"""Analytical Tools Platform - one FastAPI app hosting three analytical tools.

Routes:
    GET  /              -> hub page (tool directory)
    /yoneylem/...       -> Operations Research Center (LP/IP solver + queueing)
    /finans/...         -> Financial Compass (Lackmus) balance-sheet analysis
    /petrinets/...      -> Petri-net hotel pricing simulator

Each tool keeps its own FastAPI sub-app; they are mounted as-is so their
/docs, /config and tool-specific endpoints stay intact under the prefix.
Run with:
    uvicorn platform.app:app --host 0.0.0.0 --port $PORT
"""
from __future__ import annotations

import os
import re
from html import escape
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from lackmus.api.app import app as lackmus_app
from petrinets.api.app import app as petrinets_app
from yoneylem.api.app import app as yoneylem_app

from .guard import Guard

_STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Analytical Tools Platform",
    description="Operations research, financial analysis and Petri-net simulation under one roof.",
)


_HOST = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(?::\d{1,5})?$")


def _safe_host(request: Request) -> str:
    """The Host / X-Forwarded-Host headers are text from the client and end up inside HTML, the sitemap and robots.txt:
    only a plain host name (optionally with a port) is accepted, anything else falls back."""
    for cand in (request.headers.get("x-forwarded-host", "").split(",")[0].strip(), request.url.netloc):
        if cand and _HOST.match(cand):
            return cand
    return "localhost"


def _site(request: Request) -> str:
    """Public base URL: SITE_URL env var if set, else the (proxy-forwarded) request origin, https off localhost."""
    env = os.environ.get("SITE_URL")
    if env:
        return env.rstrip("/")
    render = os.environ.get("RENDER_EXTERNAL_URL")  # set by Render itself: on Render no request header decides the origin
    if render and re.match(r"^https?://[A-Za-z0-9.-]+(:\d+)?/?$", render):
        return render.rstrip("/")
    host = _safe_host(request)
    proto = "http"  # local development; everything else is https (set just below)
    if host.split(":")[0] not in ("localhost", "127.0.0.1", "testserver"):
        proto = "https"
    return f"{proto}://{host}"


_TOOL_PATHS = ("/", "/yoneylem/ui/", "/finans/ui/", "/petrinets/ui/")

# Search-style AI crawlers are welcome; training-only crawlers are blocked.
# Edit here to change the policy.
_ALLOW = ("OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User")
_BLOCK = ("GPTBot", "ClaudeBot", "Google-Extended", "CCBot")


@app.get("/", include_in_schema=False)
def index(request: Request) -> HTMLResponse:
    site = _site(request)
    html = (_STATIC_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html.replace("__SITE__", escape(site, quote=True)))


@app.get("/robots.txt", include_in_schema=False)
def robots(request: Request) -> PlainTextResponse:
    lines = ["User-agent: *", "Allow: /", "Disallow: /docs", "Disallow: /openapi.json", ""]
    for bot in _ALLOW:
        lines += [f"User-agent: {bot}", "Allow: /", ""]
    for bot in _BLOCK:
        lines += [f"User-agent: {bot}", "Disallow: /", ""]
    lines.append(f"Sitemap: {_site(request)}/sitemap.xml")
    return PlainTextResponse("\n".join(lines) + "\n")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap(request: Request) -> Response:
    site = _site(request)
    urls = "".join(f"<url><loc>{escape(site + p)}</loc></url>" for p in _TOOL_PATHS)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
    return Response(xml, media_type="application/xml")


@app.get("/llms.txt", include_in_schema=False)
def llms(request: Request) -> PlainTextResponse:
    site = _site(request)
    return PlainTextResponse(
        "# Analytical Tools Platform\n\n"
        "> Free web tools: operations research (LP/IP, queueing), financial statement ratio analysis, "
        "and Petri-net hotel pricing simulation. Computation is deterministic code; LLMs only parse and explain.\n\n"
        f"- [Operations Research Center]({site}/yoneylem/ui/): LP/IP and M/M/1, M/M/c solver\n"
        f"- [Financial Compass]({site}/finans/ui/): ratio analysis, DuPont, charts\n"
        f"- [Hotel Pricing Simulator]({site}/petrinets/ui/): Petri-net booking simulation\n"
    )


@app.get("/health", include_in_schema=False)
def health() -> dict:
    return {"status": "ok"}


app.add_middleware(Guard)  # rate limits and body caps for the costly endpoints of all three tools (see guard.py)

app.mount("/yoneylem", yoneylem_app)
app.mount("/finans", lackmus_app)
app.mount("/petrinets", petrinets_app)

app.mount("/hub-static", StaticFiles(directory=str(_STATIC_DIR)), name="hub-static")
