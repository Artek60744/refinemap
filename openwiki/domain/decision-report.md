---
type: Domain Concept
title: Decision Report — the Refinement Verdict
description: The explicit arbitration that closes a refinement session — go / explore / rework / drop — with root cause, blockers, strengths, next action, the deterministic offline arbitration rules, and the Markdown export that renders them.
tags: [domain, decision, verdict, deliverable]
openwiki:
  roles: [domain]
  change_kinds: [runtime, public-api]
  source_paths: [src/api/schemas_refinement.py, src/services/refinement_llm.py, src/services/artifact_renderer.py]
  symbols: [DecisionReport, DecisionRecommendation, RefinementDeliverable, _build_decision_report, render_deliverable_markdown]
  test_paths: [tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  invariants: ["reasons[0] is always the root cause and the rest is strictly secondary. A verdict short of go carries a conditional-go flip condition derived from its blockers. Root cause, blockers and next action must point at the same blocking item. Blockers are capped at two."]
  validation_commands: [python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q]
---

# Decision Report — the Refinement Verdict

The product rule is that "the AI helps converge, it does not decide for the team" —
but the engine still has to surface an **explicit, shareable arbitration**. That is
the `decisionReport`: a verdict that closes every finalized session, distinct from
the session summary. A summary recounts; a decision report arbitrates.

## The verdict model (`src/api/schemas_refinement.py`)

`DecisionReport` is a `StrictModel` (extra fields rejected) with:

- `recommendation` — `Literal["go", "explore", "rework", "drop"]`, normalized to
  lowercase on input (`_normalize` validator).
- `confidence` — solidity of the **verdict itself**, not of the project context.
- `reasons` — 2–4 blunt reasons, **each citing a specific fact, risk or unknown**;
  `reasons[0]` is the root cause.
- `blockers` — the 1–3 conditions that actually prevent moving forward (framing,
  not implementation); the renderer caps them at 2 in practice.
- `strengths` — what is already validated and justifies not dropping the idea.
- `nextAction` — the single priority action, imperative form.

A `model_validator` (`_migrate_v1`) maps the first persisted report format
(`rationale` / `changeTriggers` / `objections` / `validationConditions`) onto the v2
fields so stored payloads keep validating under `extra="forbid"` — this is the
compatibility path for sessions finalized before the report format was introduced.

## Deterministic arbitration (mock engine rules)

The offline engine (`MockRefinementLLM._build_decision_report`) applies ordered
rules over the session's facts, unknowns, risks, assumptions and confidence — this
is the exact logic the real engine is prompted to reproduce, and the rules are
pinned by tests:

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TD
    A["facts empty and unknowns >= 3"] -->|yes| DROP["drop / high"]
    A -->|no| B["no unknowns and confidence high<br>and risks <= 1"]
    B -->|yes| GO["go / high"]
    B -->|no| C["risks >= 3 or risks > facts"]
    C -->|yes| REWORK["rework / medium"]
    C -->|no| EXPLORE["explore / medium"]
```

Then, from one shared source of truth (the blocking item):

- **go** -> no blockers, root cause "no residual blocker", next action launches the
  plan.
- **rework** with risks -> blocker is the first risk; **rework** without risks ->
  first unknown.
- **drop** -> blocker is the first unknown; next action says do not pursue unless
  the blocker falls.
- **explore** -> next action is to arbitrate the main blocker first.

Blockers are labeled ("Inconnue bloquante", "Risque bloquant", "Cadrage bloquant")
and capped at 2 — beyond that it is a shopping list, not a decision. Secondary
reasons take at most one unknown, one risk, and one unverified assumption.
`strengths` defaults to the first three facts, or a grid-framing fallback when there
are none ("Le périmètre est cadré par la grille PO.").

## Rendering (`src/services/artifact_renderer.py`)

`render_deliverable_markdown(subject, deliverable)` produces the `GET
/api/refinement/sessions/{id}/export` payload (see
[refinement-api.md](../api/refinement-api.md)). The Decision section is the
**headline, before the Brief**:

- `**REWORK** — confidence: high`
- a **conditional-go line** when the verdict is `explore`/`rework` and blockers
  exist: "Conditional go once the main blocker is lifted." / "...once the 2
  blockers are lifted." — a `go` carries no condition.
- `### Root cause` (reasons[0]) then `### Secondary reasons` (the rest),
  `### Real blockers` (numbered, first marked "(main)"), `### What is already
  solid`, and `### Next action`.
- Empty sublists are skipped; a legacy deliverable without `decisionReport` renders
  with no Decision section at all.

## Frontend presentation

`DecisionReportView.tsx` renders the report as a banner or full view with per-verdict
colors and icons (go green, explore blue, rework amber, drop red), the same root
cause / secondary split, and the same conditional-go wording via i18n keys
(`decision.conditional_go_one` / `decision.conditional_go_many`). It is shown in the
War Room when a deliverable exists and on the result page (see
[frontend/overview.md](../frontend/overview.md)).

## Change guidance

- **When to consult this page:** changing the verdict vocabulary, the arbitration
  rules, the Markdown export layout, or the decision UI.
- **Invariants to preserve:** root cause = blockers[0] = nextAction target; reasons
  capped at 4; blockers capped at 2; conditional-go phrasing only for
  explore/rework with blockers; v1 payload migration stays in
  `DecisionReport._migrate_v1`.
- **Cross-package surface:** changing the schema touches `frontend/src/types/api.ts`
  (`DecisionReport`, `DecisionRecommendation`) and `frontend/src/components/DecisionReportView.tsx`
  in the same change; the JSON Schema mirrors live in `contracts/final-refinement.schema.json`.
- **Focused tests:** `tests/test_mock_decision.py` pins all four verdicts plus the
  "one main blocker, one secondary" cap and the root-cause/next-action alignment;
  `tests/test_artifact_renderer.py` pins the Markdown order, conditional-go
  singular/plural, empty-sublist skipping, legacy payloads, and the v1 -> v2
  migration.
- **Validation:** `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q`.
