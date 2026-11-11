"""Limits in front of the three tools (src/atp/guard.py) and the bounds inside them. No LLM is called."""
import pytest
from fastapi.testclient import TestClient
from lackmus.api import app as lapp
from petrinets.api import app as papp
from yoneylem import lp_solver
from yoneylem.api import app as yapp
from yoneylem.models import LPConstraint, LPFormulation, ParsedProblem, QueueingParams

from atp import guard
from atp.app import app


@pytest.fixture
def c(monkeypatch):
    guard.limiter.reset()
    monkeypatch.setattr(yapp, "parse_problem", lambda q: ParsedProblem(problem_type="other"))
    return TestClient(app)


def test_costly_endpoint_is_limited_per_client_and_others_are_not_affected(c, monkeypatch):
    monkeypatch.setitem(guard.RULES, "/yoneylem/solve", (3, 100))
    codes = [c.post("/yoneylem/solve", json={"question": "q"}).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = c.post("/yoneylem/solve", json={"question": "q"})
    assert int(r.headers["retry-after"]) >= 1 and "wait" in r.json()["detail"]
    assert c.post("/yoneylem/solve", json={"question": "q"}, headers={"X-Forwarded-For": "203.0.113.9"}).status_code == 200
    assert c.get("/health").status_code == 200 and c.get("/yoneylem/config").status_code == 200


def test_forged_forwarding_entries_do_not_give_a_fresh_identity(c, monkeypatch):
    monkeypatch.setitem(guard.RULES, "/yoneylem/solve", (2, 100))
    # the caller writes whatever it likes on the left; our proxy appends the real address on the right
    codes = [c.post("/yoneylem/solve", json={"question": "q"}, headers={"X-Forwarded-For": f"10.9.9.{i}, 198.51.100.7"}).status_code for i in range(4)]
    assert codes == [200, 200, 429, 429]


def test_global_budget_holds_against_many_addresses(c, monkeypatch):
    monkeypatch.setitem(guard.RULES, "/yoneylem/solve", (5, 6))
    codes = [c.post("/yoneylem/solve", json={"question": "q"}, headers={"X-Forwarded-For": f"198.51.100.{i}"}).status_code for i in range(9)]
    assert codes == [200] * 6 + [429] * 3


def test_client_table_has_a_fixed_size_and_ipv6_counts_per_64(monkeypatch):
    lim = guard.Limiter(clock=lambda: 100.0)
    monkeypatch.setattr(guard, "MAX_CLIENTS", 20)
    monkeypatch.setitem(guard.RULES, "/x", (2, 10**9))
    for i in range(500):
        assert lim.check("/x", guard.bucket(f"10.0.{i // 250}.{i % 250}")) == 0
    assert len(lim._clients) == 20
    assert guard.bucket("2a02:1:2:300::1") == guard.bucket("2a02:1:2:3ff:ffff::9") != guard.bucket("2a02:1:2:400::1")
    assert guard.bucket("::ffff:192.0.2.7") == "192.0.2.7" and guard.bucket("nonsense") == "unknown"


def test_bodies_are_capped_also_when_streamed(c):
    big = b'{"question": "' + b"x" * (guard.DEFAULT_BODY + 10) + b'"}'
    assert c.post("/yoneylem/solve", content=big, headers={"Content-Type": "application/json"}).status_code == 413
    chunks = (b"y" * 4096 for _ in range(40))
    assert c.post("/petrinets/recommend", content=chunks, headers={"Content-Type": "application/json"}).status_code == 413
    assert c.post("/yoneylem/solve", content=b"{}", headers={"Content-Type": "application/json", "Content-Length": "x"}).status_code == 400
    assert c.get("/health").status_code == 200


def test_upload_size_and_error_text(c, monkeypatch):
    monkeypatch.setattr(lapp, "MAX_UPLOAD_BYTES", 1000)
    r = c.post("/finans/api/extract-balance-sheet", files={"file": ("b.png", b"\x89PNG" + b"z" * 5000, "image/png")})
    assert r.status_code == 413
    monkeypatch.setattr(lapp, "extract_from_image", lambda *a: (_ for _ in ()).throw(RuntimeError("key=sk-secret /srv/app/.env")))
    r = c.post("/finans/api/extract-balance-sheet", files={"file": ("b.png", b"\x89PNG" + b"z" * 50, "image/png")})
    assert r.status_code == 500 and "sk-secret" not in r.text and ".env" not in r.text and "RuntimeError" in r.text
    assert c.post("/finans/api/extract-balance-sheet", files={"file": ("b.exe", b"MZ", "application/x-msdownload")}).status_code == 415


def test_solver_refuses_huge_problems_and_has_a_time_limit(c, monkeypatch):
    big = LPFormulation(sense="max", variables=[f"x{i}" for i in range(lp_solver.MAX_VARIABLES + 1)], objective={"x0": 1}, constraints=[])
    with pytest.raises(ValueError):
        lp_solver.solve_lp(big)
    monkeypatch.setattr(yapp, "parse_problem", lambda q: ParsedProblem(problem_type="lp", lp=big))
    assert c.post("/yoneylem/solve", json={"question": "q"}).status_code == 422
    seen = {}
    real = lp_solver.pulp.PULP_CBC_CMD
    monkeypatch.setattr(lp_solver.pulp, "PULP_CBC_CMD", lambda **kw: (seen.update(kw), real(**kw))[1])
    ok = LPFormulation(sense="max", variables=["x"], objective={"x": 1}, constraints=[LPConstraint(coeffs={"x": 1}, op="<=", rhs=4)])
    assert lp_solver.solve_lp(ok).objective_value == 4 and seen["timeLimit"] == lp_solver.TIME_LIMIT_S
    monkeypatch.setattr(yapp, "parse_problem", lambda q: ParsedProblem(problem_type="queueing", queueing=QueueingParams(model="mmc", arrival_rate=1, service_rate=2, servers=10**9)))
    assert c.post("/yoneylem/solve", json={"question": "q"}).status_code == 422
    assert c.post("/yoneylem/solve", json={"question": "x" * 6001}).status_code == 422


@pytest.mark.parametrize("change", [{"total_rooms": 10**9}, {"floor_price": float("1e12")}, {"days_until": 10**7}, {"day_of_week": "F" * 500}, {"ceiling_price": -5}])
def test_pricing_inputs_are_bounded(c, monkeypatch, change):
    called = []
    monkeypatch.setattr(papp, "recommend_price", lambda **kw: called.append(kw))
    body = {"total_rooms": 50, "occupied_now": 10, "days_until": 7, "day_of_week": "Friday", "floor_price": 80, "ceiling_price": 200, "no_llm": True, **change}
    assert c.post("/petrinets/recommend", json=body).status_code == 422 and not called


def test_requests_refused_by_validation_are_not_charged(c, monkeypatch):
    monkeypatch.setitem(guard.RULES, "/yoneylem/solve", (2, 3))
    for _ in range(10):                                   # invalid bodies: nothing costly runs, so no budget is spent
        assert c.post("/yoneylem/solve", json={"question": ""}).status_code == 422
    assert [c.post("/yoneylem/solve", json={"question": "q"}).status_code for _ in range(3)] == [200, 200, 429]


def test_pdf_handling_is_bounded():
    import pymupdf as fitz
    from lackmus.extraction import pdf_handling as ph
    doc = fitz.open()
    for i in range(ph.MAX_TEXT_PAGES + 10):
        doc.new_page().insert_text((72, 72), f"page {i} " + "x" * 50)
    text = ph.extract_pdf_text(doc.tobytes())
    assert f"page {ph.MAX_TEXT_PAGES - 1} " in text and f"page {ph.MAX_TEXT_PAGES} " not in text
    huge = fitz.open()
    huge.new_page(width=14400, height=14400)
    pix = fitz.Pixmap(ph.rasterize_first_page(huge.tobytes()))
    assert pix.width * pix.height <= ph.MAX_PAGE_PIXELS * 1.01
    a4 = fitz.open()
    a4.new_page()
    assert fitz.Pixmap(ph.rasterize_first_page(a4.tobytes())).width == 1190
