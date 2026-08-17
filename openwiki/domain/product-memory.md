---
type: Domain Concept
title: Product Memory — Durable Facts Across Sessions
description: How RefineMap remembers what a product is, its stack, team, constraints, users and decisions across refinement sessions — categories, the durability rule, the injection budget, the add/update/remove ops, and the repository rules that apply them safely.
tags: [domain, product-memory, persistence]
openwiki:
  roles: [domain]
  change_kinds: [runtime]
  source_paths: [src/models/product_memory.py, src/repositories/product_memory_repository.py, src/services/product_memory_service.py, src/services/product_memory_rules.py, prompts/extract-product-memory.md]
  symbols: [Product, ProductMemoryFact, MEMORY_CATEGORIES, MEMORY_FACT_LIMIT, normalize_category, is_durable_statement, classify_memory_category, apply_ops, to_memory_context]
  invariants: ["A fact enters the memory only if it would still be true in a different session about the same product. Facts are archived, never hard-deleted. At most MEMORY_FACT_LIMIT (40) active facts are injected into a prompt, grouped by category after the cap is applied. An op targeting a fact of another product is ignored rather than failing the session."]
  validation_commands: [python -m pytest tests/ -q]
---

# Product Memory — Durable Facts Across Sessions

The product memory is the second moat of RefineMap (after the refinement engine):
durable facts established in one session are injected into later sessions about the
**same product**, so the engine never asks twice what it already knows. It is
deliberately not a log: only a bounded set of durable, categorized statements is
kept and re-injected.

## Products and facts (`src/models/product_memory.py`)

- **`Product`** — one product the user refines repeatedly, owned by a user. Memory
  is scoped to it so one client's stack never contaminates another project's
  questions. Product names are matched case-insensitively (`ensure_product`) so
  «Geofolia» and «geofolia» stay one memory.
- **`ProductMemoryFact`** — one durable statement: `category`, `statement`,
  `status` (`active` / `archived`), `confirmed` (human-validated), `source_session_id`
  (traceability), and `uses` (injection counter so facts that never help can be
  spotted later).

Categories are the grouping axis of the memory page and the unit of the prompt
budget: `MEMORY_CATEGORIES = ("produit", "stack", "equipe", "contrainte",
"utilisateur", "decision")`; anything unknown normalizes to `produit`
(`normalize_category`).

## The durability rule (`src/services/product_memory_rules.py`)

"A fact is durable if it would **still be true in a different session** about the
same product." `is_durable_statement` enforces this offline, with the same rule
stated in `prompts/extract-product-memory.md` for the real engine:

- statements over 220 characters are rejected (a durable fact is a statement, not a
  paragraph);
- anything containing a temporal marker (`deadline`, `d'ici`, `avant le`, `cette
  semaine`, `ce sprint`, `next week`, `asap`, `en cours de`, `livraison prévue`,
  ...) or a date pattern (dates, `q1 2026`, French month names) is rejected.

`classify_memory_category` maps a statement to a category by ordered keyword groups:
`stack` (api, backend, database, postgres, react, docker, azure, ...), `equipe`
(équipe, développeur, tech lead, owner, squad, ...), `contrainte` (rgpd, sécurité,
budget, licence, sla, quota, audit, ...), `utilisateur` (client, cible, persona,
marché, ...), `decision` (décidé, retenu, abandonné, arbitrage, ...), defaulting to
`produit`. The more specific buckets are tested first.

## Injection budget

`ProductMemoryRepository.list_active_facts(product_id, limit=MEMORY_FACT_LIMIT)`
returns the active facts injected into prompts: most recently touched first, capped
at **40** (`MEMORY_FACT_LIMIT`), then **grouped by category** — sorting by category
first would let one crowded category starve the others. `RefinementService` calls
`touch_uses` after injection so the `uses` counter reflects real usage.

The shape seen by prompts is `{"id", "category", "statement"}`
(`to_memory_context`): the id is required so the model can target an existing fact
with `update`/`remove` instead of adding a duplicate.

## Memory ops (add / update / remove)

The `extract_product_memory` graph node (see
[refinement-engine.md](../architecture/refinement-engine.md)) asks the LLM for a
diff — never a dump: `ProductMemoryOp {action, id, category, statement}` with
`action` deliberately a plain `str` (an unknown action is skipped, not fatal).
`ProductMemoryRepository.apply_ops` applies the diff at session finalization:

- **`remove`** — archives the targeted fact (status -> `archived`), never deletes.
- **`update`** — rewrites statement/category, reactivates, and sets `confirmed =
  False` because a model rewrite needs a human pass again.
- **`add`** — creates a fact (with `source_session_id`), skipping exact
  case-insensitive duplicates among active facts.
- An op targeting a fact **of another product is ignored rather than raising**: a
  hallucinated id must not fail the session.

The offline mock never emits `update` or `remove` — rewriting a memorized fact needs
a judgment heuristics cannot make, and heuristic archiving would silently erase real
knowledge (comment in `MockRefinementLLM.extract_product_memory`).

## Curation API (`src/services/product_memory_service.py`)

Outside sessions, humans curate the memory through `/api/products*` and
`/api/memory*` endpoints (see [refinement-api.md](../api/refinement-api.md)):
list/create/delete products, list facts, add a manual fact (typed by a human, so
`confirmed=True` immediately), update a fact, archive a fact. Correcting a statement
is itself a confirmation: `update_fact` sets `confirmed=True` when a new statement
is provided without an explicit flag. Unknown and not-owned resources collapse into
the same 404 to avoid existence leaks (`_owned_product`, `_owned_fact`).

The curation UI lives in the SPA: the `/memory` page (`ProductMemoryPage`, product
list + facts grouped by category with inline add / edit / confirm / archive), the
home product picker, and a round-0 banner in the War Room that lets the user
correct or remove injected facts inline — see
[frontend/overview.md](../frontend/overview.md). All three write through the same
`api/memory.ts` client, so a correction made in one place is immediately visible
everywhere, including the next session's injection.

## Change guidance

- **When to consult this page:** changing the memory categories, the durability
  rule, the injection budget, the ops application, or the memory curation UI/API.
- **Invariants to preserve:** archiving not deleting; the 40-fact cap; category
  grouping after the cap; `confirmed` semantics (manual add = true, model rewrite =
  false, human correction = true); ops scoped to the owning product; session
  finalization applies `memory_ops` only when the session has a `product_id`.
- **Cross-package surface:** category list is shared by the model, the offline
  classifier, the prompts, the settings of `CreateMemoryFactRequest`, and the
  frontend memory UI (`ProductMemoryPage`'s `CATEGORIES`, the War Room banner) —
  a category change must touch all of them.
- **Focused tests:** none exist yet; the rules in `product_memory_rules.py` and the
  op application in `apply_ops` are the natural candidates for a dedicated
  `tests/test_product_memory.py` when they change.
- **Validation:** `python -m pytest tests/ -q`.
