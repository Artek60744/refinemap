---
type: Tests
title: Suites de tests et commandes de validation
description: Les tests automatisés actuels de RefineMap — règles de routage, verdicts du rapport de décision, rendu des artefacts Markdown, règles et API de mémoire produit, boucle de flux session → mémoire — les fixtures de test partagées, les commandes de validation silencieuses par domaine et les domaines sans couverture pour l'instant.
tags: [testing, pytest, validation]
openwiki:
  roles: [testing]
  change_kinds: [testing]
  source_paths: [tests/conftest.py, tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py, tests/test_product_memory.py, tests/test_product_memory_api.py, tests/test_product_memory_flow.py]
  symbols: [route_after_summary, MockRefinementLLM, render_deliverable_markdown, DecisionReport, is_durable_statement, classify_memory_category, apply_ops, RefinementService]
  test_paths: [tests/conftest.py, tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py, tests/test_product_memory.py, tests/test_product_memory_api.py, tests/test_product_memory_flow.py]
  validation_commands: [python -m pytest tests/ -q]
---

# Suites de tests et commandes de validation

La suite de tests est centrée sur les surfaces déterministes du moteur et sur la frontière service/dépôt de la mémoire produit. Les tests sont volontairement hors ligne : aucune clé LLM ni aucun Postgres requis, grâce aux fixtures partagées de `tests/conftest.py`. Le reste est validé par la vérification de types / la compilation et par des tests de fumée manuels.

## Fixtures partagées (`tests/conftest.py`)

Trois fixtures rendent les tests de service/dépôt/API possibles sans environnement externe :

