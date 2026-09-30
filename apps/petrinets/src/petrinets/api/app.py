"""FastAPI backend for the Petri-net hotel pricing tool. Run with:
    uvicorn petrinets.api.app:app --reload

Endpoints:
    POST /recommend  -> PriceRecommendation + rationale
    GET  /config      -> {provider, model}
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from ..config import settings
from ..llm.rationale import Rationale, explain
from ..pricing import PriceRecommendation, recommend_price
from .errors import friendly_error

app = FastAPI(title="Petrinets - Hotel Pricing Simulator")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="ui/")


_FRONTEND_DIR = Path(__file__).resolve().parents[3] / "frontend"
if _FRONTEND_DIR.exists():
    app.mount("/ui", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="ui")


class ConfigInfo(BaseModel):
    provider: str
    model: str


_MODEL_BY_PROVIDER = {"glm": lambda: settings.glm_model, "gemini": lambda: settings.gemini_model}


@app.get("/config", response_model=ConfigInfo)
def get_config() -> ConfigInfo:
    return ConfigInfo(provider=settings.synthesis_provider, model=_MODEL_BY_PROVIDER[settings.synthesis_provider]())


class RecommendRequest(BaseModel):
    total_rooms: int
    occupied_now: int
    days_until: int
    day_of_week: str
    local_event: bool = False
    floor_price: float
    ceiling_price: float
    competitor_price: float | None = None
    no_llm: bool = False


class RecommendResult(BaseModel):
    recommendation: PriceRecommendation
    rationale: Rationale | None


@app.post("/recommend", response_model=RecommendResult)
def recommend_endpoint(req: RecommendRequest) -> RecommendResult:
    try:
        if req.total_rooms <= 0:
            raise ValueError("total_rooms must be positive")
        if req.occupied_now < 0 or req.occupied_now > req.total_rooms:
            raise ValueError("occupied_now must be between 0 and total_rooms")
        if req.days_until < 0:
            raise ValueError("days_until must be >= 0")

        rec = recommend_price(
            total_rooms=req.total_rooms,
            occupied_now=req.occupied_now,
            days_until=min(req.days_until, 60),  # cap horizon - beyond this the
            # demand-model constants (see simulate.py) aren't a meaningful
            # near-term forecast anyway
            day_of_week=req.day_of_week,
            local_event=req.local_event,
            floor_price=req.floor_price,
            ceiling_price=req.ceiling_price,
            competitor_price=req.competitor_price,
        )

        rationale = None
        if not req.no_llm:
            inputs_desc = (
                f"- Total rooms: {req.total_rooms}, occupied now: {req.occupied_now}\n"
                f"- Days until check-in: {req.days_until}, day of week: {req.day_of_week}\n"
                f"- Local event/high season: {req.local_event}\n"
                f"- Competitor average price: {req.competitor_price if req.competitor_price else 'not given'}"
            )
            rationale = explain(rec, inputs_desc)

        return RecommendResult(recommendation=rec, rationale=rationale)
    except ValueError as e:
        raise friendly_error(e) from e
    except Exception as e:
        raise friendly_error(e) from e
