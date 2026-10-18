import random

from petrinets.petri_net import Marking, fire_cancel, fire_confirm, fire_reject, fire_request
from petrinets.pricing import recommend_price
from petrinets.simulate import SimInputs, _confirm_prob, _demand_rate, _run_once, simulate


def test_transitions_fire_only_when_enabled():
    m = Marking(available=0)
    assert not fire_request(m) and not fire_confirm(m) and not fire_reject(m) and not fire_cancel(m)
    assert m.as_dict() == {"available": 0, "pending": 0, "confirmed": 0}


def test_each_transition_moves_exactly_one_token():
    m = Marking(available=2)
    assert fire_request(m) and m.as_dict() == {"available": 1, "pending": 1, "confirmed": 0}
    assert fire_confirm(m) and m.as_dict() == {"available": 1, "pending": 0, "confirmed": 1}
    assert fire_request(m) and fire_reject(m) and m.as_dict() == {"available": 1, "pending": 0, "confirmed": 1}
    assert fire_cancel(m) and m.as_dict() == {"available": 2, "pending": 0, "confirmed": 0}


def inputs(**kw):
    base = dict(total_rooms=20, occupied_now=10, days_until=5, day_of_week="Friday", local_event=False,
                assumed_price=130.0, competitor_price=None, seed=1)
    base.update(kw)
    return SimInputs(**base)


def test_tokens_are_conserved_on_every_simulated_day():
    hist = _run_once(inputs(), random.Random(0))
    assert len(hist) == 6
    assert all(m.available + m.pending + m.confirmed == 20 for m in hist)


def test_demand_rises_for_weekends_events_and_urgency():
    base = _demand_rate(inputs(day_of_week="Tuesday"), 0)
    assert _demand_rate(inputs(day_of_week="Saturday"), 0) > base
    assert _demand_rate(inputs(day_of_week="Tuesday", local_event=True), 0) > base
    assert _demand_rate(inputs(day_of_week="Tuesday"), 4) > base


def test_overpricing_against_competitor_lowers_confirm_probability():
    cheap = _confirm_prob(inputs(competitor_price=150, assumed_price=120))
    dear = _confirm_prob(inputs(competitor_price=150, assumed_price=200))
    assert dear < cheap and 0.05 <= dear <= 0.95


def test_simulation_is_reproducible_with_a_seed_and_trajectory_has_one_point_per_day():
    a, b = simulate(inputs(), 50), simulate(inputs(), 50)
    assert a.final_occupancy_rate_mean == b.final_occupancy_rate_mean
    assert len(a.trajectory) == 6 and a.trajectory[-1].days_until == 0
    assert 0 <= a.final_occupancy_rate_p10 <= a.final_occupancy_rate_mean <= a.final_occupancy_rate_p90 + 1e-9 <= 1 + 1e-9


def rec(**kw):
    base = dict(total_rooms=20, occupied_now=10, days_until=5, day_of_week="Friday", local_event=False,
                floor_price=80, ceiling_price=180, seed=3, n_runs=150)
    base.update(kw)
    return recommend_price(**base)


def test_price_stays_inside_the_band_and_swapped_bounds_are_fixed():
    r = rec()
    assert 80 <= r.recommended_price <= 180
    s = rec(floor_price=180, ceiling_price=80)
    assert (s.floor_price, s.ceiling_price) == (80, 180)


def test_fuller_hotel_gets_a_higher_price_than_an_empty_one():
    assert rec(occupied_now=19).recommended_price > rec(occupied_now=1).recommended_price
