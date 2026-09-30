"""Structured field extraction directly from a page IMAGE (scanned PDF page
or a plain photo/screenshot of a balance sheet, with no usable text layer)
via Gemini's multimodal input - GLM's chat endpoint has no documented image
support, Gemini's does via google-genai.

Uses `instructor` (see text_extract.py's module docstring for the shared
rationale: validated ExtractedFinancials instead of hand-parsed text, with
the balance-sheet-identity check able to trigger an automatic retry).
Mode.GENAI_STRUCTURED_OUTPUTS uses Gemini's native response_schema
support, the most robust option for this provider (unlike GLM's path in
text_extract.py, Gemini's structured-output feature is well-documented and
already exercised by google-genai directly, so there's no reason to fall
back to a prompt-only JSON mode here).
"""
from __future__ import annotations

import base64

import instructor

from ..config import settings
from .fields import EXTRACTION_INSTRUCTIONS, ExtractedFinancials, to_fields_dict


def extract_from_image(image_bytes: bytes, mime_type: str) -> dict[str, float]:
    from google import genai

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set in .env")
    client = instructor.from_genai(
        genai.Client(api_key=settings.gemini_api_key),
        mode=instructor.Mode.GENAI_STRUCTURED_OUTPUTS,
    )
    data_uri = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"
    result = client.create(
        model=settings.gemini_model,
        response_model=ExtractedFinancials,
        max_retries=2,
        messages=[
            {
                "role": "user",
                "content": [EXTRACTION_INSTRUCTIONS, instructor.Image.from_base64(data_uri)],
            }
        ],
    )
    return to_fields_dict(result)
