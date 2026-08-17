---
type: Référence API
title: API de raffinement, de mémoire produit et de paramètres
description: La surface FastAPI complète de RefineMap — les points de terminaison de session de raffinement, les points de terminaison de mémoire produit, les points de terminaison de paramètres, les schémas Pydantic stricts, les conventions de correspondance d'erreurs et le répertoire des contrats.
tags: [api, fastapi, schemas, endpoints]
openwiki:
  roles: [integration]
  change_kinds: [public-api]
  source_paths: [src/api/refinement.py, src/api/product_memory.py, src/api/settings.py, src/api/schemas_refinement.py, src/api/schemas_settings.py]
  symbols: [refinement_api_router, product_memory_api_router, settings_api_router, StrictModel, CreateSessionRequest, SubmitAnswersRequest, SessionDetailResponse, StartSessionResponse]
  test_paths: [tests/test_product_memory_api.py, tests/test_artifact_renderer.py]
  invariants: ["All request/response schemas are StrictModel (extra=forbid). KeyError maps to 404, ValueError maps to 400. The LLM API key is never returned to the client, only a masked hint."]
  validation_commands: [python -m pytest tests/test_product_memory_api.py tests/test_artifact_renderer.py -q]
---

# API de raffinement, de mémoire produit et de paramètres

Le backend expose trois routeurs, montés dans `src/main.py` :
`/api/refinement` (sessions de raffinement), `/api` sous `/api/products` et
`/api/memory` (mémoire produit), et `/api/settings` (configuration LLM). Chaque
schéma est un `StrictModel` (`extra="forbid"`) afin que les champs inconnus
échouent de manière explicite à la frontière. Le frontend reflète ces types dans
`frontend/src/types/api.ts` — gardez les deux en synchronisation lors d'une
modification de schéma.

## Points de terminaison de raffinement (`src/api/refinement.py`)

| Méthode et chemin | Objet | Requête -> Réponse |
|---|---|---|
| `POST /api/refinement/sessions` | Créer une session et générer le tour 1 | `CreateSessionRequest` (`objective`, `mode`, `extraContext`, `productId`, `productName`, `maxRounds`, `maxQuestionsPerRound`) -> `StartSessionResponse` (`session`, `questionRound`, `sessionSummary`, `productMemory`, `degraded`) |
| `GET /api/refinement/sessions` | Liste paginée de l'historique | query : `q`, `status`, `limit` (1..100, défaut 20), `offset` -> `SessionListResponse` |
| `GET /api/refinement/sessions/{session_id}` | Détail complet de la session | -> `SessionDetailResponse` (`session`, `subject`, `currentQuestionRound`, `questionRounds`, historique `answers`, `sessionSummary`, `productMemory`, `deliverable`) |
| `PATCH /api/refinement/sessions/{session_id}` | Renommer | `RenameSessionRequest.title` -> `SessionListItem` |
| `DELETE /api/refinement/sessions/{session_id}` | Supprimer (en cascade) | -> 204 |
| `POST /api/refinement/sessions/{session_id}/mode` | Changer la grille, réinitialiser les tours, rejouer le tour 0 | `SetModeRequest.mode` -> `SessionDetailResponse` |
| `POST /api/refinement/sessions/{session_id}/answers` | Soumettre les réponses du tour ouvert | `SubmitAnswersRequest.answers[]` (`questionId`, `answer`) -> `SubmitAnswersResponse` (`decision`, `questionRound` ou `deliverable`, `sessionSummary`, `degraded`) |
| `GET /api/refinement/sessions/{session_id}/export` | Téléchargement du livrable Markdown | -> `text/markdown` avec `Content-Disposition: attachment; filename="refinement-{session_id}.md"` |

Convention d'erreur : `KeyError` -> `404` (« Session introuvable »), `ValueError`
-> `400` (« Fournissez un prompt d'objectif pour démarrer une session. », « Aucun
tour de questions ouvert pour cette session », « Aucun livrable disponible pour le
moment », « Fournissez un titre. », ...). Les ressources inconnues et celles qui
n'appartiennent pas à l'utilisateur se confondent dans la même 404 afin d'éviter
les fuites d'existence.

## Points de terminaison de mémoire produit (`src/api/product_memory.py`)

| Méthode et chemin | Objet |
|---|---|
| `GET /api/products` | Liste les produits de l'utilisateur avec les compteurs de faits actifs |
| `POST /api/products` | Crée un produit (`CreateProductRequest.name`, min 1 / max 255) |
| `DELETE /api/products/{product_id}` | Supprime un produit (les faits sont supprimés en cascade ; les sessions conservent un `product_id` orphelin qui se lit comme « aucune mémoire ») |
| `GET /api/products/{product_id}/memory` | Liste les faits actifs du produit |
| `POST /api/products/{product_id}/memory` | Ajoute un fait manuel (`CreateMemoryFactRequest.category`, `statement`) — confirmé immédiatement |
| `PATCH /api/memory/{fact_id}` | Met à jour la déclaration et/ou le drapeau `confirmed` (`UpdateMemoryFactRequest`) |
| `DELETE /api/memory/{fact_id}` | Archive un fait (jamais de suppression définitive) |

