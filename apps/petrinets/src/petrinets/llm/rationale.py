"""LLM-written plain-language rationale, strictly grounded in the real
numbers computed by pricing.recommend_price - mirrors the discipline in
GFCA's llm/synthesis.py: the LLM explains real computed numbers, it does
not invent its own demand estimate, price, or confidence figure."""
from __future__ import annotations

from pydantic import BaseModel

from ..config import settings
from ..pricing import PriceRecommendation

_SYSTEM_PROMPT = """You are helping a small, independent hotel owner interpret the output of a \
room-pricing simulation tool. You will be given the real, already-computed inputs and results of \
a stochastic Petri-net simulation of hotel booking demand - not your own estimate.

Rules:
- Explain and justify the recommendation using ONLY the numbers given to you. Do not invent your \
own occupancy estimate, demand figure, or price.
- Do not state a probability that the recommended price is "correct" or "optimal." This tool has \
no historical booking or pricing data behind it - it is a documented simulation with example \
demand-model constants, not a model validated against this specific hotel's real outcomes.
- Explain briefly, in plain language, why the recommendation moved toward the floor or ceiling \
(e.g. day of week, days until arrival, current occupancy, local event, competitor price) using the \
real figures given.
- End with one sentence making explicit that this is a simulation-based heuristic suggestion, not \
a certified optimal price, and that the owner should use their own judgment alongside it.
- Keep the whole answer under 150 words.
"""


class Rationale(BaseModel):
    text: str
    model_used: str


def _format_context(rec: PriceRecommendation, inputs_desc: str) -> str:
    return (
        f"Inputs:\n{inputs_desc}\n\n"
        f"Simulation result (n={rec.simulation.n_runs} runs):\n"
        f"- Baseline expected occupancy rate at a neutral test price: {rec.baseline_occupancy_rate:.0%}\n"
        f"- Expected occupancy rate at the recommended price: {rec.final_occupancy_rate:.0%} "
        f"(p10={rec.simulation.final_occupancy_rate_p10:.0%}, p90={rec.simulation.final_occupancy_rate_p90:.0%})\n"
        f"- Price range considered: {rec.floor_price:.2f} (floor) to {rec.ceiling_price:.2f} (ceiling)\n"
        f"- Recommended price: {rec.recommended_price:.2f}\n"
    )


def _call_glm(context: str) -> str:
    from openai import OpenAI

    if not settings.glm_api_key:
        raise RuntimeError("GLM_API_KEY not set in .env")
    client = OpenAI(api_key=settings.glm_api_key, base_url=settings.glm_base_url)
    response = client.chat.completions.create(
        model=settings.glm_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"{context}\nWrite the rationale."},
        ],
    )
    return response.choices[0].message.content


def _call_gemini(context: str) -> str:
    from google import genai

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set in .env")
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = f"{_SYSTEM_PROMPT}\n\n{context}\nWrite the rationale."
    interaction = client.interactions.create(model=settings.gemini_model, input=prompt)
    return interaction.output_text


_CALLERS = {"glm": _call_glm, "gemini": _call_gemini}
_MODEL_LABEL = {"glm": lambda: settings.glm_model, "gemini": lambda: settings.gemini_model}


def explain(rec: PriceRecommendation, inputs_desc: str) -> Rationale:
    context = _format_context(rec, inputs_desc)
    caller = _CALLERS[settings.synthesis_provider]
    text = caller(context)
    return Rationale(
        text=text,
        model_used=f"{settings.synthesis_provider}:{_MODEL_LABEL[settings.synthesis_provider]()}",
    )
