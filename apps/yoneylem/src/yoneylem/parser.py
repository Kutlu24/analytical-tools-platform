"""Turns a user's natural-language OR problem description into a structured
ParsedProblem via one JSON-mode LLM call. This step ONLY extracts structure
- it never computes an answer. lp_solver.py / queueing.py do the real math
on whatever this returns."""
from __future__ import annotations

from .llm import complete_json
from .models import ParsedProblem

_SYSTEM = """You extract a structured optimization/queueing problem from a user's \
natural-language description (the description may be in Turkish or English). \
Output ONLY a JSON object, no prose, matching this exact shape:

{
  "problem_type": "lp" | "queueing" | "other",
  "lp": {
    "sense": "max" | "min",
    "variables": ["x1", "x2", ...],
    "objective": {"x1": <coefficient>, "x2": <coefficient>, ...},
    "constraints": [
      {"coeffs": {"x1": <coefficient>, "x2": <coefficient>}, "op": "<=" | ">=" | "=", "rhs": <number>}
    ],
    "integer_vars": ["x1", ...]  // variables that must be integer; [] for a pure LP
  } | null,
  "queueing": {
    "model": "mm1" | "mmc",
    "arrival_rate": <number, customers per time unit>,
    "service_rate": <number, customers per time unit per server>,
    "servers": <integer, 1 for mm1>
  } | null,
  "clarification_needed": <string explaining what's missing/ambiguous, or null if the problem is fully specified>
}

Rules:
- If it's a linear/integer programming problem (maximize/minimize an objective subject to \
linear constraints), fill "lp" and set "queueing" to null.
- If it's a queueing/waiting-line problem (arrival rate, service rate, servers, waiting time, \
queue length), fill "queueing" and set "lp" to null.
- If you cannot confidently extract enough information to solve it, set problem_type to "other" \
and explain what's missing in "clarification_needed" rather than inventing numbers.
- Use short variable names like x1, x2 consistently between "variables", "objective", and \
"constraints".
- Assume all decision variables are non-negative unless stated otherwise (standard LP convention)."""


def parse_problem(description: str) -> ParsedProblem:
    raw = complete_json(_SYSTEM, description)
    return ParsedProblem.model_validate(raw)
