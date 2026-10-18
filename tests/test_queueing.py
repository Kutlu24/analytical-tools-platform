import math

import pytest
from yoneylem.models import QueueingParams
from yoneylem.queueing import solve_queueing


def q(model, lam, mu, c=1):
    return solve_queueing(QueueingParams(model=model, arrival_rate=lam, service_rate=mu, servers=c))


def test_mm1_textbook_values():
    r = q("mm1", 2, 5)
    assert r.stable and math.isclose(r.rho, 0.4)
    assert math.isclose(r.L, 0.4 / 0.6) and math.isclose(r.Lq, 0.16 / 0.6)
    assert math.isclose(r.W, r.L / 2) and math.isclose(r.Wq, r.Lq / 2)


def test_mm2_known_case():
    # lambda=2, mu=2, c=2: offered load 1, rho 0.5, Erlang C = 1/3 -> Lq = 1/3, Wq = 1/6
    r = q("mmc", 2, 2, 2)
    assert r.stable and math.isclose(r.rho, 0.5)
    assert math.isclose(r.Lq, 1 / 3) and math.isclose(r.Wq, 1 / 6)
    assert math.isclose(r.W, 1 / 6 + 1 / 2) and math.isclose(r.L, 2 * r.W)


def test_littles_law_holds_for_both_models():
    for r, lam in ((q("mm1", 3, 4), 3), (q("mmc", 7, 3, 3), 7)):
        assert math.isclose(r.L, lam * r.W) and math.isclose(r.Lq, lam * r.Wq)


def test_mmc_with_one_server_equals_mm1():
    a, b = q("mmc", 2, 5, 1), q("mm1", 2, 5)
    assert math.isclose(a.L, b.L) and math.isclose(a.Wq, b.Wq)


def test_more_servers_never_increase_waiting():
    waits = [q("mmc", 8, 3, c).Wq for c in (3, 4, 5, 6)]
    assert waits == sorted(waits, reverse=True)


@pytest.mark.parametrize("model,lam,mu,c", [("mm1", 5, 5, 1), ("mm1", 6, 5, 1), ("mmc", 6, 3, 2)])
def test_unstable_systems_are_flagged(model, lam, mu, c):
    r = q(model, lam, mu, c)
    assert not r.stable and r.rho >= 1 and math.isinf(r.L)
