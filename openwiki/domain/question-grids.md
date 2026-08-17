---
type: Concept de domaine
title: Grilles de questions (Postures)
description: Les trois postures de raffinement — PO, Technique, Hybride — leurs axes, la normalisation des modes et la détection hors ligne par mots-clés qui choisit une grille lorsqu'un aller-retour LLM n'en vaut pas la peine.
tags: [domain, grids, postures, refinement]
openwiki:
  roles: [domain]
  change_kinds: [runtime]
  source_paths: [src/services/question_grids.py, prompts/detect-mode.md, frontend/src/constants/grids.ts]
  symbols: [GRID_AXES, GRID_LABELS, MODES, GRIDS, normalize_mode, resolve_grid, grid_axes, detect_grid_by_keywords]
  invariants: [The resolved grid is always one of po, technique, hybride; any unknown mode falls back to auto, any unknown grid falls back to po. Grid axes are the backbone of the first question round and of the Brief sections.]
  validation_commands: [python -m pytest tests/ -q]
---

# Grilles de questions (Postures)

Une grille est la « posture » utilisée pour raffiner un sujet : **PO** (cadrage métier), **Technique** (spécification technique) ou **Hybride** (les deux). L'utilisateur en choisit explicitement une à la création de la session, ou laisse le moteur en choisir une en mode `auto`. La grille détermine tout ce qui suit : les axes du premier tour de questions, les thèmes des questions suivantes et les sections du Brief final.

## Axes des grilles (`src/services/question_grids.py`)

| Grille | Axes (`key` — `label`) |
|---|---|
| `po` | `objectif` — Objectif · `cible` — Cible / utilisateurs · `probleme` — Problème · `valeur` — Valeur / impact · `perimetre` — Périmètre · `contraintes` — Contraintes métier · `succes` — Critères de succès · `dependances` — Dépendances / parties prenantes · `decision` — Décision attendue |
| `technique` | `comportement` — Comportement attendu · `cas_limites` — Cas limites · `integrations` — Intégrations / APIs / services · `contraintes_tech` — Contraintes techniques · `donnees` — Données manipulées · `risques_tech` — Risques techniques · `impacts` — Impacts perf / sécurité / conformité / observabilité · `dependances_tech` — Dépendances / migrations · `tests` — Plan de test / validation |
| `hybride` | `objectif_metier` — Objectif métier · `comportement` — Comportement attendu · `impactes` — Qui est impacté · `contraintes` — Contraintes métier & techniques · `arbitrages` — Dépendances / risques / arbitrages · `succes` — Critères de succès (valeur + faisabilité) · `incertitudes` — Zones d'incertitude à trancher |

Les axes servent à deux fins : l'arborescence « Intent Structure » de la barre latérale du War Room, et la guidance que le prompt LLM reçoit sous forme de `grid_axes` pour générer les questions du tour 1 et les sections du Brief. Les tours suivants conservent les axes comme libellés `theme`, mais doivent approfondir les réponses déjà fournies (voir la règle 3 de `system-refinement.md`).

## Mode et résolution de la grille

- `MODES = ("po", "technique", "hybride", "auto")` — ce que l'utilisateur peut demander ; `GRIDS = ("po", "technique", "hybride")` — ce qui s'exécute réellement.
- `normalize_mode()` met en minuscules et valide ; toute valeur inconnue devient `auto`.
- `resolve_grid()` met en minuscules et valide ; toute valeur inconnue devient `po`.
- `grid_axes(grid)` renvoie les axes de la grille résolue.

Dans `RefinementService.start_session` et `set_mode` (le service derrière le [moteur de raffinement](../architecture/refinement-engine.md)), le mode `auto` déclenche un aller-retour LLM (`llm.detect_mode` via `prompts/detect-mode.md`) avec un repli par mots-clés ; un mode manuel ignore complètement l'aller-retour LLM — « l'aller-retour LLM n'en vaut pas la peine pour la seule bannière de suggestion » — et calcule quand même `detected_grid` à partir des mots-clés, afin que l'UI puisse suggérer la posture alternative détectée.

## Détection hors ligne par mots-clés

`detect_grid_by_keywords(text)` est le repli déterministe et sans réseau utilisé par `MockRefinementLLM.detect_mode` et par la bannière de suggestion en mode manuel :

- compte les mots-clés PO (`priorité`, `valeur`, `cible`, `utilisateur`, `impact`, `métier`, `roi`, `client`, `adoption`, `marché`, `persona`, ...) et les mots-clés TECH (`api`, `latence`, `auth`, `migration`, `bug`, `perf`, `endpoint`, `déploiement`, `base de données`, `code`, `service`, `intégration`, `sécurité`, `cache`, `sql`, `schema`, ...) ;
- si les deux compteurs sont > 0 et à 1 près l'un de l'autre -> `hybride` ;
- si le compteur TECH est strictement supérieur -> `technique` ;
- sinon -> `po`.

## Guide de modification

- **Quand consulter cette page :** ajout ou renommage d'un axe, modification de l'ensemble des grilles, réglage de la détection par mots-clés, ou édition de l'UI du sélecteur de grille (`frontend/src/pages/ChooseGrid.tsx`, libellés dans `frontend/src/constants/grids.ts` — voir [frontend/overview.md](../frontend/overview.md)).
- **Invariants à préserver :** la grille résolue est toujours dans `GRIDS` ; les axes sont utilisés de manière cohérente par le moteur mock, les prompts (`grid_axes`) et le regroupement du Brief ; `theme` sur les questions est une chaîne libre, donc le War Room en dérive le regroupement par axes (`themeKey` dans `WarRoom.tsx`) — renommer un libellé d'axe change le regroupement dans l'UI, sauf si le frontend est mis à jour dans le même changement.
- **Pas de fichier de test dédié :** le comportement des grilles est exercé indirectement via les tests du moteur mock (`tests/test_mock_decision.py`) et les tests de routage. Ajouter un petit `tests/test_question_grids.py` serait une amélioration naturelle lorsque les axes ou la détection changent.
- **Validation :** `python -m pytest tests/ -q`.