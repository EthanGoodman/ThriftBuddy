import math
import re
import importlib.util
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAI
from typing import Any, Counter, Dict, List, Optional, Tuple
import base64
import httpx
import json
import os
import asyncio
import time
from pathlib import Path

from helpers import image_processing, image_ranking, query_refining, output_builder, LLM_Helper
from auth.routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from helpers.r2_storage import upload_uploadfile_and_get_url


app = FastAPI()
app.include_router(auth_router, prefix="/auth", tags=["auth"])

from dotenv import load_dotenv
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

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
# For stats: keep anything above this similarity
SIMILARITY_MIN = 0.55
SEPARATION_THRESHOLD = 0.05
FINAL_SIMILARITY_MIN = 0.68  # stricter than SIMILARITY_MIN
FINAL_KEEP_TOP_K = 25        # optional: return fewer, higher quality


def normalize_mode(mode: str) -> str:
    mode = (mode or "both").strip().lower()
    if mode not in ("active", "sold", "both"):
        raise HTTPException(status_code=400, detail="mode must be active|sold|both")
    return mode


def validate_image_uploads(main_image: UploadFile, files: List[UploadFile]) -> None:
    # Only ensure uploads look like images by content type if provided.
    # Actual decoding/normalization is handled during read.
    def looks_like_image(ct: str | None) -> bool:
        return ct is None or ct.startswith("image/")

    if not looks_like_image(main_image.content_type):
        raise HTTPException(status_code=400, detail="main_image must be an image")

    for f in files:
        if not looks_like_image(f.content_type):
            raise HTTPException(status_code=400, detail=f"{f.filename or 'extra'} must be an image")


def serp_timeout() -> httpx.Timeout:
    return httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)


async def serp_search(http: httpx.AsyncClient, *, q: str, sold: bool) -> dict:
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not set")

    params = {"engine": "ebay", "_nkw": q, "_ipg": 50, "api_key": api_key}
    if sold:
        params["show_only"] = "Sold"

    r = await http.get(SERPAPI_ENDPOINT, params=params)
    r.raise_for_status()
    return r.json()


def extract_items(serp_json: Optional[dict]) -> List[dict]:
    if not serp_json:
        return []
    return serp_json.get("organic_results") or []


def attach_images_to_openai_content(
    content: List[Dict[str, Any]],
    main_bytes: bytes,
    main_content_type: str,
    extra_bytes_list: List[bytes],
    extra_content_types: List[str],
) -> None:
    main_b64 = base64.b64encode(main_bytes).decode("utf-8")
    main_data_url = f"data:{main_content_type};base64,{main_b64}"
    content.append({"type": "input_image", "image_url": main_data_url})

    for b, ctype in zip(extra_bytes_list, extra_content_types):
        b64 = base64.b64encode(b).decode("utf-8")
        data_url = f"data:{ctype};base64,{b64}"
        content.append({"type": "input_image", "image_url": data_url})


async def get_initial_query(
    *,
    itemName: Optional[str],
    text: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
    main_content_type: str,
    extra_content_types: List[str],
) -> Tuple[str, bool, Optional[dict]]:
    """
    Returns: (query, used_llm, extracted_json_if_any)
    - If text provided -> query=text, used_llm=False
    - Else -> OpenAI -> first search query
    """
    if itemName and itemName.strip():
        return itemName.strip(), False, None

    content: List[Dict[str, Any]] = [{"type": "input_text", "text": LLM_Helper.EXTRACTION_PROMPT}]
    if text and text.strip():
        content.append({"type": "input_text", "text": f"User text: {text.strip()}"})

    attach_images_to_openai_content(
        content,
        main_bytes,
        main_content_type,
        extra_bytes,
        extra_content_types,
    )

    resp = openai_client.responses.create(
        model="gpt-4o-mini",
        input=[{"role": "user", "content": content}],
        max_output_tokens=1500,
    )

    raw_text = resp.output_text
    try:
        extracted = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail={"error": "LLM did not return valid JSON", "raw_result": raw_text},
        )

    query = extracted.get("query") or None

    if not query:
        raise HTTPException(
            status_code=502,
            detail={"error": "First search query missing 'query'", "extracted": extracted},
        )

    return query, True, extracted


