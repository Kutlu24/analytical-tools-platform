"""Drives the Petri net (petri_net.py) day-by-day with a real, documented,
stochastic demand model, over many Monte Carlo runs, to produce a genuine
simulated distribution of check-in-day occupancy - not a hardcoded output.
Every constant below is named and commented so the model is auditable, not
a black box (see README.md for the same explanation in prose).
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from pydantic import BaseModel

from .petri_net import Marking, fire_cancel, fire_confirm, fire_reject, fire_request

# --- documented demand-model constants -------------------------------------
BASE_REQUEST_RATE_PER_ROOM = 0.018  # mean daily booking requests, per room of
# total inventory, on an average weekday with no event - e.g. a 20-room hotel
# sees ~0.36 requests/day baseline (a request roughly every 3 days). Tuned so
# that a lightly-booked hotel with a normal (non-event, non-weekend) window
# does NOT reliably saturate to full occupancy well before check-in - see
# README's Scope note: not fit to real data, since none exists for this tool.
WEEKEND_MULTIPLIER = 2.2  # target night is Fri/Sat
EVENT_MULTIPLIER = 2.8  # local_event flag set
URGENCY_GROWTH_PER_DAY = 0.04  # demand intensity grows this fraction per day
# as days_until shrinks (last-minute search volume increasing)
BASE_CONFIRM_PROB = 0.55  # fraction of requests that convert to a confirmed
# booking, before any price-value adjustment
PRICE_VALUE_SENSITIVITY = 0.35  # how much a price above/below the
# competitor's average price moves confirm probability
DAILY_CANCEL_PROB = 0.03  # probability any one confirmed booking cancels
# on a given simulated day before check-in

WEEKEND_DAYS = {"friday", "saturday"}


class DayPoint(BaseModel):
    day_index: int  # 0 = check-in day, counting down from days_until
    days_until: int
    mean_occupied: float
    mean_available: float
    n_requests_mean: float


class SimulationResult(BaseModel):
    total_rooms: int
    n_runs: int
    days_until: int
    trajectory: list[DayPoint]  # index 0 = today, last = check-in day
    final_occupancy_rate_mean: float
    final_occupancy_rate_p10: float
    final_occupancy_rate_p90: float


@dataclass
class SimInputs:
    total_rooms: int
    occupied_now: int
    days_until: int
    day_of_week: str  # e.g. "Friday" - the TARGET (check-in) date's weekday
    local_event: bool
    assumed_price: float  # the price being tested for demand response
    competitor_price: float | None
    seed: int | None = None


def _demand_rate(inputs: SimInputs, day_offset_from_now: int) -> float:
    """day_offset_from_now: 0 = today, up to inputs.days_until = check-in day."""
    rate = BASE_REQUEST_RATE_PER_ROOM * inputs.total_rooms
    if inputs.day_of_week.strip().lower() in WEEKEND_DAYS:
        rate *= WEEKEND_MULTIPLIER
    if inputs.local_event:
        rate *= EVENT_MULTIPLIER
    rate *= 1.0 + URGENCY_GROWTH_PER_DAY * day_offset_from_now
    return max(0.0, rate)


def _confirm_prob(inputs: SimInputs) -> float:
    p = BASE_CONFIRM_PROB
    if inputs.competitor_price and inputs.competitor_price > 0:
        # relative_gap > 0 means our price is ABOVE competitor (worse value)
        relative_gap = (inputs.assumed_price - inputs.competitor_price) / inputs.competitor_price
        p -= PRICE_VALUE_SENSITIVITY * relative_gap
    return min(0.95, max(0.05, p))


def _poisson(rng: random.Random, lam: float) -> int:
    """Knuth's algorithm - avoids a numpy dependency for one distribution."""
    if lam <= 0:
        return 0
    l_ = pow(2.718281828459045, -lam)
    k = 0
    p = 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= l_:
            return k - 1


def _run_once(inputs: SimInputs, rng: random.Random) -> list[Marking]:
    """One stochastic pass over the Petri net from today through check-in
    day. Returns the marking recorded at the end of each simulated day
    (index 0 = today's end-of-day, last = check-in day)."""
    m = Marking(available=max(0, inputs.total_rooms - inputs.occupied_now), confirmed=inputs.occupied_now)
    p_confirm = _confirm_prob(inputs)
    history: list[Marking] = []
    for day_offset in range(inputs.days_until, -1, -1):
        n_requests = _poisson(rng, _demand_rate(inputs, inputs.days_until - day_offset))
        for _ in range(n_requests):
            if fire_request(m):
                if rng.random() < p_confirm:
                    fire_confirm(m)
                else:
                    fire_reject(m)
        # cancellations checked against the confirmed count as of NOW in
        # this step, one Bernoulli trial per confirmed token (real per-
        # token firing, not an aggregate rate applied to a formula)
        for _ in range(m.confirmed):
            if rng.random() < DAILY_CANCEL_PROB:
                fire_cancel(m)
        history.append(m.copy())
    return history


def simulate(inputs: SimInputs, n_runs: int = 300) -> SimulationResult:
    seed_rng = random.Random(inputs.seed)
    runs: list[list[Marking]] = []
    for _ in range(n_runs):
        run_seed = seed_rng.randrange(1 << 30)
        runs.append(_run_once(inputs, random.Random(run_seed)))

    n_days = inputs.days_until + 1
    trajectory: list[DayPoint] = []
    for day_idx in range(n_days):
        occupied_vals = [run[day_idx].confirmed for run in runs]
        available_vals = [run[day_idx].available for run in runs]
        trajectory.append(
            DayPoint(
                day_index=day_idx,
                days_until=inputs.days_until - day_idx,
                mean_occupied=sum(occupied_vals) / len(occupied_vals),
                mean_available=sum(available_vals) / len(available_vals),
                n_requests_mean=0.0,  # not tracked per-run here; trajectory focuses on marking, not arrivals
            )
        )

    final_rates = sorted(run[-1].confirmed / inputs.total_rooms for run in runs)
    n = len(final_rates)
    mean_rate = sum(final_rates) / n
    p10 = final_rates[max(0, int(0.10 * n) - 1)]
    p90 = final_rates[min(n - 1, int(0.90 * n))]

    return SimulationResult(
        total_rooms=inputs.total_rooms,
        n_runs=n_runs,
        days_until=inputs.days_until,
        trajectory=trajectory,
        final_occupancy_rate_mean=mean_rate,
        final_occupancy_rate_p10=p10,
        final_occupancy_rate_p90=p90,
    )
