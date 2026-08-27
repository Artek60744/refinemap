# RefineMap

RefineMap transforme une idée floue en **décision argumentée** et en **spec markdown**,
en local, dans ton dépôt. Tu arrives avec « il faudrait ajouter des notifications », tu
repars avec un verdict explicite (Go / Explore / Rework / Drop), ses causes racines, ses
blocages, et un fichier prêt à être lu — par toi ou par ton agent de code.

```bash
pipx install git+https://github.com/Artek60744/refinement   # pas encore sur PyPI
refinemap refine "Ajouter un système de notifications"
# → .refinemap/ajouter-un-systeme-de-notifications-20260827-2120.md
```

Ce n'est pas un chat. Le moteur pose des questions par rounds, refuse de conclure trop
tôt, et rend un rapport structuré validé par schéma.

## Pourquoi

Un agent de code part dans le mur sur une spec vague — et ça coûte cher, en tokens comme
en relectures. Le goulot n'est plus d'écrire le code, c'est de savoir quoi écrire.
RefineMap est la couche de cadrage qui précède : il interroge, il challenge, il tranche,
et il dépose le résultat là où l'agent le lira.

## Comment ça marche

1. Tu donnes un objectif en une phrase.
2. Le moteur choisit une **grille de questions** (PO, technique ou hybride) et t'en pose
   une série, avec pour chacune la raison pour laquelle elle est posée.
3. Tes réponses sont résumées en faits, hypothèses, inconnues, dépendances et risques.
4. Tant que le contexte est insuffisant, il relance un round.
5. Il rend un **rapport de décision** : recommandation, confiance, cause racine, blocages
   ordonnés, points déjà solides, prochaine action — plus un brief et un plan.

## Ce qui le distingue d'un bon prompt

- **Un plancher de rounds.** Le LLM déclare « j'ai assez de contexte » beaucoup trop tôt.
  Le routeur (`src/agents/refinement_workflow/graph.py`) impose un minimum de deux rounds
  avant d'autoriser une conclusion.
- **Des grilles par profil.** Les axes interrogés diffèrent selon qu'on cadre un besoin
  produit ou un changement technique (`src/services/question_grids.py`).
- **Une sortie contrainte.** Chaque réponse du LLM est validée par un modèle Pydantic en
  `extra="forbid"` (`src/api/schemas_refinement.py`). Pas de champ inventé, pas de prose
  à la place d'un verdict.
- **Une mémoire produit.** Les contraintes, pivots et objections récurrents sont extraits
  en fin de session, rattachés à un produit et réinjectés dans les suivantes. C'est la
  seule chose qui s'accumule — et ce qu'un prompt ponctuel ne peut pas reproduire.
- **Un repli honnête.** Si le fournisseur échoue, un moteur hors-ligne prend le relais et
  le rapport est marqué comme dégradé, au lieu de servir du contenu de démonstration
  sans le dire.

## Ce que ça ne fait pas

Autant l'écrire ici plutôt que te le laisser découvrir :

- **pas de multi-utilisateur** — un seul utilisateur local, pas de comptes, pas d'équipes ;
- **pas de connecteurs** Jira, Linear ou Notion, et il n'y en aura pas. Le format
  d'intégration est un fichier markdown dans ton dépôt ;
- **pas de scoring** ni de vote ni de board ;
- **pas de service hébergé.**

## Utiliser le CLI

```bash
refinemap refine "<ton objectif>"      # démarrer une session
  --product <nom>                      #   rattacher à un produit (mémoire persistante)
  --grid po|technique|hybride|auto     #   forcer la grille (défaut : détection)
  --rounds N                           #   plafonner le nombre de rounds
  --context "<contexte>"               #   contexte additionnel
  -o <chemin> | --stdout               #   où écrire le rapport

refinemap resume <session-id>          # reprendre une session interrompue
refinemap list                         # lister les sessions
refinemap export <session-id>          # réexporter un rapport
refinemap memory [--product <nom>]     # inspecter la mémoire produit
refinemap config                       # vérifier la configuration effective
```

Piper directement vers un agent :

