import asyncio
import base64
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openai import OpenAI

from helpers import LLM_Helper, image_processing, image_ranking, output_builder, query_refining
from helpers.marketplace_client import extract_items, serp_search, serp_timeout


SIMILARITY_MIN = 0.55
FINAL_SIMILARITY_MIN = 0.68
FINAL_KEEP_TOP_K = 25


def normalize_mode(mode: str) -> str:
    mode = (mode or "both").strip().lower()
    if mode not in ("active", "sold", "both"):
        raise HTTPException(status_code=400, detail="mode must be active|sold|both")
    return mode


def validate_image_uploads(main_image: UploadFile, files: List[UploadFile]) -> None:
    def looks_like_image(ct: str | None) -> bool:
        return ct is None or ct.startswith("image/")

    if not looks_like_image(main_image.content_type):
        raise HTTPException(status_code=400, detail="main_image must be an image")

    for f in files:
        if not looks_like_image(f.content_type):
            raise HTTPException(status_code=400, detail=f"{f.filename or 'extra'} must be an image")


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
    openai_client: OpenAI,
    itemName: Optional[str],
    text: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
    main_content_type: str,
    extra_content_types: List[str],
) -> Tuple[str, bool, Optional[dict]]:
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
    openai_client: OpenAI,
    original_text: Optional[str],
    refined_query: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
    main_content_type: str,
    extra_content_types: List[str],
) -> Optional[str]:
    if not (original_text and original_text.strip()):
        return None
    if refined_query:
        return None

    llm_query, _used_llm, _extracted = await get_initial_query(
        openai_client=openai_client,
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
    before = datetime.now()
    if not refined_query:
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
        print(f"Re-ranking items via similarity {datetime.now() - before}")
        return {
            "active_ranked": active_ranked_final,
            "sold_ranked": sold_ranked_final,
            "active_items_ref": initial_active_items,
            "sold_items_ref": initial_sold_items,
        }

    before = datetime.now()
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        tasks = []
        if mode in ("active", "both"):
            tasks.append(serp_search(http, q=refined_query, sold=False))
        if mode in ("sold", "both"):
            tasks.append(serp_search(http, q=refined_query, sold=True))
        results = await asyncio.gather(*tasks)
    print(f"Getting marketplace results {datetime.now() - before}")

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

    before = datetime.now()
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
    print(f"Image stuff {datetime.now() - before}")

    return {
        "active_ranked": active_ranked_final if mode in ("active", "both") else None,
        "sold_ranked": sold_ranked_final if mode in ("sold", "both") else None,
        "active_items_ref": active_items_ref,
        "sold_items_ref": sold_items_ref,
    }


def _ndjson(obj: Any) -> str:
    return json.dumps(output_builder.json_sanitize(obj)) + "\n"


async def _step_1_generate_marketplace_query(
    *,
    openai_client: OpenAI,
    main_image: UploadFile,
    files: List[UploadFile],
    itemName: Optional[str],
    text: Optional[str],
) -> Tuple[bytes, List[bytes], str, List[str], List[List[float]], str, bool, bool]:
    print("[extract] step1 start: prepare images + initial query")
    main_bytes, extra_bytes, main_content_type, extra_content_types = await image_processing.read_images(
        main_image, files
    )
    main_vecs = await image_processing.embed_main_image(main_bytes)

    query, used_llm, _extracted = await get_initial_query(
        openai_client=openai_client,
        itemName=itemName,
        text=text,
        main_image=main_image,
        main_bytes=main_bytes,
        files=files,
        extra_bytes=extra_bytes,
        main_content_type=main_content_type,
        extra_content_types=extra_content_types,
    )
    print("[extract] step1 done: initial query ready")
    direct_final = bool(itemName and itemName.strip())
    return (
        main_bytes,
        extra_bytes,
        main_content_type,
        extra_content_types,
        main_vecs,
        query,
        used_llm,
        direct_final,
    )


async def _step_2_query_initial_marketplaces(*, query: str, mode: str) -> Tuple[List[dict], List[dict]]:
    print(f"[extract] step2 start: initial marketplace query mode={mode}")
    serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
    active_items = extract_items(serp_active)
    sold_items = extract_items(serp_sold)
    print("[extract] step2 done: initial marketplace results fetched")
    return active_items, sold_items


async def _step_3_process_item_images(
    *,
    active_items: List[dict],
    sold_items: List[dict],
    mode: str,
    main_vecs: List[List[float]],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    print("[extract] step3 start: embed thumbnails + rerank")
    await image_processing.embed_initial_thumbnails_if_needed(
        active_items=active_items,
        sold_items=sold_items,
        mode=mode,
    )
    print("[extract] step3 mid: initial thumbnail embedding complete")
    active_ranked, sold_ranked = await rerank_initial_for_signal(
        active_items=active_items,
        sold_items=sold_items,
        main_vecs=main_vecs,
        mode=mode,
    )
    print("[extract] step3 done: initial rerank complete")
    return active_ranked, sold_ranked


async def _step_4_refine_query_with_optional_fallback(
    *,
    openai_client: OpenAI,
    query: str,
    used_llm: bool,
    text: Optional[str],
    main_image: UploadFile,
    main_bytes: bytes,
    files: List[UploadFile],
    extra_bytes: List[bytes],
    main_content_type: str,
    extra_content_types: List[str],
    active_items: List[dict],
    sold_items: List[dict],
    main_vecs: List[List[float]],
    mode: str,
) -> Tuple[str, bool, Optional[str], List[dict], List[dict], Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    print("[extract] step4 start: refine query")
    refined_query = await query_refining.refine_query_if_confident(
        original_query=query,
        active_items=active_items,
        sold_items=sold_items,
        main_vecs=main_vecs,
    )
    print("[extract] step4 mid: refine pass complete")
    fallback_llm_query = await maybe_fallback_to_llm_when_text_fails(
        openai_client=openai_client,
        original_text=text,
        refined_query=refined_query,
        main_image=main_image,
        main_bytes=main_bytes,
        files=files,
        extra_bytes=extra_bytes,
        main_content_type=main_content_type,
        extra_content_types=extra_content_types,
    )
    print("[extract] step4 mid: fallback decision evaluated")

    active_ranked_from_fallback = None
    sold_ranked_from_fallback = None

    if fallback_llm_query:
        print("[extract] step4 fallback: running llm fallback flow")
        query = fallback_llm_query
        used_llm = True
        serp_active, serp_sold = await fetch_initial_serp_results(query=query, mode=mode)
        active_items = extract_items(serp_active)
        sold_items = extract_items(serp_sold)
        await image_processing.embed_initial_thumbnails_if_needed(
            active_items=active_items,
            sold_items=sold_items,
            mode=mode,
        )
        active_ranked_from_fallback, sold_ranked_from_fallback = await rerank_initial_for_signal(
            active_items=active_items,
            sold_items=sold_items,
            main_vecs=main_vecs,
            mode=mode,
        )
        refined_query = await query_refining.refine_query_if_confident(
            original_query=query,
            active_items=active_items,
            sold_items=sold_items,
            main_vecs=main_vecs,
        )
    print("[extract] step4 done: refine stage complete")

    return (
        query,
        used_llm,
        refined_query,
        active_items,
        sold_items,
        active_ranked_from_fallback,
        sold_ranked_from_fallback,
    )


def _step_5_get_final_step_message(*, direct_final: bool) -> str:
    print(f"[extract] step5 route: direct_final={direct_final}")
    if direct_final:
        return "Querying marketplaces"
    return "Re-querying marketplaces"


async def _step_6_fetch_final_candidates(
    *,
    mode: str,
    refined_query: Optional[str],
    active_items: List[dict],
    sold_items: List[dict],
    main_vecs: List[List[float]],
) -> Dict[str, Any]:
    print("[extract] step6 start: fetch final candidates")
    final_candidates = await fetch_final_candidates(
        mode=mode,
        refined_query=refined_query,
        initial_active_items=active_items,
        initial_sold_items=sold_items,
        main_vecs=main_vecs,
    )
    print("[extract] step6 done: final candidates ready")
    return final_candidates


def _step_7_apply_final_candidate_state(
    *,
    refined_query: Optional[str],
    final_candidates: Dict[str, Any],
    active_ranked: Optional[Dict[str, Any]],
    sold_ranked: Optional[Dict[str, Any]],
    active_items: List[dict],
    sold_items: List[dict],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], List[dict], List[dict]]:
    print("[extract] step7 start: apply final candidate state")
    if refined_query:
        active_ranked = final_candidates.get("active_ranked") or active_ranked
        sold_ranked = final_candidates.get("sold_ranked") or sold_ranked
        active_items = final_candidates.get("active_items_ref") or active_items
        sold_items = final_candidates.get("sold_items_ref") or sold_items
    print("[extract] step7 done: final state merged")
    return active_ranked, sold_ranked, active_items, sold_items


def _step_8_strip_heavy_fields(
    *,
    active_items: List[dict],
    sold_items: List[dict],
    active_ranked: Optional[Dict[str, Any]],
    sold_ranked: Optional[Dict[str, Any]],
) -> None:
    print("[extract] step8 start: strip heavy fields")
    if active_ranked and active_ranked.get("filtered_items"):
        output_builder.strip_heavy_fields(active_items, active_ranked["filtered_items"])
    else:
        output_builder.strip_heavy_fields(active_items)
    if sold_ranked and sold_ranked.get("filtered_items"):
        output_builder.strip_heavy_fields(sold_items, sold_ranked["filtered_items"])
    else:
        output_builder.strip_heavy_fields(sold_items)
    print("[extract] step8 done: heavy fields stripped")


def _step_9_build_frontend_result(
    *,
    mode: str,
    query: str,
    refined_query: Optional[str],
    active_ranked: Optional[Dict[str, Any]],
    sold_ranked: Optional[Dict[str, Any]],
    t0: float,
) -> Dict[str, Any]:
    print("[extract] step9 start: build frontend payload")
    frontend = output_builder.build_frontend_payload(
        mode=mode,
        initial_query=query,
        refined_query=refined_query,
        active_ranked=active_ranked,
        sold_ranked=sold_ranked,
    )
    print("[extract] step9 done: frontend payload built")
    frontend["timing_sec"] = round(time.time() - t0, 3)
    return frontend


async def build_extract_file_stream_response(
    *,
    openai_client: OpenAI,
    main_image: UploadFile,
    files: List[UploadFile],
    itemName: Optional[str],
    text: Optional[str],
    mode: str,
) -> StreamingResponse:
    t0 = time.time()
    print("[extract] request start")
    mode = normalize_mode(mode)
    validate_image_uploads(main_image, files)

    async def gen():
        async def emit(step_id: str, label: str, status: str, pct: Optional[float] = None, detail: Optional[str] = None):
            payload = {
                "type": "step",
                "step_id": step_id,
                "label": label,
                "status": status,
            }
            if pct is not None:
                payload["pct"] = pct
            if detail:
                payload["detail"] = detail
            yield _ndjson(payload)

        try:
            print("[extract] stream start")
            async for chunk in emit("gen_query", "Generating marketplace query", "start", 0.02):
                yield chunk
            (
                main_bytes,
                extra_bytes,
                main_content_type,
                extra_content_types,
                main_vecs,
                query,
                used_llm,
                direct_final,
            ) = await _step_1_generate_marketplace_query(
                openai_client=openai_client,
                main_image=main_image,
                files=files,
                itemName=itemName,
                text=text,
            )
            async for chunk in emit("gen_query", "Generating marketplace query", "done", 0.18):
                yield chunk

            if direct_final:
                print("[extract] direct itemName mode: skipping initial query/refine image steps")
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
                print("[extract] full flow mode: running initial query/image/refine pipeline")
                async for chunk in emit("query_mkt", "Querying marketplaces", "start", 0.20):
                    yield chunk
                active_items, sold_items = await _step_2_query_initial_marketplaces(query=query, mode=mode)
                async for chunk in emit("query_mkt", "Querying marketplaces", "done", 0.0):
                    yield chunk

                async for chunk in emit("proc_imgs", "Processing item images", "start", 0.32):
                    yield chunk
                active_ranked, sold_ranked = await _step_3_process_item_images(
                    active_items=active_items,
                    sold_items=sold_items,
                    mode=mode,
                    main_vecs=main_vecs,
                )
                async for chunk in emit("proc_imgs", "Processing item images", "done", 0.65):
                    yield chunk

                async for chunk in emit("refine", "Refining search query", "start", 0.67):
                    yield chunk
                (
                    query,
                    used_llm,
                    refined_query,
                    active_items,
                    sold_items,
                    active_ranked_from_fallback,
                    sold_ranked_from_fallback,
                ) = await _step_4_refine_query_with_optional_fallback(
                    openai_client=openai_client,
                    query=query,
                    used_llm=used_llm,
                    text=text,
                    main_image=main_image,
                    main_bytes=main_bytes,
                    files=files,
                    extra_bytes=extra_bytes,
                    main_content_type=main_content_type,
                    extra_content_types=extra_content_types,
                    active_items=active_items,
                    sold_items=sold_items,
                    main_vecs=main_vecs,
                    mode=mode,
                )
                if active_ranked_from_fallback is not None:
                    active_ranked = active_ranked_from_fallback
                if sold_ranked_from_fallback is not None:
                    sold_ranked = sold_ranked_from_fallback
                async for chunk in emit("refine", "Refining search query", "done", 0.80):
                    yield chunk

            final_step_message = _step_5_get_final_step_message(direct_final=direct_final)
            if refined_query:
                print("[extract] requery start: refined query present")
                async for chunk in emit("requery", final_step_message, "start", 0.82):
                    yield chunk
            final_candidates = await _step_6_fetch_final_candidates(
                mode=mode,
                refined_query=refined_query,
                active_items=active_items,
                sold_items=sold_items,
                main_vecs=main_vecs,
            )

            if refined_query:
                async for chunk in emit("requery", "Re-querying marketplaces", "done", 0.98):
                    yield chunk
                active_ranked, sold_ranked, active_items, sold_items = _step_7_apply_final_candidate_state(
                    refined_query=refined_query,
                    final_candidates=final_candidates,
                    active_ranked=active_ranked,
                    sold_ranked=sold_ranked,
                    active_items=active_items,
                    sold_items=sold_items,
                )
            else:
                print("[extract] requery skipped: no refined query")
                async for chunk in emit(
                    "requery", "Re-querying marketplaces", "done", 0.98, detail="skipped (no refined query)"
                ):
                    yield chunk

            _step_8_strip_heavy_fields(
                active_items=active_items,
                sold_items=sold_items,
                active_ranked=active_ranked,
                sold_ranked=sold_ranked,
            )
            frontend = _step_9_build_frontend_result(
                mode=mode,
                query=query,
                refined_query=refined_query,
                active_ranked=active_ranked,
                sold_ranked=sold_ranked,
                t0=t0,
            )
            yield _ndjson({"type": "result", "data": frontend})
            print("[extract] request done")

        except HTTPException as e:
            yield _ndjson(
                {
                    "type": "error",
                    "error": e.detail if isinstance(e.detail, dict) else {"error": str(e.detail)},
                }
            )
        except httpx.TimeoutException as e:
            yield _ndjson({"type": "error", "error": {"error": "Timeout during marketplace query", "detail": str(e)}})
        except httpx.HTTPError as e:
            yield _ndjson({"type": "error", "error": {"error": "HTTP error during marketplace query", "detail": str(e)}})
        except Exception as e:
            yield _ndjson({"type": "error", "error": {"error": "Unhandled server error", "detail": str(e)}})

    return StreamingResponse(gen(), media_type="application/x-ndjson")
