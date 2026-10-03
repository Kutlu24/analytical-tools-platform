"""FastAPI backend for Financial Compass. Run with:
    uvicorn lackmus.api.app:app --reload

Endpoints:
    POST /api/extract-balance-sheet   multipart file upload -> {fields: {...}}

The existing frontend (index.html/script.js/style.css) is entirely
client-side and untouched except for the new "Upload Document" tab, which
POSTs here and then auto-fills the same manual-entry form fields the
ratio calculator already reads - no change to the ratio math itself.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..extraction.pdf_handling import extract_pdf_text, has_usable_text_layer, rasterize_first_page
from ..extraction.text_extract import extract_from_text
from ..extraction.vision_extract import extract_from_image

def _allowed_origins() -> list[str]:
    """CORS allowlist: ALLOWED_ORIGINS env (comma-separated) plus this
    service's RENDER_EXTERNAL_URL; localhost only when not on Render."""
    origins = [
        o.strip()
        for o in os.environ.get("ALLOWED_ORIGINS", "").split(",")
        if o.strip()
    ]
    render_url = os.environ.get("RENDER_EXTERNAL_URL")
    if render_url and render_url not in origins:
        origins.append(render_url)
    if not render_url and not origins:
        origins = [
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:5173",
        ]
    return origins


app = FastAPI(title="Financial Compass (Lackmus) backend")
app.add_middleware(
    CORSMiddleware, allow_origins=_allowed_origins(), allow_methods=["*"], allow_headers=["*"]
)


@app.middleware("http")
async def _security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
    )
    return response


class ExtractResponse(BaseModel):
    fields: dict[str, float]
    source: str  # "pdf-text" | "pdf-scanned-vision" | "image-vision"


_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


@app.post("/api/extract-balance-sheet", response_model=ExtractResponse)
async def extract_balance_sheet(file: UploadFile) -> ExtractResponse:
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    content_type = (file.content_type or "").lower()
    is_pdf = content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf")

    try:
        if is_pdf:
            has_text, text = has_usable_text_layer(content)
            if has_text:
                fields = extract_from_text(text)
                source = "pdf-text"
            else:
                image_bytes = rasterize_first_page(content)
                fields = extract_from_image(image_bytes, "image/png")
                source = "pdf-scanned-vision"
        elif content_type in _IMAGE_MIME_TYPES or (file.filename or "").lower().endswith(
            (".png", ".jpg", ".jpeg", ".webp")
        ):
            mime = content_type if content_type in _IMAGE_MIME_TYPES else "image/png"
            fields = extract_from_image(content, mime)
            source = "image-vision"
        else:
            raise HTTPException(415, f"Unsupported file type: {content_type or file.filename}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Extraction failed ({type(e).__name__}): {str(e)[:300]}") from e

    return ExtractResponse(fields=fields, source=source)


@app.get("/health", include_in_schema=False)
def health() -> dict:
    return {"status": "ok"}


# Serve the existing static frontend (index.html/script.js/style.css) from
# frontend/ - NOT the repo root, which would also expose .env, src/, etc.
# through StaticFiles.
@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="ui/")


_FRONTEND_DIR = Path(__file__).resolve().parents[3] / "frontend"
if (_FRONTEND_DIR / "index.html").exists():
    app.mount("/ui", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="ui")
