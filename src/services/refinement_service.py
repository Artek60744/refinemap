from __future__ import annotations

from functools import lru_cache
from typing import Any

from sqlalchemy.orm import Session

from src.agents.refinement_workflow import create_initial_state, create_refinement_graph
from src.api.schemas_refinement import (
    CreateSessionRequest,
    DecisionModel,
    FinalRefinementModel,
    GetWorkItemResponse,
    QuestionItem,
    QuestionRoundModel,
    SearchWorkItemsResponse,
    SessionDetailResponse,
    SessionModel,
    SessionSummaryModel,
    StartSessionResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
    WorkItemDetail,
    WorkItemSearchItem,
)
from src.config.settings import settings
from src.repositories.refinement_repository import RefinementRepository
from src.services.artifact_renderer import render_final_refinement_markdown
from src.services.azure_devops_refinement import build_work_item_provider_from_values
from src.services.prompt_loader import PromptLoader
from src.services.refinement_llm import build_refinement_llm
from src.services.settings_service import SettingsService


class RefinementService:
    def __init__(self) -> None:
        self.prompt_loader = PromptLoader(settings.prompts_dir)

    async def search_work_items(self, db: Session, query: str, limit: int = 10) -> SearchWorkItemsResponse:
        provider, _llm, _graph, _runtime = self._build_runtime_components(db)
        items = await provider.search(query, limit=limit)
        return SearchWorkItemsResponse(items=[WorkItemSearchItem.model_validate(self._trim_work_item(item)) for item in items])

    async def get_work_item(self, db: Session, work_item_id: str) -> GetWorkItemResponse:
        provider, _llm, _graph, _runtime = self._build_runtime_components(db)
        item = await provider.get_by_id(work_item_id)
        return GetWorkItemResponse(workItem=WorkItemDetail.model_validate(self._clean_work_item(item)))

    async def start_session(self, db: Session, request: CreateSessionRequest) -> StartSessionResponse:
        repo = RefinementRepository(db)
        user = repo.ensure_local_user(settings.default_user_email, settings.default_user_name)

        provider, llm, graph, runtime = self._build_runtime_components(db)

        raw_work_item = await provider.get_by_id(request.workItemId)
        work_item_payload = self._clean_work_item(raw_work_item)

        session = repo.create_session(
            user=user,
            work_item=work_item_payload,
            extra_context=request.extraContext,
            max_rounds=request.maxRounds or settings.refinement_max_rounds,
            max_questions_per_round=request.maxQuestionsPerRound or settings.refinement_max_questions_per_round,
            prompt_version=self.prompt_loader.version,
            llm_provider=runtime.llm.provider,
            llm_model=llm.model_name,
        )
        repo.add_work_item_snapshot(
            session_id=session.id,
            normalized_payload=work_item_payload,
            raw_payload=raw_work_item.get("raw") if isinstance(raw_work_item, dict) else None,
        )

        initial_state = create_initial_state(
            session_id=session.id,
            work_item=work_item_payload,
            extra_context=request.extraContext,
            max_rounds=session.max_rounds,
            max_questions_per_round=session.max_questions_per_round,
        )
        result = await graph.ainvoke(initial_state, config={"configurable": {"thread_id": session.id}})

        repo_session = repo.get_session(session.id)
        assert repo_session is not None
        question_round = repo.add_question_round(repo_session, result["latest_question_round"])

        derived_summary = {
            "facts": [],
            "assumptions": [],
            "unknowns": result["latest_question_round"].get("missingAreas", []),
            "dependencies": [],
            "risks": result["latest_question_round"].get("potentialRisks", []),
            "confidence": "low",
            "enoughContext": False,
            "reason": result["latest_question_round"].get(
                "reasoningSummary",
                "Initial question round generated.",
            ),
        }
        repo.add_summary(repo_session, derived_summary, round_number=0)

        refreshed = repo.get_session(session.id)
        assert refreshed is not None
        return StartSessionResponse(
            session=self._to_session_model(refreshed),
            questionRound=self._to_question_round_model(question_round),
            sessionSummary=self._to_summary_model(repo.latest_summary(refreshed)),
        )

    async def get_session(self, db: Session, session_id: str) -> SessionDetailResponse:
        repo = RefinementRepository(db)
        session = repo.get_session(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")

        snapshot = repo.latest_snapshot(session)
        summary = repo.latest_summary(session)
        current_round = repo.get_current_round(session)
        final_artifact = repo.latest_final_artifact(session)

        return SessionDetailResponse(
            session=self._to_session_model(session),
            workItem=WorkItemDetail.model_validate(snapshot.normalized_payload if snapshot else {}),
            currentQuestionRound=self._to_question_round_model(current_round) if current_round else None,
            sessionSummary=self._to_summary_model(summary),
            finalArtifact=FinalRefinementModel.model_validate(final_artifact.payload) if final_artifact else None,
        )

    async def submit_answers(self, db: Session, session_id: str, request: SubmitAnswersRequest) -> SubmitAnswersResponse:
        repo = RefinementRepository(db)
        session = repo.get_session(session_id)
        if session is None:
            raise KeyError(f"Session not found: {session_id}")

        repo.record_answers(session, [item.model_dump() for item in request.answers])
        reloaded = repo.get_session(session_id)
        assert reloaded is not None

        _provider, _llm, graph, _runtime = self._build_runtime_components(db)
        state = self._build_state_from_session(reloaded, workflow_action="answers_submitted")
        result = await graph.ainvoke(state, config={"configurable": {"thread_id": session_id}})

        current = repo.get_session(session_id)
        assert current is not None
        if "latest_summary" in result:
            repo.add_summary(current, result["latest_summary"], round_number=current.round)

        question_round_model = None
        final_artifact_model = None

        if result.get("final_artifact"):
            repo.add_final_artifact(current, result["final_artifact"])
            current = repo.get_session(session_id)
            assert current is not None
            final_artifact = repo.latest_final_artifact(current)
            if final_artifact is not None:
                final_artifact_model = FinalRefinementModel.model_validate(final_artifact.payload)
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
            finalArtifact=final_artifact_model,
        )

    async def export_markdown(self, db: Session, session_id: str) -> str:
        session_detail = await self.get_session(db, session_id)
        if session_detail.finalArtifact is None:
            raise ValueError("No final artifact available yet for this session")
        return render_final_refinement_markdown(session_detail.finalArtifact)

    def _build_state_from_session(self, session, workflow_action: str) -> dict[str, Any]:
        snapshot = None
        if session.snapshots:
            snapshot = max(session.snapshots, key=lambda item: item.created_at)

        latest_summary = None
        if session.summaries:
            latest_summary = max(session.summaries, key=lambda item: item.round_number)

        asked_questions: list[dict[str, Any]] = []
        for round_model in session.question_rounds:
            for question in round_model.questions:
                asked_questions.append(
                    {
                        "id": question.external_id,
                        "theme": question.theme,
                        "question": question.question_text,
                    }
                )

        answers_payload = []
        for answer in session.answers:
            answers_payload.append(
                {
                    "questionId": answer.question.external_id,
                    "answer": answer.answer_text,
                }
            )

        return {
            "workflow_action": workflow_action,
            "session_id": session.id,
            "work_item_id": session.work_item_id,
            "work_item": snapshot.normalized_payload if snapshot else {},
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
            workItemId=session.work_item_id,
            createdAt=session.created_at,
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

    def _trim_work_item(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(item["id"]),
            "type": item.get("type", "Work Item"),
            "title": item.get("title", "Untitled"),
            "state": item.get("state"),
            "tags": item.get("tags", []),
            "areaPath": item.get("areaPath"),
            "iterationPath": item.get("iterationPath"),
        }

    def _clean_work_item(self, item: dict[str, Any]) -> dict[str, Any]:
        payload = dict(item)
        payload.pop("raw", None)
        return payload

    def _build_runtime_components(self, db: Session):
        runtime = SettingsService(db).get_runtime_config()
        provider = build_work_item_provider_from_values(
            org_url=runtime.azure_devops.org_url,
            project=runtime.azure_devops.project,
            pat=runtime.azure_devops.pat,
            mock_mode=runtime.azure_devops.mock_mode,
        )
        llm = build_refinement_llm(
            provider=runtime.llm.provider,
            deployment=runtime.llm.deployment,
            model=runtime.llm.model,
        )
        graph = create_refinement_graph(llm)
        return provider, llm, graph, runtime


@lru_cache
def get_refinement_service() -> RefinementService:
    return RefinementService()
