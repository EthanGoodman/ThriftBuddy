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
from PIL import Image
from io import BytesIO
import torch
import open_clip
import asyncio



import common

app = FastAPI()
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SERPAPI_ENDPOINT = "https://serpapi.com/search.json"

# ---- Thumbnail embedding cache (in-memory) ----
# Key: product_id (str) OR thumbnail URL as fallback
_THUMB_EMBED_CACHE: Dict[str, List[List[float]]] = {}

_STOP = {
    "new","sealed","tested","excellent","condition","free","shipping","fast","ship",
    "look","rare","wow","vintage","lot","bundle","sale","only","authentic","genuine",
    "with","and","the","a","an","in","of","for","to"
}

import anyio

@app.on_event("startup")
def _startup():
    _load_clip()


async def image_bytes_to_embeddings_multicrop_async(img_bytes: bytes, *, crops: List[float]) -> List[List[float]]:
    return await anyio.to_thread.run_sync(
        lambda: image_bytes_to_embeddings_multicrop(img_bytes, crops=crops)
    )


def extract_strong_tokens(title: str) -> List[str]:
    if not title:
        return []
    t = re.sub(r"[^\w\s\-\/]", " ", title.lower())
    parts = [p for p in t.split() if p and p not in _STOP]

    # Prefer model-ish tokens like "kt-591", "xr500", "a-10"
    modelish = []
    for p in parts:
        if re.search(r"^[a-z]{0,4}[- ]?\d{2,6}[a-z]?$", p):
            modelish.append(p)

    # Keep some core words too (limited)
    core = [p for p in parts if len(p) >= 3][:6]

    # Put model tokens first, then core, dedupe
    out = []
    for p in modelish + core:
        if p not in out:
            out.append(p)

    return out[:10]


def build_refined_query(original_query: str, top_title: str) -> str:
    base = (original_query or "").strip()
    tokens = extract_strong_tokens(top_title)

    # If we got nothing useful, fall back to original query
    if not tokens:
        return base

    # Merge (avoid duplicates)
    base_tokens = set(re.sub(r"[^\w\s\-\/]", " ", base.lower()).split())
    merged = []
    for tok in tokens:
        if tok not in base_tokens:
            merged.append(tok)

    # Keep query short-ish
    refined = " ".join([base] + merged[:6]).strip()
    return refined

async def maybe_refine_query_via_top_match(
    *,
    original_query: str,
    items: List[Dict[str, Any]],
    main_vecs: List[List[float]],
    similarity_threshold: float = 0.35,
    separation_threshold: float = 0.05,
) -> Optional[str]:
    """
    Returns a refined query string if confidence is high enough, else None.
    Assumes items already have _thumb_embedding populated.
    """
    # Score all
    scored = []
    for it in items:
        vecs = it.get("_thumb_embedding")
        if not isinstance(vecs, list) or not vecs:
            continue
        sim = best_multicrop_similarity(main_vecs, vecs)
        scored.append((sim, it))

    if len(scored) < 2:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    top_sim, top_it = scored[0]
    second_sim, _ = scored[1]

    if top_sim < similarity_threshold:
        return None

    top_title = top_it.get("title") or ""
    refined = build_refined_query(original_query, top_title)

    # If refined ended up basically unchanged, skip
    if refined.lower() == (original_query or "").strip().lower():
        return None

    return refined


async def fetch_image_bytes(url: str, http: httpx.AsyncClient) -> Optional[bytes]:
    """
    Download image bytes. Returns None on failure.
    """
    try:
        r = await http.get(url, timeout=10.0, follow_redirects=True)
        r.raise_for_status()
        # basic sanity: only accept reasonably sized images
        if not r.content or len(r.content) < 50:
            return None
        return r.content
    except Exception:
        return None


