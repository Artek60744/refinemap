# Task — Summarize the session state

Use the system instructions and the provided context. Summarize the state after a
question round has been answered.

`answers` contains joined pairs — each item has `question`, `answer`, `theme` and `round`,
so read the answer against the question it responds to.

Instructions:

1. Promote only explicit answer content into `facts`.
2. Put inferred but unconfirmed statements into `assumptions`.
3. `unknowns` must be NEW uncertainties revealed by the answers — contradictions between two
   answers, implicit dependencies, unquantified claims ("rapidement", "beaucoup"), unnamed
   owners, options listed without a decision. They must NOT be unanswered questions restated:
   never copy or paraphrase an item of `asked_questions`. Each unknown names what is missing,
   not which question was skipped. Keep them focused on information that can still change the
   deliverable; if the answers revealed no new uncertainty, return an empty list.
4. Add `dependencies` and `risks` when clearly supported by the context.
5. Set `confidence` (`low|medium|high`) based on how well the subject is understood.
6. Set `enoughContext=true` only when a practical deliverable can be produced with
   acceptable confidence. Be conservative: if `unknowns` is non-empty, or if answers were
   vague or missing, keep `enoughContext=false` — a follow-up round is cheaper than a
   deliverable full of holes. After a single answered round, `enoughContext=true` is only
   acceptable when the answers left nothing material to clarify.
7. The `reason` must briefly justify the decision (for logs and UI).

Return strict JSON only:

```
{
  "facts": ["..."], "assumptions": ["..."], "unknowns": ["..."],
  "dependencies": ["..."], "risks": ["..."],
  "confidence": "low|medium|high", "enoughContext": false,
  "reason": "<short justification>"
}
```
