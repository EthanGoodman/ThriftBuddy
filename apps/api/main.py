from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
from typing import Any, Dict, List, Optional
import base64
import httpx
import json
import os
import asyncio
import httpx

import common
from helpers import image_processing, image_ranking, query_refining, output_builder


app = FastAPI()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"


@app.on_event("startup")
def _startup():
    image_processing._load_clip()

async def serpapi_ebay_search(query: str, ipg: int = 50, sold: bool = False) -> dict:
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not set")

    params = {"engine": "ebay", "_nkw": query, "_ipg": ipg, "api_key": api_key}
    if sold:
        params["show_only"] = "Sold"

    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.get(SERPAPI_ENDPOINT, params=params)
        r.raise_for_status()
        return r.json()

@app.post("/api/py/extract-file")
async def extract_from_files(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    text: Optional[str] = Form(None),
    mode: str = Form("active"),  # "active" | "sold" | "both"
):
    """
    Fast(er) pipeline:
      1) OpenAI -> initial query
      2) Embed main image (CLIP)
      3) SerpApi search (active/sold) in parallel (depending on mode)
      4) Embed a SMALL subset of thumbnails on initial results ONLY
      5) Use top match title to build refined query
      6) Re-query SerpApi with refined query and return top 50 (NO thumbnail embedding/rerank again)
    """

    # ---- Speed knobs (tune) ----
    MAIN_CROPS = [1.0, 0.85]          # fewer crops = faster
    EMBED_MAX_INITIAL = 10            # thumbnails to embed per bucket on initial query
    THUMB_CONCURRENCY = 6             # moderate concurrency
    RERANK_THRESHOLD = 0.25
    TOPK_SIGNAL = 10                  # how many top matches to include as "signal"
    SIMILARITY_THRESHOLD = 0.35
    SEPARATION_THRESHOLD = 0.05

    mode = (mode or "both").strip().lower()
    if mode not in ("active", "sold", "both"):
        return JSONResponse(status_code=400, content={"error": "mode must be active|sold|both"})

    # ---- Local helper: SerpApi using one shared client ----
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

    def top_signal_block(items_ranked: Dict[str, Any]) -> Dict[str, Any]:
        # items_ranked is output of rerank_items_by_image_similarity
        top = items_ranked.get("filtered_items") or []
        return {
            "summary": {k: v for k, v in items_ranked.items() if k != "filtered_items"},
            "top_matches": [output_builder.slim_item(it) for it in top[:TOPK_SIGNAL]],
        }

    try:
        # ---- Build OpenAI content ----
        content = [{"type": "input_text", "text": common.EXTRACTION_PROMPT}]
        if text and text.strip():
            content.append({"type": "input_text", "text": text.strip()})

        # ---- Read main image and embed it (threaded) ----
        main_bytes = await main_image.read()
        try:
            main_image_vecs = await image_processing.image_bytes_to_embeddings_multicrop_async(main_bytes, crops=MAIN_CROPS)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed main image embedding: {str(e)}"})

        # Add images to OpenAI (annotation/query building only)
        main_b64 = base64.b64encode(main_bytes).decode("utf-8")
        main_data_url = f"data:{main_image.content_type};base64,{main_b64}"
        content.append({"type": "input_image", "image_url": main_data_url})

        for f in files:
            img_bytes = await f.read()
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            data_url = f"data:{f.content_type};base64,{b64}"
            content.append({"type": "input_image", "image_url": data_url})

        # ---- OpenAI -> initial query ----
        resp = openai_client.responses.create(
            model="gpt-4o-mini",
            input=[{"role": "user", "content": content}],
            max_output_tokens=1500,  # slightly smaller
        )

        raw_text = resp.output_text
        try:
            extracted = json.loads(raw_text)
        except json.JSONDecodeError:
            return JSONResponse(status_code=502, content={"error": "LLM did not return valid JSON", "raw_result": raw_text})

        search_queries = extracted.get("search_queries") or []
        if not isinstance(search_queries, list) or not search_queries:
            return JSONResponse(status_code=502, content={"error": "No search_queries returned by LLM", "extracted": extracted})

        chosen = search_queries[0] if isinstance(search_queries[0], dict) else None
        query = chosen.get("query") if chosen else None
        if not query:
            return JSONResponse(status_code=502, content={"error": "First search query missing 'query'", "chosen": chosen, "extracted": extracted})

        # ---- Serp initial: active/sold in parallel (depending on mode) ----
        # IMPORTANT: don’t use a 30s hard timeout if your proxy drops at 30.
        # Keep each hop fast. If Serp is slow, fail fast and return an error payload.
        timeout = httpx.Timeout(connect=5.0, read=18.0, write=10.0, pool=5.0)

        async with httpx.AsyncClient(timeout=timeout) as http:
            tasks = []
            if mode in ("active", "both"):
                tasks.append(serp_search(http, q=query, sold=False))
            if mode in ("sold", "both"):
                tasks.append(serp_search(http, q=query, sold=True))

            results = await asyncio.gather(*tasks)

        # Map results back
        serp_active = None
        serp_sold = None
        if mode == "active":
            serp_active = results[0]
        elif mode == "sold":
            serp_sold = results[0]
        else:
            serp_active, serp_sold = results[0], results[1]

        active_items = (serp_active.get("organic_results") or []) if serp_active else []
        sold_items = (serp_sold.get("organic_results") or []) if serp_sold else []

        # ---- Embed thumbnails (INITIAL ONLY), small subset ----
        # We only need this to compute similarity and refine the query.
        if mode in ("active", "both") and active_items:
            await image_processing.embed_thumbnails_for_items(active_items, max_items=EMBED_MAX_INITIAL, concurrency=THUMB_CONCURRENCY)
        if mode in ("sold", "both") and sold_items:
            await image_processing.embed_thumbnails_for_items(sold_items, max_items=EMBED_MAX_INITIAL, concurrency=THUMB_CONCURRENCY)

        # ---- Rerank (INITIAL ONLY), just to produce signal and pick best title ----
        active_ranked = None
        sold_ranked = None
        if mode in ("active", "both") and active_items:
            active_ranked = image_ranking.rerank_items_by_image_similarity(
                active_items, main_image_vecs, threshold=RERANK_THRESHOLD, keep_top_k=TOPK_SIGNAL
            )
        if mode in ("sold", "both") and sold_items:
            sold_ranked = image_ranking.rerank_items_by_image_similarity(
                sold_items, main_image_vecs, threshold=RERANK_THRESHOLD, keep_top_k=TOPK_SIGNAL
            )

        # ---- Query refinement: use ACTIVE if available, else SOLD ----
        refinement_source_items = []
        if active_items:
            refinement_source_items = active_items
        elif sold_items:
            refinement_source_items = sold_items

        refined_query = None
        if refinement_source_items:
            refined_query = await query_refining.maybe_refine_query_via_top_match(
                original_query=query,
                items=refinement_source_items,
                main_vecs=main_image_vecs,
                similarity_threshold=SIMILARITY_THRESHOLD,
                separation_threshold=SEPARATION_THRESHOLD,
            )

        # ---- If refined query exists: re-query SerpApi (NO embedding/rerank again) ----
        refined_candidates = None
        if refined_query:
            async with httpx.AsyncClient(timeout=timeout) as http:
                tasks2 = []
                if mode in ("active", "both"):
                    tasks2.append(serp_search(http, q=refined_query, sold=False))
                if mode in ("sold", "both"):
                    tasks2.append(serp_search(http, q=refined_query, sold=True))

                results2 = await asyncio.gather(*tasks2)

            serp_active_ref = None
            serp_sold_ref = None
            if mode == "active":
                serp_active_ref = results2[0]
            elif mode == "sold":
                serp_sold_ref = results2[0]
            else:
                serp_active_ref, serp_sold_ref = results2[0], results2[1]

            active_items_ref = (serp_active_ref.get("organic_results") or []) if serp_active_ref else []
            sold_items_ref = (serp_sold_ref.get("organic_results") or []) if serp_sold_ref else []

            refined_candidates = {
                "active_top50": [output_builder.slim_item(it) for it in active_items_ref[:50]] if active_items_ref else [],
                "sold_top50": [output_builder.slim_item(it) for it in sold_items_ref[:50]] if sold_items_ref else [],
            }

        # ---- Strip heavy embeddings before return ----
        if active_items:
            output_builder._strip_heavy_fields(active_items)
        if sold_items:
            output_builder._strip_heavy_fields(sold_items)
        if active_ranked and active_ranked.get("filtered_items"):
            output_builder._strip_heavy_fields(active_ranked["filtered_items"])
        if sold_ranked and sold_ranked.get("filtered_items"):
            output_builder._strip_heavy_fields(sold_ranked["filtered_items"])

        response: Dict[str, Any] = {
            "mode": mode,
            "main_embedding_dim": len(main_image_vecs[0]) if main_image_vecs else 0,
            "initial_query": query,
            "refined_query": refined_query,
            "initial_signal": {
                "active": top_signal_block(active_ranked) if active_ranked else None,
                "sold": top_signal_block(sold_ranked) if sold_ranked else None,
            },
            "final_candidates": refined_candidates
                if refined_candidates is not None
                else {
                    # If no refined query, still return the initial 50s
                    "active_top50": [output_builder.slim_item(it) for it in active_items[:50]] if active_items else [],
                    "sold_top50": [output_builder.slim_item(it) for it in sold_items[:50]] if sold_items else [],
                },
        }

        return JSONResponse(output_builder.json_sanitize(response))

    except httpx.TimeoutException as e:
        return JSONResponse(status_code=504, content={"error": "Timeout during marketplace query", "detail": str(e)})
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"error": "HTTP error during marketplace query", "detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Unhandled server error", "detail": str(e)})

