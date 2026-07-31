from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates

from src.config.settings import settings
from src.i18n import SUPPORTED_LANGUAGES, get_current_language, js_catalog, label, t

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


def build_templates() -> Jinja2Templates:
    """Jinja environment shared by every page router, i18n helpers included."""
    templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
    templates.env.cache = None
    templates.env.globals.update(
        asset_version=settings.asset_version,
        t=t,
        label=label,
        current_language=get_current_language,
        languages=SUPPORTED_LANGUAGES,
        js_catalog=js_catalog,
    )
    return templates
