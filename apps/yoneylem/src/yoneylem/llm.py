"""Thin LLM call wrappers - GLM (default, OpenAI-compatible endpoint) and
Gemini as an alternate provider. Two modes: plain text completion (for the
final natural-language explanation) and JSON-mode completion (for parsing
a user's problem description into a structured formulation the real
solver consumes - the LLM's JSON output is a PARSE, never the answer
itself; the answer always comes from pulp/queueing.py's real computation).
"""
from __future__ import annotations

import json
import re

from .config import settings


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    return m.group(1) if m else text


def _call_glm_text(system: str, user: str, json_mode: bool = False) -> str:
    from openai import OpenAI

    if not settings.glm_api_key:
        raise RuntimeError("GLM_API_KEY not set in .env")
    client = OpenAI(api_key=settings.glm_api_key, base_url=settings.glm_base_url)
    kwargs = {}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(
        model=settings.glm_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        **kwargs,
    )
    return response.choices[0].message.content


def _call_gemini_text(system: str, user: str, json_mode: bool = False) -> str:
    from google import genai
    from google.genai import types

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set in .env")
    client = genai.Client(api_key=settings.gemini_api_key)
    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if json_mode else "text/plain",
    )
    response = client.models.generate_content(
        model=settings.gemini_model, contents=user, config=config
    )
    return response.text


_CALLERS = {"glm": _call_glm_text, "gemini": _call_gemini_text}


def complete(system: str, user: str) -> str:
    return _CALLERS[settings.chat_provider](system, user, json_mode=False)


def complete_json(system: str, user: str) -> dict:
    raw = _CALLERS[settings.chat_provider](system, user, json_mode=True)
    return json.loads(_strip_json_fence(raw))
