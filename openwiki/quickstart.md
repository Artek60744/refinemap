---
type: Documentation Hub
title: RefineMap — Quickstart and Wiki Map
description: Entry point for the RefineMap repository wiki. Explains what the product is, how the wiki is organized, and routes every major change area to the exact source files, invariants, focused tests, and validation commands.
tags: [refinemap, quickstart, navigation]
openwiki:
  roles: [repository, workflow]
  change_kinds: [navigation]
  source_paths: [src/main.py, src/services/refinement_service.py, src/agents/refinement_workflow/graph.py]
  validation_commands: [python -m pytest tests/ -q]
---

# RefineMap — Quickstart

RefineMap (branded **PromptRefine** in the UI) is a "decision board" SaaS: an
AI-assisted refinement workspace where a team enters a raw idea and leaves a single
session with an explicit arbitration (Go / Explore / Rework / Drop), a decision
report, and an exportable deliverable (Brief, Plan, Code Draft). It is deliberately
*not* another AI brainstorming tool — the differentiator is the agentic refinement
engine and the product memory that carries durable facts across sessions.

The repository is a two-part application:

- **Backend** (`src/`) — FastAPI JSON API, a LangGraph refinement state machine,
  SQLAlchemy persistence (PostgreSQL in production, SQLite locally), and pluggable
  LLM providers (mock by default).
- **Frontend** (`frontend/`) — React 18 + TypeScript + Vite + Tailwind SPA served by
  nginx in production. It only talks to the API; it never calls an LLM directly.

## What this wiki covers

| Area | Page | What you will find there |
|---|---|---|
| System architecture and request flow | [architecture/overview.md](architecture/overview.md) | Component map, runtime sequence, i18n split, thread-id alignment |
| LangGraph refinement engine | [architecture/refinement-engine.md](architecture/refinement-engine.md) | State machine, routing rules, LLM providers, mock fallback, prompts |
| Question grids (postures) | [domain/question-grids.md](domain/question-grids.md) | PO / Technique / Hybride axes, mode detection, keyword fallback |
| Decision report semantics | [domain/decision-report.md](domain/decision-report.md) | Verdict enum, root-cause rules, blockers, Markdown export |
| Product memory | [domain/product-memory.md](domain/product-memory.md) | Products, facts, categories, durability rules, memory ops, curation API + UI |
| Data model and session lifecycle | [domain/data-model.md](domain/data-model.md) | SQLAlchemy entities, statuses, artifact journal, forward migration |
| API surface | [api/refinement-api.md](api/refinement-api.md) | Endpoints, schemas, error mapping, exports |
| Frontend SPA | [frontend/overview.md](frontend/overview.md) | Routes, pages, navigation shells, i18n, API client, product-memory UI |
| Deployment and operations | [operations/deployment.md](operations/deployment.md) | deploy.sh, Docker compose, Azure VM, cost control, known limits |
| LLM provider configuration | [operations/llm-configuration.md](operations/llm-configuration.md) | Settings storage, encryption, providers, connection test |
| Testing and validation | [testing.md](testing.md) | Test suites, exact assertions, minimal validation commands |

The [README.md](../README.md) at the repository root is the product pitch and the
local dev quickstart; `docs/` contains design and planning documents (workflow
walkthrough, deployment guide, target data model, MVP blueprint) that this wiki
summarizes and links instead of duplicating.

## Task routing

