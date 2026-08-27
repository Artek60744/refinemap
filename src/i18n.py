"""Minimal translation layer for the API messages and the mock LLM content.

The UI strings live in the React app (frontend/src/i18n/catalog.ts); only the
namespaces referenced by backend code (api.*) remain here.

The active language lives in a ContextVar set once per request by middleware, so
services and exception messages can all call `t()` without threading a `lang`
argument through every signature.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Only `resolve_language` needs it, and only for the annotation — which
    # `from __future__ import annotations` never evaluates. Importing it eagerly
    # would drag FastAPI into the CLI, where the web layer is not installed.
    from fastapi import Request

logger = logging.getLogger(__name__)

DEFAULT_LANGUAGE = "fr"
LANGUAGE_COOKIE = "lang"

SUPPORTED_LANGUAGES: dict[str, dict[str, str]] = {
    "fr": {"flag": "🇫🇷", "label": "Français"},
    "en": {"flag": "🇬🇧", "label": "English"},
}

# key: (english, french)
_MESSAGES: dict[str, tuple[str, str]] = {
    # --- api / services ----------------------------------------------------
    "api.settings_saved": ("Settings saved successfully.", "Paramètres enregistrés."),
    "api.mock_llm": (
        "Mock LLM mode is enabled. The local refinement engine is active.",
        "Mode LLM mock actif. Le moteur de refinement local est utilisé.",
    ),
    "api.llm_missing": ("Missing LLM configuration: {fields}.", "Configuration LLM incomplète : {fields}."),
    "api.llm_ready": (
        "Configuration appears complete.",
        "La configuration semble complète.",
    ),
    "api.llm_unsupported": ("Unsupported LLM provider: {provider}", "Provider LLM non supporté : {provider}"),
    "api.field.api_key": ("api key", "clé api"),
    "api.field.endpoint": ("endpoint", "endpoint"),
    "api.field.deployment": ("deployment", "deployment"),
    "api.field.model": ("model", "modèle"),
}

CATALOG: dict[str, dict[str, str]] = {
    "en": {key: value[0] for key, value in _MESSAGES.items()},
    "fr": {key: value[1] for key, value in _MESSAGES.items()},
}

_current_language: ContextVar[str] = ContextVar("current_language", default=DEFAULT_LANGUAGE)


def get_current_language() -> str:
    return _current_language.get()


def set_current_language(language: str) -> None:
    _current_language.set(normalize_language(language))


def normalize_language(language: str | None) -> str:
    if not language:
        return DEFAULT_LANGUAGE
    short = language.strip().lower()[:2]
    return short if short in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def resolve_language(request: Request) -> str:
    cookie = request.cookies.get(LANGUAGE_COOKIE)
    if cookie and normalize_language(cookie) == cookie.lower()[:2] and cookie.lower()[:2] in SUPPORTED_LANGUAGES:
        return cookie.lower()[:2]

    header = request.headers.get("accept-language", "")
    for part in header.split(","):
        candidate = part.split(";")[0].strip().lower()[:2]
        if candidate in SUPPORTED_LANGUAGES:
            return candidate

    return DEFAULT_LANGUAGE


def t(key: str, language: str | None = None, **kwargs: object) -> str:
    lang = normalize_language(language) if language else get_current_language()
    template = CATALOG.get(lang, {}).get(key)

    if template is None:
        logger.warning("Missing translation for key %r in %r", key, lang)
        template = CATALOG[DEFAULT_LANGUAGE].get(key, key)

    if not kwargs:
        return template

    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        logger.warning("Bad placeholders for translation key %r", key)
        return template

