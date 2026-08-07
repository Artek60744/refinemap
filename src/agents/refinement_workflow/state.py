from __future__ import annotations

from typing import Any, TypedDict


class RefinementState(TypedDict, total=False):
    workflow_action: str
    session_id: str
    subject_id: str
    subject: dict[str, Any]
    mode: str
    grid: str
    extra_context: str
    round: int
    min_rounds: int
    max_rounds: int
    max_questions_per_round: int
    asked_questions: list[dict[str, Any]]
    answers: list[dict[str, Any]]
    facts: list[str]
    assumptions: list[str]
    unknowns: list[str]
    dependencies: list[str]
    risks: list[str]
    confidence: str
    enough_context: bool
    latest_question_round: dict[str, Any]
    latest_summary: dict[str, Any]
    deliverable: dict[str, Any] | None
    decision: dict[str, Any]
    errors: list[dict[str, Any]]


def create_initial_state(
    *,
    session_id: str,
    subject: dict[str, Any],
    mode: str,
    grid: str,
    extra_context: str,
    min_rounds: int,
    max_rounds: int,
    max_questions_per_round: int,
) -> RefinementState:
    return {
        "workflow_action": "start_session",
        "session_id": session_id,
        "subject_id": str(subject["id"]),
        "subject": subject,
        "mode": mode,
        "grid": grid,
        "extra_context": extra_context,
        "round": 0,
        "min_rounds": min_rounds,
        "max_rounds": max_rounds,
        "max_questions_per_round": max_questions_per_round,
        "asked_questions": [],
        "answers": [],
        "facts": [],
        "assumptions": [],
        "unknowns": [],
        "dependencies": [],
        "risks": [],
        "confidence": "low",
        "enough_context": False,
        "errors": [],
    }
