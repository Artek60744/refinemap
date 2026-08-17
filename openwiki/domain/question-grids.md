---
type: Domain Concept
title: Question Grids (Postures)
description: The three refinement postures — PO, Technique, Hybride — their axes, mode normalization, and the offline keyword detection that picks a grid when no LLM round-trip is worth it.
tags: [domain, grids, postures, refinement]
openwiki:
  roles: [domain]
  change_kinds: [runtime]
  source_paths: [src/services/question_grids.py, prompts/detect-mode.md, frontend/src/constants/grids.ts]
  symbols: [GRID_AXES, GRID_LABELS, MODES, GRIDS, normalize_mode, resolve_grid, grid_axes, detect_grid_by_keywords]
  invariants: [The resolved grid is always one of po, technique, hybride; any unknown mode falls back to auto, any unknown grid falls back to po. Grid axes are the backbone of the first question round and of the Brief sections.]
  validation_commands: [python -m pytest tests/ -q]
---

# Question Grids (Postures)

A grid is the "posture" used to refine a subject: **PO** (business framing),
**Technique** (technical spec), or **Hybride** (both). The user either picks one
explicitly at session creation or lets the engine pick in `auto` mode. The grid
drives everything downstream: the axes of the first question round, the themes of
subsequent questions, and the sections of the final Brief.

## Grid axes (`src/services/question_grids.py`)

| Grid | Axes (`key` — `label`) |
|---|---|
| `po` | `objectif` — Objectif · `cible` — Cible / utilisateurs · `probleme` — Problème · `valeur` — Valeur / impact · `perimetre` — Périmètre · `contraintes` — Contraintes métier · `succes` — Critères de succès · `dependances` — Dépendances / parties prenantes · `decision` — Décision attendue |
| `technique` | `comportement` — Comportement attendu · `cas_limites` — Cas limites · `integrations` — Intégrations / APIs / services · `contraintes_tech` — Contraintes techniques · `donnees` — Données manipulées · `risques_tech` — Risques techniques · `impacts` — Impacts perf / sécurité / conformité / observabilité · `dependances_tech` — Dépendances / migrations · `tests` — Plan de test / validation |
| `hybride` | `objectif_metier` — Objectif métier · `comportement` — Comportement attendu · `impactes` — Qui est impacté · `contraintes` — Contraintes métier & techniques · `arbitrages` — Dépendances / risques / arbitrages · `succes` — Critères de succès (valeur + faisabilité) · `incertitudes` — Zones d'incertitude à trancher |

The axes serve two purposes: the "Intent Structure" tree in the War Room sidebar,
and the guidance the LLM prompt receives as `grid_axes` for generating round 1
questions and Brief sections. Later rounds keep axes as `theme` labels but must
drill into the answers already given (see `system-refinement.md` rule 3).

## Mode and grid resolution

- `MODES = ("po", "technique", "hybride", "auto")` — what the user can request;
  `GRIDS = ("po", "technique", "hybride")` — what actually executes.
- `normalize_mode()` lowercases and validates; anything unknown becomes `auto`.
- `resolve_grid()` lowercases and validates; anything unknown becomes `po`.
- `grid_axes(grid)` returns the axes of the resolved grid.

In `RefinementService.start_session` and `set_mode` (the service behind the
[refinement engine](../architecture/refinement-engine.md)), `auto` triggers an LLM
round-trip (`llm.detect_mode` via `prompts/detect-mode.md`) with a keyword fallback;
a manual mode skips the LLM round-trip entirely — "the LLM round-trip is not worth
it just for the suggestion banner" — and still computes `detected_grid` from
keywords so the UI can suggest the alternative posture it detected.

## Offline keyword detection

`detect_grid_by_keywords(text)` is the deterministic, network-free fallback used by
`MockRefinementLLM.detect_mode` and by the manual-mode suggestion banner:

- counts PO keywords (`priorité`, `valeur`, `cible`, `utilisateur`, `impact`,
  `métier`, `roi`, `client`, `adoption`, `marché`, `persona`, ...) and TECH
  keywords (`api`, `latence`, `auth`, `migration`, `bug`, `perf`, `endpoint`,
  `déploiement`, `base de données`, `code`, `service`, `intégration`, `sécurité`,
  `cache`, `sql`, `schema`, ...);
- both count > 0 and within 1 of each other -> `hybride`;
- tech strictly higher -> `technique`;
- otherwise -> `po`.

## Change guidance

- **When to consult this page:** adding or renaming an axis, changing the grid set,
  tuning keyword detection, or editing the grid picker UI
  (`frontend/src/pages/ChooseGrid.tsx`, labels in
  `frontend/src/constants/grids.ts` — see [frontend/overview.md](../frontend/overview.md)).
- **Invariants to preserve:** resolved grid always in `GRIDS`; axes used
  consistently by the mock engine, the prompts (`grid_axes`), and the Brief
  grouping; `theme` on questions is a free string, so the War Room derives axis
  grouping from it (`themeKey` in `WarRoom.tsx`) — renaming an axis label changes
  the UI grouping unless the frontend is updated in the same change.
- **No dedicated test file:** grid behavior is exercised indirectly through the
  mock engine tests (`tests/test_mock_decision.py`) and the routing tests. Adding a
  small `tests/test_question_grids.py` would be a natural improvement when axes or
  detection change.
- **Validation:** `python -m pytest tests/ -q`.
