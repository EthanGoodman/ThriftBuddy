# apps/clip_service/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List
from io import BytesIO
from PIL import Image, UnidentifiedImageError
import torch
import open_clip
import asyncio
from pydantic import BaseModel, HttpUrl
import httpx

app = FastAPI()

_CLIP_MODEL = None
_CLIP_PREPROCESS = None
_CLIP_DEVICE = "cpu"
MAIN_CROPS = [1.0, 0.85]

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



def _load_clip():
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

@app.on_event("startup")
def warm_model():
    _load_clip()

def image_bytes_to_embeddings_multicrop(img_bytes: bytes, crops: List[float]) -> List[List[float]]:
    model, preprocess = _load_clip()
    img = Image.open(BytesIO(img_bytes)).convert("RGB")
    w, h = img.size
    side = min(w, h)

    vectors: List[List[float]] = []
    for frac in crops:
        crop_side = max(1, int(side * float(frac)))
        left = (w - crop_side) // 2
        top = (h - crop_side) // 2
        cropped = img.crop((left, top, left + crop_side, top + crop_side))

        image_tensor = preprocess(cropped).unsqueeze(0).to(_CLIP_DEVICE)
        with torch.no_grad():
            feats = model.encode_image(image_tensor)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        vectors.append(feats[0].cpu().tolist())

    return vectors or [[]]

@app.post("/embed")
async def embed(image: UploadFile = File(...)):
    b = await image.read()
    if not b:
        raise HTTPException(status_code=400, detail="Empty image upload")
    vecs = image_bytes_to_embeddings_multicrop(b, crops=MAIN_CROPS)
    return {"embeddings": vecs, "crops": MAIN_CROPS}

@app.post("/embed_batch")
async def embed_batch(images: List[UploadFile] = File(...)):
    if not images:
        raise HTTPException(status_code=400, detail="No images uploaded")

    async def embed_one(b: bytes) -> List[List[float]]:
        # offload CPU-bound work to a thread so requests don’t block the event loop
        return await asyncio.to_thread(
            image_bytes_to_embeddings_multicrop,
            b,
            crops=MAIN_CROPS
        )

    results = []
    for img in images:
        b = await img.read()
        if not b:
            results.append({"ok": False, "embeddings": [], "error": "empty"})
            continue
        try:
            vecs = await embed_one(b)
            results.append({"ok": True, "embeddings": vecs})
        except Exception:
            results.append({"ok": False, "embeddings": [], "error": "embed_failed"})

    return {"results": results, "crops": MAIN_CROPS}

@app.post("/best_match")
async def best_match(req: BestMatchRequest):
    if not req.candidates:
        raise HTTPException(status_code=400, detail="No candidates provided")
    if len(req.candidates) > 10:
        raise HTTPException(status_code=400, detail="Max 10 candidates")

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as http:
        # ---- embed query image ----
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

        # ---- embed candidates ----
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

    return {"best_title": best["title"], "score": best["score"], "usable_candidates": usable, "skipped": skipped}
