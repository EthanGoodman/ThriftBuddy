from io import BytesIO
from typing import List, Optional

from contextlib import nullcontext
import httpx
import open_clip
import torch
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, HttpUrl

_CLIP_MODEL = None
_CLIP_PREPROCESS = None
_CLIP_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAIN_CROPS = [1.0, 0.85]
FAST_CROPS = [1.0]


class Candidate(BaseModel):
    title: str
    image: HttpUrl


class BestMatchRequest(BaseModel):
    query_image: HttpUrl
    candidates: List[Candidate]


def _avg_vec(vecs: List[List[float]]) -> List[float]:
    if not vecs:
        return []
    dim = len(vecs[0])
    out = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            out[i] += x
    out = [x / len(vecs) for x in out]
    norm = sum(x * x for x in out) ** 0.5
    return [x / norm for x in out] if norm else out


def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _crop_image(img: Image.Image, frac: float) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    crop_side = max(1, int(side * float(frac)))
    left = (w - crop_side) // 2
    top = (h - crop_side) // 2
    return img.crop((left, top, left + crop_side, top + crop_side))


def load_clip():
    global _CLIP_MODEL, _CLIP_PREPROCESS
    if _CLIP_MODEL is not None:
        return _CLIP_MODEL, _CLIP_PREPROCESS

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


def warm_model() -> None:
    load_clip()


def image_bytes_to_embeddings_multicrop(img_bytes: bytes, crops: List[float]) -> List[List[float]]:
    model, preprocess = load_clip()
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    vectors: List[List[float]] = []
    for frac in crops:
        cropped = _crop_image(img, frac)
        image_tensor = preprocess(cropped).unsqueeze(0).to(_CLIP_DEVICE)
        autocast_ctx = torch.autocast(device_type="cuda", dtype=torch.float16) if _CLIP_DEVICE == "cuda" else nullcontext()
        with torch.no_grad(), autocast_ctx:
            feats = model.encode_image(image_tensor)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        vectors.append(feats[0].cpu().tolist())

    return vectors or [[]]


def image_bytes_batch_to_embeddings(
    images: List[bytes],
    crops: List[float],
) -> List[Optional[List[List[float]]]]:
    model, preprocess = load_clip()
    decoded: List[Optional[Image.Image]] = []

    for b in images:
        try:
            with Image.open(BytesIO(b)) as im:
                decoded.append(im.convert("RGB"))
        except Exception:
            decoded.append(None)

    out: List[List[List[float]]] = [[] for _ in images]
    valid_indices = [i for i, img in enumerate(decoded) if img is not None]
    if not valid_indices:
        return [None for _ in images]

    autocast_ctx = torch.autocast(device_type="cuda", dtype=torch.float16) if _CLIP_DEVICE == "cuda" else nullcontext()
    with torch.no_grad(), autocast_ctx:
        for frac in crops:
            batch_inputs = [preprocess(_crop_image(decoded[i], frac)) for i in valid_indices]
            image_batch = torch.stack(batch_inputs, dim=0).to(_CLIP_DEVICE)
            feats = model.encode_image(image_batch)
            feats = feats / feats.norm(dim=-1, keepdim=True)
            vecs = feats.cpu().tolist()
            for idx, vec in zip(valid_indices, vecs):
                out[idx].append(vec)

    final: List[Optional[List[List[float]]]] = []
    for i, img in enumerate(decoded):
        if img is None:
            final.append(None)
        else:
            final.append(out[i] or [[]])
    return final


async def best_match(req: BestMatchRequest):
    if not req.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided")
    if len(req.candidates) > 10:
        raise HTTPException(status_code=400, detail="Max 10 candidates")

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as http:
        q_img = await http.get(str(req.query_image))
        q_img.raise_for_status()

        try:
            q_vecs = image_bytes_to_embeddings_multicrop(q_img.content, MAIN_CROPS)
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=400, detail="Query image could not be decoded")

        q = _avg_vec(q_vecs)

        best = {"title": None, "score": -1.0}
        usable = 0
        skipped = 0

        for c in req.candidates:
            try:
                r = await http.get(str(c.image))
                r.raise_for_status()
            except Exception:
                skipped += 1
                continue

            try:
                vecs = image_bytes_to_embeddings_multicrop(r.content, MAIN_CROPS)
            except (UnidentifiedImageError, OSError, ValueError):
                skipped += 1
                continue

            v = _avg_vec(vecs)
            score = _dot(q, v)
            usable += 1

            if score > best["score"]:
                best = {"title": c.title, "score": score}

    if usable == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "No decodable candidate images", "skipped": skipped},
        )

    return {
        "best_title": best["title"],
        "score": best["score"],
        "usable_candidates": usable,
        "skipped": skipped,
    }
