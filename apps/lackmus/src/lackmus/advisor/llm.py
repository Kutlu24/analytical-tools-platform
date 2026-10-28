"""Plain chat completion for the advisor: GLM first (free tier, OpenAI-compatible
endpoint), Gemini as fallback. The extraction code uses instructor for structured
output; here free text is wanted, so the thin clients are used directly.

Providers are tried in order and a provider that errors or returns empty text is
skipped (GLM's reasoning models sometimes spend the whole budget thinking and
return nothing, hence thinking is switched off).
"""
from __future__ import annotations

import logging
from collections.abc import Callable

from openai import OpenAI

from ..config import settings

log = logging.getLogger(__name__)

MAX_TOKENS = 900
TIMEOUT_S = 45


class NoProviderConfigured(RuntimeError):
    pass


def _glm(system: str, messages: list[dict[str, str]]) -> str:
    client = OpenAI(api_key=settings.glm_api_key, base_url=settings.glm_base_url, timeout=TIMEOUT_S)
    resp = client.chat.completions.create(
        model=settings.glm_model,
        temperature=0.3,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "system", "content": system}, *messages],
        extra_body={"thinking": {"type": "disabled"}},
    )
    return (resp.choices[0].message.content or "").strip()


def _gemini(system: str, messages: list[dict[str, str]]) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    contents = [
        types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part(text=m["content"])])
        for m in messages
    ]
    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system, temperature=0.3, max_output_tokens=MAX_TOKENS),
    )
    return (resp.text or "").strip()


def providers() -> list[tuple[str, Callable[[str, list[dict[str, str]]], str]]]:
    out: list[tuple[str, Callable[[str, list[dict[str, str]]], str]]] = []
    if settings.glm_api_key:
        out.append(("glm", _glm))
    if settings.gemini_api_key:
        out.append(("gemini", _gemini))
    return out


def complete(system: str, messages: list[dict[str, str]]) -> tuple[str, str]:
    """Returns (reply, provider). Raises NoProviderConfigured or RuntimeError."""
    available = providers()
    if not available:
        raise NoProviderConfigured("No LLM key configured (GLM_API_KEY or GEMINI_API_KEY)")
    last: Exception | None = None
    for name, fn in available:
        try:
            text = fn(system, messages)
            if text:
                return text, name
            log.warning("advisor: %s returned empty content", name)
        except Exception as e:  # noqa: BLE001 - any provider failure falls through to the next
            log.warning("advisor: %s failed: %s", name, type(e).__name__)
            last = e
    raise RuntimeError(f"All providers failed ({type(last).__name__ if last else 'empty reply'})")