```bash
refinemap refine "Migrer la base vers Postgres" --stdout > SPEC.md
```

Les sessions et la mémoire produit vivent dans `~/.refinemap/` (surchargeable par
`REFINEMAP_HOME`), donc partagées entre tous tes dépôts. Les rapports, eux, sont écrits
dans le répertoire courant.

## Configurer un fournisseur LLM

Par défaut, `LLM_PROVIDER=mock` : tout tourne hors ligne avec un moteur de démonstration,
sans clé. Utile pour essayer l'outil, inutilisable pour du vrai travail.

Configure un vrai fournisseur dans `~/.refinemap/.env` :

```bash
LLM_PROVIDER=openai       # openai | deepseek | openrouter | azure-openai | azure-foundry | ollama
LLM_MODEL=gpt-4.1-mini
LLM_API_KEY=sk-...
```

### En local, sans rien envoyer à un tiers

C'est la raison d'être du support Ollama : tes specs ne quittent pas ta machine.

```bash
ollama serve
ollama pull qwen3
```

```bash
# ~/.refinemap/.env
LLM_PROVIDER=ollama
LLM_MODEL=qwen3
# LLM_ENDPOINT=http://autre-machine:11434/v1   # si Ollama tourne ailleurs
```

Aucune clé d'API n'est requise ni demandée pour un fournisseur local.

## L'interface web (optionnelle)

Une SPA React couvre le même moteur, avec l'historique des sessions et l'édition de la
mémoire produit. Elle est optionnelle : le CLI est le chemin principal.

```bash
pip install -e ".[server]"
uvicorn src.main:app --reload --port 8000
cd frontend && npm install && npm run dev   # http://localhost:5173
```

- `frontend/` — SPA React 18 + TypeScript + Vite + Tailwind
- `src/` — moteur de refinement LangGraph, persistance SQLAlchemy, fournisseurs LLM
  pluggables, et l'API JSON qui les expose

## Domaine

- **session** — un cadrage complet, du sujet au rapport (`RefinementSession`)
- **subject** — l'énoncé normalisé, figé à l'ouverture (`SubjectSnapshot`)
- **question round** — un tour de questions et ses réponses (`QuestionRound`, `Question`)
- **summary** — faits, hypothèses, inconnues, dépendances, risques d'un round
- **deliverable** — le rapport final : décision, brief, plan
- **product** / **memory fact** — ce qui survit d'une session à l'autre

Voir `src/models/refinement.py` et `src/models/product_memory.py`.

## Architecture

- La SPA React ne parle qu'à l'API JSON (`/api/refinement/*`, `/api/settings/*`) ;
  elle n'appelle jamais un LLM directement.
- Le backend FastAPI possède l'orchestration, la persistance et les credentials.
- La boucle de refinement est une **machine à états LangGraph**, pas un chat libre.
- Chaque étape LLM renvoie du JSON structuré validé par Pydantic et JSON Schema.
- `thread_id` aligne les checkpoints LangGraph avec la session applicative ; la base
  (SQLite en local, PostgreSQL si configurée) reste la source de vérité.
- En production, un conteneur nginx sert la SPA buildée et reverse-proxy `/api` et
  `/health` vers le backend — même origine, donc pas de CORS.
- i18n : le catalogue UI (fr/en) vit dans `frontend/src/i18n/catalog.ts` ; le backend
  garde son propre catalogue (`src/i18n.py`) pour les messages d'API, les erreurs
  fournisseur, le contenu LLM mocké et la langue des prompts. Les deux lisent le même
  cookie `lang`.

## Stack

- Frontend : `React 18`, `TypeScript`, `Vite`, `react-router`, `Tailwind CSS v4`
- Backend : `FastAPI`, `LangGraph`, `Pydantic v2`, `SQLAlchemy 2.x`
- Base de données : `SQLite` par défaut, `PostgreSQL` pour un déploiement serveur
- Fournisseur LLM : pluggable (mock par défaut ; Ollama, OpenAI, DeepSeek,
  OpenRouter, Azure OpenAI et Azure AI Foundry)
