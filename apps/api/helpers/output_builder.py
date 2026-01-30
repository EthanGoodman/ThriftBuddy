from typing import Any, Dict, List, Optional
import math
import re

TOPK_SIGNAL = 10

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

def _strip_heavy_fields(items: List[Dict[str, Any]]) -> None:
  for it in items:
      it.pop("_thumb_embedding", None)

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

def top_signal_block(items_ranked: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not items_ranked:
        return None
    top = items_ranked.get("filtered_items") or []
    return {
        "summary": {k: v for k, v in items_ranked.items() if k != "filtered_items"},
        "top_matches": [slim_item(it) for it in top[:TOPK_SIGNAL]],
    }

def strip_heavy_fields(*item_lists: List[dict]) -> None:
    for items in item_lists:
        if items:
            _strip_heavy_fields(items)

def build_response(
    *,
    mode: str,
    main_vecs: List[List[float]],
    initial_query: str,
    refined_query: Optional[str],
    active_ranked: Optional[Dict[str, Any]],
    sold_ranked: Optional[Dict[str, Any]],
    final_candidates: Dict[str, Any],
    used_llm: bool,
) -> Dict[str, Any]:
    return {
        "mode": mode,
        "used_llm_for_initial_query": used_llm,
        "main_embedding_dim": len(main_vecs[0]) if main_vecs else 0,
        "initial_query": initial_query,
        "refined_query": refined_query,
        "initial_signal": {
            "active": top_signal_block(active_ranked),
            "sold": top_signal_block(sold_ranked),
        },
        "final_candidates": final_candidates,
    }

def _parse_money_str(s: str) -> Optional[float]:
    if not isinstance(s, str):
        return None
    m = re.search(r"([\d,]+(\.\d+)?)", s)
    if not m:
        return None
    return float(m.group(1).replace(",", ""))

def _to_float_price(item: Dict[str, Any]) -> Optional[float]:
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

def _iqr_bounds(sorted_vals: List[float]) -> Optional[Dict[str, float]]:
    if len(sorted_vals) < 4:
        return None
    q1 = _percentile(sorted_vals, 0.25)
    q3 = _percentile(sorted_vals, 0.75)
    if q1 is None or q3 is None:
        return None
    iqr = q3 - q1
    low = max(0.0, q1 - 1.5 * iqr)
    high = q3 + 1.5 * iqr
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

def _safe_round_money(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        return round(float(x), 2)
    except Exception:
        return None

def _price_range_from_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "n": int(summary.get("n_items_with_price") or 0),
        "low": _safe_round_money(summary.get("min_price")),
        "q1": _safe_round_money(summary.get("q1_price")),
        "median": _safe_round_money(summary.get("median_price")),
        "q3": _safe_round_money(summary.get("q3_price")),
        "high": _safe_round_money(summary.get("max_price")),
    }

def _pick_example_listings(items: List[Dict[str, Any]], *, k: int = 5) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for it in items:
        if len(out) >= k:
            break
        out.append(slim_item(it))
    return out

def _infer_category_hint(query: str, examples: List[Dict[str, Any]]) -> str:
    text = " ".join([
        (query or ""),
        " ".join((x.get("title") or "") for x in examples),
    ]).lower()

    if any(w in text for w in ["t-shirt", "tshirt", "tee", "hoodie", "sweater", "jacket", "jeans", "pants"]):
        return "clothing"
    if any(w in text for w in ["puzzle", "jigsaw", "buffalo games", "ravensburger"]):
        return "puzzle"
    if any(w in text for w in ["tuner", "receiver", "am-fm", "stereo", "turntable", "speaker"]):
        return "audio"
    return "general"

def _legit_advice(category: str) -> List[str]:
    if category == "clothing":
        return [
            "Check tag details (brand, fabric, RN/CA numbers) and compare to known authentic examples.",
            "Look for era-specific construction cues (e.g., single-stitch, made-in country, label style) if the listing claims 'vintage'.",
            "Watch for stock photos only, inconsistent sizing, or logos that look too crisp/new for the claimed era.",
        ]
    if category == "puzzle":
        return [
            "Verify original brand/piece count on the box (front and side panels) and match it across listings.",
            "Sealed condition tends to be more consistent; if opened, look for notes about 'complete' and included poster/insert.",
            "Be cautious of listings with only generic images or missing clear photos of the front/title.",
        ]
    if category == "audio":
        return [
            "Confirm model number from visible faceplate/back-panel text and compare port layout/knob arrangement to reference photos.",
            "Ask for photos showing serial number/labels and verify key parts (buttons/knobs) match the model.",
            "Be cautious with vague 'powers on' claims; look for 'tested' details and return policy.",
        ]
    return [
        "Compare branding/model identifiers across multiple listings; prefer listings with clear photos from several angles.",
        "Be cautious of unusually low prices relative to the typical sold range and listings using only stock images.",
        "Check seller feedback, return policy, and whether the description matches what the photos show.",
    ]

def _rarity_label(*, active_n: int, sold_n: int) -> str:
    if sold_n <= 2 and active_n <= 3:
        return "high"
    if sold_n <= 6 and active_n <= 10:
        return "medium"
    return "common"

def _velocity_label(*, active_n: int, sold_n: int) -> str:
    score = float(sold_n) / float(active_n + 1)
    if score >= 1.0:
        return "fast"
    if score >= 0.35:
        return "moderate"
    return "slow"

def build_frontend_payload(
    *,
    mode: str,
    initial_query: str,
    refined_query: Optional[str],
    active_ranked: Optional[Dict[str, Any]],
    sold_ranked: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    active_matches = (active_ranked or {}).get("filtered_items") or []
    sold_matches = (sold_ranked or {}).get("filtered_items") or []

    active_filtered = filter_outliers_iqr(active_matches)["filtered_items"] if active_matches else []
    sold_filtered = filter_outliers_iqr(sold_matches)["filtered_items"] if sold_matches else []

    active_range = _price_range_from_summary(compute_price_summary(active_filtered)) if active_filtered else None
    sold_range = _price_range_from_summary(compute_price_summary(sold_filtered)) if sold_filtered else None

    active_n = len(active_matches)
    sold_n = len(sold_matches)

    active_listings = _pick_example_listings(active_matches, k=50)
    sold_listings = _pick_example_listings(sold_matches, k=50)

    category = _infer_category_hint(refined_query or initial_query, active_listings)
    advice = _legit_advice(category)

    rarity = _rarity_label(active_n=active_n, sold_n=sold_n)
    velocity = _velocity_label(active_n=active_n, sold_n=sold_n)

    q_used = refined_query or initial_query
    parts = [f"Query: {q_used}."]
    if sold_range and sold_range.get("n", 0) > 0:
        parts.append(
            f"Sold listings (similar items) cluster around ${sold_range.get('median')}, with a typical range of ${sold_range.get('low')}–${sold_range.get('high')} after outlier filtering."
        )
    if active_range and active_range.get("n", 0) > 0:
        parts.append(
            f"Active listings are commonly priced around ${active_range.get('median')} (about ${active_range.get('low')}–${active_range.get('high')} after filtering)."
        )
    parts.append(f"Rarity looks {rarity}, and sell-through appears {velocity} based on sold vs active counts.")
    summary = " ".join(parts)

    return {
        "mode": mode,
        "initial_query": initial_query,
        "refined_query": refined_query,
        "market_analysis": {
            "active": {"similar_count": active_n, "price_range": active_range},
            "sold": {"similar_count": sold_n, "price_range": sold_range},
            "sell_velocity": velocity,
            "rarity": rarity,
        },
        "legit_check_advice": advice,
        "active_listings": active_listings,
        "sold_listings": sold_listings,
        "summary": summary,
    }
