from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from src.api.refinement import router as refinement_api_router
from src.api.settings import router as settings_api_router
from src.config.settings import settings
from src.database import SessionLocal, init_db
from src.i18n import resolve_language, set_current_language
from src.services.settings_service import SettingsService

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Refinement Assistant")
    init_db()
    yield
    logger.info("Stopping AI Refinement Assistant")


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)


class LanguageMiddleware:
    """Pick the request language once, so API messages and the LLM prompt language
    can read it.

    Written as raw ASGI on purpose: BaseHTTPMiddleware runs the endpoint in a
    separate task, which makes ContextVar propagation fragile.
    """

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http":
            set_current_language(resolve_language(Request(scope)))
        await self.app(scope, receive, send)


app.add_middleware(LanguageMiddleware)

app.include_router(refinement_api_router)
app.include_router(settings_api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    with SessionLocal() as db:
        runtime = SettingsService(db).get_runtime_config()

    return {
        "status": "ok",
        "llm_provider": runtime.llm.provider,
        "azure_devops_mode": "mock" if runtime.azure_devops.mock_mode else "live",
    }
