---
type: Architecture
title: Frontend SPA — Routes, pages et i18n
description: Le frontend React 18 + TypeScript + Vite + Tailwind de RefineMap — les routes client, les pages derrière chaque route (y compris la surface de curation de la mémoire produit), les coques de navigation, le client API, le catalogue i18n partagé avec le cookie lang, et les commandes de build/validation.
tags: [frontend, react, typescript, vite, i18n]
openwiki:
  roles: [architecture]
  change_kinds: [runtime]
  source_paths: [frontend/src/App.tsx, frontend/src/pages/WarRoom.tsx, frontend/src/pages/HistoryPage.tsx, frontend/src/pages/ProductMemoryPage.tsx, frontend/src/pages/RefinementHome.tsx, frontend/src/pages/SettingsPage.tsx, frontend/src/pages/SessionResultPage.tsx, frontend/src/components/ArtifactView.tsx, frontend/src/components/DecisionReportView.tsx, frontend/src/api/client.ts, frontend/src/api/refinement.ts, frontend/src/api/memory.ts, frontend/src/components/TopNavBar.tsx, frontend/src/components/Layout.tsx, frontend/src/i18n/catalog.ts]
  symbols: [App, WarRoom, HistoryPage, ProductMemoryPage, RefinementHome, SettingsPage, ChooseGrid, SessionResultPage, ArtifactView, DecisionReportView, MemoryBanner, TopNavBar, Layout, apiFetch, LanguageProvider, useI18n]
  invariants: ["The SPA never calls an LLM; all AI work goes through /api. The lang cookie is shared with the backend. Theme grouping in the War Room derives from the free-string question theme, exactly like the backend brief grouping. Memory corrections in the War Room and on the /memory page write straight to the product memory through the API, never to a local-only copy."]
  validation_commands: [cd frontend && npm run build]
---

# Frontend SPA — Routes, pages et i18n

Le frontend est une SPA React 18 + TypeScript construite avec Vite et stylée avec Tailwind CSS v4. Elle ne communique qu'avec le backend FastAPI via JSON ; elle n'appelle jamais directement un LLM. En production, nginx sert le bundle compilé et proxifie `/api` et `/health` ; en développement, Vite proxifie les mêmes chemins vers `http://localhost:8000` (surchargez avec `BACKEND_URL`).

## Routes (`frontend/src/App.tsx`)

| Route | Page | Objectif |
|---|---|---|
| `/` and `/refinement` | `RefinementHome` | Capturer l'idée brute et choisir le périmètre produit (quelle mémoire alimente la session) |
| `/refinement/choose` | `ChooseGrid` | Choisir la posture (PO / Technique / Hybride) — protégée : redirige vers l'accueil en l'absence d'objectif dans l'état de localisation |
| `/refinement/sessions/:sessionId` | `WarRoom` | L'écran principal de raffinement à 3 zones |
| `/refinement/sessions/:sessionId/result` | `SessionResultPage` | Vue en lecture seule du livrable final |
| `/refinement/history` | `HistoryPage` | Liste des sessions, recherche, filtre par statut, renommage, suppression, ré-exportation |
| `/memory` | `ProductMemoryPage` | Curation de la mémoire produit : liste des produits, faits groupés par catégorie, ajout / modification / confirmation / archivage |
| `/settings` | `SettingsPage` | Configuration du fournisseur LLM et test de connexion |
| `*` | redirect | Routes inconnues -> `/refinement` |

## Coques de navigation

Deux coques, choisies par route dans `App.tsx` :

