---
type: API Reference
title: Refinement, Product Memory and Settings APIs
description: The complete FastAPI surface of RefineMap — refinement session endpoints, product memory endpoints, settings endpoints, the strict Pydantic schemas, error mapping conventions, and the contracts directory.
tags: [api, fastapi, schemas, endpoints]
openwiki:
  roles: [integration]
  change_kinds: [public-api]
  source_paths: [src/api/refinement.py, src/api/product_memory.py, src/api/settings.py, src/api/schemas_refinement.py, src/api/schemas_settings.py]
  symbols: [refinement_api_router, product_memory_api_router, settings_api_router, StrictModel, CreateSessionRequest, SubmitAnswersRequest, SessionDetailResponse, StartSessionResponse]
  invariants: ["All request/response schemas are StrictModel (extra=forbid). KeyError maps to 404, ValueError maps to 400. The LLM API key is never returned to the client, only a masked hint."]
  validation_commands: [python -m pytest tests/ -q]
---

# Refinement, Product Memory and Settings APIs

The backend exposes three routers, mounted in `src/main.py`:
`/api/refinement` (refinement sessions), `/api` under `/api/products` and
`/api/memory` (product memory), and `/api/settings` (LLM configuration). Every
schema is a `StrictModel` (`extra="forbid"`) so unknown fields fail loudly at the
boundary. The frontend mirrors these types in `frontend/src/types/api.ts` — keep
both in sync when changing a schema.

## Refinement endpoints (`src/api/refinement.py`)

| Method & path | Purpose | Request -> Response |
|---|---|---|
| `POST /api/refinement/sessions` | Create a session and generate round 1 | `CreateSessionRequest` (`objective`, `mode`, `extraContext`, `productId`, `productName`, `maxRounds`, `maxQuestionsPerRound`) -> `StartSessionResponse` (`session`, `questionRound`, `sessionSummary`, `productMemory`, `degraded`) |
| `GET /api/refinement/sessions` | Paginated history list | query: `q`, `status`, `limit` (1..100, default 20), `offset` -> `SessionListResponse` |
| `GET /api/refinement/sessions/{session_id}` | Full session detail | -> `SessionDetailResponse` (`session`, `subject`, `currentQuestionRound`, `questionRounds`, `answers` history, `sessionSummary`, `productMemory`, `deliverable`) |
| `PATCH /api/refinement/sessions/{session_id}` | Rename | `RenameSessionRequest.title` -> `SessionListItem` |
| `DELETE /api/refinement/sessions/{session_id}` | Delete (cascade) | -> 204 |
| `POST /api/refinement/sessions/{session_id}/mode` | Change grid, reset rounds, replay round 0 | `SetModeRequest.mode` -> `SessionDetailResponse` |
| `POST /api/refinement/sessions/{session_id}/answers` | Submit the open round's answers | `SubmitAnswersRequest.answers[]` (`questionId`, `answer`) -> `SubmitAnswersResponse` (`decision`, `questionRound` or `deliverable`, `sessionSummary`, `degraded`) |
| `GET /api/refinement/sessions/{session_id}/export` | Markdown deliverable download | -> `text/markdown` with `Content-Disposition: attachment; filename="refinement-{session_id}.md"` |

Error convention: `KeyError` -> `404` ("Session not found"), `ValueError` -> `400`
("Provide an objective prompt to start a session.", "No open question round for this
session", "No deliverable available yet", "Provide a title.", ...). Unknown and
not-owned resources collapse into the same 404 to avoid existence leaks.

## Product memory endpoints (`src/api/product_memory.py`)

| Method & path | Purpose |
|---|---|
| `GET /api/products` | List the user's products with active fact counts |
| `POST /api/products` | Create a product (`CreateProductRequest.name`, min 1 / max 255) |
| `DELETE /api/products/{product_id}` | Delete a product (facts cascade; sessions keep a dangling `product_id` that reads as "no memory") |
| `GET /api/products/{product_id}/memory` | List the product's active facts |
| `POST /api/products/{product_id}/memory` | Add a manual fact (`CreateMemoryFactRequest.category`, `statement`) — confirmed immediately |
| `PATCH /api/memory/{fact_id}` | Update statement and/or `confirmed` flag (`UpdateMemoryFactRequest`) |
| `DELETE /api/memory/{fact_id}` | Archive a fact (never hard-delete) |

## Settings endpoints (`src/api/settings.py`)

| Method & path | Purpose |
|---|---|
| `GET /api/settings` | Current LLM settings: provider, endpoint, deployment, model, `keyConfigured`, masked `keyHint`, and `source` (database vs environment) |
| `POST /api/settings` | Save provider/endpoint/deployment/model; API key saved only if non-empty and encrypted at rest |
| `POST /api/settings/test/llm` | Validate the config for the chosen provider (`ConnectionTestRequest`, optional overrides). **Deliberately non-live**: it checks field completeness per provider, it does not call the network |

See [llm-configuration.md](../operations/llm-configuration.md) for the full
behavior, including provider-specific required fields and the mask/encryption rules.

## Schema highlights (`src/api/schemas_refinement.py`)

- **Subject/round/summary** — `SubjectModel`, `QuestionItem` (with `suggestions`
  chips), `QuestionRoundModel`, `SessionSummaryModel`.
- **Deliverable** — `RefinementDeliverable` (`summary`, `brief[]`, `plan[]`,
  `codeDraft`, `openQuestions[]`, `decisionReport`) with the `DecisionReport` v1->v2
  migration (see [decision-report.md](../domain/decision-report.md)).
- **LLM structured outputs** — `GenerateQuestionsOutput`, `SessionSummaryOutput`,
  `RefinementDeliverableOutput`, `DetectModeOutput`, `ProductMemoryOp(s)Output`;
  `ProductMemoryOp.action` is a plain `str` on purpose so an unknown action is
  skipped by the repository instead of failing the whole diff.
- **`degraded` flag** — present on `StartSessionResponse` and
  `SubmitAnswersResponse`; true when the LLM failed and the offline mock produced
  the content, so the UI can show a fallback banner.

## Contracts directory (`contracts/`)

The JSON Schemas for the LLM outputs (`generate-questions.schema.json`,
`final-refinement.schema.json`, `session-summary.schema.json`) document the shapes
the prompts must produce. Note: `contracts/refinement-api.md` describes an **older
work-item-centric target contract** (Azure DevOps work items, HTMX pages) — it is a
historical artifact that predates the current objective-based API and does not match
the implemented routes.

## Change guidance

- **When to consult this page:** adding/renaming an endpoint, changing a schema, or
  changing error semantics.
- **Invariants to preserve:** `StrictModel` with `extra="forbid"`; 404/400 mapping;
  the `degraded` flag; masked (never raw) secrets in responses; the
  session-id = thread-id convention.
- **Cross-package surface:** every backend schema change must be mirrored in
  `frontend/src/types/api.ts`, and consumer changes follow in
  `frontend/src/api/refinement.ts` / `settings.ts`.
- **Focused tests:** the schema behavior that is tested today is the
  `DecisionReport` migration and normalization (`tests/test_artifact_renderer.py`);
  there is no API-client test suite yet — endpoint smoke tests would require a
  test client plus a temporary SQLite DB.
- **Validation:** `python -m pytest tests/ -q`; for a manual smoke run start the
  server and exercise `POST /api/refinement/sessions` with
  `{"objective": "Test subject"}` (mock provider by default).
