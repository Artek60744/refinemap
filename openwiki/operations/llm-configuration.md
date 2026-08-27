---
type: Opérations
title: Configuration du fournisseur LLM et gestion des secrets
description: Comment RefineMap résout et stocke le fournisseur LLM à l’exécution — le magasin clé/valeur app_settings, les replis d’environnement par fournisseur, le chiffrement Fernet de la clé API, les indices masqués et le test de connexion non live.
tags: [operations, llm, configuration, security, encryption]
openwiki:
  roles: [operations]
  change_kinds: [runtime]
  source_paths: [src/services/settings_service.py, src/repositories/settings_repository.py, src/models/app_settings.py, src/utils/encryption.py, src/config/settings.py]
  symbols: [SettingsService, get_runtime_config, SettingsRepository, AppSetting, SettingKeys, SettingCategories, SENSITIVE_SETTING_KEYS, EncryptionService, encrypt_value, decrypt_value]
  invariants: ["The API key is only persisted when the submitted value is non-empty (empty keeps the stored key). The key is encrypted at rest with a Fernet key derived from SECRET_KEY and never returned to the client, only masked. Runtime config prefers the database over env fallbacks."]
  validation_commands: [python -m pytest tests/ -q]
---

# Configuration du fournisseur LLM et gestion des secrets

La configuration du fournisseur LLM est stockée à l’exécution dans la table `app_settings` (clé/valeur), gérée par `SettingsService`, et consommée par `RefinementService._build_runtime_components` pour construire le moteur (voir [refinement-engine.md](../architecture/refinement-engine.md)).

## Modèle de stockage

- `AppSetting` (`src/models/app_settings.py`) : `key` clé primaire, `value`, `is_encrypted`, `description`, `category` (`general` | `llm`), horodatages avec index sur `category` et `updated_at`.
- `SettingKeys` : `llm_provider`, `llm_endpoint`, `llm_api_key`, `llm_deployment`, `llm_model`. `SENSITIVE_SETTING_KEYS = {LLM_API_KEY}` pilote l’indicateur de chiffrement.
- `SettingsRepository.set` effectue un upsert ; `get` lit les valeurs brutes.

## Ordre de résolution (`SettingsService.get_runtime_config`)

1. `provider` — depuis `app_settings`, avec repli sur l’environnement (`settings.llm_provider`, défaut `mock`).
2. Les replis d’environnement pour endpoint / modèle / clé **dépendent du fournisseur** :
   - `deepseek` -> `settings.deepseek_api_key` / `deepseek_model` / `deepseek_endpoint` ;
   - tout autre -> `azure_ai_key or openai_api_key` / `openai_model` / `azure_ai_endpoint` ;
   - `deployment` retombe sur `settings.azure_ai_model_id`.
3. Une valeur en base l’emporte toujours sur le repli d’environnement ; ainsi, enregistrer le fournisseur via l’interface utilisateur écrase le `.env`. Il suffit de définir le fournisseur et sa clé dans le `.env` — aucun enregistrement via l’interface n’est requis.

## Enregistrement et secrets

- `save_settings` enregistre le fournisseur/l’endpoint/le déploiement/le modèle en clair, et la clé API **uniquement si la clé soumise est non vide** (l’interface envoie un champ vide pour conserver la clé actuelle ; voir `SettingsPage`). La clé est chiffrée avec `EncryptionService` (Fernet avec une clé dérivée de `SECRET_KEY` via SHA-256).
- L’API ne renvoie jamais la clé brute : `get_all_settings` retourne `keyConfigured: bool` et un `keyHint` masqué (`****` + 4 derniers caractères), ainsi que `source` ("database" lorsque la ligne de réglage existe, sinon "environment").
- `decrypt_value` renvoie `None` sur `InvalidToken` ou toute erreur de déchiffrement, au lieu de lever une exception ; ainsi, une clé stockée corrompue retombe sur le repli d’environnement plutôt que de faire échouer les requêtes.

## Test de connexion

`POST /api/settings/test/llm` (`ConnectionTestRequest`, tous les champs sont facultatifs — les champs non envoyés retombent sur la configuration d’exécution ; voir les [points de terminaison des paramètres](../api/refinement-api.md)) est **volontairement non live** : il valide la complétude des champs par fournisseur et renvoie `success` avec `details.liveInvocation: false`. Champs requis :

- `mock` — toujours un succès.
- `azure-foundry` / `azure-openai` — clé API, endpoint, déploiement.
- `openai` / `openrouter` / `deepseek` — clé API, modèle.
- tout autre fournisseur — « fournisseur non pris en charge ».

## Prise en charge des fournisseurs dans le moteur

`build_refinement_llm` utilise un vrai `OpenAICompatibleLLM` uniquement lorsque `provider != "mock"` **et** qu’une clé API est configurée ; sinon, `MockRefinementLLM`. Fournisseurs pris en charge : `mock`, `azure-foundry`, `azure-openai`, `openai`, `openrouter`, `deepseek` (voir la construction de l’URL Azure et la note sur `reasoning_effort` de DeepSeek dans [refinement-engine.md](../architecture/refinement-engine.md)).

## Recommandations de modification

- **Quand consulter cette page :** ajout d’un fournisseur, modification des champs requis, changement des replis d’environnement, ou intervention sur la gestion des secrets.
- **Invariants à préserver :** une clé vide conserve la clé stockée ; chiffrement au repos avec Fernet ; seuls des indices masqués sont exposés dans les réponses ; la base de données prime sur l’environnement dans la configuration d’exécution ; le point de terminaison de test reste non live (il s’agit d’une vérification de complétude, pas d’une sonde réseau) ; `decrypt_value` ne lève jamais d’exception.
- **Points d’extension pour un nouveau fournisseur :** ajouter les champs d’environnement dans `src/config/settings.py`, les replis spécifiques au fournisseur dans `get_runtime_config`, les valeurs par défaut du fournisseur dans `OpenAICompatibleLLM._url`, les champs requis dans `test_llm`, l’entrée d’interface dans `frontend/src/pages/SettingsPage.tsx` (`LLM_FIELDS_BY_PROVIDER`) et les chaînes de catalogue dans `frontend/src/i18n/catalog.ts`.
- **Validation :** `python -m pytest tests/ -q` (aucun test spécifique aux paramètres n’existe encore) ; test de fumée manuel : enregistrer `mock` via la page des paramètres, vérifier que le test de connexion réussit, et vérifier que `GET /api/settings` ne contient jamais de clé brute.