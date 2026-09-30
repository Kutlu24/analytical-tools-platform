"""Turns a real simulated occupancy rate into a price recommendation via a
stated, auditable rule - not a black box. Two-pass: first simulate at a
neutral (midpoint) price to estimate demand, then derive a price from that,
then re-simulate AT the recommended price so the reported trajectory/
occupancy is self-consistent with what's actually being recommended (price
affects confirm probability in simulate.py's demand model).
"""
from __future__ import annotations

from pydantic import BaseModel

from .simulate import SimInputs, SimulationResult, simulate

COMPETITOR_BLEND_WEIGHT = 0.15  # how much the recommendation nudges toward
# the competitor's price after the occupancy-based interpolation - stated
# explicitly so the rule is auditable, not hidden inside the number.


class PriceRecommendation(BaseModel):
    recommended_price: float
    floor_price: float
    ceiling_price: float
    baseline_occupancy_rate: float  # from the neutral-price pass
    final_occupancy_rate: float  # from the pass at the recommended price
    simulation: SimulationResult  # the pass run AT the recommended price


def _interpolate(occupancy_rate: float, floor_price: float, ceiling_price: float) -> float:
    occupancy_rate = min(1.0, max(0.0, occupancy_rate))
    return floor_price + occupancy_rate * (ceiling_price - floor_price)


def recommend_price(
    total_rooms: int,
    occupied_now: int,
    days_until: int,
    day_of_week: str,
    local_event: bool,
    floor_price: float,
    ceiling_price: float,
    competitor_price: float | None = None,
    n_runs: int = 300,
    seed: int | None = None,
) -> PriceRecommendation:
    if ceiling_price < floor_price:
        floor_price, ceiling_price = ceiling_price, floor_price

    midpoint = (floor_price + ceiling_price) / 2
    baseline_inputs = SimInputs(
        total_rooms=total_rooms,
        occupied_now=occupied_now,
        days_until=days_until,
        day_of_week=day_of_week,
        local_event=local_event,
        assumed_price=midpoint,
        competitor_price=competitor_price,
        seed=seed,
    )
    baseline = simulate(baseline_inputs, n_runs=n_runs)

    price = _interpolate(baseline.final_occupancy_rate_mean, floor_price, ceiling_price)
    if competitor_price and competitor_price > 0:
        price = (1 - COMPETITOR_BLEND_WEIGHT) * price + COMPETITOR_BLEND_WEIGHT * competitor_price
    price = min(ceiling_price, max(floor_price, price))

    final_inputs = SimInputs(
        total_rooms=total_rooms,
        occupied_now=occupied_now,
        days_until=days_until,
        day_of_week=day_of_week,
        local_event=local_event,
        assumed_price=price,
        competitor_price=competitor_price,
        seed=(seed + 1) if seed is not None else None,
    )
    final_sim = simulate(final_inputs, n_runs=n_runs)

    return PriceRecommendation(
        recommended_price=round(price, 2),
        floor_price=floor_price,
        ceiling_price=ceiling_price,
        baseline_occupancy_rate=baseline.final_occupancy_rate_mean,
        final_occupancy_rate=final_sim.final_occupancy_rate_mean,
        simulation=final_sim,
    )
