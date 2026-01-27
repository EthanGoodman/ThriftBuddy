from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAI
from typing import Any, Dict, List, Optional, Tuple
import base64
import httpx
import json
import os
import asyncio
import time

from helpers import image_processing, image_ranking, query_refining, output_builder, LLM_Helper
from auth.routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.include_router(auth_router, prefix="/auth", tags=["auth"])

from dotenv import load_dotenv
load_dotenv() 

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    main_b64 = base64.b64encode(main_bytes).decode("utf-8")
    main_data_url = f"data:{main_image.content_type};base64,{main_b64}"
    content.append({"type": "input_image", "image_url": main_data_url})

    for f, b in zip(extra_files, extra_bytes_list):
        b64 = base64.b64encode(b).decode("utf-8")
        data_url = f"data:{f.content_type};base64,{b64}"
        content.append({"type": "input_image", "image_url": data_url})


async def get_initial_query(
    *,
    itemName: Optional[str],
    text: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
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
    )
    return llm_query


async def fetch_initial_serp_results(*, query: str, mode: str) -> Tuple[Optional[dict], Optional[dict]]:
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

    if mode in ("active", "both") and active_items_ref:
        await image_processing.embed_thumbnails_for_items(active_items_ref, max_items=50, concurrency=image_processing.THUMB_CONCURRENCY)
        active_ranked_final = image_ranking.rerank_items_by_image_similarity(
            active_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=FINAL_KEEP_TOP_K,
        )
        active_filtered = active_ranked_final["filtered_items"]
    else:
        active_filtered = []

    if mode in ("sold", "both") and sold_items_ref:
        await image_processing.embed_thumbnails_for_items(sold_items_ref, max_items=50, concurrency=image_processing.THUMB_CONCURRENCY)
        sold_ranked_final = image_ranking.rerank_items_by_image_similarity(
            sold_items_ref,
            main_vecs,
            threshold=FINAL_SIMILARITY_MIN,
            keep_top_k=FINAL_KEEP_TOP_K,
        )
        sold_filtered = sold_ranked_final["filtered_items"]
    else:
        sold_filtered = []

    return {
        "active_ranked": active_ranked_final if mode in ("active", "both") else None,
        "sold_ranked": sold_ranked_final if mode in ("sold", "both") else None,
        "active_items_ref": active_items_ref,
        "sold_items_ref": sold_items_ref,
    }



@app.post("/api/py/extract-file")
async def extract_from_files(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    itemName: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),  # "active" | "sold" | "both"
    include_debug: bool = Form(False),
):
    t0 = time.time()
    mode = normalize_mode(mode)

    try:
        # 1) Read images
        main_bytes, extra_bytes = await image_processing.read_images(main_image, files)

        # 2) Embed main image (always needed)
        main_vecs = await image_processing.embed_main_image(main_bytes)

        initial_time = time.time()
        # 3) Initial query (text-first else LLM)
        query, used_llm, _extracted = await get_initial_query(
            itemName=itemName,
            text=text,
            main_image=main_image,
            main_bytes=main_bytes,
            files=files,
            extra_bytes=extra_bytes,
        )
        print("LLM: ", time.time() - initial_time)

        # 4) Initial Serp results
        serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
        active_items = extract_items(serp_active)
        sold_items = extract_items(serp_sold)

        initial_time = time.time()
        # 5) Embed a small subset of thumbnails
        await image_processing.embed_initial_thumbnails_if_needed(active_items=active_items, sold_items=sold_items, mode=mode)

        # 6) Rerank for similarity signal
        active_ranked, sold_ranked = rerank_initial_for_signal(
            active_items=active_items, sold_items=sold_items, main_vecs=main_vecs, mode=mode
        )
        print("Image embedding and reranking: ", time.time() - initial_time)

        initial_time = time.time()
        # 7) Refine query if confident (based on image similarity)
        refined_query = await query_refining.refine_query_if_confident(
            original_query=query,
            active_items=active_items,
            sold_items=sold_items,
            main_vecs=main_vecs,
        )

        # 7.5) If user text was weak (no refined_query), fallback to LLM
        fallback_llm_query = await maybe_fallback_to_llm_when_text_fails(
            original_text=text,
            refined_query=refined_query,
            main_image=main_image,
            main_bytes=main_bytes,
            files=files,
            extra_bytes=extra_bytes,
        )

        if fallback_llm_query:
            print("here")
            query = fallback_llm_query
            used_llm = True

            serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
            active_items = extract_items(serp_active)
            sold_items = extract_items(serp_sold)

            await image_processing.embed_initial_thumbnails_if_needed(active_items=active_items, sold_items=sold_items, mode=mode)
            active_ranked, sold_ranked = rerank_initial_for_signal(
                active_items=active_items, sold_items=sold_items, main_vecs=main_vecs, mode=mode
            )
            refined_query = await query_refining.refine_query_if_confident(
                original_query=query,
                active_items=active_items,
                sold_items=sold_items,
                main_vecs=main_vecs,
            )

        # 8) Final candidates (refined if exists, else initial)
        final_candidates = await fetch_final_candidates(
            mode=mode,
            refined_query=refined_query,
            initial_active_items=active_items,
            initial_sold_items=sold_items,
            main_vecs=main_vecs,
        )

        if refined_query:
            active_ranked = final_candidates.get("active_ranked") or active_ranked
            sold_ranked = final_candidates.get("sold_ranked") or sold_ranked
            active_items = final_candidates.get("active_items_ref") or active_items
            sold_items = final_candidates.get("sold_items_ref") or sold_items

        print("Refining search: ", time.time() - initial_time)

        # Strip heavy fields before returning
        if active_ranked and active_ranked.get("filtered_items"):
            output_builder.strip_heavy_fields(active_items, active_ranked["filtered_items"])
        else:
            output_builder.strip_heavy_fields(active_items)

        if sold_ranked and sold_ranked.get("filtered_items"):
            output_builder.strip_heavy_fields(sold_items, sold_ranked["filtered_items"])
        else:
            output_builder.strip_heavy_fields(sold_items)

        # ✅ Frontend-friendly payload ONLY
        frontend = output_builder.build_frontend_payload(
            mode=mode,
            initial_query=query,
            refined_query=refined_query,
            active_ranked=active_ranked,
            sold_ranked=sold_ranked,
        )
        frontend["timing_sec"] = round(time.time() - t0, 3)

        # ✅ Debug payload on demand
        if include_debug:
            debug = output_builder.build_response(
                mode=mode,
                main_vecs=main_vecs,
                initial_query=query,
                refined_query=refined_query,
                active_ranked=active_ranked,
                sold_ranked=sold_ranked,
                final_candidates=final_candidates,
                used_llm=used_llm,
            )
            debug["timing_sec"] = frontend["timing_sec"]
            print(output_builder.json_sanitize({"data": frontend, "debug": debug}))
            return JSONResponse(output_builder.json_sanitize({"data": frontend, "debug": debug}))

        return JSONResponse(output_builder.json_sanitize(frontend))

    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content=e.detail if isinstance(e.detail, dict) else {"error": str(e.detail)},
        )
    except httpx.TimeoutException as e:
        return JSONResponse(status_code=504, content={"error": "Timeout during marketplace query", "detail": str(e)})
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"error": "HTTP error during marketplace query", "detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Unhandled server error", "detail": str(e)})


