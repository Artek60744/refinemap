# Task — Generate the deliverable (Brief / Plan / Code Draft)

Use the system instructions and the provided context (subject, active `grid`,
`grid_axes`, confirmed facts, assumptions, unknowns).

Produce a practical deliverable:

- `summary`: one or two sentences framing the subject.
- `brief`: a list of sections. Use the axes of the active grid as headings and fill
  each with concise, confirmed items. Skip axes with nothing meaningful to say.
- `plan`: an ordered list of concrete next steps (`title` + short `detail`).
- `codeDraft`: for `technique` or `hybride` subjects, a short starter code snippet or
  scaffold; use `null` when not relevant (e.g. a pure `po` subject).
- `openQuestions`: residual unknowns worth flagging — do not hide them.

Rules:

- Base the output on confirmed facts first; keep assumptions visible.
- Do not invent details that were never provided.
- Keep everything in the requested `language`.

Return strict JSON only:

```
{
  "summary": "<...>",
  "brief": [{"heading": "<axis label>", "items": ["..."]}],
  "plan": [{"title": "<step>", "detail": "<short detail>"}],
  "codeDraft": "<code or null>",
  "openQuestions": ["..."]
}
```
