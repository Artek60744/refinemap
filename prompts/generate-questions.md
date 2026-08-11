# Task — Generate the next question round

Use the system instructions and the provided context (subject, active `grid`,
`grid_axes`, extra context, previous facts/assumptions/unknowns/answers).

`answers` contains joined pairs — each item has `question`, `answer`, `theme` and `round`,
so you can read every answer against the question that produced it. `asked_questions` lists
every question already asked, with `round` and `answered`.

Objectives:

- reduce ambiguity on this subject quickly
- avoid questions already answered or already implied by known facts
- ask at most `max_questions_per_round` questions

Round behavior (`round` is 0-based: 0 = first round, 1 = second round, ...):

- If `round` is 0 (first round): cover the axes of the active grid (`grid_axes`) broadly,
  one focused question per high-value axis.
- If `round` >= 1: do NOT return to the grid axes. Each question must be a follow-up that
  drills INTO a specific answer from `answers` or targets an item in `unknowns`. Quote the
  answer fragment (or unknown) you are drilling into at the start of `why`. Never re-ask or
  rephrase anything present in `asked_questions` — a question that could have been asked in
  round 0 without reading the answers is a failure.
  Go one level deeper than the answer: make a vague quantity precise, resolve a
  contradiction between two answers, surface an unstated dependency or owner, or force a
  choice where the answer listed options without picking one.

Instructions:

1. Pick the highest-value uncertainties to clarify given what is still unknown.
2. Produce one focused question per uncertainty, each with a short `why`.
   Every question must force ONE of these four answer shapes — nothing else:
   - a number or a threshold ("above which volume does this stop being acceptable?");
   - a binary choice, or a choice between named options;
   - a named owner (who decides, who maintains);
   - a testable success condition.
   A question whose answer could be a paragraph of prose is a failure. "Can you clarify
   X?" is a failure; "what exact threshold on X turns this subject from explore to go?"
   is the target.
3. The `why` must name the DECISION the answer unlocks — "without this we cannot choose
   between X and Y", not "this would help understand the context". If you cannot name the
   decision the answer changes, drop the question.
4. Set `theme` to the grid axis label the question belongs to — for follow-ups, reuse the
   `theme` of the question or answer you are drilling into.
5. Set `priority` to `high`, `medium`, or `low`. Order the questions by decisional
   impact: the one whose answer moves the verdict the most comes first.
6. Give 2 to 4 `suggestions`: short plausible answers (max ~60 characters, no sentence) the
   user can pick in one click. They must be mutually exclusive and realistic for THIS subject
   — concrete values, options or trade-offs, never generic filler like "oui" / "non" / "à
   définir". For a threshold question they are concrete values; for a choice question they
   are the named options. If no plausible answer can be inferred from the context, return an
   empty list rather than inventing one.
7. If context is already sufficient to write the deliverable, set `stopCriteria=true`
   and keep the list minimal.
8. Avoid vague questions ("anything else?"). Each question targets one uncertainty and
   is answerable by the team.

Return strict JSON only:

```
{
  "questions": [
    {"id": "q1", "theme": "<axis label>", "priority": "high|medium|low",
     "question": "<question>", "why": "<why it matters>",
     "suggestions": ["<short answer>", "<short answer>"]}
  ],
  "reasoningSummary": "<short summary>",
  "potentialRisks": ["..."],
  "missingAreas": ["..."],
  "stopCriteria": false
}
```
