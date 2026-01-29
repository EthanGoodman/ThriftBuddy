# modal_clip_service.py
import modal

APP_NAME = "thriftbuddy-clip-service"

# ---- Container image (CPU version: easiest) ----
# Note: open-clip is "open-clip-torch" on pip.
image = (
    modal.Image.debian_slim()
    .pip_install(
        "fastapi[standard]",
        "pillow",
        "open-clip-torch",
        "torch",
    )
)

app = modal.App(APP_NAME)

# If you want GPU later, see the GPU section below.

@app.function(image=image, timeout=60)
@modal.asgi_app()
def fastapi_app():
    # IMPORTANT: import heavy libs inside the function so they’re in the Modal container
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from typing import List
    from io import BytesIO
    from PIL import Image
    import torch
    import open_clip
    import asyncio

    web_app = FastAPI()

    _CLIP_MODEL = None
    _CLIP_PREPROCESS = None
    MAIN_CROPS = [1.0, 0.85]

    def _device() -> str:
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _load_clip():
        nonlocal _CLIP_MODEL, _CLIP_PREPROCESS
        if _CLIP_MODEL is not None:
            return _CLIP_MODEL, _CLIP_PREPROCESS

        model_name = "ViT-B-32"
        pretrained = "laion2b_s34b_b79k"
        model, _, preprocess = open_clip.create_model_and_transforms(
            model_name=model_name,
            pretrained=pretrained,
        )
        model.eval()
        model.to(_device())
        _CLIP_MODEL = model
        _CLIP_PREPROCESS = preprocess
        return _CLIP_MODEL, _CLIP_PREPROCESS

    @web_app.on_event("startup")
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

            image_tensor = preprocess(cropped).unsqueeze(0).to(_device())
            with torch.no_grad():
                feats = model.encode_image(image_tensor)
                feats = feats / feats.norm(dim=-1, keepdim=True)
            vectors.append(feats[0].detach().cpu().tolist())

        return vectors or [[]]

    @web_app.post("/embed")
    async def embed(image: UploadFile = File(...)):
        b = await image.read()
        if not b:
            raise HTTPException(status_code=400, detail="Empty image upload")
        vecs = image_bytes_to_embeddings_multicrop(b, crops=MAIN_CROPS)
        return {"embeddings": vecs, "crops": MAIN_CROPS}

    @web_app.post("/embed_batch")
    async def embed_batch(images: List[UploadFile] = File(...)):
        if not images:
            raise HTTPException(status_code=400, detail="No images uploaded")

        async def embed_one(b: bytes) -> List[List[float]]:
            return await asyncio.to_thread(image_bytes_to_embeddings_multicrop, b, MAIN_CROPS)

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

    return web_app
