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

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from lackmus.api.app import app as lackmus_app
from petrinets.api.app import app as petrinets_app
from yoneylem.api.app import app as yoneylem_app

_STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Analytical Tools Platform",
    description="Operations research, financial analysis and Petri-net simulation under one roof.",
)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(_STATIC_DIR / "index.html")


@app.get("/health", include_in_schema=False)
def health() -> dict:
    return {"status": "ok"}


app.mount("/yoneylem", yoneylem_app)
app.mount("/finans", lackmus_app)
app.mount("/petrinets", petrinets_app)

app.mount("/hub-static", StaticFiles(directory=str(_STATIC_DIR)), name="hub-static")
