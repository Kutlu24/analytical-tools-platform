"""Real LP/IP solving via PuLP (bundled CBC solver). Takes a structured
LPFormulation (produced by lp_parser.py's LLM call, itself never solving
anything) and returns the actual solver's optimal value and variable
values - the only place in this codebase that decides what the "answer"
to an optimization question is."""
from __future__ import annotations

import pulp

from .models import LPFormulation, LPSolution

_OP_MAP = {
    "<=": pulp.LpConstraintLE,
    ">=": pulp.LpConstraintGE,
    "=": pulp.LpConstraintEQ,
    "==": pulp.LpConstraintEQ,
}


def solve_lp(formulation: LPFormulation) -> LPSolution:
    sense = pulp.LpMaximize if formulation.sense == "max" else pulp.LpMinimize
    prob = pulp.LpProblem("problem", sense)

    lower_bound = 0 if formulation.nonnegative else None
    pulp_vars: dict[str, pulp.LpVariable] = {}
    for name in formulation.variables:
        cat = "Integer" if name in formulation.integer_vars else "Continuous"
        pulp_vars[name] = pulp.LpVariable(name, lowBound=lower_bound, cat=cat)

    prob += pulp.lpSum(
        coeff * pulp_vars[var] for var, coeff in formulation.objective.items() if var in pulp_vars
    )

    for i, c in enumerate(formulation.constraints):
        expr = pulp.lpSum(
            coeff * pulp_vars[var] for var, coeff in c.coeffs.items() if var in pulp_vars
        )
        op = _OP_MAP.get(c.op)
        if op is None:
            raise ValueError(f"Unknown constraint operator: {c.op!r}")
        prob += pulp.LpConstraint(expr, op, name=f"c{i}", rhs=c.rhs)

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    status = pulp.LpStatus[prob.status]
    obj_value = pulp.value(prob.objective) if status == "Optimal" else None
    var_values = {name: (var.value() or 0.0) for name, var in pulp_vars.items()}

    return LPSolution(status=status, objective_value=obj_value, variable_values=var_values)
