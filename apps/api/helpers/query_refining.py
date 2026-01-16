from typing import Any, Dict, List, Optional
import re

from helpers import image_ranking

_STOP = {
    "new","sealed","tested","excellent","condition","free","shipping","fast","ship",
    "look","rare","wow","vintage","lot","bundle","sale","only","authentic","genuine",
    "with","and","the","a","an","in","of","for","to"
}
SIMILARITY_THRESHOLD = 0.65


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
    similarity_threshold: float = 0.65,
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
        sim = image_ranking.best_multicrop_similarity(main_vecs, vecs)
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

async def refine_query_if_confident(
    *,
    original_query: str,
    active_items: List[dict],
    sold_items: List[dict],
    main_vecs: List[List[float]],
) -> Optional[str]:
    # Same logic as before: prefer active for refinement, else sold.
    source = active_items if active_items else sold_items
    if not source:
        return None

    return await maybe_refine_query_via_top_match(
        original_query=original_query,
        items=source,
        main_vecs=main_vecs,
        similarity_threshold=SIMILARITY_THRESHOLD,
    )