| Change area or user intent | Wiki page | Source entry points | Important symbols / types | Focused tests | Minimal validation command |
|---|---|---|---|---|---|
| Session flow: create, answer, change grid, export | [architecture/overview.md](architecture/overview.md), [api/refinement-api.md](api/refinement-api.md) | `src/services/refinement_service.py` (`start_session`, `submit_answers`, `set_mode`, `export_markdown`), `src/api/refinement.py` | `RefinementService`, `CreateSessionRequest`, `SubmitAnswersRequest`, `StartSessionResponse` | none (no service-level suite yet) | `python -m pytest tests/ -q` |
| LangGraph state machine or routing rules | [architecture/refinement-engine.md](architecture/refinement-engine.md) | `src/agents/refinement_workflow/graph.py` (`create_refinement_graph`, `route_start`, `route_after_summary`, `route_after_final`), `state.py` (`RefinementState`) | `RefinementState`, `create_initial_state`, node builders in `nodes.py` | `tests/test_routing.py` (5 tests) | `python -m pytest tests/test_routing.py -q` |
| LLM provider, JSON repair, mock fallback | [architecture/refinement-engine.md](architecture/refinement-engine.md), [operations/llm-configuration.md](operations/llm-configuration.md) | `src/services/refinement_llm.py` (`OpenAICompatibleLLM`, `MockRefinementLLM`, `build_refinement_llm`) | `RefinementLLM` protocol, `degraded` flag, `_chat_json` | `tests/test_mock_decision.py` | `python -m pytest tests/test_mock_decision.py -q` |
| Decision report verdict or Markdown export | [domain/decision-report.md](domain/decision-report.md) | `src/services/refinement_llm.py::_build_decision_report`, `src/services/artifact_renderer.py::render_deliverable_markdown` | `DecisionReport`, `DecisionRecommendation`, `RefinementDeliverable` | `tests/test_mock_decision.py`, `tests/test_artifact_renderer.py` | `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q` |
| Question grids, axes, mode detection | [domain/question-grids.md](domain/question-grids.md) | `src/services/question_grids.py` | `GRID_AXES`, `normalize_mode`, `resolve_grid`, `detect_grid_by_keywords` | covered indirectly by mock engine tests | `python -m pytest tests/ -q` |
| Product memory curation or memory ops | [domain/product-memory.md](domain/product-memory.md), [frontend/overview.md](frontend/overview.md) | `src/services/product_memory_rules.py`, `src/repositories/product_memory_repository.py::apply_ops`, `src/services/product_memory_service.py`, `frontend/src/pages/ProductMemoryPage.tsx`, `frontend/src/api/memory.ts`, `prompts/extract-product-memory.md` | `is_durable_statement`, `classify_memory_category`, `MEMORY_FACT_LIMIT`, `ProductMemoryOp`, `ProductMemoryPage`, `api/memory.ts` | none (no dedicated suite yet) | `python -m pytest tests/ -q` |
| Data model, session statuses, schema evolution | [domain/data-model.md](domain/data-model.md) | `src/models/refinement.py`, `src/models/product_memory.py`, `src/models/app_settings.py`, `src/database.py` | `RefinementSession`, `QuestionRound`, `Question`, `Answer`, `SessionSummary`, `SessionArtifact`, `Product`, `ProductMemoryFact` | none (no model suite yet) | `python -m pytest tests/ -q` |
| API endpoints, schemas, error semantics | [api/refinement-api.md](api/refinement-api.md) | `src/api/refinement.py`, `src/api/product_memory.py`, `src/api/settings.py`, `src/api/schemas_refinement.py` | router objects, `StrictModel` schemas, `HTTPException` mapping | `tests/test_artifact_renderer.py` (schema round-trips) | `python -m pytest tests/ -q` |
| Frontend page, route, or i18n string | [frontend/overview.md](frontend/overview.md) | `frontend/src/App.tsx`, `frontend/src/pages/*` (`WarRoom`, `HistoryPage`, `ProductMemoryPage`, `RefinementHome`, `SettingsPage`), `frontend/src/api/*` (`client`, `refinement`, `memory`, `settings`), `frontend/src/i18n/catalog.ts` | `WarRoom`, `HistoryPage`, `ProductMemoryPage`, `MemoryBanner`, `TopNavBar`, `Layout`, `apiFetch`, `LanguageProvider` | none (frontend has no test suite) | `cd frontend && npm run build` |
| Deployment, Docker, VM operations | [operations/deployment.md](operations/deployment.md) | `deploy.sh`, `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `frontend/nginx.conf` | `deploy.sh` subcommands (`sync`, `deploy`, `dev`, `logs`, `env`, `stop`), nginx proxy config | none | `./deploy.sh status` |
| LLM settings storage, encryption, connection test | [operations/llm-configuration.md](operations/llm-configuration.md) | `src/services/settings_service.py`, `src/repositories/settings_repository.py`, `src/utils/encryption.py`, `src/models/app_settings.py` | `SettingsService`, `RuntimeConfig`, `EncryptionService`, `AppSetting`, `SENSITIVE_SETTING_KEYS` | none | `python -m pytest tests/ -q` |
| Backend wiring, health check, DB bootstrap | [architecture/overview.md](architecture/overview.md) | `src/main.py` (`app`, `LanguageMiddleware`, `/health`), `src/database.py::init_db`, `src/config/settings.py` | `settings`, `SessionLocal`, `Base` | none | `uvicorn src.main:app --reload --port 8000`, then `curl localhost:8000/health` |

## Quick orientation

- **The refinement loop is a LangGraph state machine, not a chat.** Each LLM step
  returns strict JSON validated by Pydantic; `thread_id` equals the session id.
  See [architecture/refinement-engine.md](architecture/refinement-engine.md).
- **The mock engine is a product invariant.** `LLM_PROVIDER=mock` (the default)
  makes the whole flow run offline; every real provider call that fails degrades to
  the same mock engine and flags `degraded: true` so the UI can tell the user.
- **Session state is the source of truth, not LangGraph checkpoints.** PostgreSQL
  (or SQLite) holds sessions, rounds, questions, answers, summaries and artifacts;
  see [domain/data-model.md](domain/data-model.md).
- **Product memory is scoped per product and capped.** Only durable, category-classified
  facts survive from one session to the next, up to `MEMORY_FACT_LIMIT` (40); humans
  curate them on the `/memory` page or inline in the War Room banner; see
  [domain/product-memory.md](domain/product-memory.md).
- **The verdict is the product.** `decisionReport` closes every finalized session
  with `go | explore | rework | drop`, a root cause, up to two blockers, strengths
  and a next action; see [domain/decision-report.md](domain/decision-report.md).

## Validation quick reference

```bash
# Backend: full focused suite (3 files, all offline — no LLM or DB required)
python -m pytest tests/ -q

