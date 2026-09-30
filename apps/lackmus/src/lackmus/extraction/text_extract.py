"""Structured field extraction from already-readable text (a text-layer PDF)
via GLM - the free-tier text LLM already used elsewhere in this account.

Uses `instructor` to get back an already-validated `ExtractedFinancials`
instead of hand-parsing raw text: no more stripping ```json fences /
regex-searching for the first {...} block, and the balance-sheet-identity
check in fields.py runs on every response - if the model's first attempt
violates it (or returns something that doesn't parse as the schema at
all), instructor automatically retries with the validation error fed back
to the model, up to `max_retries`, instead of the app just trusting
whatever text came back.

Mode.MD_JSON (prompt for JSON, parse it out of the response - the same
shape of behaviour the old hand-rolled parser assumed) rather than
Mode.TOOLS: GLM's chat endpoint here is only documented as OpenAI-
*compatible* chat completions, with no confirmed native function/tool-
calling support - MD_JSON only depends on the model following a text
instruction, which is what EXTRACTION_INSTRUCTIONS already does, so it
doesn't add a new capability requirement on top of what was already
working.
"""
from __future__ import annotations

import instructor
from openai import OpenAI

from ..config import settings
from .fields import EXTRACTION_INSTRUCTIONS, ExtractedFinancials, to_fields_dict


def extract_from_text(document_text: str) -> dict[str, float]:
    if not settings.glm_api_key:
        raise RuntimeError("GLM_API_KEY not set in .env")
    client = instructor.from_openai(
        OpenAI(api_key=settings.glm_api_key, base_url=settings.glm_base_url),
        mode=instructor.Mode.MD_JSON,
    )
    result = client.chat.completions.create(
        model=settings.glm_model,
        response_model=ExtractedFinancials,
        max_retries=2,
        messages=[
            {"role": "system", "content": EXTRACTION_INSTRUCTIONS},
            {"role": "user", "content": f"Document text:\n\n{document_text[:20000]}"},
        ],
    )
    return to_fields_dict(result)
