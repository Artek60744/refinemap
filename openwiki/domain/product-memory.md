---
type: Concept de domaine
title: Mémoire produit — faits durables entre les sessions
description: Comment RefineMap se souvient de ce qu’est un produit, de sa stack, de son équipe, de ses contraintes, de ses utilisateurs et de ses décisions à travers les sessions de raffinement — les catégories, la règle de durabilité, le budget d’injection, les opérations add/update/remove, et les règles du dépôt qui les appliquent en toute sécurité.
tags: [domain, product-memory, persistence]
openwiki:
  roles: [domain]
  change_kinds: [runtime]
  source_paths: [src/models/product_memory.py, src/repositories/product_memory_repository.py, src/services/product_memory_service.py, src/services/product_memory_rules.py, prompts/extract-product-memory.md, docs/product-memory.md]
  symbols: [Product, ProductMemoryFact, MEMORY_CATEGORIES, MEMORY_FACT_LIMIT, normalize_category, is_durable_statement, classify_memory_category, apply_ops, to_memory_context]
  test_paths: [tests/test_product_memory.py, tests/test_product_memory_api.py, tests/test_product_memory_flow.py]
  invariants: ["Un fait n’entre en mémoire que s’il serait encore vrai dans une session différente portant sur le même produit. Les faits sont archivés, jamais supprimés définitivement. Au plus MEMORY_FACT_LIMIT (40) faits actifs sont injectés dans un prompt, regroupés par catégorie après application du plafond. Une opération ciblant un fait d’un autre produit est ignorée plutôt que de faire échouer la session."]
  validation_commands: [python -m pytest tests/test_product_memory.py tests/test_product_memory_api.py tests/test_product_memory_flow.py -q]
---

# Mémoire produit — faits durables entre les sessions

La mémoire produit est le deuxième fossé défensif de RefineMap (après le moteur de raffinement) : les faits durables établis lors d’une session sont injectés dans les sessions ultérieures concernant le **même produit**, de sorte que le moteur ne pose jamais une question dont il connaît déjà la réponse. Ce n’est délibérément pas un journal : seul un ensemble borné de déclarations durables et catégorisées est conservé et réinjecté. Le document de conception `docs/product-memory.md` (note de commit de la fonctionnalité) décrit le pourquoi, les décisions de conception et la règle de durabilité avec ses exemples.

## Produits et faits (`src/models/product_memory.py`)

- **`Product`** — un produit que l’utilisateur affine de manière répétée, appartenant à un utilisateur. La mémoire lui est rattachée, afin que la stack d’un client ne contamine jamais les questions d’un autre projet. Les noms de produits sont comparés sans tenir compte de la casse (`ensure_product`), de sorte que «Geofolia» et «geofolia» restent une seule mémoire.
- **`ProductMemoryFact`** — une déclaration durable : `category`, `statement`, `status` (`active` / `archived`), `confirmed` (validé par un humain), `source_session_id` (traçabilité) et `uses` (compteur d’injection permettant de repérer ultérieurement les faits qui n’ont jamais servi).

Les catégories constituent l’axe de regroupement de la page mémoire et l’unité du budget de prompt : `MEMORY_CATEGORIES = ("produit", "stack", "equipe", "contrainte", "utilisateur", "decision")` ; tout ce qui est inconnu est normalisé en `produit` (`normalize_category`).

## La règle de durabilité (`src/services/product_memory_rules.py`)

> Un fait est durable s’il serait **encore vrai dans une autre session** concernant le même produit.

`is_durable_statement` impose cette règle hors ligne, la même règle étant énoncée dans `prompts/extract-product-memory.md` pour le moteur réel :

- les déclarations de plus de 220 caractères sont rejetées (un fait durable est une déclaration, pas un paragraphe) ;
- tout ce qui contient un marqueur temporel (`deadline`, `d'ici`, `avant le`, `cette semaine`, `ce sprint`, `next week`, `asap`, `en cours de`, `livraison prévue`, ...) ou un motif de date (dates, `q1 2026`, noms de mois français) est rejeté.

`classify_memory_category` associe une déclaration à une catégorie selon des groupes de mots-clés ordonnés : `stack` (api, backend, database, postgres, react, docker, azure, ...), `equipe` (équipe, développeur, tech lead, owner, squad, ...), `contrainte` (rgpd, sécurité, budget, licence, sla, quota, audit, ...), `utilisateur` (client, cible, persona, marché, ...), `decision` (décidé, retenu, abandonné, arbitrage, ...), avec `produit` comme valeur par défaut. Les groupes les plus spécifiques sont testés en premier.

## Budget d’injection

