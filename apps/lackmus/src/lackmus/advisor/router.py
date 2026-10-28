"""POST /api/advisor/chat: grounded chat about the figures the user entered."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from . import llm
from .context import ChatRequest, build_system_prompt, to_chat_messages

router = APIRouter()

# Free-tier LLM keys sit behind this endpoint, so it is rate limited per client.
RATE_LIMIT = 20
RATE_WINDOW_S = 600
# Spoofing the client id must not let anyone spend the keys without bound: a global
# budget and a bounded table cap the total no matter how many identities are invented.
GLOBAL_LIMIT = 240
MAX_CLIENTS = 5000
_GLOBAL = "*"
_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def _client_id(request: Request) -> str:
    """The right-most X-Forwarded-For entry is the one our own proxy appended; earlier
    entries are whatever the caller sent and can be forged."""
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    return parts[-1] if parts else (request.client.host if request.client else "unknown")


def _prune(q: deque[float], now: float) -> None:
    while q and now - q[0] > RATE_WINDOW_S:
        q.popleft()


def _check_rate(client: str, now: float | None = None) -> bool:
    now = time.monotonic() if now is None else now
    with _lock:
        g = _hits[_GLOBAL]
        _prune(g, now)
        if len(g) >= GLOBAL_LIMIT:
            return False
        if client not in _hits and len(_hits) >= MAX_CLIENTS:
            for k in [k for k, v in _hits.items() if k != _GLOBAL and (not v or now - v[-1] > RATE_WINDOW_S)]:
                del _hits[k]
            if len(_hits) >= MAX_CLIENTS:
                return False
        q = _hits[client]
        _prune(q, now)
        if len(q) >= RATE_LIMIT:
            return False
        q.append(now)
        g.append(now)
        return True


class ChatResponse(BaseModel):
    reply: str
    provider: str


@router.post("/api/advisor/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request) -> ChatResponse:
    if not llm.providers():
        raise HTTPException(503, "The advisor is not configured on this server (no LLM key).")
    if not _check_rate(_client_id(request)):
        raise HTTPException(429, "Too many questions in a short time. Please wait a few minutes.")
    try:
        reply, provider = llm.complete(build_system_prompt(req.context), to_chat_messages(req))
    except llm.NoProviderConfigured as e:
        raise HTTPException(503, str(e)) from e
    except Exception as e:
        raise HTTPException(502, f"The advisor could not answer right now ({type(e).__name__}).") from e
    return ChatResponse(reply=reply, provider=provider)
