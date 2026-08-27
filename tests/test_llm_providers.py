from __future__ import annotations

import pytest

from src.api.schemas_settings import ConnectionTestRequest
from src.services.refinement_llm import (
    KEYLESS_PROVIDERS,
    MockRefinementLLM,
    OpenAICompatibleLLM,
    build_refinement_llm,
)
from src.services.settings_service import SettingsService


def test_ollama_is_reachable_without_an_api_key():
    llm = build_refinement_llm(provider="ollama", api_key="", model="qwen3")

    assert isinstance(llm, OpenAICompatibleLLM)
    assert llm._url() == "http://localhost:11434/v1/chat/completions"


def test_no_authorization_header_when_there_is_no_key():
    llm = build_refinement_llm(provider="ollama", api_key="", model="qwen3")

    # "Bearer " with nothing after it makes some gateways reject the call outright.
    assert "Authorization" not in llm._headers()


def test_a_custom_ollama_endpoint_wins_over_the_default():
    llm = build_refinement_llm(
        provider="ollama", api_key="", model="qwen3", endpoint="http://box.lan:11434/v1"
    )

    assert llm._url() == "http://box.lan:11434/v1/chat/completions"


def test_keyed_providers_still_fall_back_to_the_mock_without_a_key():
    assert isinstance(build_refinement_llm(provider="openai", api_key=""), MockRefinementLLM)
    assert isinstance(build_refinement_llm(provider="deepseek", api_key=""), MockRefinementLLM)


def test_a_keyed_provider_sends_a_bearer_token():
    llm = build_refinement_llm(provider="openai", api_key="sk-test", model="gpt-4.1-mini")

    assert llm._headers()["Authorization"] == "Bearer sk-test"


def test_ollama_is_declared_keyless():
    assert "ollama" in KEYLESS_PROVIDERS


@pytest.mark.parametrize(
    ("model", "expected"),
    [("qwen3", True), ("", False)],
)
def test_connection_test_accepts_ollama_without_a_key(db, model, expected):
    result = SettingsService(db).test_llm(
        ConnectionTestRequest(provider="ollama", model=model, apiKey="", endpoint="")
    )

    # A model is still required — only the credential check is waived.
    assert result.success is expected


def test_ollama_never_inherits_another_provider_s_key(db, monkeypatch):
    """Falling back to the Azure/OpenAI key would ship a real credential to a
    local endpoint."""
    monkeypatch.setattr("src.services.settings_service.settings.openai_api_key", "sk-real")
    monkeypatch.setattr("src.services.settings_service.settings.azure_ai_key", "azure-real")
    monkeypatch.setattr("src.services.settings_service.settings.llm_provider", "ollama")

    runtime = SettingsService(db).get_runtime_config()

    assert runtime.llm.provider == "ollama"
    assert runtime.llm.api_key == ""
