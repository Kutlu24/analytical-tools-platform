# Optimizasyon Merkezi — Operations Research Reference + Solver

A Turkish-language **Operations Research (Yöneylem Araştırması)** site: a static reference (four core techniques with real mathematical formulations rendered via MathJax, application areas, tooling, further-reading links) plus an interactive **Problem Çözücü** that actually solves the problem a user describes in plain language - not an LLM guess.

🇩🇪 German version: [README.de.md](README.de.md)

## What it does

- **Problem Çözücü (Solver):** describe an LP/IP or queueing problem in natural language; an LLM parses it into a structured formulation, then a *real* solver computes the answer - [PuLP](https://coin-or.github.io/pulp/) (bundled CBC) for linear/integer programming, closed-form M/M/1 and M/M/c formulas for queueing. The LLM only narrates the already-computed numbers afterward - it never invents the answer itself.
- **Teknikler (Techniques):** switchable cards for Linear Programming, Integer Programming, Queueing Theory, and Simulation — each with its standard mathematical formulation (LaTeX via [MathJax](https://www.mathjax.org/)), solution methods, and a worked example.
- **Uygulama Alanları (Applications):** production planning, logistics, inventory, staff scheduling, service systems.
- **Araçlar (Tools):** real solvers and libraries (CPLEX, Gurobi, CBC, Python's PuLP/Pyomo/SimPy, R's lpSolve/ompr, Excel Solver).
- **Kaynaklar (Resources):** links to NEOS Guide, INFORMS, and PuLP's documentation.

## Tech stack

Frontend: plain HTML, CSS and vanilla JavaScript, math typesetting via [MathJax](https://www.mathjax.org/) (CDN). Backend (`src/yoneylem`): FastAPI + PuLP, serving the frontend directly at `/ui`. LLM parsing/explanation via GLM (default, free tier) or Gemini - see `src/yoneylem/config.py`.

## Running it

Static-only (no solver): open `index.html` in a browser, or `npx serve .`.

With the solver backend:
```bash
pip install -e .
# .env needs GLM_API_KEY (and/or GEMINI_API_KEY)
uvicorn yoneylem.api.app:app --reload
# open http://127.0.0.1:8000/ui/
```

## Notes

The original source had only section headings and technique cards with `...` placeholder text where the formulas and explanations should be, plus a dependency on `polyfill.io` (a CDN pulled from public distribution after a 2024 supply-chain compromise). Both were replaced before publishing: real formulations/examples were written for all four techniques, and the polyfill dependency was removed (unnecessary — the ES6 features it polyfilled are natively supported everywhere now).