- **`db`** — une base SQLite **en mémoire** (pas un fichier) créée par `Base.metadata.create_all`, isolée par test. `StaticPool` + `check_same_thread: False` maintiennent une connexion unique à travers les threads, ce dont `TestClient` a besoin (l'application tourne dans un thread de travail).
- **`client`** — un `TestClient` FastAPI attaché à cette base via `app.dependency_overrides[get_db]`. Il est instancié **sans** le gestionnaire de contexte, volontairement : cela saute le `lifespan`, donc `init_db()` ne s'exécute jamais contre la vraie `DATABASE_URL` et le `refinement.db` du développeur n'est jamais touché par une exécution de tests.
- **`offline_llm`** — force le moteur déterministe en remplaçant `build_refinement_llm` par un `MockRefinementLLM()` : sans elle, le service lirait le fournisseur depuis `.env` (qui pointe vers un vrai endpoint avec une vraie clé) et les tests toucheraient le réseau.

`requirements-dev.txt` ajoute `pytest-asyncio>=0.23` pour les tests asynchrones (`@pytest.mark.asyncio`).

## Suites

### `tests/test_routing.py` — règles de routage du graphe

Verrouille les cinq branches de `route_after_summary` (la décision LangGraph entre « prochain tour de questions » et « raffinement final » — voir [refinement-engine.md](architecture/refinement-engine.md)) :

- un tour en dessous de `min_rounds` continue le questionnement **même avec enoughContext** ;
- `enoughContext` à `min_rounds` finalise ;
- un contexte insuffisant continue le questionnement ;
- `max_rounds` force la finalisation quel que soit le contexte ;
- `min_rounds` plafonné à `max_rounds`.

Commande : `python -m pytest tests/test_routing.py -q`

### `tests/test_mock_decision.py` — sémantique des verdicts

Verrouille l’arbitrage déterministe dans `MockRefinementLLM._build_decision_report` (voir [decision-report.md](domain/decision-report.md)) :

- aucun fait + >= 3 inconnues -> **drop / high** avec exactement 2 bloqueurs, cause racine = blocker[0] = cible de nextAction, force de repli issue de la grille ;
- aucun inconnu + confiance élevée + <= 1 risque -> **go / high**, aucun bloqueur ;
- risques >= 3 ou risques > faits -> **rework / medium** ;
- sinon -> **explore / medium** avec 2..4 raisons, <= 2 bloqueurs.

Commande : `python -m pytest tests/test_mock_decision.py -q`

### `tests/test_artifact_renderer.py` — export Markdown

Verrouille `render_deliverable_markdown` (section de décision avant le Brief ; singulier/pluriel du go conditionnel ; répartition cause racine / causes secondaires ; sous-listes vides ignorées ; livrable hérité sans `decisionReport` ; migration du payload `DecisionReport` de v1 vers v2 ; normalisation de la casse des valeurs de recommandation et de confiance).

Commande : `python -m pytest tests/test_artifact_renderer.py -q`

### `tests/test_product_memory.py` — règles, extraction et opérations mémoire

Verrouille la couche hors ligne de la mémoire produit (voir [product-memory.md](domain/product-memory.md)) :

- **règle de durabilité** — les énoncés datés (deadline, « ce trimestre », dates) ne sont pas durables ; les énoncés structurels (stack, équipe) le sont ; les paragraphes de plus de 220 caractères et les chaînes blanches sont rejetés ;
- **classification** — chaque groupe de mots-clés mappe la catégorie attendue (`stack`, `equipe`, `contrainte`, `utilisateur`, `decision`), avec repli sur `produit` ;
- **extraction mock** — ne promeut que les faits durables, ignore les faits déjà mémorisés (insensibles à la casse), ignore les réponses « Je ne sais pas encore » / « À confirmer », et n'émet jamais `update` ni `remove` ;
- **`apply_ops`** — add crée avec `source_session_id` et `confirmed=False` ; update réécrit ; remove archive au lieu de supprimer ; les doublons insensibles à la casse, les ids étrangers (autre produit), les ids inexistants, les verbes inconnus et les déclarations blanches sont ignorés sans erreur ;
- **plafond** — `list_active_facts` renvoie au plus `MEMORY_FACT_LIMIT` (40) faits, les faits archivés ne sont jamais injectés ;
- **injection et routage** — `_base_context` propage `product_memory` (et produit un contexte valide sans produit) ; `route_after_final` saute le nœud d'extraction sans `product_id` ;
- **dégradation** — une extraction LLM qui échoue bascule sur le moteur hors ligne avec `degraded=True` ; une entrée `ops` malformée ne fait pas échouer tout le diff (c'est pourquoi `ProductMemoryOp.action` est un `str` simple).

Commande : `python -m pytest tests/test_product_memory.py -q`

### `tests/test_product_memory_api.py` — contrat des endpoints produits/mémoire

Verrouille la surface HTTP que la SPA consomme (`GET/POST/DELETE /api/products*`, `PATCH/DELETE /api/memory*`, voir [refinement-api.md](api/refinement-api.md)) :

- liste vide au départ ; création de produit **idempotente sur le nom** (« Geofolia » et « geofolia » = même id) ;
- `factCount` ne compte que les faits actifs ; un fait manuel est `confirmed=True` et catégorisé ;
- une catégorie inconnue retombe sur `produit` au lieu d'échouer ;
- corriger une déclaration **confirme** le fait ; confirmer sans éditer préserve la déclaration ; un patch vide est rejeté (400) ;
- supprimer un fait l'archive (toujours traçable) ; supprimer un produit emporte ses faits (cascade) ;
- ids inconnus -> 404 uniforme (produits et faits) ; noms/déclarations blancs -> 400 ;
- démarrer une session sur un `productId` inconnu -> **404**, pas 500.

Commande : `python -m pytest tests/test_product_memory_api.py -q`

### `tests/test_product_memory_flow.py` — la boucle session → mémoire → session suivante

Verrouille la boucle de bout en bout qui justifie la fonctionnalité (via `RefinementService`, voir [refinement-engine.md](architecture/refinement-engine.md)) :

- une session finalisée sur un produit laisse les faits durables derrière elle (les faits datés restent liés à la session, pas au produit) ; chaque fait mémorisé pointe vers `source_session_id` ;
- la **session suivante** sur le même produit démarre avec exactement ces faits injectés, ids compris (la bannière en a besoin pour corriger en place) ;
- la mémoire est injectée dans le contexte de prompt sous `state["product_memory"]` avec `{id, category, statement}` ;
- une session sans produit ne touche jamais la mémoire ;
- rejouer une session produit ne duplique pas les faits ;
- un `productId` inconnu est rejeté (`KeyError` au niveau service).

Commande : `python -m pytest tests/test_product_memory_flow.py -q`

## Commandes de validation

| Domaine | Commande | Notes |
|---|---|---|
| Tous les tests unitaires backend | `python -m pytest tests/ -q` | Silencieux ; affichage complet des échecs. Nécessite `pip install -r requirements-dev.txt` (`pytest-asyncio` pour les tests async). |
| Routage du moteur uniquement | `python -m pytest tests/test_routing.py -q` | Signal le plus rapide pour les modifications du graphe. |
| Verdict + export | `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q` | Les deux surfaces du rapport de décision. |
| Règles et opérations mémoire | `python -m pytest tests/test_product_memory.py -q` | Durabilité, classification, extraction, `apply_ops`, plafond, dégradation. |
| Contrat API produits/mémoire | `python -m pytest tests/test_product_memory_api.py -q` | Utilise les fixtures `db`/`client`/`offline_llm`. |
| Boucle de flux mémoire | `python -m pytest tests/test_product_memory_flow.py -q` | Service de bout en bout ; le plus lent des tests ciblés. |
| Vérification de types + build frontend | `cd frontend && npm run build` | Exécute `tsc --noEmit` puis `vite build` ; c’est la seule validation frontend (aucune suite de tests). |
| Test de fumée backend | `uvicorn src.main:app --reload --port 8000` puis `curl localhost:8000/health` | Vérifie `init_db` et le routage ; avec la valeur par défaut `LLM_PROVIDER=mock`, tout le flux s’exécute hors ligne. |
| Pile locale complète | `docker compose up --build` | Coûteux ; uniquement lorsque la question porte sur le comportement des conteneurs (nginx, délais d’attente du proxy, Postgres). |

## Lacunes de couverture (candidats à de futurs tests)

- **Pas de test HTTP des endpoints de session** — le contrat de `/api/refinement/sessions*` (création, soumission, détail, mode, export) n'est pas verrouillé au niveau TestClient ; seuls les endpoints produits/mémoire le sont. La boucle de session est couverte au niveau service par `test_product_memory_flow.py`.
- **Pas de test des transitions de session hors mémoire** — la réinitialisation de grille (`reset_rounds`), l'upsert des réponses, la suppression en cascade et les statuts DRAFT → QUESTIONING → ANALYZING → FINAL_READY ne sont pas testés directement.
- **Aucun test frontend** — le rendu des composants, le repli de l’i18n et la logique d’ordonnancement de la War Room (`openRoundOrder`, `themeKey`) ne sont pas testés.
- **Aucun test des paramètres LLM ni des grilles** — `SettingsService`/`SettingsRepository` et `question_grids` (`detect_grid_by_keywords`, `resolve_grid`) restent non couverts ; un petit `tests/test_question_grids.py` serait naturel.

## Conseils de modification

Lorsqu’une modification touche le routage du graphe, les règles de verdict, l’export Markdown, les règles de mémoire produit, le contrat API produits/mémoire ou la boucle de flux, la suite correspondante ci-dessus est la vérification la plus ciblée et doit être étendue dans la même modification.

Pour les modifications de service/dépôt/API de session, ajoutez des tests à la frontière du service en réutilisant les fixtures de `conftest.py` (`db`, `client`, `offline_llm`) — elles fournissent déjà la base SQLite en mémoire isolée et le moteur mock forcé ; n’exigez ni Postgres ni un LLM réel dans les tests unitaires. Ne créez jamais de base de données sur disque dans un test : la fixture `db` est en mémoire, et `init_db` n'est pas censé tourner pendant les tests (la fixture `client` saute le lifespan à dessein).
