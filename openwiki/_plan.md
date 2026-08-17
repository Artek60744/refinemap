---
type: Plan de maintenance
title: Plan d'impact — mise à jour du wiki OpenWiki
description: Inventaire des changements détectés depuis la dernière mise à jour documentée (gitHead f51db76) et des mises à jour de pages nécessaires pour le wiki RefineMap.
tags: [openwiki, plan, maintenance]
---

# Plan d'impact — mise à jour du wiki

Source de comparaison : l'état documenté dans le wiki (dernière mise à jour `f51db76dde5261e1fb5d9b166e5fd222b865d787`, 2026-08-11) vs l'état actuel du dépôt (git inaccessible — shell restreint ; comparaison source/tests/wiki).

## Inventaire des changements détectés

1. **Nouveaux fichiers de tests backend** — `tests/conftest.py` (fixtures `db`, `client`, `offline_llm`), `tests/test_product_memory.py` (règles de durabilité, classification, extraction mock, `apply_ops`, plafond, injection, dégradation), `tests/test_product_memory_api.py` (contrat des endpoints produits/mémoire), `tests/test_product_memory_flow.py` (boucle complète session → mémoire → session suivante). `requirements-dev.txt` ajoute `pytest-asyncio>=0.23`.
   → Pages affectées : testing.md, domain/product-memory.md, quickstart.md, api/refinement-api.md, domain/data-model.md, architecture/refinement-engine.md. Le wiki affirmait à plusieurs endroits que ces tests n'existaient pas.
2. **Composant frontend `ArtifactView.tsx`** — nouveau, utilisé par `SessionResultPage` pour rendre le livrable.
   → Pages affectées : frontend/overview.md (composants + frontmatter).
3. **`_add_missing_columns` dans `src/database.py`** — gère désormais aussi `subject_id`, `subject_title`, `mode`, `grid`, `detected_grid` + backfill `work_item_id`→`subject_id` et `work_item_title`→`subject_title` + NOT NULL/index.
   → Pages affectées : domain/data-model.md (déjà partiellement documenté, mais la liste des colonnes est incomplète).
4. **Nouveau doc de conception `docs/product-memory.md`** (note de commit de la fonctionnalité mémoire).
   → Pages affectées : domain/product-memory.md (référence à la conception), quickstart.md (liste des docs).
5. **`src/config/settings.py`** — `default_user_name` et `asset_version` (mineur, pas critique).

## Dispositions

| Composant / workflow | Page | Section | Disposition |
|---|---|---|---|
| Suite de tests backend (7 fichiers) | testing.md | Suites, commandes, lacunes, conseils | covered — réécriture substantielle |
| Règles mémoire produit (tests) | domain/product-memory.md | Tests ciblés, guide de changement | covered — mise à jour |
| Tests produits/mémoire API | api/refinement-api.md | Guide des modifications, tests ciblés | covered — mise à jour |
| Cycle de vie des sessions (tests dépôt) | domain/data-model.md | Recommandations, tests ciblés, migration | covered — mise à jour |
| Nouveau composant ArtifactView | frontend/overview.md | War Room / résultat, frontmatter | covered — ajout |
| Route de session → mémoire → session (flow test) | quickstart.md | Routage des tâches, validation | covered — mise à jour |
| docs/product-memory.md | domain/product-memory.md | Référence de conception | covered — lien |
| docs/perplexity.md, docs/exemple_text.md, frontend/exemple/, root *.md, slate.json | — | hors de portée | out of scope — artefacts de recherche/mockups non liés aux composants documentés |

## Relations (source -> relation -> cible)

- tests/test_product_memory*.py -> verrouillent les règles de -> domain/product-memory.md
- tests/test_product_memory_api.py -> teste le contrat de -> api/refinement-api.md
- tests/test_product_memory_flow.py -> exerce le service de -> architecture/refinement-engine.md (RefinementService)
- frontend ArtifactView -> rend le livrable de -> domain/decision-report.md (via DecisionReportView)
- docs/product-memory.md -> décrit la conception de -> domain/product-memory.md
