from __future__ import annotations

from typing import Any, Protocol

from src.api.schemas_refinement import (
    CrossCuttingConcernsModel,
    DeliveryPlanModel,
    FinalRefinementOutput,
    GenerateQuestionsOutput,
    ProposedSplitModel,
    QuestionItem,
    SessionSummaryOutput,
    StoryModel,
)
from src.i18n import t


class RefinementLLM(Protocol):
    model_name: str

    async def generate_questions(self, context: dict[str, Any]) -> GenerateQuestionsOutput:
        ...

    async def summarize_context(self, context: dict[str, Any]) -> SessionSummaryOutput:
        ...

    async def generate_final_refinement(self, context: dict[str, Any]) -> FinalRefinementOutput:
        ...


class MockRefinementLLM:
    def __init__(self, model_name: str = "mock-refiner-v1") -> None:
        self.model_name = model_name

    async def generate_questions(self, context: dict[str, Any]) -> GenerateQuestionsOutput:
        text = self._context_text(context)
        round_number = int(context.get("round", 0)) + 1
        max_questions = int(context.get("max_questions_per_round", 6))

        questions: list[QuestionItem] = []
        index = 1

        def add(theme: str, priority: str, question: str, why: str) -> None:
            nonlocal index
            if len(questions) >= max_questions:
                return
            if question in {item.question for item in questions}:
                return
            questions.append(
                QuestionItem(
                    id=f"q{index}",
                    theme=theme,
                    priority=priority,
                    question=question,
                    why=why,
                )
            )
            index += 1

        if round_number == 1:
            if self._mentions(text, "database", "dataset", "data", "schema"):
                add(
                    "data",
                    "high",
                    t("mock.q.data.scope"),
                    t("mock.q.data.scope.why"),
                )
                add(
                    "data",
                    "high",
                    t("mock.q.data.sync"),
                    t("mock.q.data.sync.why"),
                )

            if self._mentions(text, "playwright", "e2e", "test", "api"):
                add(
                    "testing",
                    "high",
                    t("mock.q.testing.suites"),
                    t("mock.q.testing.suites.why"),
                )

            if self._mentions(text, "pipeline", "ci/cd", "continuous", "mobile", "web"):
                add(
                    "cicd",
                    "high",
                    t("mock.q.cicd.pipelines"),
                    t("mock.q.cicd.pipelines.why"),
                )

            add(
                "dependencies",
                "medium",
                t("mock.q.dependencies.owner"),
                t("mock.q.dependencies.owner.why"),
            )
            add(
                "infra",
                "medium",
                t("mock.q.infra.rollback"),
                t("mock.q.infra.rollback.why"),
            )
            add(
                "functional",
                "medium",
                t("mock.q.functional.out_of_scope"),
                t("mock.q.functional.out_of_scope.why"),
            )
        else:
            for unknown in context.get("unknowns", [])[:max_questions]:
                lower = unknown.lower()
                if "pipeline" in lower or "ci/cd" in lower:
                    add(
                        "cicd",
                        "high",
                        t("mock.q.cicd.update"),
                        t("mock.q.cicd.update.why"),
                    )
                elif "rollback" in lower:
                    add(
                        "infra",
                        "high",
                        t("mock.q.infra.rollback_path"),
                        t("mock.q.infra.rollback_path.why"),
                    )
                elif "owner" in lower or "ownership" in lower:
                    add(
                        "dependencies",
                        "medium",
                        t("mock.q.dependencies.signoff"),
                        t("mock.q.dependencies.signoff.why"),
                    )
                else:
                    add(
                        "technical",
                        "medium",
                        t("mock.q.technical.unknown", unknown=unknown),
                        t("mock.q.technical.unknown.why"),
                    )

            if not questions:
                add(
                    "testing",
                    "medium",
                    t("mock.q.testing.prove"),
                    t("mock.q.testing.prove.why"),
                )

        missing_areas = self._missing_areas(text)
        potential_risks = self._potential_risks(text)

        return GenerateQuestionsOutput(
            questions=questions[:max_questions],
            reasoningSummary=t("mock.reasoning_summary"),
            potentialRisks=potential_risks,
            missingAreas=missing_areas,
            stopCriteria=False,
        )

    async def summarize_context(self, context: dict[str, Any]) -> SessionSummaryOutput:
        existing_facts = list(context.get("facts", []))
        existing_assumptions = list(context.get("assumptions", []))

        facts = self._dedupe(existing_facts)
        assumptions = self._dedupe(existing_assumptions)
        unknowns: list[str] = []

        answers = context.get("answers", [])
        asked_questions = {item["id"]: item.get("question", "") for item in context.get("asked_questions", [])}

        for answer in answers:
            answer_text = answer.get("answer", "").strip()
            question_id = answer.get("questionId")
            question_text = asked_questions.get(question_id, "")
            if not answer_text:
                if question_text:
                    unknowns.append(question_text)
                continue

            if self._looks_unknown(answer_text):
                if question_text:
                    unknowns.append(question_text)
                assumptions.append(t("mock.assumption.unclear", question=question_text or question_id))
                continue

            facts.append(answer_text)

        text = self._context_text(context)
        if self._mentions(text, "database", "dataset", "data") and not any("data" in item.lower() or "dataset" in item.lower() for item in facts):
            unknowns.append(t("mock.unknown.data_perimeter"))
        if self._mentions(text, "pipeline", "ci/cd", "continuous", "mobile", "web") and not any("pipeline" in item.lower() or "datasetlabel" in item.lower() for item in facts):
            unknowns.append(t("mock.unknown.pipeline_config"))
        if not any("rollback" in item.lower() or "fallback" in item.lower() for item in facts):
            unknowns.append(t("mock.unknown.rollback"))

        dependencies = self._dedupe(list(context.get("dependencies", [])))
        if self._mentions(text, "pipeline", "ci/cd", "mobile", "web"):
            dependencies.append(t("mock.dependency.delivery_qa"))
        if self._mentions(text, "database", "dataset"):
            dependencies.append(t("mock.dependency.provisioning"))

        risks = self._dedupe(list(context.get("risks", [])) + self._potential_risks(text))
        risks.extend(
            risk
            for risk in [
                t("mock.risk.shared_assumptions"),
                t("mock.risk.pipeline_drift"),
            ]
            if risk not in risks
        )

        unknowns = self._dedupe(unknowns)
        facts = self._dedupe(facts)
        assumptions = self._dedupe(assumptions)
        dependencies = self._dedupe(dependencies)
        risks = self._dedupe(risks)

        round_number = int(context.get("round", 0))
        if not unknowns:
            confidence = "high"
        elif round_number >= int(context.get("max_rounds", 3)):
            confidence = "medium"
        elif len(unknowns) <= 2 and len(facts) >= 3:
            confidence = "medium"
        else:
            confidence = "low"

        enough_context = confidence == "high" or round_number >= int(context.get("max_rounds", 3))
        reason = t("mock.reason.enough") if enough_context else t("mock.reason.not_enough")

        return SessionSummaryOutput(
            facts=facts,
            assumptions=assumptions,
            unknowns=unknowns,
            dependencies=dependencies,
            risks=risks,
            confidence=confidence,
            enoughContext=enough_context,
            reason=reason,
        )

    async def generate_final_refinement(self, context: dict[str, Any]) -> FinalRefinementOutput:
        work_item = context.get("work_item", {})
        title = work_item.get("title", "Refinement item")
        text = self._context_text(context)

        facts = self._dedupe(list(context.get("facts", [])))
        assumptions = self._dedupe(list(context.get("assumptions", [])))
        unknowns = self._dedupe(list(context.get("unknowns", [])))
        dependencies = self._dedupe(list(context.get("dependencies", [])))
        risks = self._dedupe(list(context.get("risks", [])))

        stories: list[StoryModel] = []
        order: list[str] = []

        if self._mentions(text, "database", "dataset", "data"):
            stories.append(
                StoryModel(
                    title=t("mock.story.data.title"),
                    goal=t("mock.story.data.goal"),
                    acceptanceCriteria=[
                        t("mock.story.data.ac1"),
                        t("mock.story.data.ac2"),
                        t("mock.story.data.ac3"),
                    ],
                    technicalNotes=[
                        t("mock.story.data.note1"),
                        t("mock.story.data.note2"),
                    ],
                    dependencies=dependencies,
                    risks=risks,
                )
            )
            order.append(t("mock.order.data"))

        stories.append(
            StoryModel(
                title=t("mock.story.consumers.title"),
                goal=t("mock.story.consumers.goal"),
                acceptanceCriteria=[
                    t("mock.story.consumers.ac1"),
                    t("mock.story.consumers.ac2"),
                ],
                technicalNotes=[
                    t("mock.story.consumers.note1"),
                ],
                dependencies=dependencies,
                risks=risks,
            )
        )
        order.append(t("mock.order.consumers"))

        if self._mentions(text, "pipeline", "ci/cd", "continuous", "mobile", "web"):
            stories.append(
                StoryModel(
                    title=t("mock.story.pipeline.title"),
                    goal=t("mock.story.pipeline.goal"),
                    acceptanceCriteria=[
                        t("mock.story.pipeline.ac1"),
                        t("mock.story.pipeline.ac2"),
                        t("mock.story.pipeline.ac3"),
                    ],
                    technicalNotes=[
                        t("mock.story.pipeline.note1"),
                    ],
                    dependencies=dependencies,
                    risks=risks,
                )
            )
            order.append(t("mock.order.pipeline"))

        rationale = t("mock.rationale")

        concerns = CrossCuttingConcernsModel(
            testing=[
                t("mock.concern.testing1"),
                t("mock.concern.testing2"),
            ],
            cicd=[
                t("mock.concern.cicd1"),
                t("mock.concern.cicd2"),
            ],
            infra=[
                t("mock.concern.infra1"),
            ],
            data=[
                t("mock.concern.data1"),
            ],
            security=[
                t("mock.concern.security1"),
            ],
            observability=[
                t("mock.concern.observability1"),
            ],
        )

        delivery = DeliveryPlanModel(
            recommendedOrder=order,
            milestones=[
                t("mock.milestone.scope"),
                t("mock.milestone.target"),
                t("mock.milestone.consumers"),
                t("mock.milestone.nonreg"),
            ],
        )

        in_scope = [
            t("mock.scope.refine_for", title=title),
            t("mock.scope.capture_impacts"),
        ]
        out_of_scope = [
            t("mock.scope.out_redesign"),
        ]

        return FinalRefinementOutput(
            summary=t("mock.summary"),
            scope={"inScope": in_scope, "outOfScope": out_of_scope},
            knownFacts=facts,
            assumptions=assumptions,
            proposedSplit=ProposedSplitModel(
                storyCount=len(stories),
                rationale=rationale,
                stories=stories,
            ),
            crossCuttingConcerns=concerns,
            deliveryPlan=delivery,
            openQuestions=unknowns,
        )

    def _context_text(self, context: dict[str, Any]) -> str:
        work_item = context.get("work_item", {})
        values = [
            work_item.get("title", ""),
            work_item.get("description", ""),
            work_item.get("acceptanceCriteria", ""),
            context.get("extra_context", ""),
            " ".join(context.get("unknowns", [])),
            " ".join(context.get("facts", [])),
        ]
        return " ".join(value for value in values if value).lower()

    def _missing_areas(self, text: str) -> list[str]:
        missing = []
        if self._mentions(text, "database", "dataset", "data"):
            missing.append(t("mock.missing.data_scope"))
        if self._mentions(text, "pipeline", "ci/cd", "continuous", "mobile", "web"):
            missing.append(t("mock.missing.pipeline_impact"))
        missing.append(t("mock.missing.ownership"))
        missing.append(t("mock.missing.rollback"))
        return self._dedupe(missing)

    def _potential_risks(self, text: str) -> list[str]:
        risks = []
        if self._mentions(text, "database", "dataset", "data"):
            risks.append(t("mock.risk.data_drift"))
        if self._mentions(text, "playwright", "e2e", "api", "test"):
            risks.append(t("mock.risk.implicit_target"))
        if self._mentions(text, "pipeline", "ci/cd", "continuous", "mobile", "web"):
            risks.append(t("mock.risk.param_drift"))
        return self._dedupe(risks)

    def _looks_unknown(self, answer: str) -> bool:
        lowered = answer.lower()
        return any(
            token in lowered
            for token in [
                "don't know",
                "do not know",
                "unknown",
                "not sure",
                "to confirm",
                "a confirmer",
                "je ne sais pas",
            ]
        )

    def _mentions(self, text: str, *keywords: str) -> bool:
        return any(keyword in text for keyword in keywords)

    def _dedupe(self, values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for value in values:
            item = value.strip()
            if not item:
                continue
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(item)
        return result


def build_refinement_llm(provider: str, deployment: str, model: str) -> RefinementLLM:
    if provider == "mock":
        return MockRefinementLLM()

    model_name = deployment or model or "configured-provider"
    return MockRefinementLLM(model_name=f"{provider}:{model_name}")
