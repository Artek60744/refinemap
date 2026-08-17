---
type: Architecture
title: The Refinement Engine — LangGraph Workflow and LLM Layer
description: The differentiating core of RefineMap — the LangGraph state machine (generate questions, summarize context, final refinement, extract memory), its routing rules, the RefinementState shape, and the two LLM engines with JSON repair, retry and offline fallback.
tags: [architecture, langgraph, llm, workflow]
openwiki:
  roles: [architecture]
  change_kinds: [runtime, lifecycle]
  source_paths: [src/agents/refinement_workflow/graph.py, src/agents/refinement_workflow/nodes.py, src/agents/refinement_workflow/state.py, src/services/refinement_llm.py, src/services/refinement_service.py, prompts/]
  symbols: [create_refinement_graph, RefinementState, create_initial_state, route_start, route_after_summary, route_after_final, build_generate_questions_node, build_summarize_context_node, build_generate_final_refinement_node, build_extract_product_memory_node, MockRefinementLLM, OpenAICompatibleLLM, build_refinement_llm]
  test_paths: [tests/test_routing.py, tests/test_mock_decision.py]
  invariants: ["thread_id equals the session id. min_rounds caps below max_rounds and forces at least one follow-up pass. The LLM is never the persistence layer: nodes only compute, the repository persists. Any real-call failure degrades to the offline mock with degraded=True instead of a 500. A session without product_id skips the memory extraction node."]
  validation_commands: [python -m pytest tests/test_routing.py tests/test_mock_decision.py -q]
---

# The Refinement Engine — LangGraph Workflow and LLM Layer

The refinement loop is a **LangGraph state machine**, not a free chat: every session
walks the same explicit graph, every LLM step returns structured JSON validated by
Pydantic, and the graph never persists anything itself — the repository does, after
each node's output is validated. The `thread_id` LangGraph checkpoint is aligned on
the session id so one graph instance carries the whole conversation.

## The graph (`src/agents/refinement_workflow/graph.py`)

Four nodes, all fed by the same `RefinementState` (a `TypedDict`, created by
`create_initial_state` or rebuilt from the session by
`RefinementService._build_state_from_session`):

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TD
    START["START"] --> R1{"route_start<br>answers submitted?"}
    R1 -->|no| Q["generate_questions"]
    R1 -->|yes| S["summarize_context"]
    S --> R2{"route_after_summary<br>round and enoughContext"}
    R2 -->|"round below min or not enough context"| Q
    R2 -->|"round at max, or enough context at min"| F["generate_final_refinement"]
    F --> R3{"route_after_final<br>product attached?"}
    R3 -->|yes| M["extract_product_memory"]
    R3 -->|no| FIN["end"]
    Q --> FIN["end"]
    M --> FIN["end"]
