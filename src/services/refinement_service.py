from __future__ import annotations

from functools import lru_cache
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from src.agents.refinement_workflow import create_initial_state, create_refinement_graph
from src.api.schemas_refinement import (
    CreateSessionRequest,
    DecisionModel,
    QuestionItem,
    QuestionRoundModel,
    RefinementDeliverable,
    SessionDetailResponse,
    SessionModel,
    SessionSummaryModel,
    StartSessionResponse,
    SubjectModel,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
)
from src.config.settings import settings
from src.repositories.refinement_repository import RefinementRepository
from src.services.artifact_renderer import render_deliverable_markdown
from src.services.prompt_loader import PromptLoader
from src.services.question_grids import (
    detect_grid_by_keywords,
    normalize_mode,
    resolve_grid,
)
from src.services.refinement_llm import build_refinement_llm
from src.services.settings_service import SettingsService


class RefinementService:
    def __init__(self) -> None:
        self.prompt_loader = PromptLoader(settings.prompts_dir)

    async def start_session(self, db: Session, request: CreateSessionRequest) -> StartSessionResponse:
        objective = request.objective.strip()
        if not objective:
            raise ValueError("Provide an objective prompt to start a session.")

        repo = RefinementRepository(db)
        user = repo.ensure_local_user(settings.default_user_email, settings.default_user_name)
        llm, graph, runtime = self._build_runtime_components(db)

        mode = normalize_mode(request.mode)
        subject = self._synthesize_subject(objective)

        detected = await self._detect_grid(llm, subject, request.extraContext)
        if mode == "auto":
            grid = detected
            detected_grid = None
        else:
            grid = resolve_grid(mode)
            detected_grid = detected if detected != grid else None
        subject["mode"] = mode
        subject["grid"] = grid

        session = repo.create_session(
            user=user,
            subject=subject,
            mode=mode,
            grid=grid,
            detected_grid=detected_grid,
            extra_context=request.extraContext,
            max_rounds=request.maxRounds or settings.refinement_max_rounds,
            max_questions_per_round=request.maxQuestionsPerRound or settings.refinement_max_questions_per_round,
            prompt_version=self.prompt_loader.version,
            llm_provider=runtime.llm.provider,
            llm_model=llm.model_name,
        )
        repo.add_subject_snapshot(session_id=session.id, normalized_payload=subject)

        question_round = await self._run_initial_round(repo, graph, session.id, subject, grid)

        refreshed = repo.get_session(session.id)
        assert refreshed is not None
        return StartSessionResponse(
            session=self._to_session_model(refreshed),
            questionRound=self._to_question_round_model(question_round),
            sessionSummary=self._to_summary_model(repo.latest_summary(refreshed)),
        )

    async def set_mode(self, db: Session, session_id: str, mode: str) -> SessionDetailResponse:
        repo = RefinementRepository(db)
        session = repo.get_session(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")

        llm, graph, _runtime = self._build_runtime_components(db)
        subject = self._subject_dict(session)

        mode = normalize_mode(mode)
        if mode == "auto":
            grid = await self._detect_grid(llm, subject, session.extra_context or "")
        else:
            grid = resolve_grid(mode)
        subject["mode"] = mode
        subject["grid"] = grid

        repo.set_mode(session, mode=mode, grid=grid)
        repo.reset_rounds(session)
        await self._run_initial_round(repo, graph, session.id, subject, grid)
        return await self.get_session(db, session_id)

    async def _run_initial_round(self, repo, graph, session_id: str, subject: dict[str, Any], grid: str):
        session = repo.get_session(session_id)
        assert session is not None
        initial_state = create_initial_state(
            session_id=session_id,
            subject=subject,
            mode=subject.get("mode", "auto"),
            grid=grid,
            extra_context=session.extra_context or "",
            max_rounds=session.max_rounds,
            max_questions_per_round=session.max_questions_per_round,
        )
        result = await graph.ainvoke(initial_state, config={"configurable": {"thread_id": session_id}})

        session = repo.get_session(session_id)
        assert session is not None
        question_round = repo.add_question_round(session, result["latest_question_round"])
        derived_summary = {
            "facts": [],
            "assumptions": [],
            "unknowns": result["latest_question_round"].get("missingAreas", []),
            "dependencies": [],
            "risks": result["latest_question_round"].get("potentialRisks", []),
            "confidence": "low",
            "enoughContext": False,
            "reason": result["latest_question_round"].get("reasoningSummary", "Initial question round generated."),
        }
        repo.add_summary(repo.get_session(session_id), derived_summary, round_number=0)
        return question_round

    async def get_session(self, db: Session, session_id: str) -> SessionDetailResponse:
        repo = RefinementRepository(db)
        session = repo.get_session(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")

        summary = repo.latest_summary(session)
        current_round = repo.get_current_round(session)
        final_artifact = repo.latest_final_artifact(session)

        return SessionDetailResponse(
            session=self._to_session_model(session),
            subject=self._to_subject_model(session),
            currentQuestionRound=self._to_question_round_model(current_round) if current_round else None,
            sessionSummary=self._to_summary_model(summary),
            deliverable=RefinementDeliverable.model_validate(final_artifact.payload) if final_artifact else None,
        )

    async def submit_answers(self, db: Session, session_id: str, request: SubmitAnswersRequest) -> SubmitAnswersResponse:
        repo = RefinementRepository(db)
        session = repo.get_session(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")

        repo.record_answers(session, [item.model_dump() for item in request.answers])
        reloaded = repo.get_session(session_id)
        assert reloaded is not None

        _llm, graph, _runtime = self._build_runtime_components(db)
        state = self._build_state_from_session(reloaded, workflow_action="answers_submitted")
        result = await graph.ainvoke(state, config={"configurable": {"thread_id": session_id}})

        current = repo.get_session(session_id)
        assert current is not None
        if "latest_summary" in result:
            repo.add_summary(current, result["latest_summary"], round_number=current.round)

        question_round_model = None
        deliverable_model = None

        if result.get("deliverable"):
            repo.add_final_artifact(current, result["deliverable"])
            current = repo.get_session(session_id)
            assert current is not None
            final_artifact = repo.latest_final_artifact(current)
            if final_artifact is not None:
                deliverable_model = RefinementDeliverable.model_validate(final_artifact.payload)
        elif result.get("latest_question_round"):
            question_round = repo.add_question_round(current, result["latest_question_round"])
            question_round_model = self._to_question_round_model(question_round)
            current = repo.get_session(session_id)
            assert current is not None

        summary = repo.latest_summary(current)
        decision = DecisionModel.model_validate(result.get("decision", {}))

        return SubmitAnswersResponse(
            session=self._to_session_model(current),
            decision=decision,
            questionRound=question_round_model,
            sessionSummary=self._to_summary_model(summary),
            deliverable=deliverable_model,
        )

    async def export_markdown(self, db: Session, session_id: str) -> str:
        session_detail = await self.get_session(db, session_id)
        if session_detail.deliverable is None:
            raise ValueError("No deliverable available yet for this session")
        return render_deliverable_markdown(session_detail.subject, session_detail.deliverable)

    # -- grid detection --
    async def _detect_grid(self, llm, subject: dict[str, Any], extra_context: str) -> str:
        try:
            detection = await llm.detect_mode({"subject": subject, "extra_context": extra_context})
            return resolve_grid(detection.grid)
        except Exception:
            text = " ".join([subject.get("title", ""), subject.get("description", ""), extra_context])
            return detect_grid_by_keywords(text)

    def _synthesize_subject(self, objective: str) -> dict[str, Any]:
        title = objective.strip()
        return {
            "id": uuid4().hex[:8],
            "title": title[:200],
            "description": title,
            "mode": "auto",
            "grid": "po",
            "notes": "",
        }

    def _subject_dict(self, session) -> dict[str, Any]:
        snapshot = None
        if session.snapshots:
            snapshot = max(session.snapshots, key=lambda item: item.created_at)
        payload = dict(snapshot.normalized_payload) if snapshot else {}
        payload.setdefault("id", session.subject_id)
        payload.setdefault("title", session.subject_title or "")
        payload["mode"] = session.mode
        payload["grid"] = session.grid
        return payload

    def _build_state_from_session(self, session, workflow_action: str) -> dict[str, Any]:
        latest_summary = None
        if session.summaries:
            latest_summary = max(session.summaries, key=lambda item: item.round_number)

        # The LLM must not have to join questions and answers itself: build the pairs here.
        answer_by_question_id = {answer.question_id: answer.answer_text for answer in session.answers}

        asked_questions: list[dict[str, Any]] = []
        answers_payload: list[dict[str, Any]] = []
        for round_model in sorted(session.question_rounds, key=lambda item: item.round_number):
            for question in round_model.questions:
                answer_text = answer_by_question_id.get(question.id)
                asked_questions.append(
                    {
                        "id": question.external_id,
                        "round": round_model.round_number,
                        "theme": question.theme,
                        "question": question.question_text,
                        "answered": answer_text is not None,
                    }
                )
                if answer_text is None:
                    continue
                answers_payload.append(
                    {
                        "questionId": question.external_id,
                        "round": round_model.round_number,
                        "theme": question.theme,
                        "question": question.question_text,
                        "answer": answer_text,
                    }
                )

        return {
            "workflow_action": workflow_action,
            "session_id": session.id,
            "subject_id": session.subject_id,
            "subject": self._subject_dict(session),
            "mode": session.mode,
            "grid": session.grid,
            "extra_context": session.extra_context or "",
            "round": session.round,
            "max_rounds": session.max_rounds,
            "max_questions_per_round": session.max_questions_per_round,
            "asked_questions": asked_questions,
            "answers": answers_payload,
            "facts": latest_summary.facts if latest_summary else [],
            "assumptions": latest_summary.assumptions if latest_summary else [],
            "unknowns": latest_summary.unknowns if latest_summary else [],
            "dependencies": latest_summary.dependencies if latest_summary else [],
            "risks": latest_summary.risks if latest_summary else [],
            "confidence": latest_summary.confidence if latest_summary else "low",
            "enough_context": latest_summary.enough_context if latest_summary else False,
        }

    def _to_session_model(self, session) -> SessionModel:
        return SessionModel(
            id=session.id,
            status=session.status,
            round=session.round,
            maxRounds=session.max_rounds,
            subjectId=session.subject_id,
            mode=session.mode,
            grid=session.grid,
            detectedGrid=session.detected_grid,
            createdAt=session.created_at,
        )

    def _to_subject_model(self, session) -> SubjectModel:
        snapshot = None
        if session.snapshots:
            snapshot = max(session.snapshots, key=lambda item: item.created_at)
        payload = snapshot.normalized_payload if snapshot else {}
        return SubjectModel(
            id=session.subject_id,
            title=session.subject_title or payload.get("title", ""),
            description=payload.get("description", ""),
            mode=session.mode,
            grid=session.grid,
            notes=session.extra_context or "",
        )

    def _to_question_round_model(self, question_round) -> QuestionRoundModel:
        return QuestionRoundModel(
            id=question_round.id,
            round=question_round.round_number,
            questions=[
                QuestionItem(
                    id=question.external_id,
                    theme=question.theme,
                    priority=question.priority,
                    question=question.question_text,
                    why=question.why_text,
                    suggestions=question.suggestions or [],
                )
                for question in question_round.questions
            ],
        )

    def _to_summary_model(self, summary) -> SessionSummaryModel:
        if summary is None:
            return SessionSummaryModel(reason="Session summary not available yet.")
        return SessionSummaryModel(
            facts=summary.facts,
            assumptions=summary.assumptions,
            unknowns=summary.unknowns,
            dependencies=summary.dependencies,
            risks=summary.risks,
            confidence=summary.confidence,
            enoughContext=summary.enough_context,
            reason=summary.reason,
        )

    def _build_runtime_components(self, db: Session):
        runtime = SettingsService(db).get_runtime_config()
        llm = build_refinement_llm(
            provider=runtime.llm.provider,
            endpoint=runtime.llm.endpoint,
            api_key=runtime.llm.api_key,
            deployment=runtime.llm.deployment,
            model=runtime.llm.model,
        )
        graph = create_refinement_graph(llm)
        return llm, graph, runtime


@lru_cache
def get_refinement_service() -> RefinementService:
    return RefinementService()
