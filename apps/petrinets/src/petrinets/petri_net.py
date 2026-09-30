"""A small, real Petri net: places, a marking (token counts per place), and
transitions that fire only when their input places hold enough tokens,
consuming/producing tokens per arc weights. This is the actual formalism -
not a formula dressed up in Petri-net words - so the simulation in
simulate.py drives real transition firings, not a black-box output.

The hotel booking-pipeline net modeled here:

    AVAILABLE --T_request--> PENDING --T_confirm--> CONFIRMED
        ^                       |                       |
        |                       +------T_reject---------+ (back to AVAILABLE)
        +-----------------------T_cancel----------------+ (CONFIRMED -> AVAILABLE)

Places: available, pending, confirmed (tokens = room-nights).
Transitions (all arcs weight 1):
  T_request:  available -> pending    (a booking request claims a room)
  T_confirm:  pending   -> confirmed  (the request is confirmed/paid)
  T_reject:   pending   -> available  (the request falls through - no
              payment, guest picks elsewhere, room released back)
  T_cancel:   confirmed -> available  (a confirmed booking is cancelled
              before check-in)
"""
from __future__ import annotations

from dataclasses import dataclass, field


PLACES = ("available", "pending", "confirmed")


@dataclass
class Marking:
    available: int
    pending: int = 0
    confirmed: int = 0

    def copy(self) -> "Marking":
        return Marking(self.available, self.pending, self.confirmed)

    def as_dict(self) -> dict[str, int]:
        return {"available": self.available, "pending": self.pending, "confirmed": self.confirmed}


class PetriNetError(RuntimeError):
    pass


def fire_request(m: Marking) -> bool:
    """available -[1]-> pending. Fires only if a token is available - this
    is the actual Petri-net enabling condition, not a convenience check."""
    if m.available < 1:
        return False
    m.available -= 1
    m.pending += 1
    return True


def fire_confirm(m: Marking) -> bool:
    """pending -[1]-> confirmed."""
    if m.pending < 1:
        return False
    m.pending -= 1
    m.confirmed += 1
    return True


def fire_reject(m: Marking) -> bool:
    """pending -[1]-> available."""
    if m.pending < 1:
        return False
    m.pending -= 1
    m.available += 1
    return True


def fire_cancel(m: Marking) -> bool:
    """confirmed -[1]-> available."""
    if m.confirmed < 1:
        return False
    m.confirmed -= 1
    m.available += 1
    return True