# Single behavior area
python -m pytest tests/test_routing.py -q        # LangGraph routing rules
python -m pytest tests/test_mock_decision.py -q  # verdict arbitration rules
python -m pytest tests/test_artifact_renderer.py -q  # Markdown export + schema migration

# Frontend: typecheck + production build (slow, conditional: run when touching frontend/)
cd frontend && npm run build

# Full stack locally (mock LLM by default)
uvicorn src.main:app --reload --port 8000   # terminal 1
cd frontend && npm run dev                  # terminal 2, open http://localhost:5173

# Deployed VM status (conditional: only when operating the deployment)
./deploy.sh status
```

See [testing.md](testing.md) for what each suite asserts and why.

## Keeping this wiki current

This wiki is generated and maintained by OpenWiki; the CLI is a root
devDependency (`package.json`, README "Documentation temps réel (OpenWiki)"):
`npm run docs:update` regenerates it, `npm run docs:watch` runs
`scripts/openwiki-watch.mjs` (watches `src/`, `frontend/src/` and `contracts/`,
debounced 8 s), and `npm run docs:visualize` opens the knowledge graph. Wiki pages
live in `openwiki/` and are committed with the code — update them in the same
change as the source they describe.

## Backlog

- **Authentication (magic link / Google SSO)** — planned (README "Prochains
  incréments techniques", `docs/implementation-plan.md` week 2) but no code exists;
  today a single local user is seeded (`local-user@example.com`, see
  `src/database.py::init_db`).
- **Alembic migrations** — `alembic` is in `requirements.txt` but no migration setup
  exists; the schema is created by `create_all()` plus a hand-rolled
  `_add_missing_columns()` forward migration in `src/database.py`.
- **Decision-board domain (workspace / board / node / score / vote / export tables)**
  — target model only, described in `docs/sqlalchemy-data-model.md`; the current
  schema is session-centric.
- **Backlog exports (CSV / JSON)** — only Markdown export is implemented
  (`GET /api/refinement/sessions/{id}/export`).
- **Scoring / vote / tags UI and decision layer** — planned, not implemented
  (README; `docs/mvp-blueprint.md`).
- **Frontend test suite** — none exists; frontend validation is `tsc --noEmit` +
  `vite build`.
- **HTTPS and real auth hardening** — documented limits in `docs/deployment.md` and
  [operations/deployment.md](operations/deployment.md).
