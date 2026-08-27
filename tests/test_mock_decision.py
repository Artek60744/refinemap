import pytest

from src.services.refinement_llm import MockRefinementLLM


def _context(**overrides):
    base = {
        "subject": {"title": "Sujet de test"},
        "grid": "po",
        "asked_questions": [],
        "answers": [],
        "facts": [],
        "assumptions": [],
        "unknowns": [],
        "dependencies": [],
        "risks": [],
        "confidence": "low",
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_drop_when_no_facts_and_many_unknowns():
    llm = MockRefinementLLM()
    output = await llm.generate_final_refinement(
        _context(unknowns=["Cible ?", "Budget ?", "Délai ?"])
    )
    report = output.decisionReport
    assert report is not None
    assert report.recommendation == "drop"
    # A drop forced by an empty fact base is a firm verdict.
    assert report.confidence == "high"
    # One main blocker, one secondary at most — never the full list of unknowns.
    assert len(report.blockers) == 2
    assert report.blockers[0] == "Inconnue bloquante : Cible ?"
    # Root cause, main blocker and next action all point at the same item.
    assert report.reasons[0] == "Cause racine : Cible ?"
    assert "Cible ?" in report.nextAction
    # No facts: the fallback strength still gives a reason not to bury the idea silently.
    assert report.strengths == ["Le périmètre est cadré par la grille PO."]


@pytest.mark.asyncio
async def test_go_when_no_unknowns_and_high_confidence():
    llm = MockRefinementLLM()
    output = await llm.generate_final_refinement(
        _context(facts=["Cible identifiée", "Budget validé"], confidence="high")
    )
    report = output.decisionReport
    assert report is not None
    assert report.recommendation == "go"
    assert report.confidence == "high"
    assert report.blockers == []
    assert report.nextAction == "Lancer la mise en œuvre du plan proposé."
    assert report.strengths == ["Cible identifiée", "Budget validé"]


@pytest.mark.asyncio
async def test_rework_when_risks_outweigh_facts():
    llm = MockRefinementLLM()
    output = await llm.generate_final_refinement(
        _context(
            facts=["Un seul fait"],
            unknowns=["Une inconnue"],
            risks=["Risque légal", "Risque technique", "Risque budget"],
            confidence="medium",
        )
    )
    report = output.decisionReport
    assert report is not None
    assert report.recommendation == "rework"
    assert report.confidence == "medium"
    assert report.reasons[0] == "Cause racine : Risque légal"
    assert report.blockers[0] == "Risque bloquant : Risque légal"
    assert report.nextAction == "Reformuler le sujet en traitant : Risque légal"


@pytest.mark.asyncio
async def test_explore_by_default():
    llm = MockRefinementLLM()
    output = await llm.generate_final_refinement(
        _context(facts=["Fait 1", "Fait 2"], unknowns=["Inconnue 1"], confidence="high")
    )
    report = output.decisionReport
    assert report is not None
    assert report.recommendation == "explore"
    assert report.confidence == "medium"
    assert 2 <= len(report.reasons) <= 4
    assert len(report.blockers) <= 2
    # No bookkeeping reason: the first one names the cause, it does not count items.
    assert report.reasons[0] == "Cause racine : Inconnue 1"
    assert report.nextAction == "Trancher en priorité : Inconnue 1"
    # The next action targets the main blocker, not a peripheral detail.
    assert report.blockers[0].endswith("Inconnue 1")
