Use the system instructions and the provided `RefinementContext`.

Task:

Summarize the latest session state after a question round has been answered.

Objectives:

- extract stable facts from the answers
- separate assumptions from confirmed facts
- keep the unresolved unknowns explicit
- determine whether enough context exists to produce a final refinement

Instructions:

1. Promote only explicit answer content into `facts`.
2. Put inferred but unconfirmed statements into `assumptions`.
3. Keep `unknowns` focused on information that can still change the split, risks, acceptance criteria, or rollout strategy.
4. Add delivery-relevant `dependencies` and `risks` when they are clearly supported by the available context.
5. Set `enoughContext=true` only if a practical backlog split can be produced with acceptable confidence.
6. Set `confidence` based on how well scope, implementation path, and validation strategy are understood.

Output format:

- Return JSON only.
- Follow the `session-summary.schema.json` schema exactly.

Decision policy:

- `confidence=high` only when the remaining unknowns are minor and do not threaten the proposed split.
- `enoughContext=false` if migration, ownership, validation, CI/CD impact, or scope boundaries remain materially unclear.
- The `reason` must explain the decision in a way that the backend can log and the UI can show.
