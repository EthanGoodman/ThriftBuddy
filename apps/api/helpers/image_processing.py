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
    batch_size: int = 10,
) -> Dict[str, Any]:
    target_items = items[:max_items]
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient() as http:
        async def download_one(it: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[bytes], Optional[str]]:
            thumb_url = it.get("thumbnail")
            if not isinstance(thumb_url, str) or not thumb_url.strip():
                it["_thumb_embed_status"] = "no_thumbnail"
                return it, None, None

            cache_key = str(it.get("product_id") or thumb_url)
            cached = _THUMB_EMBED_CACHE.get(cache_key)
            if cached is not None:
                it["_thumb_embedding"] = cached
                it["_thumb_embed_status"] = "ok_cached"
                return it, None, cache_key  # None bytes => no embed needed

            async with sem:
                img_bytes = await fetch_image_bytes(thumb_url, http)

            if img_bytes is None:
                it["_thumb_embed_status"] = "download_failed"
                return it, None, None

            return it, img_bytes, cache_key

        downloaded = await asyncio.gather(*(download_one(it) for it in target_items))

        # Build batch list for those that actually need embedding
        to_embed_items: List[Dict[str, Any]] = []
        to_embed_bytes: List[bytes] = []
        to_embed_keys: List[str] = []

        for it, b, cache_key in downloaded:
            if b is None:
                continue
            if not cache_key:
                it["_thumb_embed_status"] = "embed_failed"
                continue
            to_embed_items.append(it)
            to_embed_bytes.append(b)
            to_embed_keys.append(cache_key)

        # One shared client for all /embed_batch calls
        async with httpx.AsyncClient(timeout=30.0) as clip_client:
            embeds = await clip_embed_batch_bytes(
                to_embed_bytes,
                client=clip_client,
                batch_size=batch_size,
            )

        for it, cache_key, vecs in zip(to_embed_items, to_embed_keys, embeds):
            if vecs is None:
                it["_thumb_embed_status"] = "embed_failed"
                continue
            _THUMB_EMBED_CACHE[cache_key] = vecs
            it["_thumb_embedding"] = vecs
            it["_thumb_embed_status"] = "ok"

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

async def clip_embed_batch_bytes(
    images: List[bytes],
    *,
    client: httpx.AsyncClient,
    batch_size: int = 10,
) -> List[Optional[List[List[float]]]]:
    """
    Calls /embed_batch in chunks. Returns list aligned to `images` where each entry is:
      - embeddings (List[List[float]]) on success
      - None on failure for that image
    """
    out: List[Optional[List[List[float]]]] = []

    for i in range(0, len(images), batch_size):
        chunk = images[i : i + batch_size]

        # IMPORTANT: repeated field name "images"
        files = [
            ("images", (f"image_{i+j}.jpg", b, "image/jpeg"))
            for j, b in enumerate(chunk)
        ]

        r = await client.post(f"{CLIP_URL}/embed_batch", files=files)
        r.raise_for_status()
        payload = r.json()

        # Your clip service returns: {"results": [{"ok": bool, "embeddings": [...]}, ...], "crops": [...]}
        results = payload.get("results", [])
        for item in results:
            if item.get("ok"):
                out.append(item.get("embeddings") or [])
            else:
                out.append(None)

    return out


    