async def maybe_fallback_to_llm_when_text_fails(
    *,
    original_text: Optional[str],
    refined_query: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
    main_content_type: str,
    extra_content_types: List[str],
) -> Optional[str]:
    """
    If user gave text but we couldn't refine confidently, generate a new query via LLM.
    """
    if not (original_text and original_text.strip()):
        return None
    if refined_query:
        return None

    llm_query, _used_llm, _extracted = await get_initial_query(
        itemName=None,
        text=None,
        main_image=main_image,
        main_bytes=main_bytes,
        files=files,
        extra_bytes=extra_bytes,
        main_content_type=main_content_type,
        extra_content_types=extra_content_types,
    )
    return llm_query


async def fetch_initial_serp_results(*, query: str, mode: str) -> Tuple[Optional[dict], Optional[dict]]:
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        tasks = []
        if mode in ("active", "both"):
            tasks.append(serp_search(http, q=query, sold=False))
        if mode == "sold" and mode != "both":
            tasks.append(serp_search(http, q=query, sold=True))

        results = await asyncio.gather(*tasks)
    if mode in ("active", "both"):
        return results[0], None
    if mode == "sold":
        return None, results[0]
    return results[0], results[1]


async def rerank_initial_for_signal(
    *,
    active_items: List[dict],
    sold_items: List[dict],
    main_vecs: List[List[float]],
    mode: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    active_ranked = None
    sold_ranked = None

    if mode in ("active", "both") and active_items:
        active_ranked = image_ranking.rerank_items_by_image_similarity(
            active_items,
            main_vecs,
            threshold=SIMILARITY_MIN,
            keep_top_k=None,
        )
        await image_processing.enrich_top_items_with_multicrop(
            active_items,
            top_n=image_processing.MULTICROP_RERANK_TOP_N,
            concurrency=image_processing.THUMB_CONCURRENCY,
        )
        active_ranked = image_ranking.rerank_items_by_image_similarity(
            active_items,
            main_vecs,
            threshold=SIMILARITY_MIN,
            keep_top_k=None,
        )

    if mode in ("sold", "both") and sold_items:
        sold_ranked = image_ranking.rerank_items_by_image_similarity(
            sold_items,
            main_vecs,
            threshold=SIMILARITY_MIN,
            keep_top_k=None,
        )
        await image_processing.enrich_top_items_with_multicrop(
            sold_items,
            top_n=image_processing.MULTICROP_RERANK_TOP_N,
            concurrency=image_processing.THUMB_CONCURRENCY,
        )
        sold_ranked = image_ranking.rerank_items_by_image_similarity(
            sold_items,
            main_vecs,
            threshold=SIMILARITY_MIN,
            keep_top_k=None,
        )

    return active_ranked, sold_ranked



async def fetch_final_candidates(
    *,
    mode: str,
    refined_query: Optional[str],
    initial_active_items: List[dict],
    initial_sold_items: List[dict],
    main_vecs: List[List[float]],
) -> Dict[str, Any]:
    if not refined_query:
        # build ranked view from initial results so shapes match
        active_ranked_final = None
        sold_ranked_final = None

        if mode in ("active", "both") and initial_active_items:
            active_ranked_final = image_ranking.rerank_items_by_image_similarity(
                initial_active_items, main_vecs, threshold=FINAL_SIMILARITY_MIN, keep_top_k=FINAL_KEEP_TOP_K
            )
        if mode in ("sold", "both") and initial_sold_items:
            sold_ranked_final = image_ranking.rerank_items_by_image_similarity(
                initial_sold_items, main_vecs, threshold=FINAL_SIMILARITY_MIN, keep_top_k=FINAL_KEEP_TOP_K
            )

        return {
            "active_ranked": active_ranked_final,
            "sold_ranked": sold_ranked_final,
            "active_items_ref": initial_active_items,
            "sold_items_ref": initial_sold_items,
        }


    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        tasks = []
        if mode in ("active", "both"):
            tasks.append(serp_search(http, q=refined_query, sold=False))
        if mode in ("sold", "both"):
            tasks.append(serp_search(http, q=refined_query, sold=True))

        results = await asyncio.gather(*tasks)

    if mode == "active":
        serp_active_ref, serp_sold_ref = results[0], None
    elif mode == "sold":
        serp_active_ref, serp_sold_ref = None, results[0]
    else:
        serp_active_ref, serp_sold_ref = results[0], results[1]

    active_items_ref = extract_items(serp_active_ref)
    sold_items_ref = extract_items(serp_sold_ref)
    active_ranked_final = None
    sold_ranked_final = None

    if mode in ("active", "both") and active_items_ref:
        await image_processing.embed_thumbnails_for_items(
            active_items_ref,
            max_items=image_processing.EMBED_MAX_INITIAL,
            concurrency=image_processing.THUMB_CONCURRENCY,
            crops=image_processing.FAST_CROPS,
        )
        active_ranked_final = image_ranking.rerank_items_by_image_similarity(
            active_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=None,
        )
        await image_processing.enrich_top_items_with_multicrop(
            active_items_ref,
            top_n=image_processing.MULTICROP_RERANK_TOP_N,
            concurrency=image_processing.THUMB_CONCURRENCY,
        )
        active_ranked_final = image_ranking.rerank_items_by_image_similarity(
            active_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=FINAL_KEEP_TOP_K,
        )

    if mode in ("sold", "both") and sold_items_ref:
        await image_processing.embed_thumbnails_for_items(
            sold_items_ref,
            max_items=image_processing.EMBED_MAX_INITIAL,
            concurrency=image_processing.THUMB_CONCURRENCY,
            crops=image_processing.FAST_CROPS,
        )
        sold_ranked_final = image_ranking.rerank_items_by_image_similarity(
            sold_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=None,
        )
        await image_processing.enrich_top_items_with_multicrop(
            sold_items_ref,
            top_n=image_processing.MULTICROP_RERANK_TOP_N,
            concurrency=image_processing.THUMB_CONCURRENCY,
        )
        sold_ranked_final = image_ranking.rerank_items_by_image_similarity(
            sold_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=FINAL_KEEP_TOP_K,
        )

    return {
        "active_ranked": active_ranked_final if mode in ("active", "both") else None,
        "sold_ranked": sold_ranked_final if mode in ("sold", "both") else None,
        "active_items_ref": active_items_ref,
        "sold_items_ref": sold_items_ref,
    }

def _ndjson(obj: Any) -> str:
    return json.dumps(output_builder.json_sanitize(obj)) + "\n"

@app.post("/extract-file-stream")
async def extract_from_files_stream(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    itemName: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),  # "active" | "sold" | "both"
):
    t0 = time.time()
    mode = normalize_mode(mode)
    validate_image_uploads(main_image, files)

    async def gen():
        async def emit(step_id: str, label: str, status: str, pct: Optional[float] = None, detail: Optional[str] = None):
            payload = {
                "type": "step",
                "step_id": step_id,
                "label": label,
                "status": status,  # "start" | "done"
            }
            if pct is not None:
                payload["pct"] = pct
            if detail:
                payload["detail"] = detail
            yield _ndjson(payload)

        try:
            # --- STEP 1: Generating marketplace query ---
            async for chunk in emit("gen_query", "Generating marketplace query", "start", 0.02):
                yield chunk
            print("1")

            # read + embed main are part of query generation "prep"
            main_bytes, extra_bytes, main_content_type, extra_content_types = await image_processing.read_images(
                main_image, files
            )
            main_vecs = await image_processing.embed_main_image(main_bytes)

            query, used_llm, _extracted = await get_initial_query(
                itemName=itemName,
                text=text,
                main_image=main_image,
                main_bytes=main_bytes,
                files=files,
                extra_bytes=extra_bytes,
                main_content_type=main_content_type,
                extra_content_types=extra_content_types,
            )
            print("2")

            async for chunk in emit("gen_query", "Generating marketplace query", "done", 0.18):
                yield chunk

            direct_final = bool(itemName and itemName.strip())

            if direct_final:
                # When itemName is provided, skip initial SERP, initial embedding/rerank, refinement, and fallback.
                active_items = []
                sold_items = []
                active_ranked = None
                sold_ranked = None
                refined_query = query

                async for chunk in emit("query_mkt", "Querying marketplaces", "done", 0.20, detail="skipped"):
                    yield chunk
                async for chunk in emit("proc_imgs", "Processing item images", "done", 0.65, detail="skipped"):
                    yield chunk
                async for chunk in emit("refine", "Refining search query", "done", 0.80, detail="skipped"):
                    yield chunk
            else:
                # --- STEP 2: Querying marketplaces (initial) ---
                async for chunk in emit("query_mkt", "Querying marketplaces", "start", 0.20):
                    yield chunk

                serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
                active_items = extract_items(serp_active)
                sold_items = extract_items(serp_sold)
                print("3")

                async for chunk in emit("query_mkt", "Querying marketplaces", "done", 0.):
                    yield chunk

                # --- STEP 3: Processing item images (embed thumbs + rerank) ---
                async for chunk in emit("proc_imgs", "Processing item images", "start", 0.32):
                    yield chunk

                await image_processing.embed_initial_thumbnails_if_needed(
                    active_items=active_items,
                    sold_items=sold_items,
                    mode=mode
                )

                print("4")

                active_ranked, sold_ranked = await rerank_initial_for_signal(
                    active_items=active_items,
                    sold_items=sold_items,
                    main_vecs=main_vecs,
                    mode=mode
                )

                print("5")

                async for chunk in emit("proc_imgs", "Processing item images", "done", 0.65):
                    yield chunk

                # --- STEP 4: Refining search query ---
                async for chunk in emit("refine", "Refining search query", "start", 0.67):
                    yield chunk

                refined_query = await query_refining.refine_query_if_confident(
                    original_query=query,
                    active_items=active_items,
                    sold_items=sold_items,
                    main_vecs=main_vecs,
                )

                print("6")

                # optional fallback (still within refine step)
                fallback_llm_query = await maybe_fallback_to_llm_when_text_fails(
                    original_text=text,
                    refined_query=refined_query,
                    main_image=main_image,
                    main_bytes=main_bytes,
                    files=files,
                    extra_bytes=extra_bytes,
                    main_content_type=main_content_type,
                    extra_content_types=extra_content_types,
                )

                print("6")

                if fallback_llm_query:
                    query = fallback_llm_query
                    used_llm = True

                    serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
                    active_items = extract_items(serp_active)
                    sold_items = extract_items(serp_sold)

                    await image_processing.embed_initial_thumbnails_if_needed(active_items=active_items, sold_items=sold_items, mode=mode)
                    active_ranked, sold_ranked = await rerank_initial_for_signal(
                        active_items=active_items, sold_items=sold_items, main_vecs=main_vecs, mode=mode
                    )

                    refined_query = await query_refining.refine_query_if_confident(
                        original_query=query,
                        active_items=active_items,
                        sold_items=sold_items,
                        main_vecs=main_vecs,
                    )
                print("7")

                async for chunk in emit("refine", "Refining search query", "done", 0.80):
                    yield chunk

            finalStepMessage = "Re-querying marketplaces"
            if direct_final:
                finalStepMessage = "Querying marketplaces"
            # --- STEP 5: Re-querying marketplaces (only if refined_query exists) ---
            if refined_query:
                async for chunk in emit("requery", finalStepMessage, "start", 0.82):
                    yield chunk

            final_candidates = await fetch_final_candidates(
                mode=mode,
                refined_query=refined_query,
                initial_active_items=active_items,
                initial_sold_items=sold_items,
                main_vecs=main_vecs,
            )

            print("8")

            if refined_query:
                async for chunk in emit("requery", "Re-querying marketplaces", "done", 0.98):
                    yield chunk

                active_ranked = final_candidates.get("active_ranked") or active_ranked
                sold_ranked = final_candidates.get("sold_ranked") or sold_ranked
                active_items = final_candidates.get("active_items_ref") or active_items
                sold_items = final_candidates.get("sold_items_ref") or sold_items
            else:
                # If no refinement, mark requery as "done" instantly (optional, but nice for UI consistency)
                async for chunk in emit("requery", "Re-querying marketplaces", "done", 0.98, detail="skipped (no refined query)"):
                    yield chunk

            # Build payload (don’t show as a user step, just finish cleanly)
            if active_ranked and active_ranked.get("filtered_items"):
                output_builder.strip_heavy_fields(active_items, active_ranked["filtered_items"])
            else:
                output_builder.strip_heavy_fields(active_items)

            if sold_ranked and sold_ranked.get("filtered_items"):
                output_builder.strip_heavy_fields(sold_items, sold_ranked["filtered_items"])
            else:
                output_builder.strip_heavy_fields(sold_items)

            frontend = output_builder.build_frontend_payload(
                mode=mode,
                initial_query=query,
                refined_query=refined_query,
                active_ranked=active_ranked,
                sold_ranked=sold_ranked,
            )

            print("9")
            
            frontend["timing_sec"] = round(time.time() - t0, 3)

            yield _ndjson({"type": "result", "data": frontend})

        except HTTPException as e:
            yield _ndjson({
                "type": "error",
                "error": e.detail if isinstance(e.detail, dict) else {"error": str(e.detail)},
            })
        except httpx.TimeoutException as e:
            yield _ndjson({"type": "error", "error": {"error": "Timeout during marketplace query", "detail": str(e)}})
        except httpx.HTTPError as e:
            yield _ndjson({"type": "error", "error": {"error": "HTTP error during marketplace query", "detail": str(e)}})
        except Exception as e:
            yield _ndjson({"type": "error", "error": {"error": "Unhandled server error", "detail": str(e)}})

    return StreamingResponse(gen(), media_type="application/x-ndjson")


