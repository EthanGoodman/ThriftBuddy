from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import asyncio
import httpx
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

# ---- Thumbnail embedding cache (in-memory) ----
# Key: product_id (str) OR thumbnail URL as fallback
_THUMB_EMBED_CACHE: Dict[str, List[List[float]]] = {}

# ---- Image Embedding (OpenCLIP) ----
MAIN_CROPS = [1.0, 0.85]
EMBED_MAX_INITIAL = 50
THUMB_CONCURRENCY = 6
_CLIP_SERVICE = None


def set_clip_service(clip_service_module: Any) -> None:
    global _CLIP_SERVICE
    _CLIP_SERVICE = clip_service_module


def _get_clip_service() -> Any:
    if _CLIP_SERVICE is None:
        raise RuntimeError("CLIP service is not initialized. Ensure startup hook sets it.")
    return _CLIP_SERVICE


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


def _convert_to_jpeg(img_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(img_bytes)) as im:
            im.load()
            if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
                base = Image.new("RGBA", im.size, (255, 255, 255, 255))
                base.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
                im = base.convert("RGB")
            else:
                im = im.convert("RGB")
            out = BytesIO()
            im.save(out, format="JPEG", quality=92, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid image file", "detail": "Could not read the uploaded image."},
        )


def _normalize_image_bytes(img_bytes: bytes, content_type: str | None) -> Tuple[bytes, str]:
    if not img_bytes:
        raise HTTPException(
            status_code=400,
            detail={"error": "Empty image file", "detail": "Uploaded image was empty."},
        )

    if content_type in ALLOWED_IMAGE_TYPES:
        return img_bytes, content_type

    converted = _convert_to_jpeg(img_bytes)
    return converted, "image/jpeg"


async def read_images(
    main_image: UploadFile,
    files: List[UploadFile],
) -> Tuple[bytes, List[bytes], str, List[str]]:
    main_bytes = await main_image.read()
    main_bytes, main_content_type = _normalize_image_bytes(main_bytes, main_image.content_type)

    extra_bytes: List[bytes] = []
    extra_types: List[str] = []
    for f in files:
        b = await f.read()
        b, ctype = _normalize_image_bytes(b, f.content_type)
        extra_bytes.append(b)
        extra_types.append(ctype)

    return main_bytes, extra_bytes, main_content_type, extra_types


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
                return it, None, cache_key

            async with sem:
                img_bytes = await fetch_image_bytes(thumb_url, http)

            if img_bytes is None:
                it["_thumb_embed_status"] = "download_failed"
                return it, None, None

            return it, img_bytes, cache_key

        downloaded = await asyncio.gather(*(download_one(it) for it in target_items))

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

        embeds = await clip_embed_batch_bytes(
            to_embed_bytes,
            batch_size=batch_size,
        )

        for it, cache_key, vecs in zip(to_embed_items, to_embed_keys, embeds):
            if vecs is None:
                it["_thumb_embed_status"] = "embed_failed"
                continue
            _THUMB_EMBED_CACHE[cache_key] = vecs
            it["_thumb_embedding"] = vecs
            it["_thumb_embed_status"] = "ok"

    counts: Dict[str, int] = {}
    for it in target_items:
        s = it.get("_thumb_embed_status", "unknown")
        counts[s] = counts.get(s, 0) + 1

    return {"processed": len(target_items), "status_counts": counts}


async def fetch_image_bytes(url: str, http: httpx.AsyncClient) -> Optional[bytes]:
    try:
        r = await http.get(url, timeout=10.0, follow_redirects=True)
        r.raise_for_status()
        if not r.content or len(r.content) < 50:
            return None
        return r.content
    except Exception:
        return None


async def clip_embed_bytes(img_bytes: bytes, *, crops: List[float]) -> List[List[float]]:
    clip_service = _get_clip_service()
    return await asyncio.to_thread(clip_service.image_bytes_to_embeddings_multicrop, img_bytes, crops)


async def clip_embed_batch_bytes(
    images: List[bytes],
    *,
    batch_size: int = 10,
) -> List[Optional[List[List[float]]]]:
    out: List[Optional[List[List[float]]]] = []

    for i in range(0, len(images), batch_size):
        chunk = images[i : i + batch_size]
        results = await asyncio.gather(
            *(clip_embed_bytes(b, crops=MAIN_CROPS) for b in chunk),
            return_exceptions=True,
        )

        for item in results:
            if isinstance(item, Exception):
                out.append(None)
            else:
                out.append(item)

    return out
