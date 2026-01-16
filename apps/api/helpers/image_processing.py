from typing import Any, Dict, List, Optional, Tuple
from fastapi import UploadFile
import httpx
from PIL import Image
from io import BytesIO
import torch
import open_clip
import asyncio
import anyio

# ---- Thumbnail embedding cache (in-memory) ----
# Key: product_id (str) OR thumbnail URL as fallback
_THUMB_EMBED_CACHE: Dict[str, List[List[float]]] = {}

# ---- Image Embedding (OpenCLIP) ----
_CLIP_MODEL = None
_CLIP_PREPROCESS = None
_CLIP_TOKENIZER = None
_CLIP_DEVICE = "cpu"  # keep CPU for now (safe default)
MAIN_CROPS = [1.0, 0.85]
EMBED_MAX_INITIAL = 50
THUMB_CONCURRENCY = 6

def _load_clip():
    """
    Lazy-load and cache the CLIP model + preprocess.
    """
    global _CLIP_MODEL, _CLIP_PREPROCESS, _CLIP_TOKENIZER, _CLIP_DEVICE

    if _CLIP_MODEL is not None:
        return _CLIP_MODEL, _CLIP_PREPROCESS

    # Good default: ViT-B-32 pretrained on LAION2B (common + solid)
    model_name = "ViT-B-32"
    pretrained = "laion2b_s34b_b79k"

    model, _, preprocess = open_clip.create_model_and_transforms(
        model_name=model_name,
        pretrained=pretrained,
    )
    model.eval()
    model.to(_CLIP_DEVICE)

    _CLIP_MODEL = model
    _CLIP_PREPROCESS = preprocess
    return _CLIP_MODEL, _CLIP_PREPROCESS

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
    return await image_bytes_to_embeddings_multicrop_async(
        main_bytes, crops=MAIN_CROPS
    )

async def image_bytes_to_embeddings_multicrop_async(img_bytes: bytes, *, crops: List[float]) -> List[List[float]]:
    return await anyio.to_thread.run_sync(
        lambda: image_bytes_to_embeddings_multicrop(img_bytes, crops=crops)
    )

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
                vecs = await image_bytes_to_embeddings_multicrop_async(img_bytes, crops=[1.0, 0.85])
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

def image_bytes_to_embedding(img_bytes: bytes) -> List[float]:
    """
    Converts image bytes to a normalized CLIP embedding vector.
    Returns a Python list[float] so it's JSON-serializable.
    """
    model, preprocess = _load_clip()

    # Decode image
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    # Preprocess -> tensor [1, 3, H, W]
    image_tensor = preprocess(img).unsqueeze(0).to(_CLIP_DEVICE)

    with torch.no_grad():
        feats = model.encode_image(image_tensor)  # [1, D]
        feats = feats / feats.norm(dim=-1, keepdim=True)  # normalize for cosine similarity
        vec = feats[0].cpu().tolist()

    return vec

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
    
def image_bytes_to_embeddings_multicrop(
    img_bytes: bytes,
    *,
    crops: List[float] = [1.0, 0.85, 0.65],  # full, medium center crop, tight center crop
) -> List[List[float]]:
    """
    Returns multiple normalized CLIP embeddings for multiple center crops.

    crops: list of fractions of the shorter side to keep (1.0 = full image)
    """
    model, preprocess = _load_clip()

    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    w, h = img.size
    side = min(w, h)

    vectors: List[List[float]] = []

    for frac in crops:
        frac = float(frac)
        if frac <= 0 or frac > 1.0:
            continue

        crop_side = max(1, int(side * frac))
        left = (w - crop_side) // 2
        top = (h - crop_side) // 2
        right = left + crop_side
        bottom = top + crop_side

        cropped = img.crop((left, top, right, bottom))

        image_tensor = preprocess(cropped).unsqueeze(0).to(_CLIP_DEVICE)

        with torch.no_grad():
            feats = model.encode_image(image_tensor)  # [1, D]
            feats = feats / feats.norm(dim=-1, keepdim=True)  # normalize
            vec = feats[0].cpu().tolist()

        vectors.append(vec)

    # Fallback if something weird happened
    if not vectors:
        vectors = [image_bytes_to_embedding(img_bytes)]

    return vectors

