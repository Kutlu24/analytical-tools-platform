from __future__ import annotations

from pydantic import BaseModel


class LPConstraint(BaseModel):
    coeffs: dict[str, float]
    op: str  # "<=" | ">=" | "="
    rhs: float


class LPFormulation(BaseModel):
    sense: str  # "max" | "min"
    variables: list[str]
    objective: dict[str, float]
    constraints: list[LPConstraint]
    integer_vars: list[str] = []
    nonnegative: bool = True


class LPSolution(BaseModel):
    status: str
    objective_value: float | None
    variable_values: dict[str, float]


class QueueingParams(BaseModel):
    model: str  # "mm1" | "mmc"
    arrival_rate: float
    service_rate: float
    servers: int = 1


class QueueingResult(BaseModel):
    model: str
    rho: float  # utilization
    L: float  # avg number in system
    Lq: float  # avg number in queue
    W: float  # avg time in system
    Wq: float  # avg wait in queue
    stable: bool


class ParsedProblem(BaseModel):
    problem_type: str  # "lp" | "queueing" | "other"
    lp: LPFormulation | None = None
    queueing: QueueingParams | None = None
    clarification_needed: str | None = None
