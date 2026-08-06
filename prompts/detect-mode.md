# Task — Detect the best posture (grid)

Given the subject in the context (`subject.title`, `subject.description`,
`extra_context`), classify which refinement posture fits best.

Choose one `grid`:

- `po` — the subject is mostly about value, users, need, product framing, priorities.
- `technique` — the subject is mostly about implementation, feasibility, an existing
  system, APIs, data, performance, security.
- `hybride` — product and technical concerns clearly need to converge together.

Return strict JSON only:

```
{"grid": "po" | "technique" | "hybride", "reason": "<one short sentence>"}
```
