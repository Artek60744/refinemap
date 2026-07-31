from __future__ import annotations

from typing import Any, Awaitable, Callable

from src.api.schemas_refinement import FinalRefinementOutput, GenerateQuestionsOutput, SessionSummaryOutput
from src.i18n import get_current_language


def build_generate_questions_node(
    llm,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    async def generate_questions_node(state: dict[str, Any]) -> dict[str, Any]:
        llm_input = {
            "language": get_current_language(),
            "work_item": state.get("work_item", {}),
            "extra_context": state.get("extra_context", ""),
            "round": state.get("round", 0),
            "max_questions_per_round": state.get("max_questions_per_round", 6),
            "asked_questions": state.get("asked_questions", []),
            "answers": state.get("answers", []),
            "facts": state.get("facts", []),
            "assumptions": state.get("assumptions", []),
            "unknowns": state.get("unknowns", []),
            "dependencies": state.get("dependencies", []),
            "risks": state.get("risks", []),
        }
        output: GenerateQuestionsOutput = await llm.generate_questions(llm_input)
        next_round = int(state.get("round", 0)) + 1
        return {
            "round": next_round,
            "latest_question_round": {
                "round": next_round,
                **output.model_dump(),
            },
            "decision": {
                "enoughContext": False,
                "confidence": state.get("confidence", "low"),
                "reason": output.reasoningSummary,
            },
        }

    return generate_questions_node


def build_summarize_context_node(
    llm,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    async def summarize_context_node(state: dict[str, Any]) -> dict[str, Any]:
        llm_input = {
            "language": get_current_language(),
            "work_item": state.get("work_item", {}),
            "extra_context": state.get("extra_context", ""),
            "round": state.get("round", 0),
            "max_rounds": state.get("max_rounds", 3),
            "asked_questions": state.get("asked_questions", []),
            "answers": state.get("answers", []),
            "facts": state.get("facts", []),
            "assumptions": state.get("assumptions", []),
            "unknowns": state.get("unknowns", []),
            "dependencies": state.get("dependencies", []),
            "risks": state.get("risks", []),
        }
        output: SessionSummaryOutput = await llm.summarize_context(llm_input)
        summary = output.model_dump()
        return {
            "facts": summary["facts"],
            "assumptions": summary["assumptions"],
            "unknowns": summary["unknowns"],
            "dependencies": summary["dependencies"],
            "risks": summary["risks"],
            "confidence": summary["confidence"],
            "enough_context": summary["enoughContext"],
            "latest_summary": summary,
            "decision": {
                "enoughContext": summary["enoughContext"],
                "confidence": summary["confidence"],
                "reason": summary["reason"],
            },
        }

    return summarize_context_node


def build_generate_final_refinement_node(
    llm,
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    async def generate_final_refinement_node(state: dict[str, Any]) -> dict[str, Any]:
        llm_input = {
            "language": get_current_language(),
            "work_item": state.get("work_item", {}),
            "extra_context": state.get("extra_context", ""),
            "round": state.get("round", 0),
            "facts": state.get("facts", []),
            "assumptions": state.get("assumptions", []),
            "unknowns": state.get("unknowns", []),
            "dependencies": state.get("dependencies", []),
            "risks": state.get("risks", []),
        }
        output: FinalRefinementOutput = await llm.generate_final_refinement(llm_input)
        return {
            "final_artifact": output.model_dump(),
            "decision": {
                "enoughContext": True,
                "confidence": state.get("confidence", "medium"),
                "reason": state.get("latest_summary", {}).get(
                    "reason",
                    "Context was finalized after the latest summary stage.",
                ),
            },
        }

    return generate_final_refinement_node
