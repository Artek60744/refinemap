from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from src.config.settings import settings

logger = logging.getLogger(__name__)

Base = declarative_base()

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    echo=settings.database_echo,
    future=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autoflush=False,
    autocommit=False,
    bind=engine,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_missing_columns() -> None:
    """Minimal forward migration for databases created before a column existed.

    `create_all` only creates missing tables, so new columns on existing tables
    have to be added by hand.
    """
    wanted = {
        ("questions", "suggestions"): "JSON",
        ("refinement_sessions", "product_id"): "VARCHAR(64)",
        ("refinement_sessions", "subject_id"): "VARCHAR(128)",
        ("refinement_sessions", "subject_title"): "VARCHAR(512)",
        ("refinement_sessions", "mode"): "VARCHAR(32) DEFAULT 'auto'",
        ("refinement_sessions", "grid"): "VARCHAR(32) DEFAULT 'po'",
        ("refinement_sessions", "detected_grid"): "VARCHAR(32)",
    }
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for (table, column), ddl_type in wanted.items():
        if table not in tables:
            continue
        if column in {item["name"] for item in inspector.get_columns(table)}:
            continue
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
        logger.info("Added missing column %s.%s", table, column)

    if "refinement_sessions" in tables:
        columns = {item["name"] for item in inspector.get_columns("refinement_sessions")}
        if {"subject_id", "work_item_id"} <= columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "UPDATE refinement_sessions SET subject_id = work_item_id "
                        "WHERE subject_id IS NULL"
                    )
                )
            logger.info("Backfilled refinement_sessions.subject_id from work_item_id")
        if {"subject_title", "work_item_title"} <= columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "UPDATE refinement_sessions SET subject_title = work_item_title "
                        "WHERE subject_title IS NULL"
                    )
                )
            logger.info("Backfilled refinement_sessions.subject_title from work_item_title")
        if "subject_id" in columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE refinement_sessions ALTER COLUMN subject_id SET NOT NULL")
                )
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_refinement_sessions_subject_id "
                        "ON refinement_sessions (subject_id)"
                    )
                )


def init_db() -> None:
    from src.models import AppSetting, User

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()

    with SessionLocal() as db:
        existing = db.query(User).filter(User.email == settings.default_user_email).first()
        if existing is None:
            db.add(
                User(
                    email=settings.default_user_email,
                    display_name=settings.default_user_name,
                )
            )
            db.commit()
            logger.info("Seeded default local user")
