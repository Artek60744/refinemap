# Comment fonctionne le workflow actuel

RefineMap est une SPA React qui parle à une API FastAPI. L'API orchestre une
**machine à états LangGraph** dont chaque étape appelle un LLM (ou un moteur
offline de secours) et stocke le résultat dans une base PostgreSQL / SQLite.

```
┌────────────────────┐   HTTP/JSON   ┌──────────────────────┐   LangGraph   ┌──────────┐
│  React SPA (nginx) │ ────────────► │  API FastAPI (/api)  │ ─────────────► │  LLM /   │
│  War Room, etc.    │ ◄──────────── │  RefinementService   │ ◄───────────── │  mock    │
└────────────────────┘   JSON validé └──────────┬───────────┘   JSON structuré└──────────┘
                                                │
                                                ▼
                                 ┌────────────────────────────┐
                                 │  DB (SQLAlchemy + SQLite/  │
                                 │  PostgreSQL)                │
                                 └────────────────────────────┘
```

---

## 1. Le parcours utilisateur

1. **Accueil** (`/refinement`) — l'utilisateur tape une idée brute dans le champ.
2. **Choix de la grille** (`/refinement/choose`) — il choisit un cadrage :
   - **PO** (business), **Technique** ou **Hybride**.
   - Cette grille définit les *axes* (Objectif, Cible, Problème, Valeur, … pour la
     grille PO ; Comportement, Intégrations, Données, Risques tech, … pour la
     grille Technique ; un mix pour l'Hybride).
3. **War Room** (`/refinement/sessions/:id`) — écran principal en 3 zones :
   - **Intent Structure** (gauche) : l'arborescence des thèmes/questions par axe,
     avec progression `répondues / total`.
   - **Decision War Room** (centre) : la conversation. L'IA pose une question à la
     fois, l'utilisateur répond (avec des *suggestions* cliquables), et quand
     toutes les questions du tour sont répondues, le tour est soumis.
   - **Deliverable** (droite) : un brouillon de livrable (Brief / Plan / Code
     Draft) qui se met à jour au fil des tours, puis un bouton d'export Markdown.
4. **Résultat** (`/refinement/sessions/:id/result`) et **Historique**
   (`/refinement/history`) — consultation des sessions passées, renommage,
   suppression, re-export.

La page **Settings** (`/settings`) permet de configurer le fournisseur LLM
(mock, Azure AI Foundry / Azure OpenAI, OpenAI, OpenRouter, DeepSeek). Les clés
sont chiffrées dans la base.

---

## 2. Le flux backend, étape par étape

### 2.1 Création de session → `POST /api/refinement/sessions`

1. `RefinementService.start_session` normalise la grille demandée :
   - mode **auto** → l'IA détecte la meilleure grille via le prompt
     `detect-mode.md` (avec repli sur une détection par mots-clés si l'appel
     échoue) ;
   - mode **manuel** → la grille est utilisée telle quelle.
2. La session est créée en base (statut `DRAFT`) avec un snapshot du sujet.
3. Le **premier tour de questions** est généré (voir §3) et la session passe en
   statut `QUESTIONING`.
4. La réponse renvoie à la SPA le premier `questionRound` + un `sessionSummary`.

### 2.2 Soumission des réponses → `POST /api/refinement/sessions/:id/answers`

1. Les réponses sont persistées (table `answers`), le tour courant passe à
   `ANSWERED`, la session à `ANALYZING`.
2. Le service reconstruit l'état complet de la session (questions + réponses
   appariées, faits/hypothèses/inconnues/résumés précédents) et relance le
   graphe LangGraph avec `workflow_action = "answers_submitted"`.
3. Le graphe décide de la suite (voir §3) :
   - **nouveau tour de questions** → persisté, renvoyé à l'UI ;
   - **fin du refinement** → le livrable est persisté (`FINAL_REFINEMENT`),
     la session passe à `FINAL_READY`.

### 2.3 Changement de grille → `POST /api/refinement/sessions/:id/mode`

Recommence le questioning depuis zéro sur la nouvelle grille : les rounds,
réponses et résumés sont purgés (`reset_rounds`), puis un premier tour est
régénéré.

### 2.4 Export → `GET /api/refinement/sessions/:id/export`

Rend le livrable en Markdown (titre, Brief par sections, Plan numéroté, Code
Draft éventuel, questions ouvertes) et le renvoie en téléchargement.

---

## 3. La machine à états LangGraph

Tout le refinement est piloté par un graphe (`src/agents/refinement_workflow/`).
Le `thread_id` LangGraph est aligné sur l'id de session, ce qui permet de
reprendre l'historique d'un tour à l'autre.

