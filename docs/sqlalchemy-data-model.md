# SQLAlchemy Data Model

This document replaces the earlier Prisma draft and aligns the refinement tool with
the Python stack already used in `../app`.

## Design principles

- PostgreSQL is the source of truth
- use JSONB for structured artifacts and summaries
- keep graph checkpoints separate from business data
- persist normalized and raw work item context independently

## Main tables

### `users`

- `id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

### `refinement_sessions`

- `id`
- `user_id`
- `work_item_id`
- `work_item_type`
- `work_item_title`
- `status`
- `round`
- `max_rounds`
- `max_questions_per_round`
- `extra_context`
- `prompt_version`
- `llm_provider`
- `llm_model`
- `created_at`
- `updated_at`
- `completed_at`

### `work_item_snapshots`

- `id`
- `session_id`
- `source`
- `normalized_payload` JSONB
- `raw_payload` JSONB
- `created_at`

### `question_rounds`

- `id`
- `session_id`
- `round_number`
- `status`
- `reasoning_summary`
- `missing_areas` JSONB
- `potential_risks` JSONB
- `created_at`
- `updated_at`

### `questions`

- `id`
- `round_id`
- `external_id`
- `theme`
- `priority`
- `question_text`
- `why_text`
- `created_at`

### `answers`

- `id`
- `session_id`
- `question_id`
- `answer_text`
- `created_at`

### `session_summaries`

- `id`
- `session_id`
- `round_number`
- `facts` JSONB
- `assumptions` JSONB
- `unknowns` JSONB
- `dependencies` JSONB
- `risks` JSONB
- `confidence`
- `enough_context`
- `reason`
- `created_at`

### `session_artifacts`

- `id`
- `session_id`
- `type`
- `version`
- `payload` JSONB
- `created_at`

## Suggested enums

### `session_status`

- `DRAFT`
- `QUESTIONING`
- `ANSWERS_SUBMITTED`
- `ANALYZING`
- `FINAL_READY`
- `COMPLETED`
- `FAILED`
- `CANCELED`

### `artifact_type`

- `WORK_ITEM_SNAPSHOT`
- `QUESTION_ROUND`
- `SESSION_SUMMARY`
- `FINAL_REFINEMENT`
- `EXPORT_MARKDOWN`

## Suggested SQLAlchemy model sketch

```python
class RefinementSession(Base):
    __tablename__ = "refinement_sessions"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    work_item_id = Column(String, nullable=False, index=True)
    work_item_type = Column(String)
    work_item_title = Column(String)
    status = Column(String, nullable=False, default="DRAFT")
    round = Column(Integer, nullable=False, default=0)
    max_rounds = Column(Integer, nullable=False, default=3)
    max_questions_per_round = Column(Integer, nullable=False, default=6)
    extra_context = Column(Text)
    prompt_version = Column(String)
    llm_provider = Column(String)
    llm_model = Column(String)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True))
```

## Relationship sketch

- one `user` to many `refinement_sessions`
- one `refinement_session` to many `work_item_snapshots`
- one `refinement_session` to many `question_rounds`
- one `question_round` to many `questions`
- one `question` to many `answers`
- one `refinement_session` to many `session_summaries`
- one `refinement_session` to many `session_artifacts`

## Persistence guidance

- keep normalized Azure DevOps payloads for stable rendering and prompting
- keep raw Azure DevOps payloads for debugging and audit only
- save every accepted LLM output as an artifact version
- save prompt version and model metadata with the session or artifact
- use Alembic from the start instead of ad hoc schema drift fixes
