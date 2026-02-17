from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import asyncio
import httpx
from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

MAIN_CROPS = [1.0, 0.85]
FAST_CROPS = [1.0]
EMBED_MAX_INITIAL = 25
MULTICROP_RERANK_TOP_N = 20
THUMB_CONCURRENCY = 6

_CLIP_SERVICE = None

# Keyed by product_id (preferred) or thumbnail URL.
# Value shape: {"1.00": [[...]], "1.00|0.85": [[...], [...]]}
_THUMB_EMBED_CACHE: Dict[str, Dict[str, List[List[float]]]] = {}


def set_clip_service(clip_service_module: Any) -> None:
    global _CLIP_SERVICE
    _CLIP_SERVICE = clip_service_module


def _get_clip_service() -> Any:
    if _CLIP_SERVICE is None:
        raise RuntimeError("CLIP service is not initialized. Ensure startup hook sets it.")
    return _CLIP_SERVICE


def _crops_key(crops: List[float]) -> str:
    return "|".join(f"{float(c):.2f}" for c in crops)


def _cache_key_for_item(it: Dict[str, Any]) -> Optional[str]:
    thumb_url = it.get("thumbnail")
    if not isinstance(thumb_url, str) or not thumb_url.strip():
        return None
    return str(it.get("product_id") or thumb_url)


def _cache_get(cache_key: str, crops: List[float]) -> Optional[List[List[float]]]:
    bucket = _THUMB_EMBED_CACHE.get(cache_key)
    if not bucket:
        return None

    exact = bucket.get(_crops_key(crops))
    if exact is not None:
        return exact

    if crops == FAST_CROPS:
        full = bucket.get(_crops_key(MAIN_CROPS))
        if full and len(full) >= 1:
            return [full[0]]

    return None


def _cache_put(cache_key: str, crops: List[float], vecs: List[List[float]]) -> None:
    _THUMB_EMBED_CACHE.setdefault(cache_key, {})[_crops_key(crops)] = vecs


def _apply_embedding_to_item(it: Dict[str, Any], vecs: List[List[float]], crops: List[float]) -> None:
    it["_thumb_embedding"] = vecs
    if crops == FAST_CROPS:
        it["_thumb_embedding_fast"] = vecs
    if crops == MAIN_CROPS:
        it["_thumb_embedding_full"] = vecs
    it["_thumb_embed_status"] = "ok"


async def embed_initial_thumbnails_if_needed(
    *,
    active_items: List[dict],
    sold_items: List[dict],
    mode: str,
) -> None:
    if mode in ("active", "both") and active_items:
        await embed_thumbnails_for_items(
            active_items,
            max_items=EMBED_MAX_INITIAL,
            concurrency=THUMB_CONCURRENCY,
            crops=FAST_CROPS,
        )
    if mode in ("sold", "both") and sold_items:
        await embed_thumbnails_for_items(
            sold_items,
            max_items=EMBED_MAX_INITIAL,
            concurrency=THUMB_CONCURRENCY,
            crops=FAST_CROPS,
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


async def embed_main_image(main_bytes: bytes, *, crops: Optional[List[float]] = None) -> List[List[float]]:
    use_crops = crops or MAIN_CROPS
    return await clip_embed_bytes(main_bytes, crops=use_crops)


async def embed_thumbnails_for_items(
    items: List[Dict[str, Any]],
    *,
    max_items: int = EMBED_MAX_INITIAL,
    concurrency: int = THUMB_CONCURRENCY,
    batch_size: int = 24,
    crops: Optional[List[float]] = None,
) -> Dict[str, Any]:
    use_crops = crops or MAIN_CROPS
    target_items = items[:max_items]
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient() as http:
        async def download_one(it: Dict[str, Any]) -> Tuple[Dict[str, Any], Optional[bytes], Optional[str]]:
            cache_key = _cache_key_for_item(it)
            if not cache_key:
                it["_thumb_embed_status"] = "no_thumbnail"
                return it, None, None

            cached = _cache_get(cache_key, use_crops)
            if cached is not None:
                _apply_embedding_to_item(it, cached, use_crops)
                it["_thumb_embed_status"] = "ok_cached"
                return it, None, cache_key

            async with sem:
                img_bytes = await fetch_image_bytes(it["thumbnail"], http)
            if img_bytes is None:
                it["_thumb_embed_status"] = "download_failed"
                return it, None, cache_key
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
            crops=use_crops,
            batch_size=batch_size,
        )

        for it, cache_key, vecs in zip(to_embed_items, to_embed_keys, embeds):
            if vecs is None:
                it["_thumb_embed_status"] = "embed_failed"
                continue
            _cache_put(cache_key, use_crops, vecs)
            _apply_embedding_to_item(it, vecs, use_crops)

    counts: Dict[str, int] = {}
    for it in target_items:
        s = it.get("_thumb_embed_status", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return {"processed": len(target_items), "status_counts": counts}


async def enrich_top_items_with_multicrop(
    items: List[Dict[str, Any]],
    *,
    top_n: int = MULTICROP_RERANK_TOP_N,
    concurrency: int = THUMB_CONCURRENCY,
) -> None:
    ranked = [it for it in items if it.get("_image_similarity") is not None]
    ranked.sort(key=lambda it: it.get("_image_similarity") or -1.0, reverse=True)
    top_items = ranked[:top_n]
    if not top_items:
        return
    await embed_thumbnails_for_items(
        top_items,
        max_items=top_n,
        concurrency=concurrency,
        crops=MAIN_CROPS,
    )


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
    crops: List[float],
    batch_size: int = 24,
) -> List[Optional[List[List[float]]]]:
    clip_service = _get_clip_service()
    out: List[Optional[List[List[float]]]] = []

    for i in range(0, len(images), batch_size):
        chunk = images[i : i + batch_size]
        batch_result = await asyncio.to_thread(
            clip_service.image_bytes_batch_to_embeddings,
            chunk,
            crops,
        )
        out.extend(batch_result)

    return out
