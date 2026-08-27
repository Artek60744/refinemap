# RefineMap — le decision board des équipes produit & tech

RefineMap transforme un brainstorm d'équipe flou en **décision priorisée** et en
**livrable exploitable**, dans une seule session — sans repasser par Miro, Notion et
Jira séparément.

> Ce n'est pas « un outil de brainstorming IA de plus » : c'est un **decision board**.
> On y arrive avec une idée brute, on en repart avec un arbitrage explicite (Go /
> Explore / Drop) et un artefact prêt à l'emploi (brief, backlog, note de cadrage).

- `frontend/` — SPA React 18 + TypeScript + Vite + Tailwind, servie par nginx en
  production
- `src/` — backend FastAPI : API JSON, moteur de refinement LangGraph, persistance
  SQLAlchemy, fournisseurs LLM pluggables

## Pour qui

- **Cible principale** : PM, Product Owner ou Tech Lead dans une équipe produit-tech
  de 3 à 10 personnes — celles qui souffrent le plus du passage brouillon entre idées,
  arbitrage et delivery.
- **Wedge initial** : le founder solo qui veut « raffiner une idée SaaS en MVP clair ».
  Cas d'usage simple à comprendre, qui sert de porte d'entrée avant les mécaniques
  d'équipe.

## Boucle de valeur

L'utilisateur ne dessine pas des branches, il fait avancer une décision :

1. **Capturer** une idée racine dans un board.
2. **Challenger** l'idée sous plusieurs angles grâce à l'IA (problème, cible, valeur,
   risque, dépendances, métriques).
3. **Scorer** les options sur impact / effort / risque / confiance.
4. **Exporter** un livrable actionnable : brief produit, backlog initial, note de
   cadrage.

Le critère de réussite : **une équipe part d'une idée brute et produit décision +
artefact dans une seule session, sans revenir à son ancien enchaînement d'outils.**

## Ce qui nous différencie

- **Détection des flous** : l'outil repère les zones vagues, les mots trop larges, les
  hypothèses non testées et les contradictions, puis pose les bonnes questions.
- **Refinement multi-perspective** : un même sujet est challengé sous plusieurs angles
  (technique, business, utilisateur, risque, faisabilité, originalité).
- **Compression progressive** : partir d'un nuage d'idées, converger vers 3 options
  solides, puis 1 recommandation justifiée.
- **Mode débat** : une voix « critique » attaque les angles morts, une voix « builder »
  propose des pistes concrètes, une voix « chercheur » apporte du contexte.
- **Score vivant par nœud** : clarté, impact, effort, risque, confiance — visibles et
  mis à jour au fil du refinement.
- **Sorties actionnables** : brief, problématique, roadmap, backlog, plan de recherche,
  outline, pitch.

Le cœur du produit — et son moat — n'est pas l'UI, mais le **moteur de refinement
agentique** (LangGraph) et la mémoire produit : contraintes, pivots et objections
récurrentes conservés d'une session à l'autre.

## Règle produit

L'IA ne doit pas « tout écrire à la place de l'équipe ». Elle pose les bonnes
questions, propose des angles et aide à converger. La décision reste celle de l'équipe.

## Architecture

- La SPA React ne parle qu'à l'API JSON (`/api/refinement/*`, `/api/settings/*`) ;
  elle n'appelle jamais un LLM directement.
- Le backend FastAPI possède l'orchestration, la persistance et les credentials.
- La boucle de refinement est une **machine à états LangGraph**, pas un chat libre.
- Chaque étape LLM renvoie du JSON structuré validé par Pydantic et JSON Schema.
- `thread_id` aligne les checkpoints LangGraph avec les entités applicatives
  (board / nœud) ; PostgreSQL reste la source de vérité.
- En production, un conteneur nginx sert la SPA buildée et reverse-proxy `/api` et
  `/health` vers le backend — même origine, donc pas de CORS.