```

- **`generate_questions`** — calls `llm.generate_questions` with the grid axes as
  the backbone, bumps `round`, and stores `latest_question_round` plus a provisional
  `decision` (enoughContext false, reasoning from the round). Entry point for
  session start (`workflow_action=start_session`) and for each new round.
- **`summarize_context`** — synthesizes facts / assumptions / unknowns /
  dependencies / risks / confidence / enoughContext from the answered questions.
  Entry point after `answers_submitted`.
- **`generate_final_refinement`** — assembles the deliverable
  (`summary`, `brief`, `plan`, `codeDraft`, `openQuestions`, `decisionReport`) and
  sets enoughContext true.
- **`extract_product_memory`** — terminal node: asks the LLM for the memory diff
  (`memory_ops`) only; persistence belongs to the service. Skipped entirely when the
  session has no `product_id` (no extra LLM call for a diff that would be discarded).

### Routing rules (pinned by `tests/test_routing.py`)

`route_after_summary` is deliberately conservative — "the LLM tends to declare
enoughContext too early":

- `min_rounds = min(state.min_rounds, state.max_rounds)` — the floor never exceeds
  the cap;
- finalize when `round >= max_rounds`, or when `enoughContext` and
  `round >= min_rounds`; otherwise ask another round.

## The service side (`src/services/refinement_service.py`)

`RefinementService` owns the lifecycle boundary between the API and the graph:

- `start_session` — resolves product + grid, creates the session row + subject
  snapshot, loads active memory facts, invokes the graph with
  `workflow_action=start_session`, persists the resulting round and a **derived
  round-0 summary** (unknowns <- missingAreas, risks <- potentialRisks), and
  returns the first round with the injected `productMemory`.
- `submit_answers` — records answers (repository upserts per question), rebuilds the
  full state from the session (questions paired with answers so the LLM never has to
  join them), invokes the graph with `workflow_action=answers_submitted`, then
  persists whichever terminal output came back: a new `latest_question_round` or the
  `deliverable`. When a deliverable exists **and** the session has a product, it
  applies `memory_ops` through `ProductMemoryRepository.apply_ops` in the same
  request, then sets `FINAL_READY`.
- `set_mode` — normalize grid, `reset_rounds` (purge + replay round 0) with memory
  re-injected, since the replay would otherwise lose inherited facts.
- `export_markdown` — renders the persisted deliverable via
  [decision-report.md](../domain/decision-report.md)'s renderer.

## The LLM layer (`src/services/refinement_llm.py`)

Two engines implement the same `RefinementLLM` Protocol
(`detect_mode`, `generate_questions`, `summarize_context`,
`generate_final_refinement`, `extract_product_memory`):

- **`MockRefinementLLM`** — deterministic offline engine: templates questions from
  the grid axes (round 1) or from `unknowns` (later rounds), offers only the two
  utility chips ("Je ne sais pas encore", "Sans objet pour ce sujet"), derives
  summary confidence from unknowns, builds the Brief by grouping answered questions
  under their grid-axis theme, produces a Code Draft skeleton for
  `technique`/`hybride` grids, applies the deterministic arbitration rules for the
  decision report, and promotes durable facts to memory with `add` ops only. It is
  the default provider (`LLM_PROVIDER=mock`) and the safety net for every real-call
  failure.
- **`OpenAICompatibleLLM`** — calls any OpenAI-compatible `/chat/completions`
  endpoint via httpx (Azure `azure-openai`/`azure-foundry` use the
  `/openai/deployments/{deployment}/chat/completions?api-version=2024-06-01` shape
  and the `api-key` header; OpenAI/OpenRouter/DeepSeek use Bearer auth). It asks for
  "a single strict JSON object", then:
  1. parses with `_extract_json` (strips code fences, slices the outermost braces,
     applies `_repair_json_text` for trailing commas, single quotes, and missing
     commas between strings);
  2. on JSON decode failure, retries **once** by asking the model to re-emit the
     exact same content as valid JSON;
  3. on any remaining failure (network, invalid JSON, schema mismatch), degrades to
     `MockRefinementLLM` and sets `self.degraded = True` so the API returns
     `degraded: true` and the UI shows the fallback banner.
  Provider quirks: DeepSeek gets `reasoning_effort: "low"` because thinking tokens
  count against `max_tokens` and can exhaust the budget; the final refinement gets a
  `max(settings.llm_max_tokens, 8000)` budget to avoid truncating the largest
  output.

## Prompts (`prompts/`)

Six Markdown prompts are loaded by `PromptLoader` (`prompts_dir` from settings,
version = sha1 over all prompt files, stored on the session as `prompt_version`):

| Prompt | Node | Output schema |
|---|---|---|
| `system-refinement.md` | system prompt for every call | rules: no invented context, grid adaptation, product_memory treated as acquired context, JSON-only, lists ordered by decisional impact |
| `detect-mode.md` | grid detection (auto mode) | `DetectModeOutput` |
| `generate-questions.md` | generate_questions | `GenerateQuestionsOutput` |
| `summarize-context.md` | summarize_context | `SessionSummaryOutput` |
| `generate-final-refinement.md` | generate_final_refinement | `RefinementDeliverableOutput` |
| `extract-product-memory.md` | extract_product_memory | `ProductMemoryOpsOutput` — the durability rule, diff-not-dump, exact category list |

Changing a prompt changes `prompt_version`, which is recorded per session — bump it
deliberately, and check the JSON Schema in `contracts/` matches the new output shape.

## Change guidance

- **When to consult this page:** touching graph topology/routing, state shape, LLM
  calls, prompt files, or the service orchestration.
- **Invariants to preserve:** thread_id = session id; nodes never persist;
  `min_rounds` clamp; degraded fallback instead of 500; `degraded` flag plumbing to
  both response schemas; memory extraction skipped without a product; answers are
  upserted, not appended.
- **Extension seam — a new graph step:** add the node builder in `nodes.py`, the
  node in `create_refinement_graph`, the routing function + conditional edges, the
  state fields in `RefinementState`, the persistence branch in
  `RefinementService.submit_answers` (and possibly `_run_initial_round`), the LLM
  method in the Protocol + both engines, the prompt file, and the JSON Schema in
  `contracts/`. Extend `tests/test_routing.py` for the new branch.
- **Extension seam — a new LLM provider:** see
  [llm-configuration.md](../operations/llm-configuration.md) for the full surface
  (env settings, runtime config fallbacks, URL/headers, required-field test, UI).
- **Focused tests:** `tests/test_routing.py` (routing matrix) and
  `tests/test_mock_decision.py` (verdict rules); the mock's question/summary
  behavior is exercised through these indirectly — a dedicated mock-engine test
  file is a natural addition when the engine changes.
- **Validation:** `python -m pytest tests/test_routing.py tests/test_mock_decision.py -q`;
  full offline flow smoke test: `uvicorn src.main:app --reload --port 8000` then
  `POST /api/refinement/sessions` with `{"objective": "..."}` (mock provider).
