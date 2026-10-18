"""The solver API returns the parsed problem next to the solution (the UI draws from it).
The LLM calls are replaced by fakes, so no key is needed."""
from fastapi.testclient import TestClient
from yoneylem.api import app as yapp
from yoneylem.models import LPConstraint, LPFormulation, ParsedProblem, QueueingParams


def client(monkeypatch, parsed):
    monkeypatch.setattr(yapp, "parse_problem", lambda q: parsed)
    monkeypatch.setattr(yapp, "explain_lp", lambda *a, **k: "ok")
    monkeypatch.setattr(yapp, "explain_queueing", lambda *a, **k: "ok")
    return TestClient(yapp.app)


def test_lp_response_carries_problem_and_solution(monkeypatch):
    lp = LPFormulation(sense="max", variables=["x", "y"], objective={"x": 1, "y": 1},
                       constraints=[LPConstraint(coeffs={"x": 1, "y": 1}, op="<=", rhs=4)])
    r = client(monkeypatch, ParsedProblem(problem_type="lp", lp=lp)).post("/solve", json={"question": "q"}).json()
    assert r["problem_type"] == "lp" and r["lp_solution"]["status"] == "Optimal"
    assert r["lp_problem"]["variables"] == ["x", "y"] and r["lp_problem"]["constraints"][0]["rhs"] == 4


def test_queueing_response_carries_parameters(monkeypatch):
    qp = QueueingParams(model="mmc", arrival_rate=2, service_rate=2, servers=2)
    r = client(monkeypatch, ParsedProblem(problem_type="queueing", queueing=qp)).post("/solve", json={"question": "q"}).json()
    assert r["queueing_params"]["servers"] == 2 and abs(r["queueing_result"]["Lq"] - 1 / 3) < 1e-9


def test_geo_endpoints():
    from fastapi.testclient import TestClient

    from atp.app import app

    c = TestClient(app)
    r = c.get("/robots.txt").text
    assert "OAI-SearchBot" in r and "Sitemap: http://testserver/sitemap.xml" in r
    assert "<loc>http://testserver/finans/ui/</loc>" in c.get("/sitemap.xml").text
    assert "Financial Compass" in c.get("/llms.txt").text
    hub = c.get("/").text
    assert "__SITE__" not in hub and 'rel="canonical" href="http://testserver/"' in hub
    for p in ("/yoneylem/ui/", "/finans/ui/", "/petrinets/ui/"):
        t = c.get(p).text
        assert 'application/ld+json' in t and 'name="description"' in t and 'id="about"' in t
