from typing import Any, Dict, List, Optional, Tuple
from fastapi import UploadFile
import httpx
import asyncio
import os

CLIP_URL = os.environ["CLIP_URL"].rstrip("/")

# ---- Thumbnail embedding cache (in-memory) ----
# Key: product_id (str) OR thumbnail URL as fallback
_THUMB_EMBED_CACHE: Dict[str, List[List[float]]] = {}

# ---- Image Embedding (OpenCLIP) ----
MAIN_CROPS = [1.0, 0.85]
EMBED_MAX_INITIAL = 50
THUMB_CONCURRENCY = 6

async def embed_initial_thumbnails_if_needed(
    *,
    active_items: List[dict],
    sold_items: List[dict],
    mode: str,
) -> None:
    if mode in ("active", "both") and active_items:
        await embed_thumbnails_for_items(
            active_items, max_items=EMBED_MAX_INITIAL, concurrency=THUMB_CONCURRENCY
        )
    if mode in ("sold", "both") and sold_items:
        await embed_thumbnails_for_items(
            sold_items, max_items=EMBED_MAX_INITIAL, concurrency=THUMB_CONCURRENCY
        )

async def read_images(
    main_image: UploadFile,
    files: List[UploadFile],
) -> Tuple[bytes, List[bytes]]:
    main_bytes = await main_image.read()
    extra_bytes = []
    for f in files:
        extra_bytes.append(await f.read())
    return main_bytes, extra_bytes

async def embed_main_image(main_bytes: bytes) -> List[List[float]]:
    return await clip_embed_bytes(main_bytes, crops=MAIN_CROPS)


async def embed_thumbnails_for_items(
    items: List[Dict[str, Any]],
    *,
    max_items: int = 50,
    concurrency: int = 10,
) -> Dict[str, Any]:
    """
    For the first `max_items` items:
      - downloads thumbnail bytes
      - computes CLIP embedding (normalized)
      - caches by product_id (preferred) or thumbnail URL
    Mutates each item by attaching:
      item["_thumb_embed_status"] = "ok" | "no_thumbnail" | "download_failed" | "embed_failed"
      item["_thumb_embedding"] = [floats]   (only if ok)
    Returns a small summary.
    """
    target_items = items[:max_items]

    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient() as http:
        async def process_item(it: Dict[str, Any]) -> None:
            thumb_url = it.get("thumbnail")
            if not isinstance(thumb_url, str) or not thumb_url.strip():
                it["_thumb_embed_status"] = "no_thumbnail"
                return

            cache_key = str(it.get("product_id") or thumb_url)
            cached = _THUMB_EMBED_CACHE.get(cache_key)
            if cached is not None:
                it["_thumb_embedding"] = cached
                it["_thumb_embed_status"] = "ok_cached"
                return

            async with sem:
                img_bytes = await fetch_image_bytes(thumb_url, http)

            if img_bytes is None:
                it["_thumb_embed_status"] = "download_failed"
                return

            try:
                vecs = await clip_embed_bytes(img_bytes, crops=[1.0, 0.85])
                _THUMB_EMBED_CACHE[cache_key] = vecs
                it["_thumb_embedding"] = vecs
                it["_thumb_embed_status"] = "ok"
            except Exception:
                it["_thumb_embed_status"] = "embed_failed"

        await asyncio.gather(*(process_item(it) for it in target_items))

    # summary counts
    counts: Dict[str, int] = {}
    for it in target_items:
        s = it.get("_thumb_embed_status", "unknown")
        counts[s] = counts.get(s, 0) + 1

    return {"processed": len(target_items), "status_counts": counts}

async def fetch_image_bytes(url: str, http: httpx.AsyncClient) -> Optional[bytes]:
    """
    Download image bytes. Returns None on failure.
    """
    try:
        r = await http.get(url, timeout=10.0, follow_redirects=True)
        r.raise_for_status()
        # basic sanity: only accept reasonably sized images
        if not r.content or len(r.content) < 50:
            return None
        return r.content
    except Exception:
        return None
    
async def clip_embed_bytes(img_bytes: bytes, *, crops: List[float]) -> List[List[float]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        files = {"image": ("image.jpg", img_bytes, "image/jpeg")}
        r = await client.post(f"{CLIP_URL}/embed", files=files)
        r.raise_for_status()
        return r.json()["embeddings"]

    