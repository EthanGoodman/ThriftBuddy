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
You are an expert at identifying the EXACT retail product from Google Lens API JSON results.

Your goal is NOT to be generic.
Your goal is to return the most specific product identity that is explicitly present in the Lens JSON
(e.g., full product title, brand, set/edition, piece count, character, subtitle, model number).

STRICT OUTPUT RULES (MUST FOLLOW):
- Output ONLY valid raw JSON (no markdown, no code fences, no extra text).
- Do NOT explain your reasoning.
- Confidence MUST be a number between 0 and 1.
- If a field is unknown, set it to null (do not omit keys).

EVIDENCE-FIRST RULES:
- You may ONLY use details that appear in the Lens JSON text fields (titles, snippets, source names, link text, rich snippets).
- Do NOT invent details.
- If multiple results point to the same exact product, merge their details.

PRIORITY OF SIGNAL (MOST IMPORTANT FIRST):
1) exact_matches (or closest equivalent in the JSON)
2) products
3) visual_matches
4) about_this_image / related searches (lowest priority)

SPECIFICITY RULES (CRITICAL):
- item_name MUST be the MOST SPECIFIC product name supported by Lens.
  - Prefer a full title copied/normalized from the best match.
  - Include unique identifiers if present: piece count, subtitle, series, edition, set name, model number, SKU, year.
  - If Lens provides only generic results, item_name may be generic — but ONLY then.
- If you see multiple near-identical product titles, choose the one with the most distinguishing information.

NORMALIZATION RULES:
- Remove store fluff like “Free Shipping”, “Brand New”, “Sale”, emojis, and repeated whitespace.
- Keep important qualifiers: brand, line/series, subtitle, piece count, edition, model/set numbers.
- Keep it short but specific (typically 6–18 words).

CATEGORY RULES:
- Choose one: electronics, clothing, collectible, media, toy_game, puzzle, furniture, home, other

OUTPUT SCHEMA (EXACT KEYS):
{
  "item_name": "<most specific normalized product title from Lens>",
  "category": "<category>",
  "brand": "<string or null>",
  "model": "<string or null>",
  "variant": "<string or null>",
  "key_attributes": ["<short fact>", "<short fact>", "<short fact>"],
  "best_match": {
    "title": "<raw title string from Lens used as primary evidence>",
    "source": "<source/domain or site name if present>",
    "link": "<url if present>"
  },
  "evidence_sources": ["exact_matches", "products", "visual_matches"],
  "confidence": <number between 0 and 1>
}

IMPORTANT:
- key_attributes must include only facts supported by Lens text (e.g., "1000-piece", "Star Wars: The Mandalorian", "Ravensburger", "jigsaw puzzle").
- If the Lens JSON contains a piece count, subtitle, or edition, include it in item_name and key_attributes.

Lens JSON:
{{LENS_JSON}}
"""