`ProductMemoryRepository.list_active_facts(product_id, limit=MEMORY_FACT_LIMIT)` renvoie les faits actifs injectés dans les prompts : les plus récemment touchés d’abord, plafonnés à **40** (`MEMORY_FACT_LIMIT`), puis **groupés par catégorie** — trier d’abord par catégorie laisserait une catégorie surchargée affamer les autres. `RefinementService` appelle `touch_uses` après l’injection afin que le compteur `uses` reflète l’utilisation réelle.

La forme exposée aux prompts est `{"id", "category", "statement"}` (`to_memory_context`) : l’id est requis pour que le modèle puisse cibler un fait existant avec `update`/`remove` au lieu d’ajouter un doublon.

## Opérations mémoire (add / update / remove)

Le nœud de graphe `extract_product_memory` (voir [refinement-engine.md](../architecture/refinement-engine.md)) demande au LLM un diff — jamais un dump : `ProductMemoryOp {action, id, category, statement}` avec `action` volontairement un simple `str` (une action inconnue est ignorée, pas fatale). `ProductMemoryRepository.apply_ops` applique le diff lors de la finalisation de la session :

- **`remove`** — archive le fait ciblé (status -> `archived`), ne le supprime jamais.
- **`update`** — réécrit la déclaration/la catégorie, réactive le fait et définit `confirmed = False`, car une réécriture par le modèle nécessite à nouveau un passage humain.
- **`add`** — crée un fait (avec `source_session_id`), en ignorant les doublons exacts insensibles à la casse parmi les faits actifs.
- Une opération ciblant un fait **d’un autre produit est ignorée plutôt que de lever une erreur** : un id halluciné ne doit pas faire échouer la session.

Le mock hors ligne n’émet jamais `update` ni `remove` — réécrire un fait mémorisé nécessite un jugement que les heuristiques ne peuvent pas porter, et un archivage heuristique effacerait silencieusement des connaissances réelles (commentaire dans `MockRefinementLLM.extract_product_memory`).

## API de curation (`src/services/product_memory_service.py`)

En dehors des sessions, la curation de la mémoire est assurée par des humains via les endpoints `/api/products*` et `/api/memory*` (voir [refinement-api.md](../api/refinement-api.md)) : lister/créer/supprimer des produits, lister les faits, ajouter un fait manuel (saisi par un humain, donc `confirmed=True` immédiatement), mettre à jour un fait, archiver un fait. Corriger une déclaration est en soi une confirmation : `update_fact` définit `confirmed=True` lorsqu’une nouvelle déclaration est fournie sans indicateur explicite. Les ressources inconnues et celles qui n’appartiennent pas à l’utilisateur se confondent dans le même 404 pour éviter les fuites d’existence (`_owned_product`, `_owned_fact`).

L’interface de curation se trouve dans la SPA : la page `/memory` (`ProductMemoryPage`, liste des produits + faits groupés par catégorie avec ajout / édition / confirmation / archivage en ligne), le sélecteur de produit de l’accueil, et une bannière round-0 dans le War Room qui permet à l’utilisateur de corriger ou de retirer les faits injectés en ligne — voir [frontend/overview.md](../frontend/overview.md). Ces trois éléments écrivent via le même client `api/memory.ts`, de sorte qu’une correction faite à un endroit est immédiatement visible partout, y compris dans l’injection de la session suivante.

## Guide de changement

- **Quand consulter cette page :** lors de la modification des catégories de mémoire, de la règle de durabilité, du budget d’injection, de l’application des opérations ou de l’interface/API de curation de la mémoire.
- **Invariants à préserver :** l’archivage et non la suppression ; le plafond de 40 faits ; le regroupement par catégorie après le plafond ; la sémantique de `confirmed` (ajout manuel = true, réécriture modèle = false, correction humaine = true) ; des opérations limitées au produit propriétaire ; la finalisation de session n’applique `memory_ops` que lorsque la session possède un `product_id`.
- **Surface transversale entre paquets :** la liste des catégories est partagée par le modèle, le classifieur hors ligne, les prompts, les réglages de `CreateMemoryFactRequest` et l’interface mémoire du frontend (`CATEGORIES` de `ProductMemoryPage`, la bannière du War Room) — une modification de catégorie doit les toucher toutes.
- **Tests ciblés :** `tests/test_product_memory.py` verrouille la règle de durabilité, la classification, l’extraction mock et `apply_ops` (add/update/remove, doublons, ids étrangers, plafond, archivage, dégradation) ; `tests/test_product_memory_api.py` verrouille le contrat HTTP des endpoints produits/mémoire ; `tests/test_product_memory_flow.py` verrouille la boucle session → mémoire → session suivante. Voir [testing.md](../testing.md) pour le détail et les commandes.
- **Validation :** `python -m pytest tests/test_product_memory.py tests/test_product_memory_api.py tests/test_product_memory_flow.py -q`.