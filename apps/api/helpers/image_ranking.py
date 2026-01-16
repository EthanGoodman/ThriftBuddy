from typing import Any, Dict, List, Optional

def _cosine_sim(u: List[float], v: List[float]) -> float:
    """
    Cosine similarity for already-normalized vectors.
    If vectors are normalized, cosine == dot product.
    """
    if not u or not v or len(u) != len(v):
        return -1.0
    return float(sum(a * b for a, b in zip(u, v)))


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