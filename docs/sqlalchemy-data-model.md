# Modèle de données SQLAlchemy

Ce document décrit le modèle relationnel cible du produit « decision board ». Il pivote
le schéma depuis le POC de refinement de tickets vers le domaine
**workspace / board / node / score / export**.

## Principes de conception

- PostgreSQL est la source de vérité
- JSONB pour les artefacts structurés (axes, critiques, payloads d'export)
- les checkpoints LangGraph restent séparés des données métier
- Alembic dès le départ, pas de dérive de schéma ad hoc

## Tables principales

### `users`

- `id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

### `workspaces`

- `id`
- `owner_id` → `users.id`
- `name`
- `created_at`
- `updated_at`

### `workspace_members`

- `id`
- `workspace_id` → `workspaces.id`
- `user_id` → `users.id`
- `role` (`owner`, `member`)
- `created_at`

### `boards`

- `id`
- `workspace_id` → `workspaces.id`
- `title`
- `template` (`feature_idea`, `product_opportunity`, `technical_initiative`, …)
- `status` (`DRAFT`, `REFINING`, `DECIDED`, `EXPORTED`, `ARCHIVED`)
- `created_by` → `users.id`
- `created_at`
- `updated_at`

### `nodes`

Idées organisées en arborescence (idée racine + dérivées).

- `id`
- `board_id` → `boards.id`
- `parent_id` → `nodes.id` (nullable pour la racine)
- `title`
- `body`
- `decision` (`GO`, `EXPLORE`, `DROP`, nullable)
- `position` JSONB (layout de la map)
- `created_at`
- `updated_at`

### `node_refinements`

Une itération IA sur un nœud (le cœur différenciant).

- `id`
- `node_id` → `nodes.id`
- `round_number`
- `axes` JSONB
- `questions` JSONB
- `answers` JSONB
- `facts` JSONB
- `assumptions` JSONB
- `unknowns` JSONB
- `dependencies` JSONB
- `risks` JSONB
- `critique` JSONB
- `confidence`
- `enough_context`
- `prompt_version`
- `llm_provider`
- `llm_model`
- `created_at`

### `scores`

- `id`
- `node_id` → `nodes.id`
- `impact`
- `effort`
- `risk`
- `confidence`
- `urgency`
- `scored_by` → `users.id` (nullable si semi-assisté par l'IA)
- `created_at`

### `votes`

- `id`
- `node_id` → `nodes.id`
- `user_id` → `users.id`
- `value` (pondération ou réaction)
- `created_at`

### `exports`

- `id`
- `board_id` → `boards.id`
- `type` (`BRIEF_MARKDOWN`, `BACKLOG_CSV`, `BACKLOG_JSON`, `SCOPING_NOTE`)
- `version`
- `payload` JSONB
- `share_token` (nullable — lien public lecture seule)
- `created_at`

## Enums suggérés

### `board_status`

- `DRAFT`
- `REFINING`
- `DECIDED`
- `EXPORTED`
- `ARCHIVED`

### `node_decision`

- `GO`
- `EXPLORE`
- `DROP`

### `export_type`

- `BRIEF_MARKDOWN`
- `BACKLOG_CSV`
- `BACKLOG_JSON`
- `SCOPING_NOTE`

## Esquisse de modèle SQLAlchemy

```python
class Board(Base):
    __tablename__ = "boards"

    id = Column(String, primary_key=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    template = Column(String)
    status = Column(String, nullable=False, default="DRAFT")
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)


class Node(Base):
    __tablename__ = "nodes"

    id = Column(String, primary_key=True)
    board_id = Column(String, ForeignKey("boards.id"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("nodes.id"), nullable=True, index=True)
    title = Column(String, nullable=False)
    body = Column(Text)
    decision = Column(String, nullable=True)
    position = Column(JSON)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
```

## Esquisse des relations

- un `user` possède plusieurs `workspaces`
- un `workspace` a plusieurs `workspace_members` et plusieurs `boards`
- un `board` a plusieurs `nodes` et plusieurs `exports`
- un `node` a un parent optionnel et plusieurs enfants (`parent_id`)
- un `node` a plusieurs `node_refinements`, `scores` et `votes`

## Guidage de persistance

- sauver chaque itération IA acceptée comme un `node_refinement` versionné
- sauver la version de prompt et le modèle avec chaque refinement
- garder les checkpoints LangGraph séparés des tables métier (le graphe n'est jamais le
  seul endroit où existent réponses ou sorties)
- utiliser Alembic dès le départ plutôt que des correctifs de schéma ad hoc
