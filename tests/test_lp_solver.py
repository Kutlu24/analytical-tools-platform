import math

from yoneylem.lp_solver import solve_lp
from yoneylem.models import LPConstraint, LPFormulation


def lp(**kw):
    base = dict(sense="max", variables=["x", "y"], objective={"x": 3, "y": 2}, constraints=[], integer_vars=[], nonnegative=True)
    base.update(kw)
    return LPFormulation(**base)


def con(op, rhs, **coeffs):
    return LPConstraint(coeffs=coeffs, op=op, rhs=rhs)


def test_two_variable_optimum_at_a_vertex():
    s = solve_lp(lp(constraints=[con("<=", 4, x=1, y=1), con("<=", 6, x=1, y=3), con("<=", 3, x=1)]))
    assert s.status == "Optimal" and math.isclose(s.objective_value, 11)
    assert math.isclose(s.variable_values["x"], 3) and math.isclose(s.variable_values["y"], 1)


def test_minimisation_with_ge_constraints():
    s = solve_lp(lp(sense="min", objective={"x": 3, "y": 2}, constraints=[con(">=", 10, x=1, y=1), con(">=", 15, x=1, y=3)]))
    assert s.status == "Optimal" and math.isclose(s.objective_value, 20)  # optimum x=0, y=10


def test_integer_restriction_changes_the_answer():
    base = dict(objective={"x": 1, "y": 1}, constraints=[con("<=", 5, x=2, y=2)])
    assert math.isclose(solve_lp(lp(**base)).objective_value, 2.5)
    assert math.isclose(solve_lp(lp(integer_vars=["x", "y"], **base)).objective_value, 2)


def test_infeasible_problem_reports_status_and_no_value():
    s = solve_lp(lp(constraints=[con("<=", 1, x=1), con(">=", 5, x=1)]))
    assert s.status == "Infeasible" and s.objective_value is None


def test_equality_constraint():
    s = solve_lp(lp(constraints=[con("=", 4, x=1, y=1), con("<=", 3, x=1)]))
    assert math.isclose(s.variable_values["x"] + s.variable_values["y"], 4)
