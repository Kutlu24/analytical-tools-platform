"""PDF text extraction and page rasterization via PyMuPDF (pure-Python
wheel, no system dependency like poppler) - one module handles both the
text-layer path and the fallback image path so the router doesn't need two
different PDF libraries.
"""
from __future__ import annotations

# A text-layer PDF should yield far more than this per page for a real
# balance sheet; below this, treat it as scanned/image-only and fall back
# to the vision path instead of feeding the LLM a near-empty document.
_MIN_TEXT_CHARS = 200
# Bounds for a file a stranger uploads: a balance sheet is a few pages, and a PDF page can declare any size.
MAX_TEXT_PAGES = 30
MAX_TEXT_CHARS = 120_000
MAX_PAGE_PIXELS = 20_000_000


def extract_pdf_text(pdf_bytes: bytes) -> str:
    import pymupdf as fitz  # PyMuPDF (import name changed from "fitz"; alias kept for readability)

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        parts, total = [], 0
        for i, page in enumerate(doc):
            if i >= MAX_TEXT_PAGES or total >= MAX_TEXT_CHARS:
                break
            text = page.get_text()[: MAX_TEXT_CHARS - total]
            parts.append(text)
            total += len(text)
        return "\n".join(parts)
    finally:
        doc.close()


def has_usable_text_layer(pdf_bytes: bytes) -> tuple[bool, str]:
    text = extract_pdf_text(pdf_bytes)
    return len(text.strip()) >= _MIN_TEXT_CHARS, text


def rasterize_first_page(pdf_bytes: bytes, zoom: float = 2.0) -> bytes:
    """Renders page 1 to a PNG at `zoom`x the default 72dpi (so ~144dpi,
    legible for a model to read numbers off of) - used when the PDF has no
    real text layer (scanned document)."""
    import pymupdf as fitz  # PyMuPDF (import name changed from "fitz"; alias kept for readability)

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("PDF has no pages")
        page = doc.load_page(0)
        area = max(1.0, page.rect.width * page.rect.height)
        zoom = min(zoom, (MAX_PAGE_PIXELS / area) ** 0.5)  # the bitmap stays under the cap whatever size the page claims
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        return pix.tobytes("png")
    finally:
        doc.close()
