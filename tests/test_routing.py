from src.agents.refinement_workflow.graph import route_after_summary


def test_below_min_rounds_keeps_questioning_even_with_enough_context():
    state = {"round": 1, "min_rounds": 2, "max_rounds": 3, "enough_context": True}
    assert route_after_summary(state) == "generate_questions"


def test_enough_context_at_min_rounds_finalizes():
    state = {"round": 2, "min_rounds": 2, "max_rounds": 3, "enough_context": True}
    assert route_after_summary(state) == "generate_final_refinement"


def test_not_enough_context_keeps_questioning():
    state = {"round": 2, "min_rounds": 2, "max_rounds": 3, "enough_context": False}
    assert route_after_summary(state) == "generate_questions"


def test_max_rounds_forces_finalization():
    state = {"round": 3, "min_rounds": 2, "max_rounds": 3, "enough_context": False}
    assert route_after_summary(state) == "generate_final_refinement"


def test_min_rounds_clamped_to_max_rounds():
    state = {"round": 1, "min_rounds": 5, "max_rounds": 1, "enough_context": False}
    assert route_after_summary(state) == "generate_final_refinement"
