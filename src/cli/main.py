"""``refinemap`` entry point.

Import order matters here. ``src.config.settings`` builds its Settings object at
import time and ``src.database`` builds the engine from it, so the database
location has to be decided *before* either is imported — hence the bootstrap
below and the deferred imports inside each command.
"""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from src.cli import console

HOME_DIR = Path(os.getenv("REFINEMAP_HOME", Path.home() / ".refinemap"))


def _bootstrap_environment() -> None:
    """Give the CLI a stable home before any settings are read.

    ``Settings.database_url`` defaults to a path relative to the working
    directory, which for a CLI would mean one database per directory it is run
    from — and therefore no shared product memory, the one thing that is
    supposed to accumulate across sessions.
    """
    HOME_DIR.mkdir(parents=True, exist_ok=True)

    # A global config file, so `refinemap` works in any repository. Real
    # environment variables win, and so does a project-local .env, which
    # pydantic-settings reads afterwards.
    global_env = HOME_DIR / ".env"
    if global_env.is_file():
        for raw in global_env.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

    os.environ.setdefault("DATABASE_URL", f"sqlite:///{HOME_DIR / 'refinement.db'}")


def _resolve_language(explicit: str | None) -> str:
    if explicit:
        return explicit
    return (os.getenv("LANG") or "fr").split("_")[0].split(".")[0]


def _session_scope():
    from src.database import SessionLocal

    return SessionLocal()


# --------------------------------------------------------------------- commands


async def _cmd_refine(args: argparse.Namespace) -> int:
    from src.api.schemas_refinement import CreateSessionRequest
    from src.cli import session as cli_session
    from src.services.refinement_service import get_refinement_service

    service = get_refinement_service()

    with _session_scope() as db:
        started = await service.start_session(
            db,
            CreateSessionRequest(
                objective=args.objective,
                mode=args.grid,
                extraContext=args.context or "",
                productName=args.product or "",
                maxRounds=args.rounds,
            ),
        )
        console.success(f"Session {started.session.id} — grille « {started.session.grid} »")
        if started.productMemory:
            console.info(
                f"{len(started.productMemory)} faits de mémoire produit réinjectés."
            )

        deliverable = await cli_session.run_loop(
            service,
            db,
            started.session.id,
            started.questionRound,
            started.session.maxRounds,
            degraded=started.degraded,
        )
        if deliverable is None:
            console.error("La session s'est terminée sans livrable.")
            return 1

        cli_session.show_decision(deliverable)
        markdown = await service.export_markdown(db, started.session.id)
        return _emit(markdown, args, title=args.objective)


async def _cmd_resume(args: argparse.Namespace) -> int:
    from src.cli import session as cli_session
    from src.services.refinement_service import get_refinement_service

    service = get_refinement_service()

    with _session_scope() as db:
        detail = await service.get_session(db, args.session_id)
        if detail.deliverable is not None:
            console.info("Cette session est déjà terminée.")
            cli_session.show_decision(detail.deliverable)
            markdown = await service.export_markdown(db, args.session_id)
            return _emit(markdown, args, title=detail.subject.title)

        console.success(f"Reprise de la session {args.session_id}")
        deliverable = await cli_session.run_loop(
            service,
            db,
            args.session_id,
            detail.currentQuestionRound,
            detail.session.maxRounds,
        )
        if deliverable is None:
            console.error("La session s'est terminée sans livrable.")
            return 1

        cli_session.show_decision(deliverable)
        markdown = await service.export_markdown(db, args.session_id)
        return _emit(markdown, args, title=detail.subject.title)


async def _cmd_export(args: argparse.Namespace) -> int:
    from src.services.refinement_service import get_refinement_service

    service = get_refinement_service()
    with _session_scope() as db:
        detail = await service.get_session(db, args.session_id)
        markdown = await service.export_markdown(db, args.session_id)
        return _emit(markdown, args, title=detail.subject.title)


def _cmd_list(args: argparse.Namespace) -> int:
    from src.services.refinement_service import get_refinement_service

    service = get_refinement_service()
    with _session_scope() as db:
        listing = service.list_sessions(db, limit=args.limit)

    if not listing.items:
        console.info("Aucune session. Lance `refinemap refine \"<ton objectif>\"`.")
        return 0

    console.heading(f"{listing.total} session(s)")
    for item in listing.items:
        created = item.createdAt.strftime("%Y-%m-%d %H:%M") if item.createdAt else "—"
        status = console.paint(f"{item.status.lower():<12}", "dim")
        # The full id, not a prefix: it is what `resume` and `export` expect, and a
        # listing you cannot copy from is a listing you have to work around.
        console.out(f"  {console.paint(item.id, 'cyan')}  {status}{created}")
        console.out(f"    {item.title[:72]}")
    return 0


