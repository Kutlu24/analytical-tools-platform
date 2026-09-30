from __future__ import annotations

from fastapi import HTTPException


def friendly_error(exc: Exception) -> HTTPException:
    name = type(exc).__name__
    msg = str(exc)
    if "RateLimit" in name or "429" in msg or "quota" in msg.lower():
        return HTTPException(503, "The AI service is rate-limited or overloaded. Please try again shortly.")
    if isinstance(exc, RuntimeError) and "API_KEY" in msg:
        return HTTPException(500, f"Configuration error: {msg}")
    return HTTPException(500, f"Unexpected error ({name}): {msg[:200]}")
