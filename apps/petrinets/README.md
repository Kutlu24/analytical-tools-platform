# Petrinets — Hotel Room Pricing Simulator

A room-pricing recommendation tool for small, independent hotels, built on
a real Petri net simulation of booking demand - not a black-box formula
dressed up in Petri-net language.

## Scope decision

There is no historical booking or pricing dataset behind this tool - the
project owner confirmed this explicitly. So this is built the same way as
this account's [GFCA](../GFCA) project: everything the tool reports is a
real, computed number from a documented (if unvalidated) model, with an
LLM layer that explains those numbers and is explicitly forbidden from
inventing its own demand estimate, price, or confidence figure. The output
is a transparent starting point for the owner's own judgment, not a
certified optimal price.

## The Petri net

Three places, four transitions - real Petri-net semantics (a transition
only fires when its input place holds enough tokens; firing consumes/
produces tokens per arc weight), implemented in `src/petrinets/petri_net.py`:

```
AVAILABLE --T_request--> PENDING --T_confirm--> CONFIRMED
    ^                       |                       |
    |                       +------T_reject---------+  (back to AVAILABLE)
    +-----------------------T_cancel----------------+  (CONFIRMED -> AVAILABLE)
```

- **available** / **pending** / **confirmed**: room-nights, as tokens.
- `T_request`: a booking request claims a room (available → pending).
- `T_confirm`: the request converts to a paid booking (pending → confirmed).
- `T_reject`: the request falls through - no payment, guest books
  elsewhere (pending → available).
- `T_cancel`: a confirmed booking is cancelled before check-in
  (confirmed → available).

`src/petrinets/simulate.py` drives this net day-by-day from today through
the arrival date, firing real stochastic events (Poisson-distributed
requests per day, each individually resolved through the net) over many
Monte Carlo runs, using a documented demand model:

| Constant | Meaning |
|---|---|
| `BASE_REQUEST_RATE_PER_ROOM` | mean daily requests per room of inventory, on a normal day |
| `WEEKEND_MULTIPLIER` | arrival night is Friday/Saturday |
| `EVENT_MULTIPLIER` | the "local event / high season" flag |
| `URGENCY_GROWTH_PER_DAY` | demand intensity grows as arrival approaches |
| `BASE_CONFIRM_PROB` | fraction of requests that convert, before price effects |
| `PRICE_VALUE_SENSITIVITY` | how much price-vs-competitor moves confirm probability |
| `DAILY_CANCEL_PROB` | daily cancellation chance per confirmed booking |

None of these are fit to real data - they are reasonable, documented
assumptions, tuned only so the model responds sensibly to its inputs
(verified manually: weekend/event inputs raise expected occupancy and
price, a cheaper/pricier competitor pulls the recommendation down/up, a
hotel that's already nearly full recommends a much higher price than one
that's lightly booked far out).

## Pricing (`src/petrinets/pricing.py`)

Two-pass simulation: first at a neutral (floor/ceiling midpoint) price to
estimate demand, then `price = floor + occupancy_rate * (ceiling - floor)`,
optionally blended 15% toward a given competitor price, then a **second**
simulation pass is run *at* that recommended price so the reported
trajectory and occupancy figures are self-consistent with what's actually
being recommended (price affects confirm probability in the demand model).

## LLM rationale (`src/petrinets/llm/rationale.py`)

Free-tier only (GLM or Gemini, `SYNTHESIS_PROVIDER` in `.env`, default
Gemini) - mirrors GFCA's `llm/synthesis.py` discipline: the system prompt
gives the LLM only the real computed numbers and forbids it from stating a
probability that the recommendation is "correct," inventing its own
demand/price estimate, or omitting the simulation-heuristic disclaimer.

## Running it

```bash
pip install -e .
uvicorn petrinets.api.app:app --reload
```

Then open `http://127.0.0.1:8000/ui/`. Needs `GLM_API_KEY` and/or
`GEMINI_API_KEY` in a local `.env` (see `render.yaml` for the expected
variable names).
