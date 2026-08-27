from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from src.api.schemas_settings import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    LlmSettingsModel,
    SaveSettingsRequest,
    SaveSettingsResponse,
    SettingsViewResponse,
)
from src.config.settings import settings
from src.i18n import t
from src.models.app_settings import SENSITIVE_SETTING_KEYS, SettingCategories, SettingKeys
from src.repositories.settings_repository import SettingsRepository
from src.services.refinement_llm import KEYLESS_PROVIDERS
from src.utils.encryption import decrypt_value, encrypt_value


def _mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    return f"****{value[-4:]}" if len(value) >= 4 else "****"


@dataclass
class LlmRuntimeConfig:
    provider: str
    endpoint: str
    api_key: str
    deployment: str
    model: str


@dataclass
class RuntimeConfig:
    llm: LlmRuntimeConfig


class SettingsService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = SettingsRepository(db)

    def get_all_settings(self) -> SettingsViewResponse:
        runtime = self.get_runtime_config()
        return SettingsViewResponse(
            llm=LlmSettingsModel(
                provider=runtime.llm.provider,
                endpoint=runtime.llm.endpoint,
                deployment=runtime.llm.deployment,
                model=runtime.llm.model,
                keyConfigured=bool(runtime.llm.api_key),
                keyHint=_mask_secret(runtime.llm.api_key),
                source=self._source_for(SettingKeys.LLM_PROVIDER, fallback="environment"),
            ),
        )

    def save_settings(self, payload: SaveSettingsRequest) -> SaveSettingsResponse:
        self._save_plain(SettingKeys.LLM_PROVIDER, payload.llmProvider, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_ENDPOINT, payload.llmEndpoint, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_DEPLOYMENT, payload.llmDeployment, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_MODEL, payload.llmModel, SettingCategories.LLM)

        if payload.llmApiKey.strip():
            self._save_secret(SettingKeys.LLM_API_KEY, payload.llmApiKey.strip(), SettingCategories.LLM)

        return SaveSettingsResponse(
            success=True,
            message=t("api.settings_saved"),
            settings=self.get_all_settings(),
        )

    def get_runtime_config(self) -> RuntimeConfig:
        provider = self._get_setting_value(SettingKeys.LLM_PROVIDER, settings.llm_provider or "mock") or "mock"

        # Env fallbacks depend on the provider, so setting only the provider + its key
        # in the .env is enough — no UI save required.
        if provider == "deepseek":
            key_fallback = settings.deepseek_api_key
            model_fallback = settings.deepseek_model
            endpoint_fallback = settings.deepseek_endpoint
        elif provider == "ollama":
            # Never inherit an Azure/OpenAI key here: that would ship a real
            # credential to a local endpoint. Only an explicit LLM_API_KEY passes,
            # for the rare local gateway that wants one.
            key_fallback = ""
            model_fallback = settings.ollama_model
            endpoint_fallback = settings.ollama_endpoint
        else:
            key_fallback = settings.azure_ai_key or settings.openai_api_key
            model_fallback = settings.openai_model
            endpoint_fallback = settings.azure_ai_endpoint

        # The generic LLM_* variables win over the provider-specific ones, and are
        # themselves overridden by anything saved from the settings page.
        return RuntimeConfig(
            llm=LlmRuntimeConfig(
                provider=provider,
                endpoint=self._get_setting_value(
                    SettingKeys.LLM_ENDPOINT, settings.llm_endpoint or endpoint_fallback
                ),
                api_key=self._get_secret_value(
                    SettingKeys.LLM_API_KEY, settings.llm_api_key or key_fallback
                ),
                deployment=self._get_setting_value(
                    SettingKeys.LLM_DEPLOYMENT, settings.llm_deployment or settings.azure_ai_model_id
                ),
                model=self._get_setting_value(
                    SettingKeys.LLM_MODEL, settings.llm_model or model_fallback
                ),
            ),
        )

    def test_llm(self, payload: ConnectionTestRequest | None = None) -> ConnectionTestResponse:
        runtime = self.get_runtime_config()
        provider = (payload.provider if payload and payload.provider is not None else runtime.llm.provider).strip() or "mock"
        endpoint = (payload.endpoint if payload and payload.endpoint is not None else runtime.llm.endpoint).strip()
        deployment = (payload.deployment if payload and payload.deployment is not None else runtime.llm.deployment).strip()
        model = (payload.model if payload and payload.model is not None else runtime.llm.model).strip()
        api_key = payload.apiKey if payload and payload.apiKey is not None and payload.apiKey.strip() else runtime.llm.api_key

        if provider == "mock":
            return ConnectionTestResponse(
                success=True,
                message=t("api.mock_llm"),
                details={"provider": provider},
            )

        if provider in {"azure-foundry", "azure-openai", "openai", "openrouter", "deepseek", "ollama"}:
            missing = []
            # A local runtime has no credentials to check — only a model to pick.
            if not api_key and provider not in KEYLESS_PROVIDERS:
                missing.append(t("api.field.api_key"))
            if provider in {"azure-foundry", "azure-openai"} and not endpoint:
                missing.append(t("api.field.endpoint"))
            if provider in {"azure-foundry", "azure-openai"} and not deployment:
                missing.append(t("api.field.deployment"))
            if provider in {"openai", "openrouter", "deepseek", "ollama"} and not model:
                missing.append(t("api.field.model"))

            if missing:
                return ConnectionTestResponse(success=False, message=t("api.llm_missing", fields=", ".join(missing)))

            return ConnectionTestResponse(
                success=True,
                message=t("api.llm_ready"),
                details={"provider": provider, "liveInvocation": False},
            )

        return ConnectionTestResponse(success=False, message=t("api.llm_unsupported", provider=provider))

    def _source_for(self, key: str, fallback: str) -> str:
        return "database" if self.repository.get_setting(key) else fallback

    def _get_setting_value(self, key: str, fallback: str) -> str:
        value = self.repository.get(key)
        return value if value is not None else fallback

    def _get_secret_value(self, key: str, fallback: str) -> str:
        stored = self.repository.get(key)
        if stored is not None:
            decrypted = decrypt_value(stored)
            return decrypted or ""
        return fallback

    def _save_plain(self, key: str, value: str, category: str) -> None:
        self.repository.set(
            key=key,
            value=value,
            category=category,
            description=key,
            is_encrypted=False,
        )

    def _save_secret(self, key: str, value: str, category: str) -> None:
        self.repository.set(
            key=key,
            value=encrypt_value(value),
            category=category,
            description=key,
            is_encrypted=key in SENSITIVE_SETTING_KEYS,
        )
