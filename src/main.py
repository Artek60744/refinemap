from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from src.api.refinement import router as refinement_api_router
from src.api.settings import router as settings_api_router
from src.config.settings import settings
from src.database import SessionLocal, init_db
from src.i18n import LANGUAGE_COOKIE, normalize_language, resolve_language, set_current_language
from src.routes.refinement import router as refinement_page_router
from src.routes.settings import router as settings_page_router
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

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


class LanguageMiddleware:
    """Pick the request language once, so templates and services can read it.

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
app.include_router(refinement_page_router)
app.include_router(settings_page_router)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/refinement", status_code=302)


@app.get("/lang/{code}", include_in_schema=False)
async def set_language(code: str, next: str = Query("/refinement")) -> RedirectResponse:
    # Only same-site paths, so the switcher can never be turned into an open redirect.
    target = next if next.startswith("/") and not next.startswith("//") else "/refinement"

    response = RedirectResponse(url=target, status_code=303)
    response.set_cookie(
        LANGUAGE_COOKIE,
        normalize_language(code),
        max_age=60 * 60 * 24 * 365,
        httponly=False,
        samesite="lax",
    )
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    with SessionLocal() as db:
        runtime = SettingsService(db).get_runtime_config()

    return {
        "status": "ok",
        "llm_provider": runtime.llm.provider,
        "azure_devops_mode": "mock" if runtime.azure_devops.mock_mode else "live",
    }
