import os
from typing import Optional

import httpx
from fastapi import HTTPException


SERPAPI_ENDPOINT = "https://serpapi.com/search.json"


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


def extract_items(serp_json: Optional[dict]) -> list[dict]:
    if not serp_json:
        return []
    return serp_json.get("organic_results") or []


async def serp_lens_search(
    http: httpx.AsyncClient,
    *,
    image_url: str,
    type: str = "all",
    q: str | None = None,
) -> dict:
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="SERPAPI_API_KEY is not set")

    params = {
        "engine": "google_lens",
        "url": image_url,
        "api_key": api_key,
        "type": type,
    }
    if q:
        params["q"] = q

    r = await http.get(SERPAPI_ENDPOINT, params=params)
    r.raise_for_status()
    return r.json()
