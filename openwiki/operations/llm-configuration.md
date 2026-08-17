---
type: Operations
title: LLM Provider Configuration and Secret Handling
description: How RefineMap resolves and stores the LLM provider at runtime — the app_settings key/value store, env fallbacks per provider, Fernet encryption of the API key, masked hints, and the non-live connection test.
tags: [operations, llm, configuration, security, encryption]
openwiki:
  roles: [operations]
  change_kinds: [runtime]
  source_paths: [src/services/settings_service.py, src/repositories/settings_repository.py, src/models/app_settings.py, src/utils/encryption.py, src/config/settings.py]
  symbols: [SettingsService, get_runtime_config, SettingsRepository, AppSetting, SettingKeys, SettingCategories, SENSITIVE_SETTING_KEYS, EncryptionService, encrypt_value, decrypt_value]
  invariants: ["The API key is only persisted when the submitted value is non-empty (empty keeps the stored key). The key is encrypted at rest with a Fernet key derived from SECRET_KEY and never returned to the client, only masked. Runtime config prefers the database over env fallbacks."]
  validation_commands: [python -m pytest tests/ -q]
---

# LLM Provider Configuration and Secret Handling

LLM provider configuration is stored at runtime in the `app_settings` table
(key/value), managed by `SettingsService`, and consumed by
`RefinementService._build_runtime_components` to construct the engine (see
[refinement-engine.md](../architecture/refinement-engine.md)).

## Storage model

- `AppSetting` (`src/models/app_settings.py`): `key` PK, `value`, `is_encrypted`,
  `description`, `category` (`general` | `llm`), timestamps with indexes on
  `category` and `updated_at`.
- `SettingKeys`: `llm_provider`, `llm_endpoint`, `llm_api_key`, `llm_deployment`,
  `llm_model`. `SENSITIVE_SETTING_KEYS = {LLM_API_KEY}` drives the encrypted flag.
- `SettingsRepository.set` upserts; `get` reads raw values.

## Resolution order (`SettingsService.get_runtime_config`)

1. `provider` — from `app_settings`, falling back to env
   (`settings.llm_provider`, default `mock`).
2. Endpoint / model / key env fallbacks **depend on the provider**:
   - `deepseek` -> `settings.deepseek_api_key` / `deepseek_model` /
     `deepseek_endpoint`;
   - everything else -> `azure_ai_key or openai_api_key` / `openai_model` /
     `azure_ai_endpoint`;
   - `deployment` falls back to `settings.azure_ai_model_id`.
3. A database value always wins over the env fallback, so saving the provider
   through the UI overrides the `.env`. Setting only the provider + its key in the
   `.env` is enough — no UI save required.

## Saving and secrets

- `save_settings` persists provider/endpoint/deployment/model as plain values and
  the API key **only if the submitted key is non-empty** (the UI sends an empty
  field to keep the current key; see `SettingsPage`). The key is encrypted with
  `EncryptionService` (Fernet over SHA-256-derived key from `SECRET_KEY`).
- The API never returns the raw key: `get_all_settings` returns `keyConfigured:
  bool` and a masked `keyHint` (`****` + last 4 chars) plus the `source`
  ("database" when the setting row exists, else "environment").
- `decrypt_value` returns `None` on `InvalidToken` or any decryption error rather
  than raising, so a corrupted stored key degrades to the env fallback instead of
  crashing requests.

## Connection test

`POST /api/settings/test/llm` (`ConnectionTestRequest`, all fields optional —
unsent fields fall back to the runtime config; see the
[settings endpoints](../api/refinement-api.md)) is **deliberately non-live**: it
validates field completeness per provider and returns `success` with
`details.liveInvocation: false`. Required fields:

- `mock` — always success.
- `azure-foundry` / `azure-openai` — api key, endpoint, deployment.
- `openai` / `openrouter` / `deepseek` — api key, model.
- anything else — "unsupported provider".

## Provider support in the engine

`build_refinement_llm` uses a real `OpenAICompatibleLLM` only when
`provider != "mock"` **and** an API key is configured; otherwise `MockRefinementLLM`.
Supported providers: `mock`, `azure-foundry`, `azure-openai`, `openai`,
`openrouter`, `deepseek` (see the Azure URL construction and the DeepSeek
`reasoning_effort` note in [refinement-engine.md](../architecture/refinement-engine.md)).

## Change guidance

- **When to consult this page:** adding a provider, changing required fields,
  changing env fallbacks, or touching secret handling.
- **Invariants to preserve:** empty key keeps stored key; encrypted at rest with
  Fernet; masked hints only in responses; database wins over env in runtime config;
  the test endpoint stays non-live (it is a completeness check, not a network
  probe); `decrypt_value` never raises.
- **Extension seams for a new provider:** add env fields in `src/config/settings.py`,
  provider-specific fallbacks in `get_runtime_config`, provider defaults in
  `OpenAICompatibleLLM._url`, required fields in `test_llm`, the UI entry in
  `frontend/src/pages/SettingsPage.tsx` (`LLM_FIELDS_BY_PROVIDER`) and catalog
  strings in `frontend/src/i18n/catalog.ts`.
- **Validation:** `python -m pytest tests/ -q` (no settings-specific tests exist
  yet); manual smoke: save mock via the settings page, confirm the connection test
  succeeds, and confirm `GET /api/settings` never contains a raw key.
