from __future__ import annotations

from typing import Literal, Optional

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.agents.refinement_workflow.nodes import (
    build_extract_product_memory_node,
    build_generate_final_refinement_node,
    build_generate_questions_node,
    build_summarize_context_node,
)
from src.agents.refinement_workflow.state import RefinementState


def route_start(state: RefinementState) -> Literal["generate_questions", "summarize_context"]:
    if state.get("workflow_action") == "answers_submitted":
        return "summarize_context"
    return "generate_questions"


def route_after_summary(state: RefinementState) -> Literal["generate_questions", "generate_final_refinement"]:
    round_number = int(state.get("round", 0))
    max_rounds = int(state.get("max_rounds", 3))
    # The LLM tends to declare enoughContext too early; a floor of rounds keeps at
    # least one follow-up pass before the deliverable can be produced.
    min_rounds = min(int(state.get("min_rounds", 2)), max_rounds)

    if round_number >= max_rounds:
        return "generate_final_refinement"
    if state.get("enough_context") and round_number >= min_rounds:
        return "generate_final_refinement"
    return "generate_questions"


def route_after_final(state: RefinementState) -> Literal["extract_product_memory", "__end__"]:
    # No product attached means nothing to remember: skip the extra LLM call instead
    # of producing a diff that would be discarded downstream.
    return "extract_product_memory" if state.get("product_id") else END


def create_refinement_graph(llm, checkpointer: Optional[MemorySaver] = None):
    builder = StateGraph(RefinementState)

    builder.add_node("generate_questions", build_generate_questions_node(llm))
    builder.add_node("summarize_context", build_summarize_context_node(llm))
    builder.add_node("generate_final_refinement", build_generate_final_refinement_node(llm))
    builder.add_node("extract_product_memory", build_extract_product_memory_node(llm))

    builder.add_conditional_edges(
        START,
        route_start,
        {
            "generate_questions": "generate_questions",
            "summarize_context": "summarize_context",
        },
    )

    builder.add_conditional_edges(
        "summarize_context",
        route_after_summary,
        {
            "generate_questions": "generate_questions",
            "generate_final_refinement": "generate_final_refinement",
        },
    )

    builder.add_conditional_edges(
        "generate_final_refinement",
        route_after_final,
        {
            "extract_product_memory": "extract_product_memory",
            END: END,
        },
    )

    builder.add_edge("generate_questions", END)
    builder.add_edge("extract_product_memory", END)

    if checkpointer is None:
        checkpointer = MemorySaver()

    return builder.compile(checkpointer=checkpointer)
