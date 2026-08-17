import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.database import Base, get_db
from src.main import app
from src.services.refinement_llm import MockRefinementLLM


@pytest.fixture
def db():
    """A throwaway in-memory database, isolated per test.

    StaticPool + check_same_thread keep a single connection alive across threads,
    which TestClient needs: it runs the app in a worker thread.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    with sessionmaker(bind=engine, future=True)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    """TestClient bound to the in-memory database.

    Instantiated WITHOUT the context manager on purpose: that skips the lifespan,
    so `init_db()` never runs against the real DATABASE_URL and the developer's
    refinement.db is never touched by a test run.
    """
    app.dependency_overrides[get_db] = lambda: db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def offline_llm(monkeypatch):
    """Force the deterministic engine.

    Without this the service reads the provider from .env — which points at a real
    endpoint with a real key — and the test would hit the network.
    """
    llm = MockRefinementLLM()
    monkeypatch.setattr(
        "src.services.refinement_service.build_refinement_llm", lambda **_kwargs: llm
    )
    return llm
