# Analytical Tools Platform

Three analytical web tools under one FastAPI application:

| Tool | Path | What it does |
|------|------|--------------|
| Operations Research Center | `/yoneylem/ui/` | Natural-language LP/IP and queueing solver (PuLP/CBC, closed-form M/M/1, M/M/c) |
| Financial Compass (Lackmus) | `/finans/ui/` | Balance-sheet ratio analysis with PDF/image document extraction |
| Hotel Pricing Simulator | `/petrinets/ui/` | Petri-net booking-demand simulation driving transparent room-price recommendations |

A hub page at `/` links to all three. Each tool is an independent FastAPI
sub-app mounted under its prefix, so its `/docs`, `/config` and tool-specific
endpoints stay intact (e.g. `/yoneylem/solve`, `/finans/api/extract-balance-sheet`,
`/petrinets/recommend`).

## Local development

```bash
pip install -e .
uvicorn atp.app:app --reload
```

## Configuration

The three tools share the same LLM environment variables (set them in the
Render dashboard, never commit them):

- `GLM_API_KEY` — free-tier GLM (default provider)
- `GEMINI_API_KEY` — optional Gemini fallback
- Provider selection uses each tool's built-in default (`glm` for the OR
  center and Financial Compass extraction, `gemini` for Petri-net rationales);
  override with `CHAT_PROVIDER` / `SYNTHESIS_PROVIDER` if needed.

## Deployment (Render)

A single web service defined in `render.yaml`:

- build: `pip install -e .`
- start: `uvicorn atp.app:app --host 0.0.0.0 --port $PORT`

Point the primary domain (the former Lackmus service domain) at this service.
Redirect the old `petrinets` and `operations-research-center` domains to the
platform domain (Render dashboard: each old service's custom domain can be
replaced with a redirect, or use a 301 at the DNS/CDN layer).

## Repository layout

```
apps/yoneylem/    vendored Operations Research Center (src/yoneylem)
apps/lackmus/     vendored Financial Compass backend (src/lackmus)
apps/petrinets/   vendored Petri-net pricing tool (src/petrinets)
src/platform/     hub FastAPI app + static hub page
```

Vendor-only changes: API path prefixes in the three frontends
(`COZUCU_API = "/yoneylem"`, `/finans/api/...`, `API = "/petrinets"`) and
relative `/ui` redirects in each sub-app root route.
