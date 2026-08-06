# Task — Generate the next question round

Use the system instructions and the provided context (subject, active `grid`,
`grid_axes`, extra context, previous facts/assumptions/unknowns/answers).

Objectives:

- reduce ambiguity on this subject quickly
- draw questions from the axes of the active grid (`grid_axes`)
- avoid questions already answered or already implied by known facts
- ask at most `max_questions_per_round` questions

Instructions:

1. Pick the highest-value axes to clarify given what is still unknown.
2. Produce one focused question per axis, each with a short `why`.
3. Set `theme` to the axis label it addresses.
4. Set `priority` to `high`, `medium`, or `low`.
5. If context is already sufficient to write the deliverable, set `stopCriteria=true`
   and keep the list minimal.
6. Avoid vague questions ("anything else?"). Each question targets one uncertainty and
   is answerable by the team.

Return strict JSON only:

```
{
  "questions": [
    {"id": "q1", "theme": "<axis label>", "priority": "high|medium|low",
     "question": "<question>", "why": "<why it matters>"}
  ],
  "reasoningSummary": "<short summary>",
  "potentialRisks": ["..."],
  "missingAreas": ["..."],
  "stopCriteria": false
}
```
