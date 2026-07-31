# Implementation Plan

## Phase 0 - Project framing

Goal:

- lock the MVP scope and align it with the patterns already used in `../app`

Tasks:

1. confirm the first supported Azure DevOps work item types
2. list the exact Azure DevOps fields that matter in your organization
3. validate the target final refinement format with tech leads
4. choose the session and auth model to reuse from the existing app ecosystem

Exit criteria:

- final artifact structure approved
- Azure DevOps field map identified
- target users and access rules identified

## Phase 1 - FastAPI foundation

Goal:

- create the application shell with routes, templates, config, and persistence

Tasks:

1. scaffold `src/main.py`, `src/routes/`, `src/api/`, `src/templates/`, `src/static/`
2. add `pydantic-settings` configuration aligned with the style used in `../app`
3. add `database.py`, `SQLAlchemy` base, and `Alembic`
4. add a base Jinja layout and a first `refinement/index.html`
5. wire minimal auth or reuse the existing auth approach if this app is merged later

Exit criteria:

- app boots locally with FastAPI
- templates render correctly
- database session dependency works

## Phase 2 - Azure DevOps integration

Goal:

- make work item selection usable from the UI

Tasks:

1. implement `AzureDevOpsRefinementService`
2. add `GET /api/refinement/work-items/search`
3. add `GET /api/refinement/work-items/{id}`
4. normalize raw Azure DevOps fields into an internal work item DTO
5. store a raw payload snapshot for traceability

Exit criteria:

- a user can search for work items
- a user can open a work item summary card
- HTML fields are safely prepared for prompting and display

## Phase 3 - LangGraph session loop

Goal:

- ask the first useful question round and persist workflow state correctly

Tasks:

1. implement the `refinement_workflow` graph
2. define `RefinementState`
3. create graph nodes for load, compile, question generation, summarization, and final output
4. compile the graph with checkpoint support
5. align `thread_id` with the application `session_id`
6. interrupt before human answer collection

Exit criteria:

- a session can start and produce the first question round
- the graph can be resumed for the same `session_id`
- graph state and database state remain aligned

## Phase 4 - Session persistence and API contracts

Goal:

- persist every meaningful artifact of the refinement workflow

Tasks:

1. implement SQLAlchemy models from `docs/sqlalchemy-data-model.md`
2. add repositories for sessions, rounds, answers, summaries, and artifacts
3. implement `POST /api/refinement/sessions`
4. implement `GET /api/refinement/sessions/{session_id}`
5. implement `POST /api/refinement/sessions/{session_id}/answers`
6. validate LLM outputs with `Pydantic` and JSON Schema before persistence

Exit criteria:

- question rounds and answers are durable in PostgreSQL
- malformed model outputs are rejected safely
- session reload after refresh works

## Phase 5 - HTMX workflow experience

Goal:

- make the iterative refinement flow smooth without a SPA

Tasks:

1. build the session workspace page
2. add HTMX forms for answer submission
3. add partial refresh for question round and session summary
4. display progress, current round, confidence, and open unknowns
5. handle the transition to `FINAL_READY` cleanly

Exit criteria:

- the user can refine a ticket without full-page reloads between rounds
- the session summary panel updates consistently
- the UI clearly signals when refinement is complete

## Phase 6 - Final artifact generation and export

Goal:

- produce a delivery-ready refinement output

Tasks:

1. implement final generation using `generate-final-refinement.md`
2. validate against `final-refinement.schema.json`
3. render the artifact in Jinja templates
4. add markdown export
5. label assumptions and unresolved questions explicitly

Exit criteria:

- a user can obtain a final structured refinement output
- the artifact can be copied or exported as markdown

## Phase 7 - Hardening and observability

Goal:

- make the MVP safe and diagnosable in real team usage

Tasks:

1. add structured logging
2. add LangGraph stage tracing and token usage tracking
3. add `Langfuse` or equivalent prompt traces
4. redact secrets from logs
5. add retry policy for transient Azure DevOps and LLM errors
6. tune prompts using a small set of real backlog items

Exit criteria:

- common failures are diagnosable
- prompt behavior is observable
- internal pilot usage is possible

## Suggested sprint split

Sprint 1:

- phases 1 and 2

Sprint 2:

- phases 3 and 4

Sprint 3:

- phases 5 and 6

Sprint 4:

- phase 7 and prompt tuning

## Validation checklist for the first pilot

- did the questions reduce ambiguity quickly
- did the loop avoid asking redundant questions
- did the final split look realistic to the team
- were CI/CD and test impacts captured often enough
- did the HTMX flow feel simple enough for workshop usage
- did users trust the separation between facts and assumptions
