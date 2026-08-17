---
type: Testing
title: Test Suites and Validation Commands
description: The current automated tests of RefineMap — routing rules, decision-report verdicts, Markdown artifact rendering — plus the quiet validation commands per area and the areas with no test coverage yet.
tags: [testing, pytest, validation]
openwiki:
  roles: [testing]
  change_kinds: [testing]
  source_paths: [tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  symbols: [route_after_summary, MockRefinementLLM, render_deliverable_markdown, DecisionReport]
  test_paths: [tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  validation_commands: [python -m pytest tests/ -q]
---

# Test Suites and Validation Commands

The automated test suite is small and deliberately focused on the engine's
deterministic surfaces. Everything else is validated by typecheck/build and manual
smoke runs.

## Suites

### `tests/test_routing.py` — graph routing rules

Pins all five branches of `route_after_summary` (the LangGraph decision between
"next question round" and "final refinement" — see
[refinement-engine.md](architecture/refinement-engine.md)):

- round below `min_rounds` keeps questioning **even with enoughContext**;
- `enoughContext` at `min_rounds` finalizes;
- not enough context keeps questioning;
- `max_rounds` forces finalization regardless of context;
- `min_rounds` clamped to `max_rounds`.

Command: `python -m pytest tests/test_routing.py -q`

### `tests/test_mock_decision.py` — verdict semantics

Pins the deterministic arbitration in `MockRefinementLLM._build_decision_report`
<!-- openwiki: broken internal link [../domain/decision-report.md] file "../domain/decision-report.md" does not exist. Fix the href or restore the target, then delete this comment. -->
(see [decision-report.md](../domain/decision-report.md)):

- no facts + >= 3 unknowns -> **drop / high** with exactly 2 blockers, root cause =
  blocker[0] = nextAction target, fallback strength from the grid;
- no unknowns + high confidence + <= 1 risk -> **go / high**, no blockers;
- risks >= 3 or risks > facts -> **rework / medium**;
- otherwise -> **explore / medium** with 2..4 reasons, <= 2 blockers.

Command: `python -m pytest tests/test_mock_decision.py -q`

### `tests/test_artifact_renderer.py` — Markdown export

Pins `render_deliverable_markdown` (decision section before Brief; conditional-go
singular/plural; root cause vs secondary split; empty sublists skipped; legacy
deliverable without `decisionReport`; v1 -> v2 `DecisionReport` payload migration;
recommendation/confidence case normalization).

Command: `python -m pytest tests/test_artifact_renderer.py -q`

## Validation commands

| Area | Command | Notes |
|---|---|---|
| All backend unit tests | `python -m pytest tests/ -q` | Quiet; complete failure output. Requires `pip install -r requirements-dev.txt`. |
| Engine routing only | `python -m pytest tests/test_routing.py -q` | Fastest signal for graph changes. |
| Verdict + export | `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q` | The two decision-report surfaces. |
| Frontend typecheck + build | `cd frontend && npm run build` | Runs `tsc --noEmit` then `vite build`; the only frontend gate (no test suite). |
| Backend smoke run | `uvicorn src.main:app --reload --port 8000` then `curl localhost:8000/health` | Verifies `init_db` and routing; default `LLM_PROVIDER=mock` runs the full flow offline. |
| Full local stack | `docker compose up --build` | Expensive; only when container behavior is the question (nginx, proxy timeouts, Postgres). |

## Coverage gaps (candidates for future tests)

- **No API client tests** — endpoint behavior (404/400 mapping, `degraded` flag,
  upsert answers) is untested; a FastAPI `TestClient` + temporary SQLite fixture
  would cover the service/repository boundaries.
- **No repository/lifecycle tests** — session status transitions, grid reset
  (`reset_rounds`), delete cascade, and `apply_ops` semantics have no tests.
- **No frontend tests** — component rendering, i18n fallback, and the War Room
  ordering logic (`openRoundOrder`, `themeKey`) are untested.
- **No product-memory rule tests** — `is_durable_statement` and
  `classify_memory_category` are pure and cheap to pin.

## Change guidance

- When a change touches graph routing, verdict rules, or the Markdown export, the
  matching suite above is the narrowest verification and should be extended in the
  same change.
- For service/repository/API changes, add tests at the service boundary with an
  in-memory or temporary SQLite engine (the app already supports
  `DATABASE_URL=sqlite:///...`); do not require Postgres or a live LLM in unit
  tests.
