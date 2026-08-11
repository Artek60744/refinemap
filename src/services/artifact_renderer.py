from __future__ import annotations

from src.api.schemas_refinement import RefinementDeliverable, SubjectModel


def render_deliverable_markdown(subject: SubjectModel, deliverable: RefinementDeliverable) -> str:
    lines: list[str] = []

    lines.append(f"# {subject.title or 'Refinement'}")
    lines.append("")
    if deliverable.summary:
        lines.append(deliverable.summary)
        lines.append("")

    decision = deliverable.decisionReport
    if decision is not None:
        lines.append("## Decision")
        lines.append(f"**{decision.recommendation.upper()}** — confidence: {decision.confidence}")
        # The flip condition, derived from the blockers: the verdict stays readable as a
        # verdict instead of a list of things left to clarify.
        if decision.recommendation in ("explore", "rework") and decision.blockers:
            count = len(decision.blockers)
            target = "the main blocker is" if count == 1 else f"the {count} blockers are"
            lines.append(f"Conditional go once {target} lifted.")
        lines.append("")
        # reasons[0] is the root cause; the rest is strictly secondary.
        if decision.reasons:
            lines.append("### Root cause")
            lines.append(decision.reasons[0])
            lines.append("")
            if len(decision.reasons) > 1:
                lines.append("### Secondary reasons")
                for item in decision.reasons[1:]:
                    lines.append(f"- {item}")
                lines.append("")
        if decision.blockers:
            lines.append("### Real blockers")
            for index, item in enumerate(decision.blockers):
                lines.append(f"{index + 1}. {'(main) ' if index == 0 else ''}{item}")
            lines.append("")
        if decision.strengths:
            lines.append("### What is already solid")
            for item in decision.strengths:
                lines.append(f"- {item}")
            lines.append("")
        if decision.nextAction:
            lines.append("### Next action")
            lines.append(decision.nextAction)
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
