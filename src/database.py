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
    wanted = {("questions", "suggestions"): "JSON"}
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
