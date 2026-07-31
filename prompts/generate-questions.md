Use the system instructions and the provided `RefinementContext`.

Task:

Generate the next best question round for a backlog refinement session.

Objectives:

- reduce ambiguity quickly
- avoid redundant questions
- prioritize questions that impact implementation split, CI/CD, tests, data, or delivery risk
- ask at most `maxQuestionsPerRound` questions

Instructions:

1. Review the work item, extra context, derived facts, assumptions, unknowns, dependencies, and risks.
2. Identify the highest-value missing information.
3. Produce grouped questions with a theme and a brief reason for each.
4. If context is already sufficient for a final refinement, set `stopCriteria` to `true` and keep the question list minimal.
5. Do not ask vague questions such as "Any other constraints?" unless you can narrow them down to a delivery-relevant area.

Output format:

- Return JSON only.
- Follow the `generate-questions.schema.json` schema exactly.

Question quality rules:

- Each question must target one uncertainty.
- Each question must be answerable by an engineering or product team.
- Each question should help define scope, ownership, sequencing, migration, validation, or rollback.
- Prefer specific wording such as:
  - what datasets are in scope
  - which pipelines will break
  - who owns a migration step
  - how non-regression will be validated
  - whether mobile and web share the same provisioning logic

Bad question examples:

- Can you provide more details?
- Are there any impacts?
- Is there anything else to consider?

Good question examples:

- Which existing Playwright suites still rely on the shared E2E main database?
- Is the dataset duplication expected to be one-time or continuously synchronized?
- Which CI/CD pipelines currently inject the shared `datasetLabel`, and do mobile jobs reuse the same configuration?
