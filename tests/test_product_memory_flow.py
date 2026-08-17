"""The loop that makes the feature worth building: a session ending on a product
leaves durable facts behind, and the next session on that product starts with them.
"""

import pytest

from src.api.schemas_refinement import AnswerInput, CreateSessionRequest, SubmitAnswersRequest
from src.repositories.product_memory_repository import ProductMemoryRepository
from src.repositories.refinement_repository import RefinementRepository
from src.services.refinement_service import RefinementService

ANSWERS = [
    "Le backend Geofolia est en .NET 8 avec une base PostgreSQL",
    "Marc est le tech lead de l'equipe",
    # Dated on purpose: this one must never reach the memory.
    "La livraison est prevue le 15/03/2026",
    "Les utilisateurs cibles sont les agriculteurs exploitants",
    "Contrainte RGPD : seul l'email est collecte",
    "Le SSO passe par SAML Google Workspace",
]


async def _run_to_verdict(service: RefinementService, db, **request_kwargs):
    """Answer every round until the deliverable lands, then return the session id."""
    start = await service.start_session(
        db, CreateSessionRequest(objective="Ajouter le SSO Google", mode="technique", **request_kwargs)
    )
    session_id = start.session.id
    question_round = start.questionRound
    for _ in range(start.session.maxRounds + 1):
        if question_round is None:
            break
        answers = [
            AnswerInput(questionId=question.id, answer=ANSWERS[index % len(ANSWERS)])
            for index, question in enumerate(question_round.questions)
        ]
        result = await service.submit_answers(db, session_id, SubmitAnswersRequest(answers=answers))
        if result.deliverable is not None:
            return start, session_id
        question_round = result.questionRound
    raise AssertionError("the session never produced a deliverable")


@pytest.mark.asyncio
async def test_finished_session_feeds_the_next_one(db, offline_llm):
    service = RefinementService()

    first_start, first_id = await _run_to_verdict(service, db, productName="Geofolia")
    # Nothing is known about a brand-new product.
    assert first_start.productMemory == []
    assert first_start.session.productName == "Geofolia"

    facts = ProductMemoryRepository(db).list_active_facts(first_start.session.productId)
    statements = [fact.statement for fact in facts]
    assert "Le backend Geofolia est en .NET 8 avec une base PostgreSQL" in statements
    # The dated answer is session-scoped, not a durable product fact.
    assert not any("15/03/2026" in statement for statement in statements)
    # Every memorized fact points back at the session that produced it.
    assert {fact.source_session_id for fact in facts} == {first_id}

    second = await service.start_session(
        db,
        CreateSessionRequest(
            objective="Ajouter un export PDF des parcelles",
            mode="technique",
            productId=first_start.session.productId,
        ),
    )
    assert [item.statement for item in second.productMemory] == statements
    # The banner needs the ids to let the user correct a fact in place.
    assert all(item.id for item in second.productMemory)


@pytest.mark.asyncio
async def test_memory_is_injected_into_the_prompt_context(db, offline_llm):
    service = RefinementService()
    start, _ = await _run_to_verdict(service, db, productName="Geofolia")

    reloaded = RefinementRepository(db).get_session(start.session.id)
    memory_facts = service._memory_facts(db, reloaded)
    state = service._build_state_from_session(
        reloaded, workflow_action="answers_submitted", memory_facts=memory_facts
    )

    assert state["product_id"] == start.session.productId
    assert len(state["product_memory"]) == len(memory_facts)
    # The prompts need the id to target an existing fact instead of duplicating it.
    assert set(state["product_memory"][0]) == {"id", "category", "statement"}


@pytest.mark.asyncio
async def test_session_without_product_never_touches_the_memory(db, offline_llm):
    service = RefinementService()
    start, _ = await _run_to_verdict(service, db)

    assert start.session.productId is None
    assert start.session.productName == ""
    assert start.productMemory == []
    assert ProductMemoryRepository(db).list_products("any-user") == []


@pytest.mark.asyncio
async def test_replaying_a_product_session_does_not_duplicate_facts(db, offline_llm):
    """Two sessions giving the same answers must not stack the same fact twice."""
    service = RefinementService()
    first_start, _ = await _run_to_verdict(service, db, productName="Geofolia")
    product_id = first_start.session.productId
    before = len(ProductMemoryRepository(db).list_active_facts(product_id))

    await _run_to_verdict(service, db, productId=product_id)
    after = ProductMemoryRepository(db).list_active_facts(product_id)

    assert len(after) == before
    assert len({fact.statement for fact in after}) == len(after)


@pytest.mark.asyncio
async def test_unknown_product_id_is_rejected(db, offline_llm):
    service = RefinementService()
    with pytest.raises(KeyError):
        await service.start_session(
            db, CreateSessionRequest(objective="Un sujet", mode="po", productId="does-not-exist")
        )