async def embed_thumbnails_for_items(
    items: List[Dict[str, Any]],
    *,
    max_items: int = 50,
    concurrency: int = 10,
) -> Dict[str, Any]:
    """
    For the first `max_items` items:
      - downloads thumbnail bytes
      - computes CLIP embedding (normalized)
      - caches by product_id (preferred) or thumbnail URL
    Mutates each item by attaching:
      item["_thumb_embed_status"] = "ok" | "no_thumbnail" | "download_failed" | "embed_failed"
      item["_thumb_embedding"] = [floats]   (only if ok)
    Returns a small summary.
    """
    target_items = items[:max_items]

    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient() as http:
        async def process_item(it: Dict[str, Any]) -> None:
            thumb_url = it.get("thumbnail")
            if not isinstance(thumb_url, str) or not thumb_url.strip():
                it["_thumb_embed_status"] = "no_thumbnail"
                return

            cache_key = str(it.get("product_id") or thumb_url)
            cached = _THUMB_EMBED_CACHE.get(cache_key)
            if cached is not None:
                it["_thumb_embedding"] = cached
                it["_thumb_embed_status"] = "ok_cached"
                return

            async with sem:
                img_bytes = await fetch_image_bytes(thumb_url, http)

            if img_bytes is None:
                it["_thumb_embed_status"] = "download_failed"
                return

            try:
                vecs = await image_bytes_to_embeddings_multicrop_async(img_bytes, crops=[1.0, 0.85])
                _THUMB_EMBED_CACHE[cache_key] = vecs
                it["_thumb_embedding"] = vecs
                it["_thumb_embed_status"] = "ok"
            except Exception:
                it["_thumb_embed_status"] = "embed_failed"

        await asyncio.gather(*(process_item(it) for it in target_items))

    # summary counts
    counts: Dict[str, int] = {}
    for it in target_items:
        s = it.get("_thumb_embed_status", "unknown")
        counts[s] = counts.get(s, 0) + 1

    return {"processed": len(target_items), "status_counts": counts}


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
    low = q1 - 1.5 * iqr
    high = q3 + 1.5 * iqr

    # clamp for price domain
    if low < 0:
        low = 0.0

    return {"q1": q1, "q3": q3, "iqr": iqr, "low": low, "high": high}



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

# ---- Image Embedding (OpenCLIP) ----
_CLIP_MODEL = None
_CLIP_PREPROCESS = None
_CLIP_TOKENIZER = None
_CLIP_DEVICE = "cpu"  # keep CPU for now (safe default)

def _load_clip():
    """
    Lazy-load and cache the CLIP model + preprocess.
    """
    global _CLIP_MODEL, _CLIP_PREPROCESS, _CLIP_TOKENIZER, _CLIP_DEVICE

    if _CLIP_MODEL is not None:
        return _CLIP_MODEL, _CLIP_PREPROCESS

    # Good default: ViT-B-32 pretrained on LAION2B (common + solid)
    model_name = "ViT-B-32"
    pretrained = "laion2b_s34b_b79k"

    model, _, preprocess = open_clip.create_model_and_transforms(
        model_name=model_name,
        pretrained=pretrained,
    )
    model.eval()
    model.to(_CLIP_DEVICE)

    _CLIP_MODEL = model
    _CLIP_PREPROCESS = preprocess
    return _CLIP_MODEL, _CLIP_PREPROCESS


def image_bytes_to_embedding(img_bytes: bytes) -> List[float]:
    """
    Converts image bytes to a normalized CLIP embedding vector.
    Returns a Python list[float] so it's JSON-serializable.
    """
    model, preprocess = _load_clip()

    # Decode image
    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    # Preprocess -> tensor [1, 3, H, W]
    image_tensor = preprocess(img).unsqueeze(0).to(_CLIP_DEVICE)

    with torch.no_grad():
        feats = model.encode_image(image_tensor)  # [1, D]
        feats = feats / feats.norm(dim=-1, keepdim=True)  # normalize for cosine similarity
        vec = feats[0].cpu().tolist()

    return vec

def _cosine_sim(u: List[float], v: List[float]) -> float:
    """
    Cosine similarity for already-normalized vectors.
    If vectors are normalized, cosine == dot product.
    """
    if not u or not v or len(u) != len(v):
        return -1.0
    return float(sum(a * b for a, b in zip(u, v)))


def image_bytes_to_embeddings_multicrop(
    img_bytes: bytes,
    *,
    crops: List[float] = [1.0, 0.85, 0.65],  # full, medium center crop, tight center crop
) -> List[List[float]]:
    """
    Returns multiple normalized CLIP embeddings for multiple center crops.

    crops: list of fractions of the shorter side to keep (1.0 = full image)
    """
    model, preprocess = _load_clip()

    img = Image.open(BytesIO(img_bytes)).convert("RGB")

    w, h = img.size
    side = min(w, h)

    vectors: List[List[float]] = []

    for frac in crops:
        frac = float(frac)
        if frac <= 0 or frac > 1.0:
            continue

        crop_side = max(1, int(side * frac))
        left = (w - crop_side) // 2
        top = (h - crop_side) // 2
        right = left + crop_side
        bottom = top + crop_side

        cropped = img.crop((left, top, right, bottom))

        image_tensor = preprocess(cropped).unsqueeze(0).to(_CLIP_DEVICE)

        with torch.no_grad():
            feats = model.encode_image(image_tensor)  # [1, D]
            feats = feats / feats.norm(dim=-1, keepdim=True)  # normalize
            vec = feats[0].cpu().tolist()

        vectors.append(vec)

    # Fallback if something weird happened
    if not vectors:
        vectors = [image_bytes_to_embedding(img_bytes)]

    return vectors