def _ndjson(obj: Any) -> str:
    return json.dumps(output_builder.json_sanitize(obj)) + "\n"


@app.post("/api/py/extract-file-stream")
async def extract_from_files_stream(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    itemName: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),  # "active" | "sold" | "both"
):
    t0 = time.time()
    mode = normalize_mode(mode)

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

            # read + embed main are part of query generation "prep"
            main_bytes, extra_bytes = await image_processing.read_images(main_image, files)
            main_vecs = await image_processing.embed_main_image(main_bytes)

            query, used_llm, _extracted = await get_initial_query(
                itemName=itemName,
                text=text,
                main_image=main_image,
                main_bytes=main_bytes,
                files=files,
                extra_bytes=extra_bytes,
            )

            async for chunk in emit("gen_query", "Generating marketplace query", "done", 0.25, detail=("used LLM" if used_llm else "used input")):
                yield chunk

            # --- STEP 2: Querying marketplaces (initial) ---
            async for chunk in emit("query_mkt", "Querying marketplaces", "start", 0.28):
                yield chunk

            serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
            active_items = extract_items(serp_active)
            sold_items = extract_items(serp_sold)

            async for chunk in emit("query_mkt", "Querying marketplaces", "done", 0.50, detail=f"active={len(active_items)} sold={len(sold_items)}"):
                yield chunk

            # --- STEP 3: Processing item images (embed thumbs + rerank) ---
            async for chunk in emit("proc_imgs", "Processing item images", "start", 0.52):
                yield chunk

            await image_processing.embed_initial_thumbnails_if_needed(
                active_items=active_items,
                sold_items=sold_items,
                mode=mode
            )

            active_ranked, sold_ranked = rerank_initial_for_signal(
                active_items=active_items,
                sold_items=sold_items,
                main_vecs=main_vecs,
                mode=mode
            )

            async for chunk in emit("proc_imgs", "Processing item images", "done", 0.75):
                yield chunk

            # --- STEP 4: Refining search query ---
            async for chunk in emit("refine", "Refining search query", "start", 0.78):
                yield chunk

            refined_query = await query_refining.refine_query_if_confident(
                original_query=query,
                active_items=active_items,
                sold_items=sold_items,
                main_vecs=main_vecs,
            )

            # optional fallback (still within refine step)
            fallback_llm_query = await maybe_fallback_to_llm_when_text_fails(
                original_text=text,
                refined_query=refined_query,
                main_image=main_image,
                main_bytes=main_bytes,
                files=files,
                extra_bytes=extra_bytes,
            )

            if fallback_llm_query:
                query = fallback_llm_query
                used_llm = True

                serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
                active_items = extract_items(serp_active)
                sold_items = extract_items(serp_sold)

                await image_processing.embed_initial_thumbnails_if_needed(active_items=active_items, sold_items=sold_items, mode=mode)
                active_ranked, sold_ranked = rerank_initial_for_signal(
                    active_items=active_items, sold_items=sold_items, main_vecs=main_vecs, mode=mode
                )

                refined_query = await query_refining.refine_query_if_confident(
                    original_query=query,
                    active_items=active_items,
                    sold_items=sold_items,
                    main_vecs=main_vecs,
                )

            async for chunk in emit("refine", "Refining search query", "done", 0.88, detail=(refined_query or "no refinement")):
                yield chunk

            # --- STEP 5: Re-querying marketplaces (only if refined_query exists) ---
            if refined_query:
                async for chunk in emit("requery", "Re-querying marketplaces", "start", 0.90):
                    yield chunk

            final_candidates = await fetch_final_candidates(
                mode=mode,
                refined_query=refined_query,
                initial_active_items=active_items,
                initial_sold_items=sold_items,
                main_vecs=main_vecs,
            )

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


