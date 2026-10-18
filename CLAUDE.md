# analytical-tools-platform

One FastAPI app (`src/atp/app.py`) that mounts three independent sub-apps, each with its own static UI:

| Prefix | Code | What |
|---|---|---|
| `/yoneylem/ui/` | `apps/yoneylem` | Operations research: natural-language LP/IP (PuLP/CBC) and queueing (M/M/1, M/M/c) |
| `/finans/ui/` | `apps/lackmus` | Balance-sheet ratio analysis with PDF/image extraction (Chart.js charts) |
| `/petrinets/ui/` | `apps/petrinets` | Petri-net booking simulation driving a room-price recommendation |

Hub page: `src/atp/static/`. Deployed as one Render web service (`render.yaml`).

## Commands
- Use the project venv: `.venv/bin/python` (system python lacks the packages).
- Tests: `.venv/bin/python -m pytest -q` (no API keys needed; LLM calls are faked)
- Lint: `.venv/bin/ruff check .`
- Run: `.venv/bin/python -m uvicorn atp.app:app --reload`; a real `/yoneylem/solve` call needs `GLM_API_KEY` in `.env`.

## Rules that are easy to get wrong
- **LLMs parse and explain only; the maths is deterministic code** (`lp_solver.py`, `queueing.py`, `petri_net.py`, `simulate.py`). Keep it that way and test the code, not the LLM.
- **PuLP is pinned `<4`.** PuLP 4 changed the `LpVariable` API and breaks `lp_solver.py`; an unpinned fresh install on Render would break the solver.
- **Vendored apps**: the three `apps/*` were copied in. Local changes versus upstream: API prefixes in the frontends (`/yoneylem`, `/finans/api/...`, `/petrinets`) and relative `/ui` redirects. Keep new edits additive.
- **Solver response contract**: `/yoneylem/solve` returns `lp_problem` and `queueing_params` next to the results; `apps/yoneylem/viz.js` draws from them.
- **Security**: CORS is an allowlist (no wildcard) and security headers are set per app; never commit `.env`; API keys are Render dashboard variables.
- **Git**: commits must use the GitHub noreply email (`201714311+Kutlu24@users.noreply.github.com`); the real address is rejected by GitHub email privacy. Repo `Kutlu24/analytical-tools-platform` is private.
- Petri simulation records end-of-day markings, so the "pending" place is always ~0 in the UI; that is the data, not a bug.
- **GEO/SEO**: hub serves `/robots.txt`, `/sitemap.xml`, `/llms.txt` (in `src/atp/app.py`); base URL comes from `SITE_URL` env or the request. Hub HTML uses a `__SITE__` placeholder. Each tool page has static meta, JSON-LD and an `#about` section (needed because most AI crawlers do not run JS). Training bots are blocked, search bots allowed (`_ALLOW`/`_BLOCK`).
