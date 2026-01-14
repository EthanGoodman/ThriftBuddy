from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import base64
import os
from openai import OpenAI

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EXTRACTION_PROMPT = """
You are an expert product identifier for second-hand marketplaces.

Your goal is to identify items as specifically as possible using visual evidence,
while generating strong search hypotheses when exact identification is not visually confirmed.

PRIMARY SOURCE OF TRUTH:
- The image(s) are the primary source of truth.
- Optional user-provided text may be missing, incomplete, or incorrect.

Analyze the uploaded image(s) and extract information that is:
- directly visible in the image, OR
- strongly supported by visible features and construction.

────────────────────────────────────────────
OPTIONAL USER TEXT (may be missing or incorrect)
────────────────────────────────────────────
If user-provided text is present:
- Treat it as a hint, not ground truth.
- Use it to guide what to look for (labels, mechanisms, materials, era cues).
- Use it to refine search queries and disambiguation questions.
- Do NOT copy claims from user text into brand/model/year fields unless:
  (a) the image visually supports them, OR
  (b) uncertainty is clearly explained and confidence is reduced.
- If user text conflicts with the image, trust the image and note the conflict in reasoning.
- If user text is vague (e.g., “rare”, “vintage”, “expensive”), do not treat it as evidence.

────────────────────────────────────────────
IDENTIFICATION STRATEGY (DO NOT STOP EARLY)
────────────────────────────────────────────
When identifying the item, do NOT stop at a generic category if the image supports more specificity.

If the exact brand or model cannot be visually confirmed, you MUST still identify:
- the functional subtype
- the intended user (consumer, professional, industrial, hobbyist)
- the design class or configuration

Acceptable descriptive specificity WITHOUT guessing brands/models includes:
- “turntable” → “direct-drive DJ turntable” → “broadcast-style transcription turntable”
- “camera” → “35mm SLR” → “manual-focus mechanical SLR”
- “jacket” → “varsity jacket” → “wool varsity jacket with chenille patches”
- “CD holder” → “teak CD rack” → “push-button eject CD storage system”

Only stop increasing specificity when further detail would require guessing unseen information.

────────────────────────────────────────────
DISTINCTIVE FEATURE PRIORITY (CRITICAL)
────────────────────────────────────────────
Actively search for and prioritize distinctive or identity-bearing features, including:
- unusual mechanisms (e.g., push-button eject, spring-loaded slots)
- moving parts or user interactions
- joinery or construction methods
- materials and finishes (e.g., teak, solid wood vs veneer)
- mounting hardware (wall-mount vs freestanding)
- modularity, capacity, or layout patterns

If distinctive features are present, they MUST be reflected in:
- item_guess.specific_name
- item_guess.reasoning
- search_queries (including keywords and ebay_terms)

Generic descriptions are insufficient when distinctive construction or mechanisms are visible.

────────────────────────────────────────────
BRANDS, MODELS, AND HALLUCINATION CONTROL
────────────────────────────────────────────
Do NOT hallucinate brand names, models, years, or artists unless:
- visible text, logos, labels, or stamps support them, OR
- they are clearly presented as hypotheses in search_queries (not claims).

Brand/model hypotheses should generally appear in search_queries, NOT as factual fields.

────────────────────────────────────────────
CONFIDENCE CALIBRATION
────────────────────────────────────────────
- If brand/model/year are not visually confirmed, item_guess.confidence should generally not exceed 0.65.
- If the identification remains generic, item_guess.confidence should not exceed 0.55.
- overall_extraction_confidence should reflect completeness of evidence (images, text, features).

If unsure, return null for uncertain fields and lower confidence accordingly.

────────────────────────────────────────────
TEXT EXTRACTION
────────────────────────────────────────────
Extract all readable text from:
- tags / labels
- printed graphics (front and back)
- packaging text
- copyright lines

────────────────────────────────────────────
GRAPHIC DESCRIPTION
────────────────────────────────────────────
Describe the graphic literally in 12 words or fewer.
Do not infer meaning, brand, or value here.

────────────────────────────────────────────
SEARCH QUERY + KEYWORD GENERATION (MARKETPLACE-READY)
────────────────────────────────────────────
Generate 6–10 search query objects suitable for Google and marketplaces like eBay/Etsy.

For EACH search query object, provide:
- query: a natural-language query string (3–10 words), specific → broad across the list
- precision: high/medium/broad
- keywords: 6–20 core keywords/phrases that MUST appear (include material, form factor, mechanism)
- ebay_terms: 4–12 marketplace-preferred synonyms or phrasing (e.g., “eject”, “dispenser”, “rack”, “holder”)

Requirements:
- At least 3 queries must include distinctive mechanisms or materials.
- keywords MUST include at least one mechanism term when a mechanism is visible.
- ebay_terms should prefer common listing language over technical phrasing.
  Example: prefer “eject” over “push-button mechanism” when appropriate.
- If item appears design-forward, vintage, or specialty-made, include 1–2 candidate
  brand/designer queries as hypotheses (not claims).

────────────────────────────────────────────
DISAMBIGUATION REQUIREMENT
────────────────────────────────────────────
If brand/model/year are not visually confirmed, include 3–6 disambiguation_questions.
Questions should focus on confirming identity (underside/back, labels/stamps, mechanism close-ups,
mounting hardware, measurements, capacity).

────────────────────────────────────────────
OUTPUT REQUIREMENTS
────────────────────────────────────────────
Always attempt a best-effort specific item guess.
Explain uncertainty clearly.
Return ONLY valid JSON matching the schema below.
Do NOT include any extra text outside the JSON.

Schema:

{
  "item_guess": {
    "specific_name": string | null,
    "brand": string | null,
    "collection_or_artist": string | null,
    "year_or_era": string | null,
    "confidence": number (0–1),
    "reasoning": string
  },

  "physical_attributes": {
    "item_type": string,
    "category": string | null,
    "color": string | null,
    "material": string | null,
    "size_visible": string | null
  },

  "visible_text": {
    "tag_text": string,
    "front_print_text": string,
    "back_print_text": string,
    "copyright_text": string
  },

  "graphic_description": string,

  "condition_guess": string | null,

  "identifiers": {
    "upc": string | null,
    "serial_number": string | null,
    "other": string | null
  },

  "search_queries": [
    {
      "query": string,
      "precision": "high" | "medium" | "broad",
      "keywords": [string],
      "ebay_terms": [string],
    }
  ],

  "disambiguation_questions": [string],

  "overall_extraction_confidence": number (0–1)
}
"""

from typing import List
from fastapi import UploadFile, File
from fastapi.responses import JSONResponse
import base64

from typing import List, Optional
from fastapi import File, Form, UploadFile
from fastapi.responses import JSONResponse
import base64

@app.post("/api/py/extract-file")
async def extract_from_files(
    files: List[UploadFile] = File(...),
    text: Optional[str] = Form(None),  # <-- NEW
):
    # Build one "content" list: prompt once + optional user text + many images
    content = [{"type": "input_text", "text": EXTRACTION_PROMPT}]

    # NEW: include user-provided text if present
    if text and text.strip():
        content.append({"type": "input_text", "text": text.strip()})

    for f in files:
        img_bytes = await f.read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:{f.content_type};base64,{b64}"

        content.append({"type": "input_image", "image_url": data_url})

    resp = client.responses.create(
        model="gpt-4o-mini",
        input=[{
            "role": "user",
            "content": content,
        }],
        max_output_tokens=900,
    )

    return JSONResponse({"raw_result": resp.output_text})