- i18n : le catalogue UI (fr/en) vit dans `frontend/src/i18n/catalog.ts` ; le backend
  garde son propre catalogue (`src/i18n.py`) pour les messages d'API, les erreurs
  fournisseur, le contenu LLM mocké et la langue des prompts. Les deux lisent le même
  cookie `lang`.

## Stack

- Frontend : `React 18`, `TypeScript`, `Vite`, `react-router`, `Tailwind CSS v4`
- Backend : `FastAPI`, `LangGraph`, `Pydantic v2`, `SQLAlchemy 2.x`
- Base de données : `PostgreSQL` (repli SQLite pour les runs locaux)
- Fournisseur LLM : pluggable (mock par défaut ; Azure AI Foundry / Azure OpenAI /
  OpenAI / OpenRouter configurables depuis la page settings)

Le socle FastAPI + LangGraph + SQLAlchemy est conservé volontairement : le moteur de
refinement agentique est précisément la valeur différenciante du produit.

## Domaine

Les entités du produit tournent autour du board de décision :

- **workspace** — l'espace d'une équipe
- **board** — un atelier de refinement
- **node** — une idée (racine ou dérivée), organisée en arborescence
- **refinement** — une itération IA sur un nœud (axes, questions, critiques)
- **score** — impact / effort / risque / confiance sur un nœud
- **export** — un livrable généré (brief, backlog, note de cadrage)

Voir `openwiki/domain/data-model.md` pour le modèle relationnel cible.

## Lancer en local (dev)

Backend (terminal 1) :

```bash
pip install -r requirements.txt
# sans PostgreSQL local :
# DATABASE_URL=sqlite:///./refinement.db
uvicorn src.main:app --reload --port 8000
```

Frontend (terminal 2) :

```bash
cd frontend
npm install
npm run dev
```

Ouvrir <http://localhost:5173>. Le serveur de dev Vite proxifie `/api` et `/health`
vers le backend, donc tout reste en même origine.

Le mode par défaut (`LLM_PROVIDER=mock`) fait tourner le flux complet en local sans
dépendance externe.

## Lancer avec Docker

```bash
docker compose up --build
```

Ouvrir <http://localhost/> — nginx sert la SPA et proxifie l'API.

## Déployer et mettre à jour

L'application est déployée sur une VM Azure et mise à jour avec `./deploy.sh` :

```bash
./deploy.sh dev      # une fois : activer le hot reload Python sur la VM
./deploy.sh sync     # après chaque changement (rebuild l'image web si besoin)
./deploy.sh logs     # voir ce qui s'est passé
```

En ligne sur <http://203.0.113.10/>.
Voir `openwiki/operations/deployment.md` pour le guide complet, y compris le contrôle des coûts et
les limites de sécurité actuelles.

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

## Critères de succès MVP

- une équipe crée un board et une idée racine en moins de 2 minutes
- le moteur de refinement génère des axes et des questions utiles, non redondantes
- l'équipe peut scorer les options et trancher (Go / Explore / Drop) sans quitter le
  produit
- la session produit un livrable exportable (brief Markdown, backlog CSV/JSON, note de
  cadrage)
- **validation clé** : une équipe part d'une idée brute et obtient décision + artefact
  dans une seule session, sans repasser par son outil précédent pour le travail
  principal

## Prochains incréments techniques

1. remplacer le LLM mock par un vrai client fournisseur
2. faire converger le modèle de données actuel vers le domaine board (voir
   `openwiki/domain/data-model.md`)
3. remplacer le bootstrap `create_all()` par des migrations Alembic
4. ajouter l'authentification (magic link / Google) et l'appartenance workspace
5. ajouter la couche décisionnelle (scoring, vote, tags) et les exports

## Intégrations futures (post-MVP)

Les connecteurs de delivery — Jira, Linear, Azure DevOps — sont des intégrations P2 :
utiles pour pousser un backlog validé vers l'exécution, mais pas nécessaires pour
tester la valeur centrale. Un export propre (Markdown / CSV / JSON) suffit d'abord.