def _cmd_memory(args: argparse.Namespace) -> int:
    from src.services.product_memory_service import ProductMemoryService

    with _session_scope() as db:
        service = ProductMemoryService(db)
        products = service.list_products()
        if not products:
            console.info(
                "Aucun produit. Utilise `refinemap refine --product <nom>` pour "
                "commencer à accumuler de la mémoire."
            )
            return 0

        wanted = [p for p in products if not args.product or p.name == args.product]
        if not wanted:
            console.error(f"Produit inconnu : {args.product}")
            return 1

        for product in wanted:
            memory = service.get_memory(product.id)
            console.heading(f"{product.name} — {len(memory.facts)} faits")
            for fact in memory.facts:
                mark = "✓" if fact.confirmed else "·"
                console.bullet(f"[{fact.category}] {fact.statement}", marker=mark)
    return 0


def _cmd_config(_args: argparse.Namespace) -> int:
    from src.config.settings import settings
    from src.services.settings_service import SettingsService

    with _session_scope() as db:
        runtime = SettingsService(db).get_runtime_config()

    console.heading("Configuration")
    console.out(f"  Home           {HOME_DIR}")
    console.out(f"  Base           {settings.database_url}")
    console.out(f"  Fournisseur    {runtime.llm.provider}")
    console.out(f"  Modèle         {runtime.llm.model or runtime.llm.deployment or '—'}")
    console.out(f"  Endpoint       {runtime.llm.endpoint or '(défaut du fournisseur)'}")
    console.out(f"  Clé API        {'définie' if runtime.llm.api_key else 'absente'}")

    if runtime.llm.provider == "mock":
        console.out()
        console.warn(
            "Fournisseur « mock » : les rapports sont générés hors ligne par un moteur "
            "de démonstration. Configure un vrai fournisseur dans "
            f"{HOME_DIR / '.env'} (LLM_PROVIDER, LLM_MODEL, LLM_API_KEY)."
        )
    return 0


def _emit(markdown: str, args: argparse.Namespace, *, title: str) -> int:
    from src.cli import session as cli_session

    if getattr(args, "stdout", False):
        print(markdown)
        return 0

    path = Path(args.output) if args.output else cli_session.default_output_path(title)
    written = cli_session.write_output(markdown, path)
    console.out()
    console.success(f"Rapport écrit dans {written}")
    return 0


# ---------------------------------------------------------------------- parsing


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="refinemap",
        description=(
            "Transforme une idée floue en décision argumentée et en spec markdown, "
            "en local, dans ton dépôt."
        ),
    )
    parser.add_argument("--lang", help="Langue des questions et du rapport (fr, en).")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_output_flags(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("-o", "--output", help="Chemin du rapport markdown.")
        sub.add_argument(
            "--stdout",
            action="store_true",
            help="Écrire le rapport sur la sortie standard (pour piper vers un agent).",
        )

    refine = subparsers.add_parser("refine", help="Démarrer une session de cadrage.")
    refine.add_argument("objective", help="L'idée ou le sujet à cadrer.")
    refine.add_argument("--product", help="Rattacher la session à un produit (mémoire).")
    refine.add_argument(
        "--grid",
        default="auto",
        choices=["auto", "po", "technique", "hybride"],
        help="Grille de questions (défaut : détection automatique).",
    )
    refine.add_argument("--rounds", type=int, help="Nombre maximum de rounds.")
    refine.add_argument("--context", help="Contexte additionnel fourni au moteur.")
    add_output_flags(refine)

    resume = subparsers.add_parser("resume", help="Reprendre une session en cours.")
    resume.add_argument("session_id")
    add_output_flags(resume)

    export = subparsers.add_parser("export", help="Réexporter le rapport d'une session.")
    export.add_argument("session_id")
    add_output_flags(export)

    listing = subparsers.add_parser("list", help="Lister les sessions.")
    listing.add_argument("--limit", type=int, default=20)

    memory = subparsers.add_parser("memory", help="Afficher la mémoire produit.")
    memory.add_argument("--product", help="Restreindre à un produit.")

    subparsers.add_parser("config", help="Afficher la configuration effective.")
    return parser


_ASYNC_COMMANDS = {"refine": _cmd_refine, "resume": _cmd_resume, "export": _cmd_export}
_SYNC_COMMANDS = {"list": _cmd_list, "memory": _cmd_memory, "config": _cmd_config}


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    _bootstrap_environment()

    # Outside HTTP there is no middleware to fill the language ContextVar, so the
    # API messages and the prompt language would silently fall back to French.
    from src.i18n import normalize_language, set_current_language

    set_current_language(normalize_language(_resolve_language(args.lang)))

    from src.database import init_db

    init_db()

    try:
        if args.command in _SYNC_COMMANDS:
            return _SYNC_COMMANDS[args.command](args)
        return asyncio.run(_ASYNC_COMMANDS[args.command](args))
    except console.AbortedByUser:
        console.warn("Interrompu. La session est enregistrée, reprends-la avec `refinemap resume`.")
        return 130
    except KeyError as exc:
        console.error(str(exc).strip("'\""))
        return 1
    except ValueError as exc:
        console.error(str(exc))
        return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
