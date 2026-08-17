---
type: Architecture
title: RefineMap — Vue d'ensemble de l'architecture système
description: Architecture de haut niveau de RefineMap, le tableau de décision pour les équipes produit et tech — SPA React, backend FastAPI, moteur de raffinement LangGraph, persistance SQLAlchemy/PostgreSQL, fournisseurs de LLM interchangeables et flux de requête à travers une session.
tags: [architecture, overview, fastapi, react, langgraph]
openwiki:
  roles: [architecture]
  change_kinds: [runtime]
  source_paths: [src/main.py, src/config/settings.py, src/database.py, src/i18n.py]
  symbols: [app, LanguageMiddleware, lifespan, settings, init_db, get_db, resolve_language]
  invariants: ["The SPA never calls an LLM directly; all AI work goes through /api. The backend owns orchestration, persistence and credentials. The lang cookie drives both the UI catalog and the backend/prompt language. thread_id aligns LangGraph checkpoints with the session entity while PostgreSQL stays the source of truth."]
  validation_commands: [python -m pytest tests/ -q]
---

# RefineMap — Vue d'ensemble de l'architecture système

RefineMap est un tableau de décision pour les équipes produit et tech : il transforme un brainstorming flou en une décision explicite et priorisée (Go / Explore / Rework / Drop) et en un livrable exploitable (Brief / Plan / Code Draft) en une seule session. La règle produit — « l'IA pose des questions et aide à converger ; la décision reste celle de l'équipe » — est appliquée structurellement par le moteur, pas seulement par les invites.

## Contexte système

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart LR
    U["Team"] --> FE["React SPA<br>nginx / Vite"]
    FE -->|"/api JSON"| API["FastAPI backend"]
    API --> LG["LangGraph workflow"]
    LG --> LLM["LLM provider<br>mock or OpenAI-compatible"]
    API --> DB[("PostgreSQL / SQLite")]
    LLM -->|"structured JSON"| LG
