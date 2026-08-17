---
type: Hub de documentation
title: RefineMap — Guide de démarrage rapide et carte du wiki
description: Point d’entrée pour le wiki du dépôt RefineMap. Explique ce qu’est le produit, comment le wiki est organisé, et oriente chaque domaine de changement majeur vers les fichiers source exacts, les invariants, les tests ciblés et les commandes de validation.
tags: [refinemap, quickstart, navigation]
openwiki:
  roles: [repository, workflow]
  change_kinds: [navigation]
  source_paths: [src/main.py, src/services/refinement_service.py, src/agents/refinement_workflow/graph.py]
  validation_commands: [python -m pytest tests/ -q]
---

# RefineMap — Guide de démarrage rapide

RefineMap (commercialisée sous le nom **PromptRefine** dans l’interface) est une SaaS de type « tableau de décision » : un espace de travail de raffinement assisté par IA où une équipe saisit une idée brute et sort d’une session unique avec un arbitrage explicite (Go / Explore / Rework / Drop), un rapport de décision et un livrable exportable (Brief, Plan, Brouillon de code). Elle n’est délibérément *pas* un autre outil de brainstorming IA — la différence réside dans le moteur de raffinement agentique et la mémoire produit qui conserve des faits durables entre les sessions.

Le dépôt est une application en deux parties :

- **Backend** (`src/`) — API JSON FastAPI, une machine à états de raffinement LangGraph, une persistance SQLAlchemy (PostgreSQL en production, SQLite en local), et des fournisseurs LLM interchangeables (mock par défaut).
- **Frontend** (`frontend/`) — SPA React 18 + TypeScript + Vite + Tailwind servie par nginx en production. Elle ne communique qu’avec l’API ; elle n’appelle jamais un LLM directement.

## Ce que couvre ce wiki

| Domaine | Page | Ce que vous y trouverez |
|---|---|---|
| Architecture système et flux de requêtes | [architecture/overview.md](architecture/overview.md) | Carte des composants, séquence d’exécution, répartition i18n, alignement des thread-id |
| Moteur de raffinement LangGraph | [architecture/refinement-engine.md](architecture/refinement-engine.md) | Machine à états, règles de routage, fournisseurs LLM, repli mock, prompts |
| Grilles de questions (postures) | [domain/question-grids.md](domain/question-grids.md) | Axes PO / Technique / Hybride, détection de mode, repli par mots-clés |
| Sémantique du rapport de décision | [domain/decision-report.md](domain/decision-report.md) | Énumération des verdicts, règles de cause racine, bloqueurs, export Markdown |
| Mémoire produit | [domain/product-memory.md](domain/product-memory.md) | Produits, faits, catégories, règles de durabilité, opérations mémoire, API de curation + UI |
| Modèle de données et cycle de vie des sessions | [domain/data-model.md](domain/data-model.md) | Entités SQLAlchemy, statuts, journal des artefacts, migration forward |
| Surface API | [api/refinement-api.md](api/refinement-api.md) | Endpoints, schémas, mapping des erreurs, exports |
| Frontend SPA | [frontend/overview.md](frontend/overview.md) | Routes, pages, coques de navigation, i18n, client API, UI de mémoire produit |
| Déploiement et exploitation | [operations/deployment.md](operations/deployment.md) | deploy.sh, Docker compose, VM Azure, contrôle des coûts, limites connues |
| Configuration des fournisseurs LLM | [operations/llm-configuration.md](operations/llm-configuration.md) | Stockage des paramètres, chiffrement, fournisseurs, test de connexion |
| Tests et validation | [testing.md](testing.md) | Suites de tests, assertions exactes, commandes de validation minimales |

Le [README.md](../README.md) à la racine du dépôt est la présentation du produit et le guide de démarrage rapide du développement local ; `docs/` contient les documents de conception et de planification (parcours du workflow, guide de déploiement, modèle de données cible, note de conception de la mémoire produit `docs/product-memory.md`, plan du MVP) que ce wiki résume et référence au lieu de les dupliquer.

## Routage des tâches

