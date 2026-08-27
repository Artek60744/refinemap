from __future__ import annotations

import os
from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    api_title: str = "AI Refinement Assistant"
    api_version: str = "0.1.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    secret_key: str = "dev-secret"

    database_url: str = "sqlite:///./refinement.db"
    database_echo: bool = False

    llm_provider: str = "mock"
    llm_temperature: float = 0.2
    llm_max_tokens: int = 4000
    azure_ai_endpoint: str = ""
    azure_ai_key: str = ""
    azure_ai_model_id: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"

    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_endpoint: str = "https://api.deepseek.com"

    # Local runtime: no key, and the endpoint is the OpenAI-compatible shim Ollama
    # serves on /v1.
    ollama_model: str = "qwen3"
    ollama_endpoint: str = "http://localhost:11434/v1"

    refinement_max_rounds: int = 3
    # Rounds to run before enoughContext may end the session; capped by max_rounds.
    refinement_min_rounds: int = 2
    refinement_max_questions_per_round: int = 6
    refinement_export_enabled: bool = True

    default_user_email: str = "local-user@example.com"
    default_user_name: str = "Local User"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    @cached_property
    def app_root(self) -> Path:
        env_root = os.getenv("APP_ROOT", "")
        if env_root:
            return Path(env_root).resolve()
        return Path(__file__).resolve().parents[2]

    @cached_property
    def prompts_dir(self) -> Path:
        repo_prompts = self.app_root / "prompts"
        if repo_prompts.is_dir():
            return repo_prompts
        # Installed as a wheel: app_root points at site-packages, where there is no
        # top-level prompts/. The build copies them next to the package instead
        # (see force-include in pyproject.toml).
        return Path(__file__).resolve().parents[1] / "prompts"

    @cached_property
    def asset_version(self) -> str:
        """Cache-busting token for static assets, derived from their mtimes.

        Without it a deployed JS change can keep serving from the browser cache.
        """
        static_dir = Path(__file__).resolve().parents[1] / "static"
        try:
            newest = max(path.stat().st_mtime for path in static_dir.rglob("*") if path.is_file())
        except ValueError:
            return "0"
        return str(int(newest))


settings = Settings()
