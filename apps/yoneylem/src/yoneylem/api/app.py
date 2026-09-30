"""FastAPI backend for the Optimizasyon Merkezi chatbot. Run with:
    uvicorn yoneylem.api.app:app --reload

POST /solve {question} -> real PuLP/queueing result + Turkish explanation.
GET  /config -> which LLM provider is parsing/explaining.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..config import settings
from ..explain import explain_lp, explain_queueing
from ..lp_solver import solve_lp
from ..parser import parse_problem
from ..queueing import solve_queueing

app = FastAPI(title="Optimizasyon Merkezi - Yoneylem Chatbot")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

_FRONTEND_DIR = Path(__file__).resolve().parents[3]
if (_FRONTEND_DIR / "index.html").exists():
    app.mount("/ui", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="ui")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="ui/")


class ConfigInfo(BaseModel):
    provider: str
    model: str


@app.get("/config", response_model=ConfigInfo)
def get_config() -> ConfigInfo:
    model = settings.glm_model if settings.chat_provider == "glm" else settings.gemini_model
    return ConfigInfo(provider=settings.chat_provider, model=model)


class SolveRequest(BaseModel):
    question: str
    lang: str = "tr"


class SolveResponse(BaseModel):
    problem_type: str
    explanation: str | None = None
    lp_solution: dict | None = None
    queueing_result: dict | None = None
    clarification_needed: str | None = None


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    lang = req.lang if req.lang in ("tr", "en") else "tr"
    parsed = parse_problem(req.question)

    if parsed.problem_type == "lp" and parsed.lp is not None:
        solution = solve_lp(parsed.lp)
        explanation = explain_lp(req.question, parsed.lp, solution, lang=lang)
        return SolveResponse(
            problem_type="lp",
            explanation=explanation,
            lp_solution=solution.model_dump(),
        )

    if parsed.problem_type == "queueing" and parsed.queueing is not None:
        result = solve_queueing(parsed.queueing)
        explanation = explain_queueing(req.question, parsed.queueing, result, lang=lang)
        return SolveResponse(
            problem_type="queueing",
            explanation=explanation,
            queueing_result=result.model_dump(),
        )

    fallback = (
        "I couldn't fully understand the problem - could you give a few more numeric details?"
        if lang == "en"
        else "Problemi tam olarak anlayamadim - luften daha fazla sayisal detay verir misin?"
    )
    return SolveResponse(
        problem_type="other",
        clarification_needed=parsed.clarification_needed or fallback,
    )
