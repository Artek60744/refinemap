import pytest

from src.agents.refinement_workflow.graph import route_after_final
from src.agents.refinement_workflow.nodes import _base_context
from src.models.product_memory import MEMORY_FACT_LIMIT, Product, ProductMemoryFact
from src.repositories.product_memory_repository import ProductMemoryRepository
from src.services.product_memory_rules import classify_memory_category, is_durable_statement
from src.services.refinement_llm import MockRefinementLLM, OpenAICompatibleLLM


@pytest.fixture
def product(db):
    item = Product(user_id="user-1", name="Geofolia")
    db.add(item)
    db.commit()
    return item


# --- durability rule -------------------------------------------------------


def test_dated_statements_are_not_durable():
    assert not is_durable_statement("La deadline est le 15 mars pour la mise en production")
    assert not is_durable_statement("Livraison prévue ce trimestre")
    assert not is_durable_statement("Le correctif part demain")
    assert not is_durable_statement("Migration planifiée le 03/06/2026")


def test_structural_statements_are_durable():
    assert is_durable_statement("Le backend est en .NET 8 avec une base PostgreSQL")
    assert is_durable_statement("Marc est le tech lead de l'équipe")


def test_paragraphs_are_not_durable():
    assert not is_durable_statement("x" * 400)
    assert not is_durable_statement("   ")


def test_category_classification():
    assert classify_memory_category("Le backend est en .NET avec PostgreSQL") == "stack"
    assert classify_memory_category("Marc est le tech lead") == "equipe"
    assert classify_memory_category("Contrainte RGPD sur les données") == "contrainte"
    assert classify_memory_category("Les utilisateurs cibles sont les agriculteurs") == "utilisateur"
    assert classify_memory_category("Le choix du monorepo est acté") == "decision"
    # No keyword match falls back to the catch-all rather than dropping the fact.
    assert classify_memory_category("Ce truc fait des machins") == "produit"


# --- offline extraction ----------------------------------------------------


def _context(**overrides):
    base = {"facts": [], "product_memory": []}
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_extraction_promotes_only_durable_facts():
    llm = MockRefinementLLM()
    output = await llm.extract_product_memory(
        _context(
            facts=[
                "Le backend est en .NET 8 avec une base PostgreSQL",
                "La deadline est le 15 mars 2026",
                "Marc est le tech lead",
            ]
        )
    )
    statements = [op.statement for op in output.ops]
    assert statements == [
        "Le backend est en .NET 8 avec une base PostgreSQL",
        "Marc est le tech lead",
    ]
    assert [op.category for op in output.ops] == ["stack", "equipe"]
    # The offline engine only ever proposes additions: rewriting or archiving a
    # memorized fact needs a judgment it cannot make.
    assert {op.action for op in output.ops} == {"add"}


@pytest.mark.asyncio
async def test_extraction_skips_already_memorized_facts():
    llm = MockRefinementLLM()
    output = await llm.extract_product_memory(
        _context(
            facts=["Le backend est en .NET 8", "Marc est le tech lead"],
            product_memory=[{"id": "f1", "category": "stack", "statement": "le backend est EN .NET 8"}],
        )
    )
    assert [op.statement for op in output.ops] == ["Marc est le tech lead"]


@pytest.mark.asyncio
async def test_extraction_skips_unknown_answers():
    llm = MockRefinementLLM()
    output = await llm.extract_product_memory(_context(facts=["Je ne sais pas encore", "À confirmer"]))
    assert output.ops == []


# --- diff application ------------------------------------------------------


def test_apply_ops_adds_updates_and_archives(db, product):
    repo = ProductMemoryRepository(db)
    repo.apply_ops(
        product.id,
        [{"action": "add", "category": "stack", "statement": "Backend .NET"}],
        source_session_id="session-1",
    )
    stored = repo.list_active_facts(product.id)
    assert [fact.statement for fact in stored] == ["Backend .NET"]
    assert stored[0].source_session_id == "session-1"
    # A fact proposed by the model is unverified until a human vouches for it.
    assert stored[0].confirmed is False

    repo.apply_ops(
        product.id,
        [{"action": "update", "id": stored[0].id, "category": "stack", "statement": "Backend .NET 8"}],
    )
    assert [fact.statement for fact in repo.list_active_facts(product.id)] == ["Backend .NET 8"]

    repo.apply_ops(product.id, [{"action": "remove", "id": stored[0].id}])
    assert repo.list_active_facts(product.id) == []
    # Archived, not deleted: the fact stays traceable to the session that produced it.
    assert db.query(ProductMemoryFact).filter_by(id=stored[0].id).one().status == "archived"


