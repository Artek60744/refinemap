"""The interactive refinement loop.

The stopping condition lives in the LangGraph router (``route_after_summary``),
not here: the CLI keeps submitting answers until the engine hands back a
deliverable. Duplicating the round logic on the client would let the two drift.
"""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from src.api.schemas_refinement import (
    AnswerInput,
    QuestionRoundModel,
    SubmitAnswersRequest,
)
from src.cli import console
from src.services.refinement_service import RefinementService

_NO_ANSWER = "Je ne sais pas."


def slugify(text: str, fallback: str = "refinement") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (slug[:60] or fallback).strip("-")


def default_output_path(title: str) -> Path:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    return Path(".refinemap") / f"{slugify(title)}-{stamp}.md"


def show_questions(round_model: QuestionRoundModel, total_rounds: int) -> None:
    console.heading(f"Round {round_model.round}/{total_rounds} — {len(round_model.questions)} questions")
    console.info(
        "Réponds librement. Laisse vide si tu ne sais pas — c'est une information "
        "utile pour le moteur, pas un échec."
    )


def collect_answers(round_model: QuestionRoundModel) -> list[AnswerInput]:
    answers: list[AnswerInput] = []
    for index, question in enumerate(round_model.questions, start=1):
        console.out()
        console.out(console.paint(f"{index}. {question.question}", "bold"))
        if question.why:
            console.out(console.paint(console.hang(question.why, "   ↳ ", "     "), "dim"))
        for suggestion in question.suggestions:
            console.out(console.paint(console.hang(suggestion, "   ex. ", "       "), "dim"))
        console.out()
        reply = console.ask("   > ")
        answers.append(AnswerInput(questionId=question.id, answer=reply or _NO_ANSWER))
    return answers


def show_summary(summary: Any) -> None:
    if summary is None:
        return
    if summary.unknowns:
        console.heading("Zones encore floues")
        for item in summary.unknowns:
            console.bullet(item)
    if summary.risks:
        console.heading("Risques identifiés")
        for item in summary.risks:
            console.bullet(item)


def show_decision(deliverable: Any) -> None:
    report = deliverable.decisionReport
    if report is None:
        return
    colour = {
        "go": "green",
        "explore": "yellow",
        "rework": "yellow",
        "drop": "red",
    }.get(report.recommendation, "bold")
    console.heading("Verdict")
    console.out(
        console.paint(report.recommendation.upper(), "bold", colour)
        + console.paint(f"  (confiance : {report.confidence})", "dim")
    )
    if report.reasons:
        console.out()
        console.info(f"Cause racine : {report.reasons[0]}")
    if report.blockers:
        console.heading("Blocages à lever")
        for index, item in enumerate(report.blockers, start=1):
            console.bullet(item, marker=f"{index}.")
    if report.nextAction:
        console.heading("Prochaine action")
        console.info(report.nextAction)


def warn_if_degraded(degraded: bool) -> None:
    if degraded:
        console.warn(
            "Le fournisseur LLM a échoué : ce contenu vient du moteur hors-ligne de "
            "secours. Ne le commite pas comme une vraie spec — vérifie ta configuration "
            "avec `refinemap config`."
        )


async def run_loop(
    service: RefinementService,
    db: Session,
    session_id: str,
    question_round: QuestionRoundModel | None,
    total_rounds: int,
    *,
    degraded: bool = False,
) -> Any:
    """Drive rounds until the engine produces a deliverable. Returns it."""
    saw_degraded = degraded

    while question_round is not None:
        show_questions(question_round, total_rounds)
        answers = collect_answers(question_round)

        console.out()
        console.info("Analyse en cours…")
        response = await service.submit_answers(
            db, session_id, SubmitAnswersRequest(answers=answers)
        )
        saw_degraded = saw_degraded or response.degraded

        if response.deliverable is not None:
            warn_if_degraded(saw_degraded)
            return response.deliverable

        show_summary(response.sessionSummary)
        question_round = response.questionRound

    # No new round and no deliverable: the session is already finished, so the
    # deliverable is on the stored detail rather than in the last response.
    detail = await service.get_session(db, session_id)
    warn_if_degraded(saw_degraded)
    return detail.deliverable


def write_output(markdown: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(markdown, encoding="utf-8")
    return path
