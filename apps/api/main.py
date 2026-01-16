from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
from typing import Any, Dict, List, Optional, Tuple
import base64
import httpx
import json
import os
import asyncio
import time

import common
from helpers import image_processing, image_ranking, query_refining, output_builder

app = FastAPI()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"
TOPK_SIGNAL = 10

THUMB_CONCURRENCY = 6
RERANK_THRESHOLD = 0.25
SEPARATION_THRESHOLD = 0.05

@app.on_event("startup")
def _startup():
    image_processing._load_clip()


# -----------------------------
# Small helpers / primitives
# -----------------------------

def normalize_mode(mode: str) -> str:
    mode = (mode or "both").strip().lower()
    if mode not in ("active", "sold", "both"):
        raise HTTPException(status_code=400, detail="mode must be active|sold|both")
    return mode

def serp_timeout() -> httpx.Timeout:
    return httpx.Timeout(connect=5.0, read=18.0, write=10.0, pool=5.0)

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
    main_image: UploadFile,
    main_bytes: bytes,
    extra_files: List[UploadFile],
    extra_bytes_list: List[bytes],
) -> None:
    # main
    main_b64 = base64.b64encode(main_bytes).decode("utf-8")
    main_data_url = f"data:{main_image.content_type};base64,{main_b64}"
    content.append({"type": "input_image", "image_url": main_data_url})

    # extras
    for f, b in zip(extra_files, extra_bytes_list):
        b64 = base64.b64encode(b).decode("utf-8")
        data_url = f"data:{f.content_type};base64,{b64}"
        content.append({"type": "input_image", "image_url": data_url})


# -----------------------------
# Pipeline steps
# -----------------------------

async def get_initial_query(
    *,
    text: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
) -> Tuple[str, bool, Optional[dict]]:
    """
    Returns: (query, used_llm, extracted_json_if_any)
    Current behavior preserved:
      - if text provided -> query=text, used_llm=False
      - else -> call OpenAI and use first extracted search query
    """
    if text and text.strip():
        return text.strip(), False, None

    content: List[Dict[str, Any]] = [{"type": "input_text", "text": common.EXTRACTION_PROMPT}]
    attach_images_to_openai_content(content, main_image, main_bytes, files, extra_bytes)

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

    search_queries = extracted.get("search_queries") or []
    if not isinstance(search_queries, list) or not search_queries:
        raise HTTPException(
            status_code=502,
            detail={"error": "No search_queries returned by LLM", "extracted": extracted},
        )

    chosen = search_queries[0] if isinstance(search_queries[0], dict) else None
    query = chosen.get("query") if chosen else None
    if not query:
        raise HTTPException(
            status_code=502,
            detail={"error": "First search query missing 'query'", "extracted": extracted},
        )

    return query, True, extracted

async def fetch_initial_serp_results(
    *,
    query: str,
    mode: str,
) -> Tuple[Optional[dict], Optional[dict]]:
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        tasks = []
        if mode in ("active", "both"):
            tasks.append(serp_search(http, q=query, sold=False))
        if mode in ("sold", "both"):
            tasks.append(serp_search(http, q=query, sold=True))

        results = await asyncio.gather(*tasks)

    if mode == "active":
        return results[0], None
    if mode == "sold":
        return None, results[0]
    return results[0], results[1]

def rerank_initial_for_signal(
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
            active_items, main_vecs, threshold=RERANK_THRESHOLD, keep_top_k=TOPK_SIGNAL
        )
    if mode in ("sold", "both") and sold_items:
        sold_ranked = image_ranking.rerank_items_by_image_similarity(
            sold_items, main_vecs, threshold=RERANK_THRESHOLD, keep_top_k=TOPK_SIGNAL
        )

    return active_ranked, sold_ranked

async def fetch_final_candidates(
    *,
    mode: str,
    refined_query: Optional[str],
    initial_active_items: List[dict],
    initial_sold_items: List[dict],
) -> Dict[str, Any]:
    # If refined query exists: requery (no embed/rerank), else return initial 50s
    if not refined_query:
        return {
            "active_top50": [output_builder.slim_item(it) for it in initial_active_items[:50]] if initial_active_items else [],
            "sold_top50": [output_builder.slim_item(it) for it in initial_sold_items[:50]] if initial_sold_items else [],
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

    return {
        "active_top50": [output_builder.slim_item(it) for it in active_items_ref[:50]] if active_items_ref else [],
        "sold_top50": [output_builder.slim_item(it) for it in sold_items_ref[:50]] if sold_items_ref else [],
    }

# -----------------------------
# Endpoint orchestrator
# -----------------------------

@app.post("/api/py/extract-file")
async def extract_from_files(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),  # "active" | "sold" | "both"
):
    t0 = time.time()
    mode = normalize_mode(mode)

    try:
        # 1) Read images
        main_bytes, extra_bytes = await image_processing.read_images(main_image, files)

        # 2) Embed main image early (needed regardless)
        try:
            main_vecs = await image_processing.embed_main_image(main_bytes)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed main image embedding: {str(e)}"})

        # 3) Initial query (text-first else LLM)
        query, used_llm, _extracted = await get_initial_query(
            text=text,
            main_image=main_image,
            main_bytes=main_bytes,
            files=files,
            extra_bytes=extra_bytes,
        )

        # 4) Initial Serp results
        serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
        active_items = extract_items(serp_active)
        sold_items = extract_items(serp_sold)

        # 5) Embed small subset thumbnails (initial only)
        await image_processing.embed_initial_thumbnails_if_needed(active_items=active_items, sold_items=sold_items, mode=mode)

        # 6) Rerank for signal + refining decision
        active_ranked, sold_ranked = rerank_initial_for_signal(
            active_items=active_items, sold_items=sold_items, main_vecs=main_vecs, mode=mode
        )

        # 7) Refine query if confident
        refined_query = await query_refining.refine_query_if_confident(
            original_query=query,
            active_items=active_items,
            sold_items=sold_items,
            main_vecs=main_vecs,
        )

        # 8) Final candidates: refined if exists else initial
        final_candidates = await fetch_final_candidates(
            mode=mode,
            refined_query=refined_query,
            initial_active_items=active_items,
            initial_sold_items=sold_items,
        )

        # 9) Strip heavy
        if active_ranked and active_ranked.get("filtered_items"):
            output_builder.strip_heavy_fields(active_items, active_ranked["filtered_items"])
        else:
            output_builder.strip_heavy_fields(active_items)

        if sold_ranked and sold_ranked.get("filtered_items"):
            output_builder.strip_heavy_fields(sold_items, sold_ranked["filtered_items"])
        else:
            output_builder.strip_heavy_fields(sold_items)

        response = output_builder.build_response(
            mode=mode,
            main_vecs=main_vecs,
            initial_query=query,
            refined_query=refined_query,
            active_ranked=active_ranked,
            sold_ranked=sold_ranked,
            final_candidates=final_candidates,
            used_llm=used_llm,
        )

        response["timing_sec"] = round(time.time() - t0, 3)
        return JSONResponse(output_builder.json_sanitize(response))

    except HTTPException as e:
        # HTTPException.detail may be dict; keep it.
        return JSONResponse(status_code=e.status_code, content=e.detail if isinstance(e.detail, dict) else {"error": str(e.detail)})
    except httpx.TimeoutException as e:
        return JSONResponse(status_code=504, content={"error": "Timeout during marketplace query", "detail": str(e)})
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"error": "HTTP error during marketplace query", "detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Unhandled server error", "detail": str(e)})
