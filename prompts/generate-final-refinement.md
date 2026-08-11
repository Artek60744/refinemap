# Task — Generate the decision report (Decision / Brief / Plan / Code Draft)

Use the system instructions and the provided context (subject, active `grid`,
`grid_axes`, confirmed facts, assumptions, unknowns, dependencies, risks,
`confidence`, `enough_context`).

This deliverable MUST end in a decision, not a summary. Weigh `facts` (confirmed)
against `assumptions` (unverified), `unknowns`, `dependencies` and `risks` to
produce a hard judgment.

Produce a decision report:

- `summary`: one or two sentences framing the subject.
- `brief`: a list of sections. Use the axes of the active grid as headings and fill
  each with concise, confirmed items. Skip axes with nothing meaningful to say.
- `plan`: an ordered list of concrete next steps (`title` + short `detail`).
- `codeDraft`: for `technique` or `hybride` subjects, a short starter code snippet or
  scaffold; use `null` when not relevant (e.g. a pure `po` subject).
- `openQuestions`: residual unknowns worth flagging — do not hide them.
- `decisionReport`: the explicit verdict closing the refinement. This is a
  POSITION, not a restated objective. If a definitive call is impossible, say why
  AND still give the provisional decision. Do not slip back into a polite summary.
  - `recommendation`: exactly one of:
    - `go` — the confirmed facts cover the critical axes, remaining unknowns are
      non-blocking, and the identified risks have plausible mitigations.
    - `explore` — one or more unknowns are decision-critical and the questioning
      could not resolve them; name them in the reasons.
    - `rework` — the subject as framed contains contradictions or structural
      objections (confirmed facts vs. stated goal mismatch); it must be reframed
      before any go/no-go.
    - `drop` — the risks or dependencies outweigh the stated value, or a confirmed
      fact invalidates the objective.
  - `confidence`: `low`, `medium` or `high` — the solidity of YOUR recommendation,
    not the confidence of the context. An explore/rework/drop motivated by clearly
    identified blockers is a high-confidence recommendation. Do NOT copy the
    `confidence` field from the context.
  - `reasons`: 2 to 4 reasons maximum, blunt, each citing a specific fact, risk or
    unknown. No diplomatic prose.
  - `blockers`: the 1 to 3 conditions that ACTUALLY prevent moving forward — not an
    exhaustive list of everything fuzzy. Framing questions only, no implementation
    details. Empty for an unreserved `go`.
  - `strengths`: what is already validated and justifies not dropping the idea.
    Never repeat items from `reasons` or `blockers`.
  - `nextAction`: ONE priority action, imperative form. Never more than one.

Rules:

- Base the output on confirmed facts first; keep assumptions visible.
- Do not invent details that were never provided.
- Keep everything in the requested `language`.
- Lowercase values only for `recommendation` and `confidence`; emit no keys other
  than those in the skeleton below.

Return strict JSON only:

```
{
  "summary": "<...>",
  "brief": [{"heading": "<axis label>", "items": ["..."]}],
  "plan": [{"title": "<step>", "detail": "<short detail>"}],
  "codeDraft": "<code or null>",
  "openQuestions": ["..."],
  "decisionReport": {
    "recommendation": "go|explore|rework|drop",
    "confidence": "low|medium|high",
    "reasons": ["<2 to 4 blunt reasons>"],
    "blockers": ["<1 to 3 real blockers, empty for an unreserved go>"],
    "strengths": ["<what is already solid>"],
    "nextAction": "<one priority action>"
  }
}
```
