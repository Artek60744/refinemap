from src.api.schemas_refinement import (
    DecisionReport,
    RefinementDeliverable,
    SubjectModel,
)
from src.services.artifact_renderer import render_deliverable_markdown


SUBJECT = SubjectModel(id="s1", title="Sujet de test")


def test_markdown_includes_decision_section_in_order():
    deliverable = RefinementDeliverable(
        summary="Résumé du sujet.",
        decisionReport=DecisionReport(
            recommendation="rework",
            confidence="high",
            reasons=["Trop de risques non couverts.", "Le cadrage contredit un fait confirmé."],
            blockers=["Traiter le risque légal"],
            strengths=["La valeur métier est claire"],
            nextAction="Reformuler le sujet en traitant le risque légal.",
        ),
    )
    markdown = render_deliverable_markdown(SUBJECT, deliverable)

    assert "## Decision" in markdown
    assert "**REWORK** — confidence: high" in markdown
    assert "### Why" in markdown
    assert "### Real blockers" in markdown
    assert "### What is already solid" in markdown
    assert "### Next action" in markdown
    assert "Reformuler le sujet en traitant le risque légal." in markdown
    # Decision is the headline: it comes before the Brief.
    assert markdown.index("## Decision") < markdown.index("## Brief")


def test_markdown_skips_empty_decision_sublists():
    deliverable = RefinementDeliverable(
        decisionReport=DecisionReport(
            recommendation="go",
            confidence="high",
            reasons=["Tout est confirmé."],
            nextAction="Lancer la mise en œuvre.",
        )
    )
    markdown = render_deliverable_markdown(SUBJECT, deliverable)

    assert "**GO** — confidence: high" in markdown
    assert "### Real blockers" not in markdown
    assert "### What is already solid" not in markdown
    assert "### Next action" in markdown


def test_markdown_without_decision_report_legacy():
    deliverable = RefinementDeliverable(summary="Ancienne session.")
    markdown = render_deliverable_markdown(SUBJECT, deliverable)

    assert "## Decision" not in markdown
    assert "## Brief" in markdown


def test_legacy_payload_validates_without_decision_report():
    payload = {
        "summary": "Ancien livrable",
        "brief": [],
        "plan": [],
        "codeDraft": None,
        "openQuestions": [],
    }
    deliverable = RefinementDeliverable.model_validate(payload)
    assert deliverable.decisionReport is None


def test_v1_decision_payload_migrates_to_v2():
    payload_v1 = {
        "recommendation": "explore",
        "confidence": "low",
        "rationale": "Plusieurs inconnues sont décision-critiques.",
        "changeTriggers": ["Définir le canal alpha", "Chiffrer le seuil de fiabilité"],
        "objections": ["La valeur métier est claire"],
        "validationConditions": ["Définir le canal alpha", "Sécuriser la clé JSON"],
    }
    report = DecisionReport.model_validate(payload_v1)

    assert report.reasons == ["Plusieurs inconnues sont décision-critiques."]
    # changeTriggers + non-duplicated validationConditions.
    assert report.blockers == [
        "Définir le canal alpha",
        "Chiffrer le seuil de fiabilité",
        "Sécuriser la clé JSON",
    ]
    assert report.strengths == ["La valeur métier est claire"]
    assert report.nextAction == ""


def test_decision_report_normalizes_llm_case_drift():
    report = DecisionReport.model_validate(
        {"recommendation": " Go ", "confidence": "HIGH", "reasons": ["ok"]}
    )
    assert report.recommendation == "go"
    assert report.confidence == "high"
