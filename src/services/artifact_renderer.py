from __future__ import annotations

from src.api.schemas_refinement import FinalRefinementModel


def render_final_refinement_markdown(artifact: FinalRefinementModel) -> str:
    lines: list[str] = []

    lines.append(f"# Refinement - {artifact.proposedSplit.storyCount} proposed stories")
    lines.append("")
    lines.append("## Summary")
    lines.append(artifact.summary)
    lines.append("")

    lines.append("## Scope")
    lines.append("### In Scope")
    for item in artifact.scope.get("inScope", []):
        lines.append(f"- {item}")
    lines.append("### Out of Scope")
    for item in artifact.scope.get("outOfScope", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Known Facts")
    for fact in artifact.knownFacts:
        lines.append(f"- {fact}")
    lines.append("")

    lines.append("## Assumptions")
    for assumption in artifact.assumptions:
        lines.append(f"- {assumption}")
    lines.append("")

    lines.append("## Proposed Split")
    lines.append(artifact.proposedSplit.rationale)
    lines.append("")
    for index, story in enumerate(artifact.proposedSplit.stories, start=1):
        lines.append(f"### Story {index} - {story.title}")
        lines.append(story.goal)
        lines.append("")
        lines.append("Acceptance Criteria:")
        for criterion in story.acceptanceCriteria:
            lines.append(f"- {criterion}")
        if story.technicalNotes:
            lines.append("Technical Notes:")
            for note in story.technicalNotes:
                lines.append(f"- {note}")
        if story.dependencies:
            lines.append("Dependencies:")
            for dependency in story.dependencies:
                lines.append(f"- {dependency}")
        if story.risks:
            lines.append("Risks:")
            for risk in story.risks:
                lines.append(f"- {risk}")
        lines.append("")

    lines.append("## Cross-cutting Concerns")
    concerns = artifact.crossCuttingConcerns.model_dump()
    for key, values in concerns.items():
        lines.append(f"### {key.upper()}")
        for value in values:
            lines.append(f"- {value}")
    lines.append("")

    lines.append("## Delivery Plan")
    lines.append("### Recommended Order")
    for item in artifact.deliveryPlan.recommendedOrder:
        lines.append(f"- {item}")
    lines.append("### Milestones")
    for milestone in artifact.deliveryPlan.milestones:
        lines.append(f"- {milestone}")
    lines.append("")

    lines.append("## Open Questions")
    for question in artifact.openQuestions:
        lines.append(f"- {question}")

    return "\n".join(lines).strip() + "\n"