| Zone de modification ou intention de l’utilisateur | Page du wiki | Points d’entrée source | Symboles / types importants | Tests ciblés | Commande de validation minimale |
|---|---|---|---|---|---|
| Flux de session : création, réponses, changement de grille, export | [architecture/overview.md](architecture/overview.md), [api/refinement-api.md](api/refinement-api.md) | `src/services/refinement_service.py` (`start_session`, `submit_answers`, `set_mode`, `export_markdown`), `src/api/refinement.py` | `RefinementService`, `CreateSessionRequest`, `SubmitAnswersRequest`, `StartSessionResponse` | `tests/test_product_memory_flow.py` (boucle service de bout en bout) | `python -m pytest tests/test_product_memory_flow.py -q` |
| Machine à états LangGraph ou règles de routage | [architecture/refinement-engine.md](architecture/refinement-engine.md) | `src/agents/refinement_workflow/graph.py` (`create_refinement_graph`, `route_start`, `route_after_summary`, `route_after_final`), `state.py` (`RefinementState`) | `RefinementState`, `create_initial_state`, builders de nœuds dans `nodes.py` | `tests/test_routing.py` (5 tests) | `python -m pytest tests/test_routing.py -q` |
| Fournisseur LLM, réparation JSON, repli mock | [architecture/refinement-engine.md](architecture/refinement-engine.md), [operations/llm-configuration.md](operations/llm-configuration.md) | `src/services/refinement_llm.py` (`OpenAICompatibleLLM`, `MockRefinementLLM`, `build_refinement_llm`) | Protocole `RefinementLLM`, indicateur `degraded`, `_chat_json` | `tests/test_mock_decision.py` | `python -m pytest tests/test_mock_decision.py -q` |
| Verdict du rapport de décision ou export Markdown | [domain/decision-report.md](domain/decision-report.md) | `src/services/refinement_llm.py::_build_decision_report`, `src/services/artifact_renderer.py::render_deliverable_markdown` | `DecisionReport`, `DecisionRecommendation`, `RefinementDeliverable` | `tests/test_mock_decision.py`, `tests/test_artifact_renderer.py` | `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q` |
| Grilles de questions, axes, détection de mode | [domain/question-grids.md](domain/question-grids.md) | `src/services/question_grids.py` | `GRID_AXES`, `normalize_mode`, `resolve_grid`, `detect_grid_by_keywords` | couvert indirectement par les tests du moteur mock | `python -m pytest tests/ -q` |
| Curation de la mémoire produit ou opérations mémoire | [domain/product-memory.md](domain/product-memory.md), [frontend/overview.md](frontend/overview.md) | `src/services/product_memory_rules.py`, `src/repositories/product_memory_repository.py::apply_ops`, `src/services/product_memory_service.py`, `frontend/src/pages/ProductMemoryPage.tsx`, `frontend/src/api/memory.ts`, `prompts/extract-product-memory.md` | `is_durable_statement`, `classify_memory_category`, `MEMORY_FACT_LIMIT`, `ProductMemoryOp`, `ProductMemoryPage`, `api/memory.ts` | `tests/test_product_memory.py`, `tests/test_product_memory_api.py`, `tests/test_product_memory_flow.py` | `python -m pytest tests/test_product_memory.py tests/test_product_memory_api.py tests/test_product_memory_flow.py -q` |
| Modèle de données, statuts de session, évolution du schéma | [domain/data-model.md](domain/data-model.md) | `src/models/refinement.py`, `src/models/product_memory.py`, `src/models/app_settings.py`, `src/database.py` | `RefinementSession`, `QuestionRound`, `Question`, `Answer`, `SessionSummary`, `SessionArtifact`, `Product`, `ProductMemoryFact` | `tests/test_product_memory_flow.py` (cycle de vie via le service), `tests/test_product_memory.py` (`apply_ops`, plafond) | `python -m pytest tests/test_product_memory.py tests/test_product_memory_flow.py -q` |
| Points de terminaison API, schémas, sémantique d’erreur | [api/refinement-api.md](api/refinement-api.md) | `src/api/refinement.py`, `src/api/product_memory.py`, `src/api/settings.py`, `src/api/schemas_refinement.py` | Objets routeur, schémas `StrictModel`, mapping `HTTPException` | `tests/test_product_memory_api.py` (contrat HTTP produits/mémoire), `tests/test_artifact_renderer.py` (allers-retours de schémas) | `python -m pytest tests/test_product_memory_api.py tests/test_artifact_renderer.py -q` |
| Page frontend, route ou chaîne i18n | [frontend/overview.md](frontend/overview.md) | `frontend/src/App.tsx`, `frontend/src/pages/*` (`WarRoom`, `HistoryPage`, `ProductMemoryPage`, `RefinementHome`, `SettingsPage`), `frontend/src/api/*` (`client`, `refinement`, `memory`, `settings`), `frontend/src/i18n/catalog.ts` | `WarRoom`, `HistoryPage`, `ProductMemoryPage`, `MemoryBanner`, `TopNavBar`, `Layout`, `apiFetch`, `LanguageProvider` | aucun (le frontend n’a pas de suite de tests) | `cd frontend && npm run build` |
| Déploiement, Docker, opérations VM | [operations/deployment.md](operations/deployment.md) | `deploy.sh`, `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `frontend/nginx.conf` | Sous-commandes `deploy.sh` (`sync`, `deploy`, `dev`, `logs`, `env`, `stop`), configuration du proxy nginx | aucun | `./deploy.sh status` |
| Stockage des paramètres LLM, chiffrement, test de connexion | [operations/llm-configuration.md](operations/llm-configuration.md) | `src/services/settings_service.py`, `src/repositories/settings_repository.py`, `src/utils/encryption.py`, `src/models/app_settings.py` | `SettingsService`, `RuntimeConfig`, `EncryptionService`, `AppSetting`, `SENSITIVE_SETTING_KEYS` | aucun | `python -m pytest tests/ -q` |
| Câblage backend, health check, amorçage de la base de données | [architecture/overview.md](architecture/overview.md) | `src/main.py` (`app`, `LanguageMiddleware`, `/health`), `src/database.py::init_db`, `src/config/settings.py` | `settings`, `SessionLocal`, `Base` | aucun | `uvicorn src.main:app --reload --port 8000`, puis `curl localhost:8000/health` |

## Orientation rapide

- **La boucle de raffinement est une machine à états LangGraph, pas un chat.** Chaque étape LLM renvoie un JSON strict validé par Pydantic ; `thread_id` est égal à l’identifiant de session. Voir [architecture/refinement-engine.md](architecture/refinement-engine.md).
- **Le moteur mock est un invariant produit.** `LLM_PROVIDER=mock` (par défaut) fait fonctionner tout le flux hors ligne ; chaque appel à un fournisseur réel qui échoue bascule en dégradé vers le même moteur mock et signale `degraded: true` pour que l’interface puisse en informer l’utilisateur.
- **L’état de session est la source de vérité, pas les points de contrôle LangGraph.** PostgreSQL (ou SQLite) contient les sessions, tours, questions, réponses, résumés et artefacts ; voir [domain/data-model.md](domain/data-model.md).
- **La mémoire produit est limitée à chaque produit et plafonnée.** Seuls les faits durables, classés par catégorie, survivent d’une session à l’autre, jusqu’à `MEMORY_FACT_LIMIT` (40) ; les humains les gèrent sur la page `/memory` ou directement dans la bannière War Room ; voir [domain/product-memory.md](domain/product-memory.md).
- **Le verdict est le produit.** `decisionReport` clôt chaque session finalisée avec `go | explore | rework | drop`, une cause racine, jusqu’à deux bloqueurs, les forces et une prochaine action ; voir [domain/decision-report.md](domain/decision-report.md).

## Référence rapide de validation

```bash
# Backend : suite ciblée complète (7 fichiers, entièrement hors ligne — LLM mock et SQLite en mémoire, aucune clé ni Postgres requis)
python -m pytest tests/ -q

