---
type: Tests
title: Suites de tests et commandes de validation
description: Les tests automatisés actuels de RefineMap — règles de routage, verdicts du rapport de décision, rendu des artefacts Markdown — ainsi que les commandes de validation silencieuses par domaine et les domaines sans couverture de test pour l’instant.
tags: [testing, pytest, validation]
openwiki:
  roles: [testing]
  change_kinds: [testing]
  source_paths: [tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  symbols: [route_after_summary, MockRefinementLLM, render_deliverable_markdown, DecisionReport]
  test_paths: [tests/test_routing.py, tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  validation_commands: [python -m pytest tests/ -q]
---

# Suites de tests et commandes de validation

La suite de tests automatisée est volontairement réduite et centrée sur les surfaces déterministes du moteur. Tout le reste est validé par la vérification de types / la compilation et par des tests de fumée manuels.

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

Verrouille l’arbitrage déterministe dans `MockRefinementLLM._build_decision_report`
<!-- openwiki: broken internal link [../domain/decision-report.md] file "../domain/decision-report.md" does not exist. Fix the href or restore the target, then delete this comment. -->
(voir [decision-report.md](../domain/decision-report.md)) :

- aucun fait + >= 3 inconnues -> **drop / high** avec exactement 2 bloqueurs, cause racine = blocker[0] = cible de nextAction, force de repli issue de la grille ;
- aucun inconnu + confiance élevée + <= 1 risque -> **go / high**, aucun bloqueur ;
- risques >= 3 ou risques > faits -> **rework / medium** ;
- sinon -> **explore / medium** avec 2..4 raisons, <= 2 bloqueurs.

Commande : `python -m pytest tests/test_mock_decision.py -q`

### `tests/test_artifact_renderer.py` — export Markdown

Verrouille `render_deliverable_markdown` (section de décision avant le Brief ; singulier/pluriel du go conditionnel ; répartition cause racine / causes secondaires ; sous-listes vides ignorées ; livrable hérité sans `decisionReport` ; migration du payload `DecisionReport` de v1 vers v2 ; normalisation de la casse des valeurs de recommandation et de confiance).

Commande : `python -m pytest tests/test_artifact_renderer.py -q`

## Commandes de validation

| Domaine | Commande | Notes |
|---|---|---|
| Tous les tests unitaires backend | `python -m pytest tests/ -q` | Silencieux ; affichage complet des échecs. Nécessite `pip install -r requirements-dev.txt`. |
| Routage du moteur uniquement | `python -m pytest tests/test_routing.py -q` | Signal le plus rapide pour les modifications du graphe. |
| Verdict + export | `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q` | Les deux surfaces du rapport de décision. |
| Vérification de types + build frontend | `cd frontend && npm run build` | Exécute `tsc --noEmit` puis `vite build` ; c’est la seule validation frontend (aucune suite de tests). |
| Test de fumée backend | `uvicorn src.main:app --reload --port 8000` puis `curl localhost:8000/health` | Vérifie `init_db` et le routage ; avec la valeur par défaut `LLM_PROVIDER=mock`, tout le flux s’exécute hors ligne. |
| Pile locale complète | `docker compose up --build` | Coûteux ; uniquement lorsque la question porte sur le comportement des conteneurs (nginx, délais d’attente du proxy, Postgres). |

## Lacunes de couverture (candidats à de futurs tests)

- **Aucun test d’API** — le comportement des endpoints (correspondance 404/400, indicateur `degraded`, opérations d’upsert des réponses) n’est pas testé ; un `TestClient` FastAPI + une fixture SQLite temporaire couvriraient les frontières service/dépôt.
- **Aucun test de dépôt ni de cycle de vie** — les transitions d’état de session, la réinitialisation de la grille (`reset_rounds`), la suppression en cascade et la sémantique d’`apply_ops` ne sont pas testées.
- **Aucun test frontend** — le rendu des composants, le repli de l’i18n et la logique d’ordonnancement de la War Room (`openRoundOrder`, `themeKey`) ne sont pas testés.
- **Aucun test des règles de mémoire produit** — `is_durable_statement` et `classify_memory_category` sont pures et peu coûteuses à verrouiller.

## Conseils de modification

Lorsqu’une modification touche le routage du graphe, les règles de verdict ou l’export Markdown, la suite correspondante ci-dessus est la vérification la plus ciblée et doit être étendue dans la même modification.

Pour les modifications de service/dépôt/API, ajoutez des tests à la frontière du service avec un moteur SQLite en mémoire ou temporaire (l’application prend déjà en charge `DATABASE_URL=sqlite:///...`) ; n’exigez ni Postgres ni un LLM réel dans les tests unitaires.