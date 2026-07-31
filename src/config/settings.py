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

    azure_devops_org: str = ""
    azure_devops_project: str = ""
    azure_devops_pat: str = ""
    azure_devops_mock_mode: bool = True

    refinement_max_rounds: int = 3
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
        return self.app_root / "prompts"

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
