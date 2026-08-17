# Files

- [Data Model and Session Lifecycle](data-model.md) - The SQLAlchemy persistence layer of RefineMap — every entity behind a refinement session (session, snapshot, question round, question, answer, summary, artifact), the product memory tables, app settings, the session status lifecycle, and the artifact journal.
- [Decision Report — the Refinement Verdict](decision-report.md) - The explicit arbitration that closes a refinement session — go / explore / rework / drop — with root cause, blockers, strengths, next action, the deterministic offline arbitration rules, and the Markdown export that renders them.
- [Product Memory — Durable Facts Across Sessions](product-memory.md) - How RefineMap remembers what a product is, its stack, team, constraints, users and decisions across refinement sessions — categories, the durability rule, the injection budget, the add/update/remove ops, and the repository rules that apply them safely.
- [Question Grids (Postures)](question-grids.md) - The three refinement postures — PO, Technique, Hybride — their axes, mode normalization, and the offline keyword detection that picks a grid when no LLM round-trip is worth it.
