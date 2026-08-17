---
type: Concept de domaine
title: Rapport de décision — le verdict du raffinement
description: L'arbitrage explicite qui clôt une session de raffinement — go / explore / rework / drop — avec la cause racine, les bloqueurs, les points forts, l'action suivante, les règles d'arbitrage déterministes hors ligne et l'export Markdown qui les restitue.
tags: [domain, decision, verdict, deliverable]
openwiki:
  roles: [domain]
  change_kinds: [runtime, public-api]
  source_paths: [src/api/schemas_refinement.py, src/services/refinement_llm.py, src/services/artifact_renderer.py]
  symbols: [DecisionReport, DecisionRecommendation, RefinementDeliverable, _build_decision_report, render_deliverable_markdown]
  test_paths: [tests/test_mock_decision.py, tests/test_artifact_renderer.py]
  invariants: ["reasons[0] is always the root cause and the rest is strictly secondary. A verdict short of go carries a conditional-go flip condition derived from its blockers. Root cause, blockers and next action must point at the same blocking item. Blockers are capped at two."]
  validation_commands: [python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q]
---

# Rapport de décision — le verdict du raffinement

La règle produit est que « l'IA aide à converger, elle ne décide pas à la place de l'équipe » — mais le moteur doit néanmoins faire remonter un **arbitrage explicite et partageable**. C'est le `decisionReport` : un verdict qui clôt chaque session finalisée, distinct du résumé de session. Un résumé relate ; un rapport de décision arbitre.

## Le modèle de verdict (`src/api/schemas_refinement.py`)

`DecisionReport` est un `StrictModel` (champs supplémentaires rejetés) avec :

- `recommendation` — `Literal["go", "explore", "rework", "drop"]`, normalisé en minuscules à l'entrée (validateur `_normalize`).
- `confidence` — solidité du **verdict lui-même**, pas du contexte du projet.
- `reasons` — 2 à 4 raisons franches, **chacune citant un fait, un risque ou une inconnue spécifique** ; `reasons[0]` est la cause racine.
- `blockers` — les 1 à 3 conditions qui empêchent réellement d'avancer (cadrage, pas implémentation) ; le moteur de rendu les plafonne à 2 en pratique.
- `strengths` — ce qui est déjà validé et justifie de ne pas abandonner l'idée.
- `nextAction` — l'unique action prioritaire, à l'impératif.

Un `model_validator` (`_migrate_v1`) fait correspondre le premier format de rapport persisté (`rationale` / `changeTriggers` / `objections` / `validationConditions`) aux champs v2, afin que les charges utiles stockées continuent de passer la validation avec `extra="forbid"` — c'est le chemin de compatibilité pour les sessions finalisées avant l'introduction du format de rapport.

## Arbitrage déterministe (règles du moteur mock)

Le moteur hors ligne (`MockRefinementLLM._build_decision_report`) applique des règles ordonnées sur les faits, inconnues, risques, hypothèses et niveau de confiance de la session — c'est la logique exacte que le moteur réel est invité à reproduire, et les règles sont verrouillées par les tests :

<!-- openwiki: l'analyse mermaid a échoué et ce diagramme a été converti en bloc texte pour ne pas casser le rendu. Corrigez la source du diagramme et restaurez le délimiteur mermaid. Erreur d'analyse : heuristique — un chevron non échappé dans un libellé casse le rendu ; reformulez le libellé. -->
```text
flowchart TD
    A["facts empty and unknowns >= 3"] -->|yes| DROP["drop / high"]
    A -->|no| B["no unknowns and confidence high<br>and risks <= 1"]
    B -->|yes| GO["go / high"]
    B -->|no| C["risks >= 3 or risks > facts"]
    C -->|yes| REWORK["rework / medium"]
    C -->|no| EXPLORE["explore / medium"]
```

Ensuite, à partir d'une source de vérité unique (l'élément bloquant) :

- **go** -> aucun bloqueur, cause racine « aucun bloqueur résiduel », l'action suivante lance le plan.
- **rework** avec risques -> le bloqueur est le premier risque ; **rework** sans risques -> la première inconnue.
- **drop** -> le bloqueur est la première inconnue ; l'action suivante indique de ne pas poursuivre à moins que le bloqueur ne soit levé.
- **explore** -> l'action suivante consiste à arbitrer d'abord le bloqueur principal.

Les bloqueurs sont étiquetés (« Inconnue bloquante », « Risque bloquant », « Cadrage bloquant ») et plafonnés à 2 — au-delà, c'est une liste de courses, pas une décision. Les raisons secondaires comportent au plus une inconnue, un risque et une hypothèse non vérifiée. `strengths` est défini par défaut sur les trois premiers faits, ou sur un repli de cadrage par grille lorsqu'il n'y en a aucun (« Le périmètre est cadré par la grille PO. »).

## Rendu (`src/services/artifact_renderer.py`)

`render_deliverable_markdown(subject, deliverable)` produit la charge utile de `GET /api/refinement/sessions/{id}/export` (voir [refinement-api.md](../api/refinement-api.md)). La section Décision est **mise en avant, avant le Brief** :

- `**REWORK** — confidence: high`
- une **ligne de go conditionnel** lorsque le verdict est `explore`/`rework` et que des bloqueurs existent : « Go conditionnel une fois le bloqueur principal levé. » / « ... une fois les 2 bloqueurs levés. » — un `go` ne comporte aucune condition.
- `### Root cause` (reasons[0]) puis `### Secondary reasons` (le reste), `### Real blockers` (numérotés, le premier marqué « (main) »), `### What is already solid` et `### Next action`.
- Les sous-listes vides sont ignorées ; un livrable hérité sans `decisionReport` est rendu sans aucune section Décision.

## Présentation du frontend

`DecisionReportView.tsx` affiche le rapport sous forme de bannière ou de vue complète, avec des couleurs et icônes par verdict (go vert, explore bleu, rework ambre, drop rouge), la même répartition cause racine / causes secondaires, et le même libellé de go conditionnel via les clés i18n (`decision.conditional_go_one` / `decision.conditional_go_many`). Il est affiché dans la War Room lorsqu'un livrable existe et sur la page de résultat (voir [frontend/overview.md](../frontend/overview.md)).

## Guide des changements

- **Quand consulter cette page :** modification du vocabulaire des verdicts, des règles d'arbitrage, de la disposition de l'export Markdown ou de l'interface de décision.
- **Invariants à préserver :** cause racine = blockers[0] = cible de nextAction ; raisons plafonnées à 4 ; bloqueurs plafonnés à 2 ; formulation du go conditionnel uniquement pour explore/rework avec bloqueurs ; la migration des charges utiles v1 reste dans `DecisionReport._migrate_v1`.
- **Surface inter-paquets :** la modification du schéma touche `frontend/src/types/api.ts` (`DecisionReport`, `DecisionRecommendation`) et `frontend/src/components/DecisionReportView.tsx` dans le même changement ; les miroirs du schéma JSON se trouvent dans `contracts/final-refinement.schema.json`.
- **Tests ciblés :** `tests/test_mock_decision.py` verrouille les quatre verdicts ainsi que le plafond « un bloqueur principal, un secondaire » et l'alignement cause racine / action suivante ; `tests/test_artifact_renderer.py` verrouille l'ordre Markdown, le go conditionnel au singulier/pluriel, l'omission des sous-listes vides, les charges utiles héritées et la migration v1 -> v2.
- **Validation :** `python -m pytest tests/test_mock_decision.py tests/test_artifact_renderer.py -q`.