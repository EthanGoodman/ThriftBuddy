from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import base64
import os
from openai import OpenAI

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EXTRACTION_PROMPT = """
You are an expert product identifier for second-hand marketplaces.

Analyze the uploaded image and extract ONLY information that is directly visible or strongly supported by the image.

Do NOT hallucinate brand names, models, years, or artists unless visible text or unmistakable visual evidence supports it.

If unsure, return null and lower confidence.

Extract all readable text from:
- tags / labels
- printed graphics (front and back)
- packaging text
- copyright lines

Describe the graphic literally in <= 12 words.

Always attempt a best-effort specific item guess, but include a confidence score and explain uncertainty clearly.

Return ONLY valid JSON matching this schema. No extra text.

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
      "precision": "high" | "medium" | "broad"
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

@app.post("/api/py/extract-file")
async def extract_from_files(files: List[UploadFile] = File(...)):
    # Build one "content" list: prompt once + many images
    content = [{"type": "input_text", "text": EXTRACTION_PROMPT}]

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