def test_apply_ops_ignores_duplicates_and_foreign_ids(db, product):
    repo = ProductMemoryRepository(db)
    other = Product(user_id="user-1", name="Autre")
    db.add(other)
    db.commit()
    foreign = ProductMemoryFact(product_id=other.id, category="stack", statement="Backend Java")
    db.add(foreign)
    db.commit()

    repo.apply_ops(product.id, [{"action": "add", "category": "stack", "statement": "Backend .NET"}])
    repo.apply_ops(
        product.id,
        [
            # Same statement in another case: a duplicate, not a new fact.
            {"action": "add", "category": "stack", "statement": "  backend .NET  "},
            # Hallucinated id belonging to another product: skipped, never raised.
            {"action": "update", "id": foreign.id, "statement": "Backend Kotlin"},
            {"action": "remove", "id": "does-not-exist"},
            # Unknown verbs are skipped rather than failing the whole diff.
            {"action": "merge", "statement": "Backend Go"},
            {"action": "add", "statement": "   "},
        ],
    )

    assert [fact.statement for fact in repo.list_active_facts(product.id)] == ["Backend .NET"]
    assert db.query(ProductMemoryFact).filter_by(id=foreign.id).one().statement == "Backend Java"


def test_list_active_facts_respects_the_cap(db, product):
    repo = ProductMemoryRepository(db)
    repo.apply_ops(
        product.id,
        [
            {"action": "add", "category": "produit", "statement": f"Fait numero {index}"}
            for index in range(MEMORY_FACT_LIMIT + 10)
        ],
    )
    assert len(repo.list_active_facts(product.id)) == MEMORY_FACT_LIMIT


def test_archived_facts_are_never_injected(db, product):
    repo = ProductMemoryRepository(db)
    repo.apply_ops(product.id, [{"action": "add", "statement": "Backend .NET"}])
    fact = repo.list_active_facts(product.id)[0]
    repo.archive_fact(fact)
    assert repo.list_active_facts(product.id) == []


# --- injection & routing ---------------------------------------------------


def test_base_context_propagates_product_memory():
    memory = [{"id": "f1", "category": "stack", "statement": "Backend .NET"}]
    assert _base_context({"grid": "po", "product_memory": memory})["product_memory"] == memory
    # A session without a product must still produce a valid context.
    assert _base_context({"grid": "po"})["product_memory"] == []


def test_extraction_node_is_skipped_without_a_product():
    assert route_after_final({"product_id": "prod-1"}) == "extract_product_memory"
    assert route_after_final({"product_id": ""}) == "__end__"
    assert route_after_final({}) == "__end__"


# --- degradation -----------------------------------------------------------


@pytest.mark.asyncio
async def test_extraction_degrades_to_the_offline_engine(monkeypatch):
    """A failing provider must not lose the session's verdict: extraction falls back
    like the four other calls, and flags the response as degraded."""
    llm = OpenAICompatibleLLM(
        provider="openai",
        endpoint="https://example.invalid",
        api_key="key",
        deployment="",
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=1000,
    )

    async def boom(*_args, **_kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(llm, "_chat_json", boom)

    output = await llm.extract_product_memory(
        {"facts": ["Le backend est en .NET 8"], "product_memory": []}
    )
    assert llm.degraded is True
    assert [op.statement for op in output.ops] == ["Le backend est en .NET 8"]


@pytest.mark.asyncio
async def test_malformed_ops_do_not_sink_the_whole_diff(monkeypatch):
    """`action` is a plain str precisely so one bad entry cannot fail validation."""
    llm = OpenAICompatibleLLM(
        provider="openai",
        endpoint="https://example.invalid",
        api_key="key",
        deployment="",
        model="gpt-4o-mini",
        temperature=0.2,
        max_tokens=1000,
    )

    async def payload(*_args, **_kwargs):
        return {
            "ops": [
                {"action": " ADD ", "category": " Stack ", "statement": "Backend .NET"},
                {"action": "merge", "statement": "Backend Go"},
            ],
            "reason": "ok",
        }

    monkeypatch.setattr(llm, "_chat_json", payload)

    output = await llm.extract_product_memory({})
    assert llm.degraded is False
    assert [op.action for op in output.ops] == ["add", "merge"]
    assert output.ops[0].category == "stack"
