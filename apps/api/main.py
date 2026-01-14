from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI
from typing import Any, Dict, List, Optional
import base64
import httpx
import json
import math
import os
import re

import common

app = FastAPI()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"


def _parse_money_str(s: str) -> Optional[float]:
    if not isinstance(s, str):
        return None
    m = re.search(r"([\d,]+(\.\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", ""))

def _to_float_price(item: Dict[str, Any]) -> Optional[float]:
    """
    Returns the *current effective price*.
    Priority:
      1) item.price.extracted  (usually current / discounted)
      2) item.old_price.discount (string like "$8.80")  <-- if SerpApi puts discount only here
      3) item.price.raw
      4) item.old_price.extracted (fallback, not ideal but better than None)
    """
    price = item.get("price")
    if isinstance(price, dict):
        extracted = price.get("extracted")
        if isinstance(extracted, (int, float)):
            return float(extracted)

        raw = price.get("raw")
        parsed = _parse_money_str(raw) if isinstance(raw, str) else None
        if parsed is not None:
            return parsed

    old_price = item.get("old_price")
    if isinstance(old_price, dict):
        # discount is often a string like "$8.80" (the new/current price)
        discount = old_price.get("discount")
        parsed_discount = _parse_money_str(discount) if isinstance(discount, str) else None
        if parsed_discount is not None:
            return parsed_discount

        old_extracted = old_price.get("extracted")
        if isinstance(old_extracted, (int, float)):
            return float(old_extracted)

    return None



def _percentile(sorted_vals: List[float], p: float) -> Optional[float]:
    n = len(sorted_vals)
    if n == 0:
        return None
    if n == 1:
        return sorted_vals[0]

    idx = (n - 1) * p
    lo = math.floor(idx)
    hi = math.ceil(idx)
    if lo == hi:
        return sorted_vals[lo]
    weight = idx - lo
    return sorted_vals[lo] * (1 - weight) + sorted_vals[hi] * weight


def _get_condition(item: Dict[str, Any]) -> Optional[str]:
    c = item.get("condition")
    if not isinstance(c, str) or not c.strip():
        return None

    c_norm = c.strip().lower()
    if "brand new" in c_norm or c_norm == "new":
        return "new"
    if "pre-owned" in c_norm or "used" in c_norm:
        return "used"
    return "other"


def _iqr_bounds(sorted_vals: List[float]) -> Optional[Dict[str, float]]:
    if len(sorted_vals) < 4:
        return None

    q1 = _percentile(sorted_vals, 0.25)
    q3 = _percentile(sorted_vals, 0.75)
    if q1 is None or q3 is None:
        return None

    iqr = q3 - q1
    return {
        "q1": q1,
        "q3": q3,
        "iqr": iqr,
        "low": q1 - 1.5 * iqr,
        "high": q3 + 1.5 * iqr,
    }


def filter_outliers_iqr(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    prices = [p for p in (_to_float_price(x) for x in items) if p is not None]
    prices.sort()

    bounds = _iqr_bounds(prices)
    if not bounds:
        return {"filtered_items": items, "outliers_removed": 0, "bounds": None}

    low, high = bounds["low"], bounds["high"]
    filtered: List[Dict[str, Any]] = []
    removed = 0

    for it in items:
        p = _to_float_price(it)
        if p is None:
            filtered.append(it)
        elif low <= p <= high:
            filtered.append(it)
        else:
            removed += 1

    return {"filtered_items": filtered, "outliers_removed": removed, "bounds": bounds}


def compute_price_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    prices = [p for p in (_to_float_price(x) for x in items) if p is not None]
    prices.sort()

    return {
        "n_items_total": len(items),
        "n_items_with_price": len(prices),
        "min_price": prices[0] if prices else None,
        "q1_price": _percentile(prices, 0.25),
        "median_price": _percentile(prices, 0.50),
        "q3_price": _percentile(prices, 0.75),
        "max_price": prices[-1] if prices else None,
    }


def compute_segmented_summaries(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    def summarize(label_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        out = filter_outliers_iqr(label_items)
        filtered_items = out["filtered_items"]
        return {
            "raw": compute_price_summary(label_items),
            "filtered": compute_price_summary(filtered_items),
            "outliers_removed": out["outliers_removed"],
            "iqr_bounds": out["bounds"],
        }

    buckets = {"new": [], "used": [], "other": [], "unknown": []}
    for it in items:
        c = _get_condition(it)
        if c == "new":
            buckets["new"].append(it)
        elif c == "used":
            buckets["used"].append(it)
        elif c == "other":
            buckets["other"].append(it)
        else:
            buckets["unknown"].append(it)

    return {
        "all": summarize(items),
        "by_condition": {
            "new": summarize(buckets["new"]),
            "used": summarize(buckets["used"]),
            "other": summarize(buckets["other"]),
            "unknown": summarize(buckets["unknown"]),
        },
    }


def display_count(n: int) -> str | int:
    return "200+" if n >= 200 else n


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
    files: List[UploadFile] = File(...),
    text: Optional[str] = Form(None),
):
    content = [{"type": "input_text", "text": common.EXTRACTION_PROMPT}]

    if text and text.strip():
        content.append({"type": "input_text", "text": text.strip()})

    for f in files:
        img_bytes = await f.read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{f.content_type};base64,{b64}"
        content.append({"type": "input_image", "image_url": data_url})

    resp = openai_client.responses.create(
        model="gpt-4o-mini",
        input=[{"role": "user", "content": content}],
        max_output_tokens=900,
    )

    raw_text = resp.output_text
    try:
        extracted = json.loads(raw_text)
    except json.JSONDecodeError:
        return JSONResponse(status_code=502, content={"error": "LLM did not return valid JSON", "raw_result": raw_text})

    search_queries = extracted.get("search_queries") or []
    if not isinstance(search_queries, list) or not search_queries:
        return JSONResponse(status_code=502, content={"error": "No search_queries returned by LLM", "extracted": extracted})

    chosen = search_queries[0]
    query = chosen.get("query")
    if not query:
        return JSONResponse(status_code=502, content={"error": "First search query object missing 'query'", "chosen": chosen, "extracted": extracted})

    serp_active = await serpapi_ebay_search(query=query, ipg=50, sold=False)
    active_items = serp_active.get("organic_results") or []
    active_stats = compute_segmented_summaries(active_items)

    serp_sold = await serpapi_ebay_search(query=query, ipg=50, sold=True)
    sold_items = serp_sold.get("organic_results") or []
    sold_stats = compute_segmented_summaries(sold_items)

    return JSONResponse(
        {
            "chosen_query": chosen,
            "active": {"listings": display_count(len(active_items)), "stats": active_stats},
            "sold": {"listings": display_count(len(sold_items)), "stats": sold_stats},
        }
    )
