---
type: Architecture
title: RefineMap — System Architecture Overview
description: High-level architecture of RefineMap, the decision board for product and tech teams — React SPA, FastAPI backend, LangGraph refinement engine, SQLAlchemy/PostgreSQL persistence, pluggable LLM providers, and the request flow through a session.
tags: [architecture, overview, fastapi, react, langgraph]
openwiki:
  roles: [architecture]
  change_kinds: [runtime]
  source_paths: [src/main.py, src/config/settings.py, src/database.py, src/i18n.py]
  symbols: [app, LanguageMiddleware, lifespan, settings, init_db, get_db, resolve_language]
  invariants: ["The SPA never calls an LLM directly; all AI work goes through /api. The backend owns orchestration, persistence and credentials. The lang cookie drives both the UI catalog and the backend/prompt language. thread_id aligns LangGraph checkpoints with the session entity while PostgreSQL stays the source of truth."]
  validation_commands: [python -m pytest tests/ -q]
---

# RefineMap — System Architecture Overview

RefineMap is a decision board for product & tech teams: it turns a fuzzy brainstorm
into an explicit, prioritized decision (Go / Explore / Rework / Drop) and an
actionable deliverable (Brief / Plan / Code Draft) in a single session. The
product rule — "the AI poses questions and helps converge; the decision stays the
team's" — is enforced structurally by the engine, not just by prompts.

## System context

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart LR
    U["Team"] --> FE["React SPA<br>nginx / Vite"]
    FE -->|"/api JSON"| API["FastAPI backend"]
    API --> LG["LangGraph workflow"]
    LG --> LLM["LLM provider<br>mock or OpenAI-compatible"]
    API --> DB[("PostgreSQL / SQLite")]
    LLM -->|"structured JSON"| LG
```

The SPA only ever talks JSON to the API (`/api/refinement/*`,
`/api/products*`, `/api/memory*`, `/api/settings`, `/health`); it never holds an
LLM credential or makes an AI call. The backend owns orchestration, persistence,
and secrets. In production, nginx serves the built SPA and reverse-proxies the API
on the same origin, so there is no CORS (see
[operations/deployment.md](../operations/deployment.md)).

## Request flow through one session

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant API as FastAPI (RefinementService)
    participant G as LangGraph
    participant LLM as LLM / mock
    participant DB as PostgreSQL / SQLite

    SPA->>API: POST /api/refinement/sessions (objective, mode)
    API->>DB: create session (DRAFT) + snapshot + memory facts
    API->>G: ainvoke start_session (thread_id = session id)
    G->>LLM: generate_questions (grid axes + memory)
    LLM-->>G: strict JSON, validated by Pydantic
    G-->>API: round 1 + derived round-0 summary
    API->>DB: persist question round + summary (QUESTIONING)
    API-->>SPA: questionRound + sessionSummary + productMemory

    loop rounds 1..maxRounds
        SPA->>API: POST /answers
        API->>DB: upsert answers (ANALYZING)
        API->>G: ainvoke answers_submitted
        G->>LLM: summarize_context
        LLM-->>G: facts / unknowns / confidence / enoughContext
        G-->>API: next round or final deliverable
        API->>DB: persist summary; round (QUESTIONING) or artifact (FINAL_READY)
        API-->>SPA: questionRound or deliverable + decision
    end

    SPA->>API: GET /export
    API-->>SPA: Markdown deliverable (Decision + Brief + Plan)
```

## Components and their homes

| Component | Home | Responsibility |
|---|---|---|
| API entry | `src/main.py` | FastAPI app, `lifespan` runs `init_db()`, raw-ASGI `LanguageMiddleware` sets the language ContextVar per request, `/health` returns provider status |
| Settings | `src/config/settings.py` | Pydantic-settings env config: DB URL, LLM provider/keys, refinement limits (`refinement_max_rounds=3`, `min_rounds=2`, `max_questions_per_round=6`), `app_root`/`prompts_dir` |
| Database | `src/database.py` | SQLAlchemy engine/session, `get_db` dependency, `init_db` (create_all + hand-rolled forward migration + default user seed) |
| Refinement engine | `src/agents/refinement_workflow/` | LangGraph state machine — see [refinement-engine.md](refinement-engine.md) |
| Services | `src/services/` | `refinement_service` (orchestration), `refinement_llm` (engines), `settings_service`, `product_memory_service`, `question_grids`, `product_memory_rules`, `artifact_renderer`, `prompt_loader` |
| Repositories | `src/repositories/` | SQLAlchemy data access for sessions, product memory, settings |
| Models | `src/models/` | ORM entities — see [data-model.md](../domain/data-model.md) |
| API routers | `src/api/` | `/api/refinement`, `/api/products`, `/api/memory`, `/api/settings` — see [refinement-api.md](../api/refinement-api.md) |
| Frontend | `frontend/src/` | React SPA — see [frontend/overview.md](../frontend/overview.md) |
| Prompts | `prompts/` | Six Markdown prompts, versioned per session (`prompt_version`) |
| Contracts | `contracts/` | JSON Schemas for LLM outputs + a historical API contract doc |

## Cross-cutting concerns

- **Language / i18n** — the `lang` cookie is the single switch: the frontend catalog
  (`frontend/src/i18n/catalog.ts`) and the backend catalog (`src/i18n.py`, only
  `api.*` namespaces) both read it; the middleware picks it once per request
  (raw ASGI on purpose — `BaseHTTPMiddleware` runs the endpoint in a separate task
  and makes ContextVar propagation fragile), and the prompt language is resolved
  from the same ContextVar so LLM user-facing strings follow the UI.
- **State alignment** — LangGraph `thread_id` = session id keeps checkpoints
  aligned with the business entity, while PostgreSQL remains the source of truth;
  the graph is rebuilt per request from repository data (`_build_state_from_session`).
- **Degradation** — any real LLM failure degrades to the deterministic offline mock
  with `degraded: true` surfaced to the UI, never a 500.
- **Security posture** — no authentication (single seeded local user), secrets
  encrypted at rest, no HTTPS yet; see
  [operations/deployment.md](../operations/deployment.md) for the full list.

## Change guidance

- **When to consult this page:** understanding how a change ripples across the
  system before touching code; adding middleware, lifecycle hooks, or new routers.
- **Entry points for a backend change:** register the router in `src/main.py`;
  add the route in `src/api/`, the logic in `src/services/`, the data access in
  `src/repositories/`, the schema in `src/api/schemas_*.py`, and mirror consumer
  types in `frontend/src/types/api.ts`.
- **Validation:** `python -m pytest tests/ -q` for the backend units, then a manual
  mock-provider flow (`uvicorn src.main:app --reload --port 8000`); frontend-only
  changes validate with `cd frontend && npm run build`.
