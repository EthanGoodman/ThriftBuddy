EXTRACTION_PROMPT = """
You generate ONE best eBay search query for the item in the image.

STRICT RULES (MUST FOLLOW):
- Output ONLY raw JSON.
- Do NOT include markdown, code fences, comments, or extra text.
- Do NOT wrap the JSON in ``` or any other formatting.
- All numbers must be valid JSON numbers.
- Confidence MUST be a number between 0 and 1.

IDENTIFICATION RULES:
- The image is the source of truth. User text is a hint only.
- DO NOT invent brand, model, or year unless visible text confirms it.
- If the item appears to be clothing, try and identify the specific color of the ite,.
- If a distinctive mechanism or material is visible, include it
  (e.g., "eject", "teak", "push button").
- Prefer common eBay wording over technical jargon.

RESPONSE FORMAT (EXACT):
{"query":"<string>","confidence":<number between 0 and 1>}

"""

LENS_ITEM_EXTRACTION_PROMPT = """
You are an expert at identifying the exact item and producing a clean, marketplace-search-ready canonical listing title from Google Lens API JSON results.

Your goal is NOT to be generic.
Your goal is to produce the most specific item identity that is explicitly supported by Lens text evidence and optimized for accurately finding the item online.

ANCHOR RULE (VERY IMPORTANT):
- You will be given an ANCHOR_TITLE selected via image similarity (CLIP) as the closest visual match.
- Treat ANCHOR_TITLE as the primary starting point, but it may be truncated, awkward, or contain listing/site fluff.
- Use other Lens results to clean and enrich the anchor by adding missing specifics supported by text evidence.
- If ANCHOR_TITLE is generic or incomplete, use it as a core noun phrase and enrich it using the strongest cluster of similar Lens titles.
- Prefer attributes that appear in at least 2 Lens results, unless the attribute is a brand or model/style code.
- Do NOT contradict the anchor unless multiple Lens results clearly indicate a different exact product.

STRICT OUTPUT RULES:
- Output ONLY valid raw JSON (no markdown, no code fences, no extra text).
- Do NOT explain reasoning.
- Confidence MUST be a number between 0 and 1.
- If a field is unknown, set it to null (do not omit keys).

EVIDENCE RULES (CRITICAL):
- You may ONLY use details that appear in Lens JSON text fields (titles, snippets, source names, link text).
- Do NOT infer attributes from the image.
- Do NOT invent or guess details.
- If Lens results are mixed, focus on the cluster that matches the anchor.

SIGNAL PRIORITY (HIGH → LOW):
1) exact_matches
2) products
3) visual_matches
4) about_this_image / related searches

ITEM_NAME CONSTRUCTION (GENERALIZED):
- item_name MUST be a clean, search-ready canonical listing title.
- Start from the anchor, then enrich using corroborating Lens titles.
- Prefer attributes that improve search precision, such as:
  brand/maker, product type, model/style code, edition/series, size, color, material, piece-count, capacity, dimensions, condition descriptors
  (ONLY when explicitly supported by Lens text).
- Do NOT merge conflicting specifics across different products.

NORMALIZATION RULES:
- Remove site/store names, sales language, emojis, and repeated whitespace.
- Remove trailing fragments like “- Walmart”, “| Amazon”, “at 1stDibs”.
- Keep important qualifiers when supported by evidence.
- Keep item_name concise but specific (typically 6–18 words).

CATEGORY RULE:
- Choose one: electronics, clothing, collectible, media, toy_game, puzzle, furniture, home, other

OUTPUT SCHEMA (EXACT KEYS):
{
  "item_name": "<most specific normalized item title from Lens>",
  "category": "<category>",
  "brand": "<string or null>",
  "model": "<string or null>",
  "variant": "<string or null>",
  "key_attributes": ["<short fact>", "<short fact>", "<short fact>"],
  "best_match": {
    "title": "<raw Lens title used as strongest evidence>",
    "source": "<site/domain if present>",
    "link": "<url if present>"
  },
  "evidence_sources": ["exact_matches", "products", "visual_matches"],
  "confidence": <number between 0 and 1>
}

IMPORTANT:
- key_attributes must include only facts supported by Lens text.
- best_match must be the Lens result that most strongly supports the final item_name (not necessarily the anchor).

ANCHOR_TITLE:
{{ANCHOR_TITLE}}

Lens JSON:
{{LENS_JSON}}
"""