async def serp_lens_search(
    http: httpx.AsyncClient,
    *,
    image_url: str,
    type: str = "all",   # "all" | "products" | "exact_matches" | "visual_matches" | "about_this_image"
    q: str | None = None # optional refinement
) -> dict:
        api_key = os.getenv("SERPAPI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not set")

        params = {
            "engine": "google_lens",
            "url": image_url,        # REQUIRED for Lens
            "api_key": api_key,
            "type": type,
        }

        # Optional text refinement (Lens supports this)
        if q:
            params["q"] = q

        r = await http.get(SERPAPI_ENDPOINT, params=params)
        r.raise_for_status()
        return r.json()

async def fetch_google_lens_results(*, image_url: str, q: Optional[str] = None) -> dict:
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        return await serp_lens_search(http, image_url=image_url, q=q)
    
async def gpt_discern_item_from_lens(lens_json: Dict[str, Any]) -> Dict[str, Any]:
    prompt = LLM_Helper.LENS_ITEM_EXTRACTION_PROMPT.replace(
        "{{LENS_JSON}}",
        json.dumps(lens_json, ensure_ascii=False)
    )

    try:
        resp = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
            temperature=0.0,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "OpenAI request failed", "detail": str(e)},
        )

    response_text = resp.output_text

    try:
        item_data = json.loads(response_text)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Invalid JSON returned from GPT Lens extraction",
                "raw_response": response_text[:500],
            },
        )

    return item_data

