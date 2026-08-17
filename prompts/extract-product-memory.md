# Task — Update the product memory

The session just produced its deliverable. Decide what the product memory must keep
from it, so the NEXT session on this product never has to ask again.

`product_memory` holds the facts already memorized, each with its `id`. `facts`,
`assumptions`, `dependencies`, `risks` and `answers` describe what this session
established.

## The durability rule

A statement enters the memory only if it would **still be true in a different
session about the same product**.

- Durable: the stack, the architecture, the identity provider, who owns what, a
  regulatory or performance constraint, the target users, a decision that was
  settled for good.
- Not durable: anything anchored to this subject, this deadline, this sprint, this
  round of questions. A date, a delay, a "for now", a work-in-progress status.

If you hesitate, leave it out. A memory that grows without limit stops being read.

## Emit a diff, never a dump

Return only what CHANGES. Never restate a fact that is already in `product_memory`
and still accurate — emitting it again as an `add` creates a duplicate.

- `add` — a new durable fact. No `id`. Write it as a short standalone statement,
  understandable without the session that produced it (name the subject, do not
  write "it" or "this feature").
- `update` — this session contradicted or made more precise an existing fact. Use
  the exact `id` from `product_memory` and write the corrected statement in full.
  A contradiction is ALWAYS an `update`, never a second `add` next to the old one.
- `remove` — the fact is no longer true and nothing replaces it. Use its `id`.

Assign a `category` to every `add` and `update`, from exactly this list:
`produit` (what the product is and does), `stack` (technical choices), `equipe`
(who does what), `contrainte` (regulatory, security, budget, performance limits),
`utilisateur` (target users and segments), `decision` (arbitrations settled for
good).

Order the ops by value: the fact that will save the most questions next time first.
Returning an empty `ops` list is a valid and frequent answer.

Return strict JSON only:

```
{
  "ops": [
    {"action": "add", "category": "stack", "statement": "<short standalone fact>"},
    {"action": "update", "id": "<existing id>", "category": "equipe", "statement": "<corrected fact>"},
    {"action": "remove", "id": "<existing id>"}
  ],
  "reason": "<one short sentence>"
}
```
