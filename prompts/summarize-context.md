# Task — Summarize the session state

Use the system instructions and the provided context. Summarize the state after a
question round has been answered.

Instructions:

1. Promote only explicit answer content into `facts`.
2. Put inferred but unconfirmed statements into `assumptions`.
3. Keep `unknowns` focused on information that can still change the deliverable.
4. Add `dependencies` and `risks` when clearly supported by the context.
5. Set `confidence` (`low|medium|high`) based on how well the subject is understood.
6. Set `enoughContext=true` only when a practical deliverable can be produced with
   acceptable confidence.
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
