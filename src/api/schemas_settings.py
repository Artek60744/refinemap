from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LlmSettingsModel(StrictModel):
    provider: str = "mock"
    endpoint: str = ""
    deployment: str = ""
    model: str = ""
    keyConfigured: bool = False
    keyHint: str | None = None
    source: str = "environment"


class AzureDevOpsSettingsModel(StrictModel):
    orgUrl: str = ""
    project: str = ""
    mockMode: bool = True
    patConfigured: bool = False
    patHint: str | None = None
    source: str = "environment"


class SettingsViewResponse(StrictModel):
    llm: LlmSettingsModel
    azureDevOps: AzureDevOpsSettingsModel


class SaveSettingsRequest(StrictModel):
    llmProvider: str = "mock"
    llmEndpoint: str = ""
    llmApiKey: str = ""
    llmDeployment: str = ""
    llmModel: str = ""
    adoOrgUrl: str = ""
    adoProject: str = ""
    adoPat: str = ""
    adoMockMode: bool = True


class ConnectionTestRequest(StrictModel):
    provider: str | None = None
    endpoint: str | None = None
    apiKey: str | None = None
    deployment: str | None = None
    model: str | None = None
    orgUrl: str | None = None
    project: str | None = None
    pat: str | None = None
    mockMode: bool | None = None


class AzureDevOpsProjectModel(StrictModel):
    id: str = ""
    name: str


class AzureDevOpsProjectsResponse(StrictModel):
    success: bool
    message: str
    projects: list[AzureDevOpsProjectModel] = Field(default_factory=list)


class ConnectionTestResponse(StrictModel):
    success: bool
    message: str
    details: dict[str, str | int | bool] = Field(default_factory=dict)


class SaveSettingsResponse(StrictModel):
    success: bool
    message: str
    settings: SettingsViewResponse
