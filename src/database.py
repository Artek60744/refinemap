from __future__ import annotations

import logging
from typing import Generator

from sqlalchemy import create_engine
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


def init_db() -> None:
    from src.models import AppSetting, User

    Base.metadata.create_all(bind=engine)

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
