"""Tests for the ExtractedFinancials schema/validator - the part testable
without a live LLM call (extract_from_text/extract_from_image themselves
were verified manually against the real GLM/Gemini APIs, see the commit
message; not re-run here since that would require live API keys in CI)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from lackmus.extraction.fields import FIELD_IDS, ExtractedFinancials, to_fields_dict


def test_all_field_ids_present_as_model_fields():
    missing = [f for f in FIELD_IDS if f not in ExtractedFinancials.model_fields]
    assert missing == []


def test_balanced_statement_passes():
    m = ExtractedFinancials(toplamAktif=1000, toplamBorclar=600, ozkaynak=400)
    assert m.toplamAktif == 1000


def test_unbalanced_statement_raises():
    with pytest.raises(ValidationError):
        ExtractedFinancials(toplamAktif=1000, toplamBorclar=600, ozkaynak=100)


def test_rounding_within_one_percent_tolerated():
    # 1000 vs 600+399 = 999 - within the 1% tolerance, should not raise
    ExtractedFinancials(toplamAktif=1000, toplamBorclar=600, ozkaynak=399)


def test_missing_fields_skip_the_identity_check():
    # No balance-sheet fields at all (e.g. an income-statement-only page) -
    # nothing to check, must not raise.
    m = ExtractedFinancials(netSatislar=100, netKar=10)
    assert m.toplamAktif is None


def test_to_fields_dict_omits_none_fields():
    m = ExtractedFinancials(netSatislar=100, netKar=10)
    assert to_fields_dict(m) == {"netSatislar": 100.0, "netKar": 10.0}