```
                    ┌──────────────────────────────┐
                    │  START                       │
                    │  workflow_action = ?         │
                    └──────┬───────────┬───────────┘
                           │           │
               start_session│           │answers_submitted
                           ▼           ▼
                   ┌─────────────┐  ┌──────────────────────┐
                   │generate_   │  │summarize_context     │
                   │questions   │  │(LLM : faits, hypothè-│
                   │(LLM)       │  │ses, inconnues, confi-│
                   └──────┬─────┘  │ance, enoughContext)  │
                          │        └──────┬───────────────┘
                          │               │ route_after_summary
                          │               │ (round >= max_rounds
                          │               │  OU enoughContext + round
                          │               │  >= min_rounds)
                          ▼               ▼
                       END        ┌──────────────────────────┐
                                 │  generate_questions       │──► END
                                 │  (tour suivant)           │
                                 └──────────────────────────┘
                                 ┌──────────────────────────┐
                                 │  generate_final_refinement│──► END
                                 │  (livrable)               │
                                 └──────────────────────────┘
```

Trois nœuds, tous alimentés par le même état (`RefinementState`) :

- **`generate_questions`** — produit le prochain tour de questions. En mode
  auto, après quelques tours (min 2, max 3 par défaut), le graphe stoppe la
  boucle dès que `enoughContext` est atteint.
- **`summarize_context`** — synthétise ce qui est *sûr* (`facts`), ce qui est
  *supposé* (`assumptions`), ce qui reste *flou* (`unknowns`), les
  dépendances, les risques, la confiance (`low/medium/high`) et
  `enoughContext` (peut-on produire le livrable ?).
- **`generate_final_refinement`** — assemble le livrable final (summary, brief,
  plan, code draft, questions ouvertes).

Le routing est gardé volontairement **conservateur** : le LLM a tendance à
déclarer « assez de contexte » trop tôt, donc un minimum de 2 tours est imposé
avant d'autoriser la production du livrable.

---

## 4. Les 4 appels LLM (prompts dans `prompts/`)

Chaque appel renvoie du **JSON strict**, validé par Pydantic
(`src/api/schemas_refinement.py`) et décrit par un JSON Schema
(`contracts/`). Le prompt demande explicitement « un seul objet JSON, sans
prose ni fences de code ».

| Prompt | Rôle | Sortie clé |
|---|---|---|
| `detect-mode.md` | Choisir la grille (mode auto) | `grid` + `reason` |
| `generate-questions.md` | Poser les bonnes questions | `questions[]`, `reasoningSummary`, `potentialRisks`, `missingAreas`, `stopCriteria` |
| `summarize-context.md` | Résumer après réponses | `facts`, `assumptions`, `unknowns`, `dependencies`, `risks`, `confidence`, `enoughContext`, `reason` |
| `generate-final-refinement.md` | Produire le livrable | `summary`, `brief[]`, `plan[]`, `codeDraft`, `openQuestions[]` |

Deux moteurs LLM coexistent :

- **`OpenAICompatibleLLM`** — appelle n'importe quel endpoint compatible
  `chat/completions` (Azure, OpenAI, OpenRouter, DeepSeek…). Il tente une
  correction automatique du JSON (ré-émission par le modèle) avant de rendre
  les armes, et met `degraded = True` quand il bascule en secours.
- **`MockRefinementLLM`** — moteur offline déterministe : il génère des
  questions à partir des axes de la grille et assemble un brief depuis les
  réponses. Il sert de **filet de sécurité** (aucune dépendance externe en dev)
  et de **repli** si l'appel réel échoue. Dans ce cas, l'UI affiche un bandeau
  « moteur de secours » et propose de revalider le tour.

---

## 5. Persistance (SQLAlchemy)

Le modèle de données tourne autour de la session
(`src/models/refinement.py`) :

- `refinement_sessions` — la session (grille, mode, round courant, statut,
  fournisseur LLM, version des prompts).
- `subject_snapshots` — le sujet tel qu'entré à la création.
- `question_rounds` + `questions` — l'historique des tours et des questions.
- `answers` — les réponses (liées à la question, à la session).
- `session_summaries` — un résumé par tour (`facts`, `assumptions`, …).
- `session_artifacts` — journal immuable de tout ce qui est produit
  (`SUBJECT_SNAPSHOT`, `QUESTION_ROUND`, `SESSION_SUMMARY`,
  `FINAL_REFINEMENT`), versionné.

Le statut de la session suit l'avancement : `DRAFT → QUESTIONING → ANALYZING →
FINAL_READY`. En production, PostgreSQL est la source de vérité ; en local,
SQLite fait l'affaire.

---

## 6. Points d'attention actuels

- **Pas d'authentification réelle** : un utilisateur local unique est créé à la
  volée (`local-user@example.com`). Tout le monde partage le même compte.
- **Pas de migrations** : le schéma est créé par `create_all()` au démarrage.
  `docs/sqlalchemy-data-model.md` décrit le modèle relationnel cible.
- **Decision board partiel** : le produit gère aujourd'hui le questioning et le
  livrable ; la couche décisionnelle (scoring impact/effort/risque/confiance,
  vote Go/Explore/Drop, tags) et les exports backlog restent à construire.
- **La langue** des prompts et des messages API suit le cookie `lang`
  (catalogue i18n côté backend dans `src/i18n.py`, côté frontend dans
  `frontend/src/i18n/catalog.ts`).