# Un seul domaine de comportement
python -m pytest tests/test_routing.py -q        # règles de routage LangGraph
python -m pytest tests/test_mock_decision.py -q  # règles d’arbitrage des verdicts
python -m pytest tests/test_artifact_renderer.py -q  # export Markdown + migration de schémas
python -m pytest tests/test_product_memory.py -q     # règles de durabilité, apply_ops, plafond
python -m pytest tests/test_product_memory_api.py -q # contrat HTTP produits/mémoire
python -m pytest tests/test_product_memory_flow.py -q # boucle session → mémoire → session suivante

# Frontend : typage + build de production (lent, conditionnel : à exécuter lors de modifications du frontend/)
cd frontend && npm run build

# Pile complète en local (mock LLM par défaut)
uvicorn src.main:app --reload --port 8000   # terminal 1
cd frontend && npm run dev                  # terminal 2, ouvrir http://localhost:5173

# Statut de la VM déployée (conditionnel : uniquement lors des opérations de déploiement)
./deploy.sh status
```

Voir [testing.md](testing.md) pour ce que chaque suite vérifie et pourquoi.

## Garder ce wiki à jour

Ce wiki est généré et maintenu par OpenWiki ; la CLI est une devDependency racine (`package.json`, README « Documentation temps réel (OpenWiki) ») : `npm run docs:update` le régénère, `npm run docs:watch` exécute `scripts/openwiki-watch.mjs` (surveille `src/`, `frontend/src/` et `contracts/`, avec un délai de 8 s), et `npm run docs:visualize` ouvre le graphe de connaissances. Les pages du wiki vivent dans `openwiki/` et sont validées avec le code — mettez-les à jour dans le même changement que le code source qu’elles décrivent.

## Backlog

- **Authentification (lien magique / Google SSO)** — prévue (README « Prochains incréments techniques », `docs/implementation-plan.md` semaine 2) mais aucun code n’existe ; aujourd’hui, un seul utilisateur local est initialisé (`local-user@example.com`, voir `src/database.py::init_db`).
- **Migrations Alembic** — `alembic` figure dans `requirements.txt` mais aucune configuration de migration n’existe ; le schéma est créé par `create_all()` plus une migration forward écrite à la main `_add_missing_columns()` dans `src/database.py`.
- **Domaine du tableau de décision (workspace / board / node / score / vote / tables d’export)** — modèle cible uniquement, décrit dans `docs/sqlalchemy-data-model.md` ; le schéma actuel est centré sur les sessions.
- **Exports du backlog (CSV / JSON)** — seul l’export Markdown est implémenté (`GET /api/refinement/sessions/{id}/export`).
- **Interface de score / vote / tags et couche de décision** — prévu, non implémenté (README ; `docs/mvp-blueprint.md`).
- **Suite de tests frontend** — aucune n’existe ; la validation frontend est `tsc --noEmit` + `vite build`.
- **Durcissement HTTPS et authentification réelle** — limites documentées dans `docs/deployment.md` et [operations/deployment.md](operations/deployment.md).