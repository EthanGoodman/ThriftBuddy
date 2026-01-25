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
