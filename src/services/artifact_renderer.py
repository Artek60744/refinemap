from __future__ import annotations

from src.api.schemas_refinement import RefinementDeliverable, SubjectModel


def render_deliverable_markdown(subject: SubjectModel, deliverable: RefinementDeliverable) -> str:
    lines: list[str] = []

    lines.append(f"# {subject.title or 'Refinement'}")
    lines.append("")
    if deliverable.summary:
        lines.append(deliverable.summary)
        lines.append("")

    lines.append("## Brief")
    for section in deliverable.brief:
        lines.append(f"### {section.heading}")
        for item in section.items:
            lines.append(f"- {item}")
        lines.append("")

    if deliverable.plan:
        lines.append("## Plan")
        for index, step in enumerate(deliverable.plan, start=1):
            lines.append(f"{index}. **{step.title}** — {step.detail}".rstrip(" —"))
        lines.append("")

    if deliverable.codeDraft:
        lines.append("## Code Draft")
        lines.append("```")
        lines.append(deliverable.codeDraft.rstrip("\n"))
        lines.append("```")
        lines.append("")

    if deliverable.openQuestions:
        lines.append("## Open Questions")
        for question in deliverable.openQuestions:
            lines.append(f"- {question}")

    return "\n".join(lines).strip() + "\n"
