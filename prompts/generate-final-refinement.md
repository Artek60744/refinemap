Use the system instructions and the provided `RefinementContext`.

Task:

Generate a final backlog refinement artifact from the available context.

Objectives:

- produce a usable engineering refinement output
- propose a realistic story split
- include acceptance criteria and technical attention points
- make assumptions and residual unknowns visible

Instructions:

1. Base the output on confirmed facts first.
2. Keep assumptions explicit and separate from facts.
3. Propose the minimum story count that still gives a manageable and testable implementation split.
4. Acceptance criteria must be verifiable.
5. Cross-cutting concerns must cover testing, CI/CD, infra, data, security, and observability when relevant.
6. If some uncertainties remain, keep them in `openQuestions` instead of hiding them.
7. The output must be practical for a delivery team, not just descriptive.

Output format:

- Return JSON only.
- Follow the `final-refinement.schema.json` schema exactly.

Story split guidance:

- Split by implementation responsibility, migration stage, or validation boundary when useful.
- Do not create artificial sub-stories if the work is tightly coupled and should ship together.
- If CI/CD or test dataset work is material, it can justify its own story or at least explicit acceptance criteria.

Acceptance criteria guidance:

- Use observable outcomes.
- Include non-regression where it matters.
- Mention environment or pipeline verification when relevant.

Example angles to include when relevant:

- scope of impacted datasets
- provisioning or cloning logic
- application config changes
- pipeline parameter changes
- rollback strategy
- monitoring after rollout