- **`TopNavBar`** — barre supérieure fixe avec les liens Tableau de bord / Historique / Mémoire plus les enfants du côté droit (paramètres, avatar). Utilisée par `RefinementHome`, `HistoryPage` et `ProductMemoryPage` (la prop `active` surligne l'onglet courant).
- **`Layout`** — coque à barre latérale avec les liens Raffinement / Historique / Mémoire / Paramètres / Santé et le sélecteur de langue. Utilisée par `SessionResultPage` et `SettingsPage` via le bloc imbriqué `<Route element={<Layout />}>` dans `App.tsx`.
- `WarRoom` rend son propre habillage (la barre supérieure est un espace réservé commenté) car c'est l'écran principal avec sa propre mise en page à trois zones.

## War Room (l'écran principal)

`WarRoom.tsx` affiche trois zones à partir de `SessionDetailResponse` :

- **Structure d'intention** (gauche) — l'arborescence des thèmes avec la progression réponses/total par question. Le regroupement des thèmes est dérivé côté client à partir de la chaîne libre `question.theme` via `themeKey()` — le même axe de regroupement que le backend utilise pour les sections Brief, donc renommer un libellé d'axe doit mettre à jour les deux côtés.
- **Decision War Room** (centre) — la conversation : une question à la fois avec des chips `suggestions` en un clic, un ordre chronologique pour le tour ouvert (`openRoundOrder` place d'abord les échanges répondus, puis la question active, puis les questions d'axes en attente dans l'ordre du serveur), des séparateurs par tour, et un état local des réponses jusqu'à la soumission du tour via `POST /answers`.
- **Livrable** (droite) — onglets d'aperçu en direct Brief / Plan / Brouillon de code et le lien d'exportation Markdown ; lorsqu'un `decisionReport` existe, `DecisionReportView` affiche la bannière de verdict avec la cause racine / les bloqueurs / la prochaine action (voir [decision-report.md](../domain/decision-report.md)).
- **Bannière mémoire (pré-vol du tour 0)** — lorsque la session est ciblée sur un produit, les faits injectés apparaissent dans une `MemoryBanner` repliable au-dessus de la première question. Corriger ou supprimer une ligne **écrit directement dans la mémoire produit** via `updateMemoryFact` / `archiveMemoryFact` — jamais dans une copie locale — car c'est cette boucle de rétroaction qui maintient la fiabilité de la mémoire au fil du temps.

Il gère également : le changement de grille (envoie une requête POST vers `/mode`, ce qui réinitialise les tours côté serveur), la bannière `degraded` lorsque le backend a utilisé le moteur hors ligne, et le score de clarté dérivé de `confidence` (`clarityFromConfidence` : élevé 85, moyen 68, faible 40, 100 avec un livrable final).

## Pages d'accueil, d'historique, de mémoire, de résultat et de paramètres

- `RefinementHome` — zone de texte d'objectif plus un **sélecteur de périmètre produit** qui décide quelle mémoire alimente la session : le sélecteur liste les produits de l'utilisateur (avec les compteurs de faits actifs), propose une option sentinelle `__new__` qui crée un produit par son nom au début de la session, et un choix vide signifie « session sans mémoire ». Un échec de `listProducts` ne bloque jamais le démarrage d'une session (commentaire dans `RefinementHome.tsx`).
- `ProductMemoryPage` — la surface de curation à `/memory` (voir [product-memory.md](../domain/product-memory.md)) : liste des produits avec les compteurs de faits, faits groupés par catégorie dans l'ordre d'affichage qui reflète `MEMORY_CATEGORIES` (`src/models/product_memory.py`), ajout / modification / confirmation / archivage en ligne, et la limite de 40 faits exposée dans l'interface (`FACT_LIMIT` reflète `MEMORY_FACT_LIMIT`).
- `HistoryPage` — liste paginée (20/page) avec recherche avec debounce, filtre par statut, renommage en ligne, confirmation de suppression et ré-exportation ; « charger plus » ajoute au lieu de réinitialiser la page.
- `SessionResultPage` — vue en lecture seule du livrable final : elle charge `SessionDetailResponse` puis délègue le rendu à **`ArtifactView`** (`frontend/src/components/ArtifactView.tsx`), qui affiche le `DecisionReportView` en variante complète, le résumé, le Brief, le Plan, le Brouillon de code et les questions ouvertes — la même hiérarchie que l'export Markdown backend, en version interactive.
- `SettingsPage` — formulaire adapté au fournisseur : champs obligatoires selon le fournisseur (`LLM_FIELDS_BY_PROVIDER` : mock aucun, deepseek modèle, azure points de terminaison + déploiement, openai/openrouter modèle), indication de clé masquée, panneau de résultat du test de connexion. Le champ de clé API n'est envoyé que s'il n'est pas vide (le serveur conserve la clé stockée), conformément à la règle du backend dans [llm-configuration.md](../operations/llm-configuration.md).

## Client API et types

- `frontend/src/api/client.ts` — enveloppe `apiFetch` : en-têtes JSON, extraction des erreurs depuis `detail` / `message` / `error.message` dans une `ApiError` avec statut.
- `frontend/src/api/refinement.ts` — fonctions typées pour chaque point de terminaison du raffinement (`createSession`, `listSessions`, `renameSession`, `deleteSession`, `getSession`, `setSessionMode`, `submitAnswers`, `exportUrl`).
- `frontend/src/api/memory.ts` — fonctions typées pour les produits et les faits (`listProducts`, `createProduct`, `deleteProduct`, `getProductMemory`, `addMemoryFact`, `updateMemoryFact`, `archiveMemoryFact`), alimentant l'interface `ProductMemoryPage`, la bannière mémoire de la War Room et le sélecteur de produit de l'accueil.
- `frontend/src/api/settings.ts` — `getSettings`, `saveSettings`, `testLlm`.
- `frontend/src/types/api.ts` — reflète les schémas Pydantic du backend 1:1 (avec les mêmes commentaires) ; maintenez-le en synchronisation avec `src/api/schemas_refinement.py` et `src/api/schemas_settings.py` lorsque les schémas changent.

## i18n

- `frontend/src/i18n/catalog.ts` — le catalogue de l'interface (`key -> [english, french]`, français par défaut), incluant le nom du cookie `lang`, les libellés des liens `nav.*` (tableau de bord / historique / mémoire), et tout l'espace de noms `memory.*` utilisé par le sélecteur de produit de l'accueil, la bannière de la War Room et `ProductMemoryPage`.
- `frontend/src/i18n/index.tsx` — `LanguageProvider` lit le cookie `lang` ou `navigator.language`, et `setLang` **écrit le même cookie que lit le backend** (chemin `/`, 1 an, SameSite=Lax) afin que les messages de l'API et la langue des prompts suivent l'interface sans aller-retour supplémentaire. `t(key, params)` formate les `{placeholders}` ; `label(prefix, value)` mappe les valeurs d'énumération via le catalogue avec repli sur la valeur brute.
- Le backend conserve son propre catalogue, plus petit, pour les messages de l'API dans `src/i18n.py` (voir [architecture/overview.md](../architecture/overview.md)).

## Guide de modification

- **Quand consulter cette page :** tout changement d'interface, ajout de route, chaîne i18n, ou travail de synchronisation des types/schémas.
- **Invariants à préserver :** la SPA n'appelle jamais un LLM ; routage mono-origine (proxy Vite/nginx pour `/api` et `/health`) ; cookie `lang` partagé avec le backend ; dérivation du groupement des thèmes identique au groupement des briefs du backend.
- **Points d'extension :** nouvelle page -> ajouter une route dans `App.tsx` ; nouveau point de terminaison -> ajouter une fonction typée dans `api/refinement.ts`, `api/memory.ts` ou `api/settings.ts` ainsi que les types dans `types/api.ts` ; nouvelle chaîne d'interface -> ajouter la paire `[en, fr]` dans `catalog.ts` (jamais de chaîne codée en dur visible par l'utilisateur).
- **Tests :** il n'existe **aucune suite de tests frontend** ; les vérifications imposées sont `tsc --noEmit` et `vite build`, toutes deux derrière `npm run build`. Ajouter une configuration de tests de composants serait une nouvelle décision d'outillage, pas un correctif incrémental.
- **Validation :** `cd frontend && npm run build` (vérification des types + build de production) ; pour le travail interactif, `npm run dev` avec le backend en cours d'exécution.