"""The exact field-id schema the frontend's ratio calculator consumes (see
script.js's `fields` arrays and `rasyolar` computation) - the extraction
prompt below must emit JSON keys matching these ids EXACTLY, since the
frontend just does `document.getElementById(fieldId).value = obj[fieldId]`
for each one. Do not rename these - they're the frontend's contract, not
free choice on the backend side.
"""
from __future__ import annotations

from pydantic import BaseModel, model_validator

# field_id -> plain-English description, used to build the extraction
# prompt so it works regardless of the source document's own language or
# exact line-item naming.
FIELD_DESCRIPTIONS: dict[str, str] = {
    "donenVarliklar": "Total current assets",
    "stoklar": "Inventory / stock",
    "nakit": "Cash and cash equivalents",
    "toplamAktif": "Total assets",
    "kisaVadeliBorclar": "Total current liabilities (short-term debt)",
    "uzunVadeliBorclar": "Total long-term / non-current liabilities",
    "toplamBorclar": "Total liabilities (short-term + long-term debt combined)",
    "ozkaynak": "Total equity / shareholders' equity",
    "netSatislar": "Net sales / net revenue",
    "brutKar": "Gross profit",
    "faaliyetKari": "Operating profit / EBIT",
    "netKar": "Net profit / net income",
    "alacaklar": "Trade accounts receivable",
    "faizGiderleri": "Interest expense",
    "eps": "Earnings per share (EPS), if disclosed",
    "hisseFiyati": "Current share price, if disclosed",
}

FIELD_IDS: list[str] = list(FIELD_DESCRIPTIONS.keys())

_FIELD_LIST_BLOCK = "\n".join(f'- "{k}": {v}' for k, v in FIELD_DESCRIPTIONS.items())

EXTRACTION_INSTRUCTIONS = f"""You are extracting structured financial data from a company balance \
sheet / income statement document (which may be in any language and any layout).

Find values for as many of the following fields as the document actually contains. Use these \
EXACT field-id keys in your JSON output (not translations, not the description text):

{_FIELD_LIST_BLOCK}

Rules:
- Output ONLY a single JSON object, no markdown fences, no commentary before or after it.
- Every value must be a plain number (no currency symbols, no thousands separators, no quotes) \
in whatever the document's base currency unit is (do not divide by 1000 even if the document is \
itself already in thousands - use the numbers as printed).
- If a field is not present in the document, OMIT that key entirely - do not guess, do not \
output 0 for a missing field.
- toplamBorclar (total liabilities) should be short-term + long-term liabilities combined if the \
document states both separately and a combined total isn't explicitly printed - only compute this \
one derived sum; do not derive any other field.
- If the document text is unreadable/garbled/not a financial statement at all, output {{}}."""


class ExtractedFinancials(BaseModel):
    """One field per FIELD_IDS entry, built dynamically so this can never
    drift from the frontend contract above - see `_build_extracted_model`.
    Every field is optional (`float | None`): a document legitimately won't
    contain all sixteen (an income-statement-only page has no balance-sheet
    fields at all), and the extraction prompt explicitly tells the model to
    omit rather than guess a missing one - the schema has to allow that, not
    force it to invent a value just to satisfy validation.
    """

    # Observed against the real GLM API (2026-09-25): when the source text
    # itself contains internally-inconsistent numbers, the retry can make
    # the model quietly change the reported toplamAktif to match
    # toplamBorclar + ozkaynak instead of preserving what the document
    # actually states - it "fixes" the figure to satisfy validation rather
    # than surfacing that the source itself doesn't add up. That's still a
    # real improvement over the old code (which had no check at all and
    # would have silently returned the literal 9-million-style figure with
    # no flag whatsoever), but it means a validated response is not a
    # guarantee the numbers match the source verbatim - the frontend's
    # existing "please verify these numbers against the original" warning
    # (script.js) remains load-bearing, not just a formality.
    @model_validator(mode="after")
    def _check_balance_sheet_identity(self) -> "ExtractedFinancials":
        # Real accounting rule (assets = liabilities + equity), not just
        # something the prompt used to ask the model to self-apply -
        # enforced here so instructor actually retries a violation instead
        # of the app silently trusting whatever the model returned.
        aktif, borclar, ozkaynak = self.toplamAktif, self.toplamBorclar, self.ozkaynak
        if aktif is None or borclar is None or ozkaynak is None:
            return self  # can't check an identity across fields the document didn't have
        expected = borclar + ozkaynak
        # Tolerance, not exact equality: real statements go through OCR/text
        # extraction noise and the document's own rounding (e.g. printed in
        # whole units vs. thousands) before this ever reaches the model -
        # 1% of total assets (floor 1.0 so tiny statements aren't exempted
        # from the check entirely) catches a genuinely wrong extraction
        # without flagging routine rounding as a fabricated retry loop.
        tolerance = max(abs(aktif) * 0.01, 1.0)
        if abs(aktif - expected) > tolerance:
            raise ValueError(
                f"toplamAktif ({aktif}) should equal toplamBorclar + ozkaynak "
                f"({borclar} + {ozkaynak} = {expected}) within {tolerance:.2f} - "
                f"got a difference of {abs(aktif - expected):.2f}"
            )
        return self


def _build_extracted_model() -> type[ExtractedFinancials]:
    """Adds one `float | None = None` field per FIELD_IDS to
    ExtractedFinancials dynamically, so a field added/removed in
    FIELD_DESCRIPTIONS above is the only place that ever needs editing -
    the validated schema can't silently drift from the frontend contract."""
    from pydantic import create_model

    return create_model(
        "ExtractedFinancials",
        __base__=ExtractedFinancials,
        **{field_id: (float | None, None) for field_id in FIELD_IDS},
    )


ExtractedFinancials = _build_extracted_model()


def to_fields_dict(result: ExtractedFinancials) -> dict[str, float]:
    """Same contract `_clean_fields` used to produce: only the fields the
    document actually had, not every key with Nones filled in - the
    frontend's `Object.keys(extracted)` count and per-field DOM-fill both
    depend on absent keys meaning "not extracted", not "extracted as null"."""
    return {k: v for k, v in result.model_dump().items() if v is not None}