## Points de terminaison de paramètres (`src/api/settings.py`)

| Méthode et chemin | Objet |
|---|---|
| `GET /api/settings` | Paramètres LLM actuels : provider, endpoint, deployment, model, `keyConfigured`, `keyHint` masqué et `source` (base de données ou environnement) |
| `POST /api/settings` | Enregistre provider/endpoint/deployment/model ; la clé API n'est enregistrée que si elle n'est pas vide et est chiffrée au repos |
| `POST /api/settings/test/llm` | Valide la configuration pour le provider choisi (`ConnectionTestRequest`, surcharges optionnelles). **Délibérément sans appel réseau** : il vérifie la complétude des champs selon le provider, il n'appelle pas le réseau |

Voir [llm-configuration.md](../operations/llm-configuration.md) pour le
comportement complet, y compris les champs obligatoires spécifiques au provider et
les règles de masquage/chiffrement.

## Points clés des schémas (`src/api/schemas_refinement.py`)

- **Sujet/tour/résumé** — `SubjectModel`, `QuestionItem` (avec des pastilles
  `suggestions`), `QuestionRoundModel`, `SessionSummaryModel`.
- **Livrable** — `RefinementDeliverable` (`summary`, `brief[]`, `plan[]`,
  `codeDraft`, `openQuestions[]`, `decisionReport`) avec la migration
  `DecisionReport` v1->v2 (voir [decision-report.md](../domain/decision-report.md)).
- **Sorties structurées du LLM** — `GenerateQuestionsOutput`,
  `SessionSummaryOutput`, `RefinementDeliverableOutput`, `DetectModeOutput`,
  `ProductMemoryOp(s)Output` ; `ProductMemoryOp.action` est volontairement un
  `str` simple afin qu'une action inconnue soit ignorée par le référentiel au lieu
  de faire échouer l'ensemble du diff.
- **Drapeau `degraded`** — présent sur `StartSessionResponse` et
  `SubmitAnswersResponse` ; il est vrai quand le LLM a échoué et que le mock hors
  ligne a produit le contenu, afin que l'interface puisse afficher une bannière de
  secours.

## Répertoire des contrats (`contracts/`)

Les schémas JSON pour les sorties du LLM (`generate-questions.schema.json`,
`final-refinement.schema.json`, `session-summary.schema.json`) documentent les
formes que les prompts doivent produire. Remarque : `contracts/refinement-api.md`
décrit un **ancien contrat cible centré sur les éléments de travail** (work items
Azure DevOps, pages HTMX) — c'est un artefact historique antérieur à l'API actuelle
basée sur les objectifs et qui ne correspond pas aux routes implémentées.

## Guide des modifications

- **Quand consulter cette page :** ajout/renommage d'un point de terminaison,
  modification d'un schéma ou modification de la sémantique des erreurs.
- **Invariants à préserver :** `StrictModel` avec `extra="forbid"` ; le mapping
  404/400 ; le drapeau `degraded` ; les secrets masqués (jamais bruts) dans les
  réponses ; la convention session-id = thread-id.
- **Surface inter-paquets :** toute modification de schéma backend doit être
  répercutée dans `frontend/src/types/api.ts`, et les modifications des
  consommateurs suivent dans `frontend/src/api/refinement.ts` / `settings.ts`.
- **Tests ciblés :** le contrat HTTP des endpoints produits/mémoire est verrouillé par `tests/test_product_memory_api.py` (création idempotente par nom, `factCount` actifs uniquement, fait manuel confirmé, catégorie inconnue repliée, correction = confirmation, patch vide rejeté, archive vs suppression, cascade produit, 404 uniformes, 400 sur blancs, session sur produit inconnu -> 404) ; la migration et la normalisation de `DecisionReport` sont verrouillées par `tests/test_artifact_renderer.py`. Il n'existe **pas encore** de suite TestClient pour les endpoints de session (`/api/refinement/sessions*`) — leur boucle est couverte au niveau service par `tests/test_product_memory_flow.py`.
- **Validation :** `python -m pytest tests/test_product_memory_api.py tests/test_artifact_renderer.py -q` ; pour un test de fumée manuel, démarrez le serveur et exécutez `POST /api/refinement/sessions` avec `{"objective": "Test subject"}` (provider simulé par défaut).