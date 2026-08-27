from __future__ import annotations

import pytest

from src.api.schemas_refinement import QuestionItem, QuestionRoundModel
from src.cli import console
from src.cli import session as cli_session
from src.cli.main import build_parser
from src.services.refinement_service import RefinementService


@pytest.fixture
def scripted_answers(monkeypatch):
    """Answer every prompt with a canned reply, in order.

    The CLI reads through console.ask, so patching that one seam covers the whole
    interactive loop without a pty.
    """
    replies: list[str] = []

    def install(*answers: str) -> list[str]:
        replies.clear()
        replies.extend(answers)
        return replies

    def fake_ask(_prompt: str) -> str:
        return replies.pop(0) if replies else "Je ne sais pas."

    monkeypatch.setattr(console, "ask", fake_ask)
    return install


@pytest.mark.asyncio
async def test_refine_loop_produces_a_deliverable_and_a_markdown_file(
    db, offline_llm, scripted_answers, tmp_path
):
    scripted_answers("On cible les PM d'équipes de 3 à 10 personnes.")
    service = RefinementService()

    from src.api.schemas_refinement import CreateSessionRequest

    started = await service.start_session(
        db, CreateSessionRequest(objective="Ajouter un export PDF", mode="po")
    )

    deliverable = await cli_session.run_loop(
        service,
        db,
        started.session.id,
        started.questionRound,
        started.session.maxRounds,
    )

    assert deliverable is not None
    assert deliverable.decisionReport is not None
    assert deliverable.decisionReport.recommendation in {"go", "explore", "rework", "drop"}

    markdown = await service.export_markdown(db, started.session.id)
    target = tmp_path / ".refinemap" / "export.md"
    written = cli_session.write_output(markdown, target)

    assert written.read_text(encoding="utf-8").startswith("# Ajouter un export PDF")
    assert "## Decision" in written.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_run_loop_stops_when_the_engine_stops_asking(
    db, offline_llm, scripted_answers
):
    """The CLI must not invent its own stopping rule.

    The round floor lives in route_after_summary; the client only reacts to what
    the engine hands back.
    """
    scripted_answers()
    service = RefinementService()

    from src.api.schemas_refinement import CreateSessionRequest

    started = await service.start_session(
        db, CreateSessionRequest(objective="Migrer la base vers Postgres", mode="technique")
    )
    await cli_session.run_loop(
        service, db, started.session.id, started.questionRound, started.session.maxRounds
    )

    detail = await service.get_session(db, started.session.id)
    assert detail.deliverable is not None
    # The floor of min_rounds must have forced at least one follow-up round.
    assert detail.session.round >= 2


def test_default_output_path_is_slugified_and_scoped_to_the_repo():
    path = cli_session.default_output_path("Ajouter un système de notifications !")

    assert path.parent.name == ".refinemap"
    assert path.suffix == ".md"
    # Accents are transliterated, not turned into separators.
    assert path.name.startswith("ajouter-un-systeme-de-notifications-")


def test_slugify_never_returns_an_empty_name():
    assert cli_session.slugify("!!!") == "refinement"
    assert cli_session.slugify("") == "refinement"
    # A truncation landing on a separator must not leave a trailing dash.
    assert not cli_session.slugify("a" * 59 + " suite").endswith("-")


def test_parser_rejects_an_unknown_grid():
    with pytest.raises(SystemExit):
        build_parser().parse_args(["refine", "sujet", "--grid", "inexistante"])


def test_parser_accepts_the_documented_grids():
    for grid in ("auto", "po", "technique", "hybride"):
        args = build_parser().parse_args(["refine", "sujet", "--grid", grid])
        assert args.grid == grid
