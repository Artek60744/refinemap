from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Index, String, Text
from sqlalchemy.sql import func

from src.database import Base


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(120), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    is_encrypted = Column(Boolean, nullable=False, default=False)
    description = Column(String(500), nullable=True)
    category = Column(String(50), nullable=False, default="general", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_app_settings_category", "category"),
        Index("idx_app_settings_updated_at", "updated_at"),
    )


class SettingCategories:
    GENERAL = "general"
    LLM = "llm"
    AZURE_DEVOPS = "azure_devops"


class SettingKeys:
    LLM_PROVIDER = "llm_provider"
    LLM_ENDPOINT = "llm_endpoint"
    LLM_API_KEY = "llm_api_key"
    LLM_DEPLOYMENT = "llm_deployment"
    LLM_MODEL = "llm_model"

    ADO_ORG_URL = "ado_org_url"
    ADO_PROJECT = "ado_project"
    ADO_PAT = "ado_pat"
    ADO_MOCK_MODE = "ado_mock_mode"


SENSITIVE_SETTING_KEYS = {
    SettingKeys.LLM_API_KEY,
    SettingKeys.ADO_PAT,
}
