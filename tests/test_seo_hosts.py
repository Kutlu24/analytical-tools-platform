from fastapi.testclient import TestClient

from atp.app import app

client = TestClient(app)

PATHS = ["/", "/robots.txt", "/sitemap.xml", "/llms.txt"]


def test_hostile_host_headers_never_reach_the_page(monkeypatch):
    monkeypatch.delenv("SITE_URL", raising=False)
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
    evil = 'x"><script>alert(1)</script>'
    for path in PATHS:
        for headers in ({"x-forwarded-host": evil}, {"x-forwarded-host": "a.example</script><script>alert(1)//"}, {"host": "evil.example\"onload=x"}):
            r = client.get(path, headers=headers)
            if r.status_code != 200:
                continue                      # a refused request shows nothing
            assert "<script>alert(1)" not in r.text and "onload=x" not in r.text, (path, headers)
    assert "demo.onrender.com" in client.get(PATHS[0], headers={"x-forwarded-host": "demo.onrender.com"}).text


def test_on_render_the_platform_origin_wins_over_request_headers(monkeypatch):
    monkeypatch.delenv("SITE_URL", raising=False)
    monkeypatch.setenv("RENDER_EXTERNAL_URL", "https://real-site.onrender.com")
    t = client.get(PATHS[0], headers={"x-forwarded-host": "attacker.example"}).text
    assert "real-site.onrender.com" in t and "attacker.example" not in t
