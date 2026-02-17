import asyncio
import importlib.util
import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

from auth.routes import router as auth_router
from helpers import image_processing
from helpers.extract_stream_service import build_extract_file_stream_response
from helpers.lens_service import build_extract_file_stream_lens_guided_response


app = FastAPI()
app.include_router(auth_router, prefix="/auth", tags=["auth"])

load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://thrift-buddy.vercel.app",
        "https://thriftbuddy.app",
        "https://thriftpal.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
_CLIP_SERVICE = None


def _load_clip_service_module():
    clip_path = Path(__file__).resolve().parent / "clip-service" / "clip_service.py"
    spec = importlib.util.spec_from_file_location("api_clip_service", str(clip_path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load clip service module at {clip_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@app.on_event("startup")
async def startup_clip_service() -> None:
    global _CLIP_SERVICE
    _CLIP_SERVICE = _load_clip_service_module()
    image_processing.set_clip_service(_CLIP_SERVICE)
    await asyncio.to_thread(_CLIP_SERVICE.warm_model)


@app.post("/extract-file-stream")
async def extract_from_files_stream(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    itemName: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),
):
    return await build_extract_file_stream_response(
        openai_client=openai_client,
        main_image=main_image,
        files=files,
        itemName=itemName,
        text=text,
        mode=mode,
    )


@app.post("/extract-file-stream-lens")
async def extract_file_stream_lens_guided(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    text: Optional[str] = Form(None),
):
    return await build_extract_file_stream_lens_guided_response(
        main_image=main_image,
        files=files,
        text=text,
    )
