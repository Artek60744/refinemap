# Mémoire produit — point sur le commit

> Commit `50bfeaa` — *Ajoute la mémoire produit entre les sessions*
> Branche `feat/product-memory` · 35 fichiers · 49 tests verts

---

## Pourquoi

Le README annonce que le moat de RefineMap n'est pas l'UI mais « le moteur de
refinement agentique **et la mémoire produit** : contraintes, pivots et objections
récurrentes conservés d'une session à l'autre ». Cette mémoire n'existait pas.

Chaque session repartait d'un vide total : la session 12 redemandait le stack,
l'owner et les contraintes exactement comme la session 1. Le symptôme est visible
noir sur blanc dans le livrable d'exemple committé (`refinement-8d3bc216-….md`),
dont les questions ouvertes finales sont *« Quel langage / framework backend
Geofolia ? »* et *« Existe-t-il déjà une table pour stocker les identités
Google ? »*. Ce ne sont pas des questions de cadrage : ce sont des faits durables
sur le produit, qui auraient dû être connus avant le round 0.

**Résultat visé** : le budget de questions (6 par round × 3 rounds) se dépense sur
des arbitrages, plus sur de la reconstitution de contexte.

---

## Ce qui a été construit

Une session peut être rattachée à un **produit**. Trois mécanismes, dans cet ordre.

### 1. Injection

Au démarrage d'une session, les faits actifs du produit entrent dans
`_base_context()` (`src/agents/refinement_workflow/nodes.py`) sous la clé
`product_memory`, distincte de `facts`. Un seul point de branchement : les quatre
prompts la reçoivent automatiquement.

`generate-questions.md` traite ces faits comme acquis — une question dont la
réponse y figure est déclarée un échec, au même titre qu'une question déjà posée.
`summarize-context.md` interdit de les recopier dans `facts` : c'est du contexte
hérité, pas un résultat de la session en cours.

### 2. Extraction

À la finalisation, un nœud LangGraph terminal (`extract_product_memory`) lit le
résumé et renvoie les faits à mémoriser.

**La règle de durabilité**, qui est le cœur du prompt : un énoncé entre en mémoire
seulement s'il serait **encore vrai dans une autre session sur le même produit**.

| Durable | Pas durable |
|---|---|
| Le backend est en .NET 8 | La deadline est le 15 mars |
| Marc est le tech lead | Livraison prévue ce trimestre |
| Contrainte RGPD sur les données | Le correctif part demain |

### 3. Curation

Un bandeau « Ce que je sais déjà » s'ouvre au round 0 dans la colonne gauche de la
War Room, corrigeable ligne par ligne, plus une page `/memory` dédiée. Les
corrections écrivent dans la mémoire réelle via l'API, jamais sur une copie
locale — c'est cette boucle qui la rend fiable dans le temps plutôt que de la
laisser dériver.

---

## Décisions de conception

- **L'extraction renvoie un diff (`add` / `update` / `remove`), pas un dump.** C'est
  ce qui empêche les doublons et permet à une réponse contradictoire de
  *remplacer* un fait au lieu de s'empiler à côté.
- **Le nœud ne touche pas la base.** Il renvoie `memory_ops` dans le state et le
  service persiste, exactement comme `latest_summary` → `repo.add_summary`.
- **`route_after_final` court-circuite le nœud sans produit.** Pas d'appel LLM payé
  pour produire un diff qui serait jeté.
- **`ProductMemoryOp.action` est un `str`, pas un `Literal`.** Sous
  `extra="forbid"`, un `Literal` ferait échouer tout le diff sur une seule entrée
  malformée ; le repository ignore silencieusement les verbes inconnus.
- **Le moteur hors ligne n'émet jamais `update` ni `remove`.** Réécrire ou archiver
  un fait mémorisé demande un jugement qu'une heuristique ne peut pas rendre, et se
  tromper efface du savoir réel.
- **Portée par produit, pas globale.** Le stack d'un client ne doit pas polluer les
  questions posées sur un autre projet.

---

## Le risque, et les trois garde-fous

Une mémoire est un **amplificateur** : un fait faux mémorisé empoisonne
silencieusement toutes les sessions suivantes, et l'outil devient *moins* fiable au
fil du temps au lieu de plus. Les trois garde-fous font partie du livrable, pas
d'une v2 :

1. **Plafond de 40 faits injectés** (`MEMORY_FACT_LIMIT`) — borne la taille du
   prompt et force la mémoire à rester une mémoire, pas un journal.
2. **Panneau de confirmation au round 0** — rien n'entre dans un raisonnement sans
   être visible et corrigeable.
3. **Archivage plutôt que suppression** — un fait douteux reste traçable jusqu'à la
   session qui l'a produit.

---

## Surface technique

### Données