def best_multicrop_similarity(
    main_vecs: List[List[float]],
    other_vecs: List[List[float]],
) -> float:
    """
    Returns the best cosine similarity across all crop-pairs.
    """
    best = -1.0
    for mv in main_vecs:
        for ov in other_vecs:
            s = _cosine_sim(mv, ov)
            if s > best:
                best = s
    return best


# Optional: include a tiny sample for debugging (avoid huge payload)
def _sample_embeds(items: List[Dict[str, Any]], k: int = 3):
  out = []
  for it in items:
      if it.get("_thumb_embed_status") in ("ok", "ok_cached"):
          out.append({
              "product_id": it.get("product_id"),
              "thumbnail": it.get("thumbnail"),
              "thumb_status": it.get("_thumb_embed_status"),
              "thumb_embedding_dim": len(it.get("_thumb_embedding", [])),
              # Uncomment ONLY if you want to see the raw vector (big):
              # "thumb_embedding": it.get("_thumb_embedding"),
          })
      if len(out) >= k:
          break
  return out

def _strip_heavy_fields(items: List[Dict[str, Any]]) -> None:
  for it in items:
      it.pop("_thumb_embedding", None)


def rerank_items_by_image_similarity(
    items: List[Dict[str, Any]],
    main_vecs: List[List[float]],
    *,
    threshold: float = 0.25,
    keep_top_k: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Adds:
      item["_image_similarity"] = best similarity (float)
      item["_image_match"] = True/False (above threshold)
    Then reranks in descending similarity.

    Returns:
      {
        "threshold": float,
        "kept": int,
        "total_scored": int,
        "n_missing_embedding": int
      }
    """
    n_missing = 0
    scored = 0

    for it in items:
        vecs = it.get("_thumb_embedding")
        if not isinstance(vecs, list) or not vecs:
            it["_image_similarity"] = None
            it["_image_match"] = False
            n_missing += 1
            continue

        # vecs should be List[List[float]]
        sim = best_multicrop_similarity(main_vecs, vecs)
        it["_image_similarity"] = sim
        it["_image_match"] = sim >= threshold
        scored += 1

    # Sort: items with similarity first, highest similarity first
    items.sort(
        key=lambda x: (x.get("_image_similarity") is not None, x.get("_image_similarity") or -1.0),
        reverse=True,
    )

    # Optionally filter down to threshold matches
    filtered = [it for it in items if it.get("_image_match")]

    if keep_top_k is not None:
        filtered = filtered[:keep_top_k]

    return {
        "threshold": threshold,
        "kept": len(filtered),
        "total_scored": scored,
        "n_missing_embedding": n_missing,
        "filtered_items": filtered,
    }

def slim_item(it: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "product_id": it.get("product_id"),
        "title": it.get("title"),
        "link": it.get("link"),
        "thumbnail": it.get("thumbnail"),
        "condition": it.get("condition"),
        "price": it.get("price"),
        "shipping": it.get("shipping"),
        "location": it.get("location"),
        "image_similarity": it.get("_image_similarity"),
    }

def json_sanitize(obj: Any) -> Any:
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {str(k): json_sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_sanitize(x) for x in obj]
    if isinstance(obj, (set, tuple)):
        return [json_sanitize(x) for x in obj]
    return str(obj)




@app.post("/api/py/extract-file")
async def extract_from_files(
    main_image: UploadFile = File(...),
    files: List[UploadFile] = File([]),
    text: Optional[str] = Form(None),
):
    content = [{"type": "input_text", "text": common.EXTRACTION_PROMPT}]

    if text and text.strip():
        content.append({"type": "input_text", "text": text.strip()})

    # Add MAIN image first (important)
    main_bytes = await main_image.read()
    # Compute main image embedding (stage 2)
    try:
      main_image_vecs = await image_bytes_to_embeddings_multicrop_async(main_bytes, crops=[1.0, 0.85, 0.65])
    except Exception as e:
      return JSONResponse(status_code=500, content={"error": f"Failed main image embedding: {str(e)}"})


    main_b64 = base64.b64encode(main_bytes).decode("utf-8")
    main_data_url = f"data:{main_image.content_type};base64,{main_b64}"
    content.append({"type": "input_image", "image_url": main_data_url})

    # Add extra images (if any)
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

    # --- Stage 3: thumbnail embeddings ---
    # For testing, embed thumbnails for the returned candidates.
    active_thumb_summary = await embed_thumbnails_for_items(active_items, max_items=50, concurrency=10)
    sold_thumb_summary = await embed_thumbnails_for_items(sold_items, max_items=50, concurrency=10)

    active_ranked = rerank_items_by_image_similarity(active_items, main_image_vecs, threshold=0.25, keep_top_k=25)
    sold_ranked = rerank_items_by_image_similarity(sold_items, main_image_vecs, threshold=0.25, keep_top_k=25)

        # ---- Query refinement (PRF) ----
    refined_query = await maybe_refine_query_via_top_match(
        original_query=query,
        items=active_ranked["filtered_items"],
        main_vecs=main_image_vecs,
        similarity_threshold=0.35,
        separation_threshold=0.05,
    )

    refined_block = None

    if refined_query:
      # Re-query using refined query
      serp_active_ref = await serpapi_ebay_search(query=refined_query, ipg=50, sold=False)
      active_items_ref = serp_active_ref.get("organic_results") or []
      raw_active_top50_ref = [slim_item(it) for it in active_items_ref[:50]]
     
      serp_sold_ref = await serpapi_ebay_search(query=refined_query, ipg=50, sold=True)
      sold_items_ref = serp_sold_ref.get("organic_results") or []
      raw_sold_top50_ref = [slim_item(it) for it in sold_items_ref[:50]]

      # Embed thumbs + rerank again
      active_thumb_ref_summary = await embed_thumbnails_for_items(active_items_ref, max_items=50, concurrency=10)
      sold_thumb_ref_summary = await embed_thumbnails_for_items(sold_items_ref, max_items=50, concurrency=10)

      active_ranked_ref = rerank_items_by_image_similarity(active_items_ref, main_image_vecs, threshold=0.25, keep_top_k=25)
      sold_ranked_ref = rerank_items_by_image_similarity(sold_items_ref, main_image_vecs, threshold=0.25, keep_top_k=25)

      # Strip heavy fields before returning anything
      _strip_heavy_fields(active_items_ref)
      _strip_heavy_fields(sold_items_ref)
      _strip_heavy_fields(active_ranked_ref["filtered_items"])
      _strip_heavy_fields(sold_ranked_ref["filtered_items"])

      refined_block = {
        "refined_query": refined_query,
        "refined_candidates": {
            "active_top50": raw_active_top50_ref,
            "sold_top50": raw_sold_top50_ref,
        },
        "rerank": {
            "active_top10": [slim_item(it) for it in active_ranked_ref["filtered_items"][:10]],
            "sold_top10": [slim_item(it) for it in sold_ranked_ref["filtered_items"][:10]],
        }
      }


    _strip_heavy_fields(active_items)
    _strip_heavy_fields(sold_items)
    _strip_heavy_fields(active_ranked["filtered_items"])
    _strip_heavy_fields(sold_ranked["filtered_items"])

    response = {
        "main_embedding_dim": len(main_image_vecs[0]) if main_image_vecs else 0,
        "initial_query": query,
        "refined_query": refined_query,   # may be None
        "initial": {
            "active_image_rerank": {
                "summary": {k: v for k, v in active_ranked.items() if k != "filtered_items"},
                "top_matches": [
                    {
                        "product_id": it.get("product_id"),
                        "title": it.get("title"),
                        "thumbnail": it.get("thumbnail"),
                        "image_similarity": it.get("_image_similarity"),
                        "price": it.get("price"),
                        "condition": it.get("condition"),
                        "link": it.get("link"),
                    }
                    for it in active_ranked["filtered_items"][:10]
                ],
            },
            "sold_image_rerank": {
                "summary": {k: v for k, v in sold_ranked.items() if k != "filtered_items"},
                "top_matches": [
                    {
                        "product_id": it.get("product_id"),
                        "title": it.get("title"),
                        "thumbnail": it.get("thumbnail"),
                        "image_similarity": it.get("_image_similarity"),
                        "price": it.get("price"),
                        "condition": it.get("condition"),
                        "link": it.get("link"),
                    }
                    for it in sold_ranked["filtered_items"][:10]
                ],
            },
            # optional debug
            "thumbnail_embed_summaries": {
                "active": active_thumb_summary,
                "sold": sold_thumb_summary,
            },
        },
        "refined": refined_block,  # None if no refinement
      }

    return JSONResponse(json_sanitize(response))