- CLI : bibliothèque standard uniquement (`argparse`, `textwrap`)

## Développer

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pip install -e ".[server]"
pytest
```

Pour le frontend, le serveur de dev Vite proxifie `/api` et `/health` vers le backend,
donc tout reste en même origine :

```bash
uvicorn src.main:app --reload --port 8000   # terminal 1
cd frontend && npm install && npm run dev   # terminal 2 → http://localhost:5173
```

Le mode par défaut (`LLM_PROVIDER=mock`) fait tourner le flux complet sans dépendance
externe ni clé d'API — c'est aussi ce que fait la suite de tests.

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les conventions et le périmètre accepté.

## Lancer avec Docker

```bash
docker compose up --build
```

Ouvrir <http://localhost/> — nginx sert la SPA et proxifie l'API.

## Héberger sa propre instance (optionnel)

RefineMap est conçu pour tourner en local. Il n'y a **pas d'instance publique** : le
produit n'est pas un service hébergé, et l'application n'a aucune authentification — ne
l'expose pas sur une IP publique sans restriction d'accès devant.

`./deploy.sh` reste fourni pour qui veut héberger la sienne sur une VM Azure. Le script
ne contient aucun identifiant : copier `deploy.env.example` vers `deploy.env` (non
tracké) et le remplir.

```bash
cp deploy.env.example deploy.env   # puis renseigner les variables AZ_*
./deploy.sh sync                   # déployer / mettre à jour
./deploy.sh logs                   # voir ce qui s'est passé
```

Voir `openwiki/operations/deployment.md` pour le guide complet.

## Documentation temps réel (OpenWiki)

Le repo embarque [OpenWiki](https://github.com/langchain-ai/openwiki), un CLI qui
génère et maintient un wiki Markdown de la codebase dans `openwiki/` — **en
français** — visualisable sous forme de **graphe de connaissances** interactif.
La doc se met à jour automatiquement à chaque changement de code.

```bash
npm install            # une fois : installe le CLI (devDependency)
npm run docs:init      # première génération interactive (provider / clé / modèle)
npm run docs:update    # régénérer la doc (one-shot, non interactif, en français)
npm run docs:watch     # temps réel : surveille src/, frontend/src/
                       # et met à jour la doc à chaque changement (debounce 8 s)
npm run docs:visualize # graphe de connaissances interactif (127.0.0.1:4321)
```

- Le wiki vit dans `openwiki/` et est commité avec le code.
- OpenWiki maintient `AGENTS.md` et `CLAUDE.md` (bloc `OPENWIKI:START/END`) pour
  pointer les agents vers le wiki.
- Le périmètre lu par la doc est contrôlé par `.openwikiignore`.
- La CI GitHub Actions (`openwiki-docs.yml`) régénère la doc à chaque push sur
  `dev`. En local, `npm run docs:watch` reste dispo en opt-in pour les branches
  de feature.

### Configurer DeepSeek

Config locale persistée dans `~/.openwiki/.env` :

```
OPENWIKI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com/v1
OPENAI_COMPATIBLE_API_KEY=sk-...
OPENWIKI_MODEL_ID=deepseek-v4-flash
```

Ou passer ces variables en environnement à chaque `npm run docs:*` — pratique pour
reprendre `DEEPSEEK_API_KEY` et `DEEPSEEK_MODEL` depuis le `.env` du repo.

## Feuille de route

Ce qui est envisagé, dans l'ordre :

1. Enrichir la mémoire produit : confirmation assistée des faits, détection des
   contradictions entre sessions.
2. Remplacer le bootstrap `create_all()` par de vraies migrations Alembic.
3. Grilles de questions personnalisables par l'utilisateur.
4. Publication sur PyPI.

Ce qui n'y figurera pas : authentification, multi-tenant, connecteurs de delivery.
Voir « Ce que ça ne fait pas » plus haut — c'est une décision de périmètre, pas un
manque de temps.

## Licence

MIT — voir [LICENSE](LICENSE). Les contributions sont bienvenues, voir
[CONTRIBUTING.md](CONTRIBUTING.md).