async def fetch_serp_results_lens(*, query: str, mode: str):
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        tasks = []
        if mode in ("active", "both"):
            tasks.append(("active", serp_search(http, q=query, sold=False)))
        if mode in ("sold", "both"):
            tasks.append(("sold", serp_search(http, q=query, sold=True)))

        out = {"active": None, "sold": None}
        results = await asyncio.gather(*(t[1] for t in tasks))
        for (kind, _), res in zip(tasks, results):
            out[kind] = res

    return out["active"], out["sold"]

def build_lens_anchor_prompt(*, lens_prompt_template: str, trimmed_lens_json: dict, anchor_title: str) -> str:
    anchor_block = f"""
IMPORTANT CONTEXT:
- The following title is the BEST visual match selected via CLIP similarity (highest cosine similarity).
- Treat it as the primary anchor, but still verify/support using other Lens results.
ANCHOR_TITLE:
{anchor_title}
""".strip()

    base = lens_prompt_template.replace(
        "{{LENS_JSON}}",
        json.dumps(trimmed_lens_json, ensure_ascii=False)
    )
    return anchor_block + "\n\n" + base


def build_lens_candidates(lens_json: Dict[str, Any], *, limit: int = 20) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    seen: set[str] = set()

    def add_items(items: List[dict], source: str):
        nonlocal candidates
        for item in items or []:
            title = (item.get("title") or item.get("name") or "").strip()
            image = output_builder.normalize_marketplace_image_url(item.get("image") or item.get("thumbnail"))
            link = item.get("link")
            if not title or not image:
                continue
            key = f"{title}|{image}"
            if key in seen:
                continue
            seen.add(key)
            candidates.append(
                {
                    "id": f"lens_{len(candidates)}",
                    "title": title,
                    "image": image,
                    "link": link,
                    "source": source,
                }
            )
            if len(candidates) >= limit:
                break

    add_items(lens_json.get("visual_matches") or [], "visual_matches")
    if len(candidates) < limit:
        add_items(lens_json.get("products") or [], "products")
    if len(candidates) < limit:
        add_items(lens_json.get("exact_matches") or [], "exact_matches")

    return candidates[:limit]


@app.post("/extract-file-stream-lens")
async def extract_file_stream_lens_guided(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    text: Optional[str] = Form(None),
):
    try:
        image_url = await upload_uploadfile_and_get_url(main_image, prefix="tmp")

        lens_query = text.strip() if text and text.strip() else None
        lens_json_full = await fetch_google_lens_results(image_url=image_url, q=lens_query)
        candidates = build_lens_candidates(lens_json_full, limit=20)
        if not candidates:
            raise HTTPException(status_code=400, detail={"error": "No usable Google Lens matches"})

        return JSONResponse(
            {
                "image_url": image_url,
                "total": len(candidates),
                "candidates": candidates,
            }
        )
    except HTTPException:
        raise
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail={"error": "Timeout during Google Lens query", "detail": str(e)})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail={"error": "HTTP error during Google Lens query", "detail": str(e)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Unhandled server error", "detail": str(e)})


