from __future__ import annotations

from typing import Any

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.models.refinement import (
    Answer,
    Question,
    QuestionRound,
    RefinementSession,
    SessionArtifact,
    SessionSummary,
    SubjectSnapshot,
    User,
)


class RefinementRepository:
    def __init__(self, db: Session):
        self.db = db

    def ensure_local_user(self, email: str, display_name: str) -> User:
        user = self.db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(email=email, display_name=display_name)
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)
        return user

    def create_session(
        self,
        *,
        user: User,
        subject: dict[str, Any],
        mode: str,
        grid: str,
        detected_grid: str | None,
        extra_context: str,
        max_rounds: int,
        max_questions_per_round: int,
        prompt_version: str,
        llm_provider: str,
        llm_model: str,
    ) -> RefinementSession:
        session = RefinementSession(
            user_id=user.id,
            subject_id=str(subject["id"]),
            subject_title=subject.get("title"),
            mode=mode,
            grid=grid,
            detected_grid=detected_grid,
            status="DRAFT",
            round=0,
            max_rounds=max_rounds,
            max_questions_per_round=max_questions_per_round,
            extra_context=extra_context,
            prompt_version=prompt_version,
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def add_subject_snapshot(
        self,
        *,
        session_id: str,
        normalized_payload: dict[str, Any],
        raw_payload: dict[str, Any] | None = None,
        source: str = "prompt",
    ) -> SubjectSnapshot:
        snapshot = SubjectSnapshot(
            session_id=session_id,
            source=source,
            normalized_payload=normalized_payload,
            raw_payload=raw_payload,
        )
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        self.add_artifact(session_id=session_id, artifact_type="SUBJECT_SNAPSHOT", payload=normalized_payload)
        return snapshot

    def set_mode(self, session: RefinementSession, *, mode: str, grid: str) -> None:
        session.mode = mode
        session.grid = grid
        session.detected_grid = None
        self.db.commit()

    def reset_rounds(self, session: RefinementSession) -> None:
        """Clear questioning/answers/summaries so the flow can restart on a new grid."""
        for answer in list(session.answers):
            self.db.delete(answer)
        for round_model in list(session.question_rounds):
            self.db.delete(round_model)
        for summary in list(session.summaries):
            self.db.delete(summary)
        session.round = 0
        session.status = "DRAFT"
        session.completed_at = None
        self.db.commit()
        self.db.refresh(session)

    def get_session(self, session_id: str) -> RefinementSession | None:
        stmt = (
            select(RefinementSession)
            .where(RefinementSession.id == session_id)
            .options(
                selectinload(RefinementSession.snapshots),
                selectinload(RefinementSession.question_rounds).selectinload(QuestionRound.questions),
                selectinload(RefinementSession.answers).selectinload(Answer.question),
                selectinload(RefinementSession.summaries),
                selectinload(RefinementSession.artifacts),
            )
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def add_question_round(self, session: RefinementSession, output: dict[str, Any]) -> QuestionRound:
        round_model = QuestionRound(
            session_id=session.id,
            round_number=output["round"],
            status="OPEN",
            reasoning_summary=output.get("reasoningSummary"),
            missing_areas=output.get("missingAreas", []),
            potential_risks=output.get("potentialRisks", []),
        )
        self.db.add(round_model)
        self.db.flush()

        for question in output.get("questions", []):
            self.db.add(
                Question(
                    round_id=round_model.id,
                    external_id=question["id"],
                    theme=question["theme"],
                    priority=question["priority"],
                    question_text=question["question"],
                    why_text=question["why"],
                )
            )

        session.round = output["round"]
        session.status = "QUESTIONING"
        self.db.commit()
        self.db.refresh(round_model)
        self.add_artifact(session_id=session.id, artifact_type="QUESTION_ROUND", payload=output)
        return round_model

    def mark_current_round_answered(self, session: RefinementSession) -> None:
        current_round = self.get_current_round(session)
        if current_round is not None:
            current_round.status = "ANSWERED"
            self.db.commit()

    def get_current_round(self, session: RefinementSession) -> QuestionRound | None:
        for round_model in sorted(session.question_rounds, key=lambda item: item.round_number, reverse=True):
            if round_model.status == "OPEN":
                return round_model
        return None

    def record_answers(self, session: RefinementSession, answers: list[dict[str, str]]) -> None:
        current_round = self.get_current_round(session)
        if current_round is None:
            raise ValueError("No open question round for this session")

        question_by_external_id = {question.external_id: question for question in current_round.questions}
        existing_answers = {answer.question_id: answer for answer in session.answers}

        for answer_payload in answers:
            question = question_by_external_id.get(answer_payload["questionId"])
            if question is None:
                raise ValueError(f"Unknown question id: {answer_payload['questionId']}")

            existing = existing_answers.get(question.id)
            if existing is None:
                self.db.add(
                    Answer(
                        session_id=session.id,
                        question_id=question.id,
                        answer_text=answer_payload["answer"].strip(),
                    )
                )
            else:
                existing.answer_text = answer_payload["answer"].strip()

        current_round.status = "ANSWERED"
        session.status = "ANALYZING"
        self.db.commit()

    def add_summary(self, session: RefinementSession, summary: dict[str, Any], round_number: int) -> SessionSummary:
        existing = (
            self.db.query(SessionSummary)
            .filter(SessionSummary.session_id == session.id, SessionSummary.round_number == round_number)
            .first()
        )
        if existing is None:
            existing = SessionSummary(
                session_id=session.id,
                round_number=round_number,
                facts=summary.get("facts", []),
                assumptions=summary.get("assumptions", []),
                unknowns=summary.get("unknowns", []),
                dependencies=summary.get("dependencies", []),
                risks=summary.get("risks", []),
                confidence=summary.get("confidence", "low"),
                enough_context=summary.get("enoughContext", False),
                reason=summary.get("reason", "No summary reason provided."),
            )
            self.db.add(existing)
        else:
            existing.facts = summary.get("facts", [])
            existing.assumptions = summary.get("assumptions", [])
            existing.unknowns = summary.get("unknowns", [])
            existing.dependencies = summary.get("dependencies", [])
            existing.risks = summary.get("risks", [])
            existing.confidence = summary.get("confidence", "low")
            existing.enough_context = summary.get("enoughContext", False)
            existing.reason = summary.get("reason", "No summary reason provided.")

        self.db.commit()
        self.db.refresh(existing)
        self.add_artifact(session_id=session.id, artifact_type="SESSION_SUMMARY", payload=summary)
        return existing

    def add_final_artifact(self, session: RefinementSession, artifact: dict[str, Any]) -> SessionArtifact:
        payload = self.add_artifact(session_id=session.id, artifact_type="FINAL_REFINEMENT", payload=artifact)
        session.status = "FINAL_READY"
        session.completed_at = datetime.now(timezone.utc)
        self.db.commit()
        return payload

    def add_artifact(self, *, session_id: str, artifact_type: str, payload: dict[str, Any]) -> SessionArtifact:
        version = (
            self.db.query(func.count(SessionArtifact.id))
            .filter(SessionArtifact.session_id == session_id, SessionArtifact.type == artifact_type)
            .scalar()
        ) or 0
        artifact = SessionArtifact(
            session_id=session_id,
            type=artifact_type,
            version=version + 1,
            payload=payload,
        )
        self.db.add(artifact)
        self.db.commit()
        self.db.refresh(artifact)
        return artifact

    def latest_snapshot(self, session: RefinementSession) -> SubjectSnapshot | None:
        if not session.snapshots:
            return None
        return max(session.snapshots, key=lambda item: item.created_at)

    def latest_summary(self, session: RefinementSession) -> SessionSummary | None:
        if not session.summaries:
            return None
        return max(session.summaries, key=lambda item: item.round_number)

    def latest_final_artifact(self, session: RefinementSession) -> SessionArtifact | None:
        final_artifacts = [artifact for artifact in session.artifacts if artifact.type == "FINAL_REFINEMENT"]
        if not final_artifacts:
            return None
        return max(final_artifacts, key=lambda item: item.version)