| Table | Rôle |
|---|---|
| `products` | Le produit raffiné, rattaché au user |
| `product_memory_facts` | `category`, `statement`, `status`, `confirmed`, `source_session_id`, `uses` |

`refinement_sessions` gagne `product_id` (nullable). Catégories : `produit`,
`stack`, `equipe`, `contrainte`, `utilisateur`, `decision`.

### API

| Méthode | Route |
|---|---|
| GET / POST | `/api/products` |
| DELETE | `/api/products/{id}` |
| GET / POST | `/api/products/{id}/memory` |
| PATCH / DELETE | `/api/memory/{fact_id}` |

`CreateSessionRequest` accepte `productId` et `productName` ; `StartSessionResponse`
et `SessionDetailResponse` renvoient `productMemory`.

### Fichiers ajoutés

```
src/models/product_memory.py                  modèle + constantes + normalisation
src/repositories/product_memory_repository.py CRUD + apply_ops (le diff)
src/services/product_memory_service.py        curation + mapping API
src/services/product_memory_rules.py          règle de durabilité + catégorisation
src/api/product_memory.py                     router
prompts/extract-product-memory.md             contrat d'extraction
frontend/src/api/memory.ts                    client
frontend/src/pages/ProductMemoryPage.tsx      page /memory
tests/conftest.py                             fixtures DB + TestClient + LLM offline
tests/test_product_memory.py                  règles, diff, injection, dégradation
tests/test_product_memory_api.py              contrat des endpoints
tests/test_product_memory_flow.py             boucle session 1 → mémoire → session 2
```

---

## Migration

`create_all()` crée les deux nouvelles tables, mais **pas** la colonne
`refinement_sessions.product_id` sur une base existante : elle passe par le dict
`wanted` de `_add_missing_columns()` (`src/database.py`). Pas d'Alembic actif dans
ce projet malgré la dépendance.

Vérifié sur une copie de `refinement.db` : colonne ajoutée, une session antérieure
se recharge sans erreur avec `productId: None` et une mémoire vide.

---

## Vérification

### Parcours réel (API live, provider `mock`)

| Étape | Résultat |
|---|---|
| Session 1 sur « Geofolia » | mémoire vide → **5 faits** extraits et catégorisés |
| Fait daté « deadline 15 mars 2026 » | **rejeté** par la règle de durabilité |
| Session 2, même produit | **5 faits injectés** et affichés dans le bandeau |
| Correction d'un fait | persistée, passe `confirmed=true` |
| Retrait d'un fait | HTTP 204, archivé, plus injecté |
| Session 3, autre produit | **0 fait** — aucune contamination |
| Session sans produit | `productId: null`, mémoire vide |
| `productId` inconnu | HTTP 404 (et non 500) |

### Tests

**49 passent** (13 existants + 36 nouveaux). Le `conftest` monte une base en
mémoire et instancie `TestClient` **sans context manager**, ce qui saute le
lifespan : un run de tests ne peut donc jamais lancer `init_db()` sur le vrai
`refinement.db`. La fixture `offline_llm` force le moteur déterministe — sans elle
les tests liraient `.env` et appelleraient le provider distant pour de vrai.

### Contrôle par mutation

Cinq mutations appliquées au code de production, **toutes détectées** par la suite :

| Mutation | Détectée |
|---|---|
| Règle de durabilité désactivée | ✅ |
| Déduplication supprimée dans `apply_ops` | ✅ |
| Archivage remplacé par un no-op | ✅ |
| Correction qui ne confirme plus | ✅ |
| Injection mémoire coupée dans `_base_context` | ✅ |

---

## Point ouvert

`prompts/extract-product-memory.md` **n'a jamais tourné sur un vrai modèle** —
l'environnement de développement n'avait pas de réseau sortant et il n'était pas
question de dépenser des crédits API sans demande explicite.

Toute la vérification s'appuie donc sur le moteur hors ligne, qui est délibérément
conservateur : il ne propose que des `add`. **Le comportement `update` sur
contradiction n'est validé qu'au niveau du repository, pas au niveau du prompt.**
C'est le premier point à valider avec un provider configuré depuis `/settings`.

---

## Suite

Les deux idées suivantes de la même famille — toutes attaquent le même goulot,
*d'où viennent les réponses* :

1. **Ancrage sur une source** — coller un repo / ticket / doc avant le round 0,
   supprimer les questions dont la réponse est dans la source, pré-remplir les
   autres avec citation. Le tuyau existe déjà de bout en bout (`extra_context` :
   colonne DB, schéma API, state LangGraph, prompts) ; aucun écran ne le remplit.
2. **Décisions périmables** — persister la condition de bascule du verdict
   (`reasons[0]`, la cause racine qui, levée, retourne l'arbitrage) et l'exposer
   dans l'historique : « EXPLORE depuis 3 semaines — bloqué sur X. Levé ? →
   ré-arbitrer ».
