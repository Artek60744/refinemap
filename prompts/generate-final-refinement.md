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
    - `explore` — the decision is gated by MISSING INFORMATION: one or more unknowns
      are decision-critical and the questioning could not resolve them.
    - `rework` — the subject as framed is broken: a confirmed fact contradicts the
      stated goal, or the framing is inconsistent with itself. Reserve `rework` for
      this. Missing information alone is never a `rework` — it is an `explore`.
    - `drop` — the risks or dependencies outweigh the stated value, or a confirmed
      fact invalidates the objective.
  - `confidence`: `low`, `medium` or `high` — the solidity of YOUR recommendation,
    not the confidence of the context. An explore/rework/drop motivated by clearly
    identified blockers is a high-confidence recommendation. Do NOT copy the
    `confidence` field from the context.
  - `reasons`: 2 to 4 reasons maximum, blunt, each citing a specific fact, risk or
    unknown.
    - `reasons[0]` is THE ROOT CAUSE: the single item which, if it were resolved,
      would change your recommendation. Name it, do not describe it. One cause, not
      a family of concerns.
    - The following reasons are secondary and must be strictly less decisive than
      the first. If a reason is as decisive as `reasons[0]`, you picked the wrong
      root cause.
    - Never a bookkeeping reason ("3 confirmed facts against 5 unknowns"): counting
      is a meeting report, not a judgment.
    - For `explore` and `rework`, the reasons must make the flip condition explicit —
      what exactly would turn this verdict into a `go`.
  - `blockers`: what ACTUALLY gates the decision. ONE main blocker in `blockers[0]`,
    plus at most one secondary blocker — nothing more. A minor clarification is not
    a blocker: it goes to `openQuestions`. Framing questions only, no implementation
    details. Empty for an unreserved `go`.
  - `strengths`: what is already validated and justifies not dropping the idea.
    Never repeat items from `reasons` or `blockers`.
  - `nextAction`: ONE priority action, imperative form, aimed at `blockers[0]` — the
    root cause, never a peripheral detail. Never more than one action.

Rules:

- Base the output on confirmed facts first; keep assumptions visible.
- Do not invent details that were never provided.
- Banned in the decision report: hedging fillers such as "it would be worth
  clarifying", "it would be desirable", "several points remain to be specified".
  Name the point, say what it blocks, move on.
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
    "reasons": ["<the root cause first, then 1 to 3 secondary reasons>"],
    "blockers": ["<the main blocker first, one secondary at most, empty for an unreserved go>"],
    "strengths": ["<what is already solid>"],
    "nextAction": "<one priority action>"
  }
}
```
