# Plan d'implémentation — MVP 6 semaines

Objectif du MVP : livrer **un seul workflow de bout en bout** — transformer un
brainstorm d'équipe en décision priorisée puis en artefact exploitable, dans une seule
session. Un seul persona, un seul workflow, une seule promesse.

Ce plan suit la logique « decision board for product teams ». Il s'appuie sur le socle
technique déjà en place (FastAPI + LangGraph + SQLAlchemy + React) ; le code ADO
existant est traité comme un POC dont on retire la spécificité au fil des semaines.

## Semaine 1 — Cadrage

Objectif : verrouiller le problème, les écrans et les critères de succès avant de
coder. Un MVP B2B échoue surtout par mauvais scope.

À faire :

- interviewer 5 à 8 profils cibles (PM, PO, lead dev, innovation manager)
- valider les douleurs récurrentes : idées dispersées, réunions non exploitables,
  difficulté à prioriser, perte de contexte avant exécution
- dessiner **4 vues seulement** : accueil, board de refinement, vue scoring, export
  final
- définir le KPI d'activation : « une équipe crée un board, raffine une idée, obtient
  un export final dans la même session »

Livrables :

- ICP précis
- user journey
- liste stricte des fonctionnalités V1
- maquette low-fi cliquable ou schéma d'écrans

## Semaine 2 — Base produit

Objectif : construire la base et l'expérience de création de board, avec un onboarding
qui permet de démarrer en moins de 2 minutes.

À développer :

- auth simple (magic link ou Google) + appartenance workspace
- création workspace + board
- modèle de données minimal : `workspace`, `user`, `board`, `node`, `score`, `export`
  (voir `openwiki/domain/data-model.md`)
- UI board en arborescence simple (semi-map), même sans temps réel avancé
- starter templates : feature idea, product opportunity, technical initiative

Décision importante : ne pas faire une vraie mind map ultra complexe au départ ; une
structure hiérarchique visuelle semi-map est plus simple à livrer et maintenir en
6 semaines.

Côté code existant : remplacer le bootstrap `create_all()` par Alembic, retirer les
tables/champs Azure DevOps, introduire les entités board.

## Semaine 3 — Moteur de refinement IA

Objectif : livrer le cœur différenciant. Il doit transformer un tableau d'idées en
conversation structurée, pas en simples post-its numériques.

À développer :

- bouton **Refine** sur une idée / un nœud
- génération de 4 à 6 axes automatiques (problème, cible, valeur, risque, dépendances,
  métriques)
- **agent critique** : pose des questions de clarification, repère les zones vagues
- **agent structurant** : reformule le sujet en opportunités mieux cadrées
- historique simple des itérations sur chaque nœud

Règle produit : l'IA ne doit pas tout écrire à la place de l'équipe ; elle pose les
bonnes questions, propose des angles et aide à converger.

Côté code existant : réorienter le graphe LangGraph (`src/agents/refinement_workflow/`)
autour du nœud d'idée plutôt que du work item ADO.

## Semaine 4 — Couche décisionnelle

Objectif : ajouter l'arbitrage explicite et partageable. Sans cette semaine, on reste
un outil de discussion visuelle parmi d'autres.

À développer :

- scoring manuel ou semi-assisté sur impact, effort, risque, confiance, urgence
- vue matrice simple impact/effort ou priorisation pondérée
- vote ou réactions d'équipe
- résumé IA : « voici les 3 options les plus crédibles et pourquoi »
- tag **Go / Explore / Drop** sur chaque idée principale

À tester :

- l'équipe peut-elle arriver à une décision sans sortir du produit ?
- les critères de décision sont-ils compréhensibles et visibles ?

## Semaine 5 — Exports

Objectif : fermer la boucle avec un export exploitable. La vraie valeur perçue vient
du passage discovery → exécution ; il faut éviter le « whiteboard joli mais mort ».

À développer :

- export **brief produit** en Markdown
- export **backlog initial** en CSV ou JSON
- export **note de cadrage** (contexte, options, décision, risques, prochaines étapes)
- résumé partageable par lien public en lecture seule
- template d'output pour PM et template d'output pour Tech Lead

Livrable clé : un PM doit pouvoir animer un atelier, prioriser, puis repartir avec un
document directement exploitable dans son flux de travail.

## Semaine 6 — Bêta fermée

Objectif : observation d'usage réel et corrections rapides. Un MVP B2B n'est validé que
si un utilisateur réel peut finir son vrai job sans revenir à son ancien enchaînement
d'outils.

À faire :

- recruter 3 à 5 équipes pilotes
- sessions assistées de 30 à 45 minutes
- mesurer : temps jusqu'au premier board, taux de refinement complet, taux d'export,
  nombre d'idées finalisées, retour à Miro / Notion / Jira pendant le test
- corriger en priorité les blocages d'onboarding, la lisibilité du scoring et la
  qualité des exports
- préparer une landing page avec une promesse unique et un formulaire waitlist bêta

## Critère de validation MVP

Une équipe part d'une idée brute et produit une **décision + un artefact de sortie dans
une seule session**, sans repasser par son outil précédent pour le travail principal.

On mesure la **complétion du workflow**, pas le nombre de clics ou d'inscriptions.

## Découpage en sprints

| Sprint | Semaines | Focus |
| :-- | :-- | :-- |
| Sprint 1 | 1–2 | Cadrage + base produit |
| Sprint 2 | 3–4 | Moteur de refinement + couche décisionnelle |
| Sprint 3 | 5–6 | Exports + bêta fermée |

## Mapping vers le code existant

- **Réutilisable tel quel** : shell FastAPI (`src/main.py`), config
  (`src/config/settings.py`), abstraction LLM (`src/services/refinement_llm.py`),
  chargement de prompts, SPA React et i18n.
- **À réorienter** : graphe LangGraph (`src/agents/refinement_workflow/`) vers le nœud
  d'idée ; schémas Pydantic (`src/api/schemas_refinement.py`) ; contrats de `src/contracts/`.
- **À retirer** : `src/services/azure_devops_refinement.py`, les tables
  `work_item_snapshots` et les champs ADO de `refinement_sessions`, les écrans de
  sélection de work item.
