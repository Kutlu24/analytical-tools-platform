"""Real queueing-theory formulas - M/M/1 and M/M/c. Standard textbook
results (e.g. Hillier & Lieberman, Introduction to Operations Research),
computed directly from arrival/service rates - no LLM involved in the
math, only in explaining the already-computed numbers afterward."""
from __future__ import annotations

import math

from .models import QueueingParams, QueueingResult


def _erlang_c(c: int, a: float) -> float:
    """Probability an arriving customer must wait (Erlang C formula),
    a = lambda/mu (offered load, not per-server utilization)."""
    sum_term = sum((a**n) / math.factorial(n) for n in range(c))
    last_term = (a**c) / (math.factorial(c) * (1 - a / c))
    return last_term / (sum_term + last_term)


def solve_queueing(p: QueueingParams) -> QueueingResult:
    lam, mu = p.arrival_rate, p.service_rate
    if p.model == "mmc" and p.servers > 1:
        c = p.servers
        rho = lam / (c * mu)
        if rho >= 1:
            return QueueingResult(model="mmc", rho=rho, L=float("inf"), Lq=float("inf"),
                                   W=float("inf"), Wq=float("inf"), stable=False)
        a = lam / mu
        pw = _erlang_c(c, a)
        Lq = pw * rho / (1 - rho)
        Wq = Lq / lam
        W = Wq + 1 / mu
        L = lam * W
        return QueueingResult(model="mmc", rho=rho, L=L, Lq=Lq, W=W, Wq=Wq, stable=True)

    # M/M/1
    rho = lam / mu
    if rho >= 1:
        return QueueingResult(model="mm1", rho=rho, L=float("inf"), Lq=float("inf"),
                               W=float("inf"), Wq=float("inf"), stable=False)
    L = rho / (1 - rho)
    Lq = rho**2 / (1 - rho)
    W = L / lam  # Little's Law
    Wq = Lq / lam
    return QueueingResult(model="mm1", rho=rho, L=L, Lq=Lq, W=W, Wq=Wq, stable=True)
