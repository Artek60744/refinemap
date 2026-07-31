from __future__ import annotations

from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from src.api.schemas_settings import (
    AzureDevOpsProjectModel,
    AzureDevOpsProjectsResponse,
    AzureDevOpsSettingsModel,
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
from src.services.azure_devops_refinement import (
    AzureDevOpsError,
    build_auth_headers,
    fetch_projects,
    normalize_org_url,
    read_json_response,
)
from src.utils.encryption import decrypt_value, encrypt_value


def _mask_secret(value: str | None) -> str | None:
    if not value:
        return None
    return f"****{value[-4:]}" if len(value) >= 4 else "****"


def _bool_from_string(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class LlmRuntimeConfig:
    provider: str
    endpoint: str
    api_key: str
    deployment: str
    model: str


@dataclass
class AzureDevOpsRuntimeConfig:
    org_url: str
    project: str
    pat: str
    mock_mode: bool


@dataclass
class RuntimeConfig:
    llm: LlmRuntimeConfig
    azure_devops: AzureDevOpsRuntimeConfig


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
            azureDevOps=AzureDevOpsSettingsModel(
                orgUrl=runtime.azure_devops.org_url,
                project=runtime.azure_devops.project,
                mockMode=runtime.azure_devops.mock_mode,
                patConfigured=bool(runtime.azure_devops.pat),
                patHint=_mask_secret(runtime.azure_devops.pat),
                source=self._source_for(SettingKeys.ADO_ORG_URL, fallback="environment"),
            ),
        )

    def save_settings(self, payload: SaveSettingsRequest) -> SaveSettingsResponse:
        self._save_plain(SettingKeys.LLM_PROVIDER, payload.llmProvider, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_ENDPOINT, payload.llmEndpoint, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_DEPLOYMENT, payload.llmDeployment, SettingCategories.LLM)
        self._save_plain(SettingKeys.LLM_MODEL, payload.llmModel, SettingCategories.LLM)
        self._save_plain(SettingKeys.ADO_ORG_URL, payload.adoOrgUrl, SettingCategories.AZURE_DEVOPS)
        self._save_plain(SettingKeys.ADO_PROJECT, payload.adoProject, SettingCategories.AZURE_DEVOPS)
        self._save_plain(SettingKeys.ADO_MOCK_MODE, "true" if payload.adoMockMode else "false", SettingCategories.AZURE_DEVOPS)

        if payload.llmApiKey.strip():
            self._save_secret(SettingKeys.LLM_API_KEY, payload.llmApiKey.strip(), SettingCategories.LLM)
        if payload.adoPat.strip():
            self._save_secret(SettingKeys.ADO_PAT, payload.adoPat.strip(), SettingCategories.AZURE_DEVOPS)

        return SaveSettingsResponse(
            success=True,
            message=t("api.settings_saved"),
            settings=self.get_all_settings(),
        )

    def get_runtime_config(self) -> RuntimeConfig:
        return RuntimeConfig(
            llm=LlmRuntimeConfig(
                provider=self._get_setting_value(SettingKeys.LLM_PROVIDER, settings.llm_provider or "mock") or "mock",
                endpoint=self._get_setting_value(SettingKeys.LLM_ENDPOINT, settings.azure_ai_endpoint),
                api_key=self._get_secret_value(SettingKeys.LLM_API_KEY, settings.azure_ai_key or settings.openai_api_key),
                deployment=self._get_setting_value(SettingKeys.LLM_DEPLOYMENT, settings.azure_ai_model_id),
                model=self._get_setting_value(SettingKeys.LLM_MODEL, settings.openai_model),
            ),
            azure_devops=AzureDevOpsRuntimeConfig(
                org_url=self._get_setting_value(SettingKeys.ADO_ORG_URL, settings.azure_devops_org),
                project=self._get_setting_value(SettingKeys.ADO_PROJECT, settings.azure_devops_project),
                pat=self._get_secret_value(SettingKeys.ADO_PAT, settings.azure_devops_pat),
                mock_mode=_bool_from_string(
                    self.repository.get(SettingKeys.ADO_MOCK_MODE),
                    settings.azure_devops_mock_mode,
                ),
            ),
        )

    def test_azure_devops(self, payload: ConnectionTestRequest | None = None) -> ConnectionTestResponse:
        runtime = self.get_runtime_config()
        org_url = (payload.orgUrl if payload and payload.orgUrl is not None else runtime.azure_devops.org_url).strip()
        project = (payload.project if payload and payload.project is not None else runtime.azure_devops.project).strip()
        pat = (payload.pat if payload and payload.pat is not None and payload.pat.strip() else runtime.azure_devops.pat)
        mock_mode = payload.mockMode if payload and payload.mockMode is not None else runtime.azure_devops.mock_mode

        if mock_mode:
            return ConnectionTestResponse(
                success=True,
                message=t("api.mock_mode_on"),
                details={"mockMode": True},
            )

        if not org_url:
            return ConnectionTestResponse(success=False, message=t("api.org_url_missing"))
        if not project:
            return ConnectionTestResponse(success=False, message=t("api.project_missing"))
        if not pat:
            return ConnectionTestResponse(success=False, message=t("api.pat_missing"))

        url = f"{normalize_org_url(org_url)}/_apis/projects?api-version=7.0&$top=200"
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(url, headers=build_auth_headers(pat))
            data = read_json_response(response, t("ado.ctx.connection"))
        except AzureDevOpsError as exc:
            return ConnectionTestResponse(success=False, message=str(exc))
        except Exception as exc:
            return ConnectionTestResponse(success=False, message=t("api.ado_failed", error=exc))

        names = [item.get("name", "") for item in data.get("value", [])]
        if project not in names:
            return ConnectionTestResponse(
                success=False,
                message=t("api.ado_project_invisible", project=project),
                details={"projectsVisible": len(names)},
            )

        return ConnectionTestResponse(
            success=True,
            message=t("api.ado_ok", project=project),
            details={"projectsVisible": len(names)},
        )

    async def list_azure_devops_projects(
        self, payload: ConnectionTestRequest | None = None
    ) -> AzureDevOpsProjectsResponse:
        runtime = self.get_runtime_config()
        org_url = (payload.orgUrl if payload and payload.orgUrl is not None else runtime.azure_devops.org_url).strip()
        pat = payload.pat if payload and payload.pat is not None and payload.pat.strip() else runtime.azure_devops.pat

        # Mock mode only changes where work items come from: as soon as an org URL
        # and a PAT exist, list the real projects so the field can be configured.
        if not org_url or not pat:
            return AzureDevOpsProjectsResponse(
                success=False,
                message=t("api.org_url_hint") if not org_url else t("api.pat_hint"),
                projects=[AzureDevOpsProjectModel(id="mock", name="MockProject")],
            )

        try:
            projects = await fetch_projects(org_url, pat)
        except AzureDevOpsError as exc:
            return AzureDevOpsProjectsResponse(success=False, message=str(exc))
        except Exception as exc:
            return AzureDevOpsProjectsResponse(success=False, message=t("api.projects_failed", error=exc))

        projects.sort(key=lambda item: item["name"].lower())
        return AzureDevOpsProjectsResponse(
            success=True,
            message=t("api.projects_found", count=len(projects)),
            projects=[AzureDevOpsProjectModel(**project) for project in projects],
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

        if provider in {"azure-foundry", "azure-openai", "openai", "openrouter"}:
            missing = []
            if not api_key:
                missing.append(t("api.field.api_key"))
            if provider in {"azure-foundry", "azure-openai"} and not endpoint:
                missing.append(t("api.field.endpoint"))
            if provider in {"azure-foundry", "azure-openai"} and not deployment:
                missing.append(t("api.field.deployment"))
            if provider in {"openai", "openrouter"} and not model:
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
