import asyncio
import json
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, UploadFile
from fastapi.responses import JSONResponse
from openai import OpenAI

from helpers import LLM_Helper, output_builder
from helpers.marketplace_client import serp_lens_search, serp_search, serp_timeout
from helpers.r2_storage import upload_uploadfile_and_get_url


async def fetch_google_lens_results(*, image_url: str, q: Optional[str] = None) -> dict:
    print("[lens] fetch start: google lens")
    timeout = serp_timeout()
    async with httpx.AsyncClient(timeout=timeout) as http:
        out = await serp_lens_search(http, image_url=image_url, q=q)
    print("[lens] fetch done: google lens")
    return out


async def gpt_discern_item_from_lens(*, openai_client: OpenAI, lens_json: Dict[str, Any]) -> Dict[str, Any]:
    print("[lens] gpt discern start")
    prompt = LLM_Helper.LENS_ITEM_EXTRACTION_PROMPT.replace(
        "{{LENS_JSON}}",
        json.dumps(lens_json, ensure_ascii=False),
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
    print("[lens] gpt discern done")
    return item_data


async def fetch_serp_results_lens(*, query: str, mode: str):
    print(f"[lens] serp fetch start: mode={mode}")
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

    print("[lens] serp fetch done")
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
        json.dumps(trimmed_lens_json, ensure_ascii=False),
    )
    return anchor_block + "\n\n" + base


def build_lens_candidates(lens_json: Dict[str, Any], *, limit: int = 20) -> List[Dict[str, Any]]:
    print(f"[lens] build candidates start: limit={limit}")
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

    out = candidates[:limit]
    print(f"[lens] build candidates done: count={len(out)}")
    return out


async def build_extract_file_stream_lens_guided_response(
    *,
    main_image: UploadFile,
    files: List[UploadFile],
    text: Optional[str],
) -> JSONResponse:
    print("[lens] request start")
    try:
        print("[lens] upload start")
        image_url = await upload_uploadfile_and_get_url(main_image, prefix="tmp")
        print("[lens] upload done")

        lens_query = text.strip() if text and text.strip() else None
        lens_json_full = await fetch_google_lens_results(image_url=image_url, q=lens_query)
        candidates = build_lens_candidates(lens_json_full, limit=20)
        if not candidates:
            raise HTTPException(status_code=400, detail={"error": "No usable Google Lens matches"})

        print("[lens] request done")
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