```

La SPA ne communique avec l'API qu'en JSON (`/api/refinement/*`, `/api/products*`, `/api/memory*`, `/api/settings`, `/health`) ; elle ne détient jamais d'identifiants LLM et n'effectue aucun appel IA. Le backend détient l'orchestration, la persistance et les secrets. En production, nginx sert la SPA compilée et fait office de reverse proxy pour l'API sur la même origine, donc pas de CORS (voir [operations/deployment.md](../operations/deployment.md)).

## Flux de requête lors d'une session

```mermaid
sequenceDiagram
    participant SPA as React SPA
    participant API as FastAPI (RefinementService)
    participant G as LangGraph
    participant LLM as LLM / mock
    participant DB as PostgreSQL / SQLite

    SPA->>API: POST /api/refinement/sessions (objective, mode)
    API->>DB: create session (DRAFT) + snapshot + memory facts
    API->>G: ainvoke start_session (thread_id = session id)
    G->>LLM: generate_questions (grid axes + memory)
    LLM-->>G: strict JSON, validated by Pydantic
    G-->>API: round 1 + derived round-0 summary
    API->>DB: persist question round + summary (QUESTIONING)
    API-->>SPA: questionRound + sessionSummary + productMemory

    loop rounds 1..maxRounds
        SPA->>API: POST /answers
        API->>DB: upsert answers (ANALYZING)
        API->>G: ainvoke answers_submitted
        G->>LLM: summarize_context
        LLM-->>G: facts / unknowns / confidence / enoughContext
        G-->>API: next round or final deliverable
        API->>DB: persist summary; round (QUESTIONING) or artifact (FINAL_READY)
        API-->>SPA: questionRound or deliverable + decision
    end

    SPA->>API: GET /export
    API-->>SPA: Markdown deliverable (Decision + Brief + Plan)
```

## Composants et leur emplacement

| Composant | Emplacement | Responsabilité |
|---|---|---|
| Point d'entrée API | `src/main.py` | Application FastAPI, `lifespan` exécute `init_db()`, `LanguageMiddleware` ASGI brut définit la ContextVar de langue par requête, `/health` renvoie le statut du fournisseur |
| Paramètres | `src/config/settings.py` | Configuration d'environnement Pydantic-settings : URL de base de données, fournisseur/clés LLM, limites de raffinement (`refinement_max_rounds=3`, `min_rounds=2`, `max_questions_per_round=6`), `app_root`/`prompts_dir` |
| Base de données | `src/database.py` | Moteur/session SQLAlchemy, dépendance `get_db`, `init_db` (create_all + migration ascendante écrite à la main + seed d'utilisateur par défaut) |
| Moteur de raffinement | `src/agents/refinement_workflow/` | Machine à états LangGraph — voir [refinement-engine.md](refinement-engine.md) |
| Services | `src/services/` | `refinement_service` (orchestration), `refinement_llm` (moteurs), `settings_service`, `product_memory_service`, `question_grids`, `product_memory_rules`, `artifact_renderer`, `prompt_loader` |
| Dépôts | `src/repositories/` | Accès aux données SQLAlchemy pour les sessions, la mémoire produit et les paramètres |
| Modèles | `src/models/` | Entités ORM — voir [data-model.md](../domain/data-model.md) |
| Routeurs API | `src/api/` | `/api/refinement`, `/api/products`, `/api/memory`, `/api/settings` — voir [refinement-api.md](../api/refinement-api.md) |
| Frontend | `frontend/src/` | SPA React — voir [frontend/overview.md](../frontend/overview.md) |
| Invites | `prompts/` | Six invites Markdown, versionnées par session (`prompt_version`) |
| Contrats | `contracts/` | Schémas JSON pour les sorties LLM + un document de contrat API historique |

## Aspects transverses

- **Langue / i18n** — le cookie `lang` est l'interrupteur unique : le catalogue frontend (`frontend/src/i18n/catalog.ts`) et le catalogue backend (`src/i18n.py`, uniquement les espaces de noms `api.*`) le lisent tous deux ; le middleware le sélectionne une fois par requête (ASGI brut volontairement — `BaseHTTPMiddleware` exécute l'endpoint dans une tâche séparée et rend la propagation de ContextVar fragile), et la langue des invites est résolue à partir de la même ContextVar afin que les chaînes LLM visibles par l'utilisateur suivent l'interface.
- **Alignement d'état** — `thread_id` de LangGraph = identifiant de session maintient les points de contrôle alignés sur l'entité métier, tandis que PostgreSQL reste la source de vérité ; le graphe est reconstruit à chaque requête à partir des données du dépôt (`_build_state_from_session`).
- **Dégradation** — toute défaillance réelle du LLM se dégrade vers le mock hors ligne déterministe avec `degraded: true` remonté à l'interface, jamais une 500.
- **Posture de sécurité** — pas d'authentification (un seul utilisateur local initialisé), secrets chiffrés au repos, pas encore de HTTPS ; voir [operations/deployment.md](../operations/deployment.md) pour la liste complète.

## Guide des modifications

- **Quand consulter cette page :** comprendre comment une modification se répercute dans tout le système avant de toucher au code ; ajout de middleware, de hooks de cycle de vie ou de nouveaux routeurs.
- **Points d'entrée pour une modification backend :** enregistrer le routeur dans `src/main.py` ; ajouter la route dans `src/api/`, la logique dans `src/services/`, l'accès aux données dans `src/repositories/`, le schéma dans `src/api/schemas_*.py`, et refléter les types consommateur dans `frontend/src/types/api.ts`.
- **Validation :** `python -m pytest tests/ -q` pour les tests unitaires backend, puis un flux manuel avec le fournisseur mock (`uvicorn src.main:app --reload --port 8000`) ; les modifications frontend uniquement se valident avec `cd frontend && npm run build`.