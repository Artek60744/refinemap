# Refinement API Contract

This document defines the target HTML and JSON contract for the MVP.

The structure intentionally mirrors the separation already used in `../app`:

- page routes under `src/routes/`
- JSON and HTMX endpoints under `src/api/`

## Conventions

- authenticated internal users only
- JSON request and response bodies for API endpoints
- HTML partial responses allowed for HTMX endpoints
- timestamps in ISO 8601
- session id is reused as LangGraph `thread_id`

## 1. HTML pages

### Refinement landing page

`GET /refinement`

Purpose:

- search a work item
- inspect the selected ticket
- add extra context
- start a refinement session

### Session workspace page

`GET /refinement/sessions/{session_id}`

Purpose:

- display the work item context
- display the current question round
- submit answers
- show live facts, assumptions, unknowns, dependencies, and risks

### Final result page

`GET /refinement/sessions/{session_id}/result`

Purpose:

- display the final refinement artifact
- allow markdown export

## 2. Search work items

### Request

`GET /api/refinement/work-items/search?q=<query>&limit=10`

### Response

```json
{
  "items": [
    {
      "id": "12345",
      "type": "User Story",
      "title": "Separate E2E databases for Web and API",
      "state": "New",
      "tags": ["E2E", "CI/CD"],
      "areaPath": "Platform\\Quality",
      "iterationPath": "Backlog"
    }
  ]
}
```

## 3. Get work item details

### Request

`GET /api/refinement/work-items/{id}`

### Response

```json
{
  "workItem": {
    "id": "12345",
    "type": "Enabler",
    "title": "Separate E2E databases for Web and API",
    "url": "https://dev.azure.com/org/project/_workitems/edit/12345",
    "description": "Current E2E tests share the same DB...",
    "acceptanceCriteria": "Datasets are isolated...",
    "tags": ["E2E", "Playwright"],
    "areaPath": "Platform\\Quality",
    "iterationPath": "Backlog",
    "priority": 2,
    "state": "New",
    "relations": [
      {
        "type": "System.LinkTypes.Hierarchy-Forward",
        "targetId": "12346"
      }
    ]
  }
}
```

## 4. Create a refinement session

Creates a session, stores a work item snapshot, starts the LangGraph workflow, and
returns the first question round.

### Request

`POST /api/refinement/sessions`

```json
{
  "workItemId": "12345",
  "extraContext": "Web pipelines and Continuous Testing jobs may also need updates.",
  "maxRounds": 3,
  "maxQuestionsPerRound": 6
}
```

### Response

```json
{
  "session": {
    "id": "ses_001",
    "status": "QUESTIONING",
    "round": 1,
    "maxRounds": 3,
    "workItemId": "12345",
    "createdAt": "2026-07-28T09:00:00.000Z"
  },
  "questionRound": {
    "id": "qr_001",
    "round": 1,
    "questions": [
      {
        "id": "q1",
        "theme": "data",
        "priority": "high",
        "question": "Which Playwright scenarios still rely on the shared E2E main database?",
        "why": "This defines the migration perimeter."
      }
    ]
  },
  "sessionSummary": {
    "facts": [],
    "assumptions": [],
    "unknowns": [
      "Exact Playwright dataset perimeter"
    ],
    "dependencies": [],
    "risks": [],
    "confidence": "low",
    "enoughContext": false,
    "reason": "The first round still needs data scope, ownership, and delivery impact clarification."
  }
}
```

## 5. Get a session

### Request

`GET /api/refinement/sessions/{session_id}`

### Response

```json
{
  "session": {
    "id": "ses_001",
    "status": "QUESTIONING",
    "round": 1,
    "maxRounds": 3,
    "workItemId": "12345"
  },
  "workItem": {
    "id": "12345",
    "type": "Enabler",
    "title": "Separate E2E databases for Web and API"
  },
  "currentQuestionRound": {
    "id": "qr_001",
    "round": 1,
    "questions": []
  },
  "sessionSummary": {
    "facts": [],
    "assumptions": [],
    "unknowns": [],
    "dependencies": [],
    "risks": [],
    "confidence": "low",
    "enoughContext": false,
    "reason": "The session has not yet collected enough validated context to produce a final split."
  },
  "finalArtifact": null
}
```

## 6. Submit answers for the current round

The backend stores answers, resumes the LangGraph workflow with the same `thread_id`,
recomputes the summary, and either returns a follow-up round or the final artifact.

### Request

`POST /api/refinement/sessions/{session_id}/answers`

```json
{
  "answers": [
    {
      "questionId": "q1",
      "answer": "Only the FR-FR web scenarios still depend on the shared E2E main database."
    },
    {
      "questionId": "q2",
      "answer": "Continuous Testing already separates jobs by target platform, but datasetLabel still points to the shared DB."
    }
  ]
}
```

### Response when another round is needed

```json
{
  "session": {
    "id": "ses_001",
    "status": "QUESTIONING",
    "round": 2,
    "maxRounds": 3,
    "workItemId": "12345"
  },
  "decision": {
    "enoughContext": false,
    "confidence": "medium",
    "reason": "Dataset migration scope is clearer, but CI/CD ownership and rollback strategy remain unclear."
  },
  "questionRound": {
    "id": "qr_002",
    "round": 2,
    "questions": []
  },
  "sessionSummary": {
    "facts": [],
    "assumptions": [],
    "unknowns": [],
    "dependencies": [],
    "risks": [],
    "confidence": "medium",
    "enoughContext": false,
    "reason": "Dataset migration scope is clearer, but CI/CD ownership and rollback strategy remain unclear."
  }
}
```

### Response when the final artifact is ready

```json
{
  "session": {
    "id": "ses_001",
    "status": "FINAL_READY",
    "round": 2,
    "maxRounds": 3,
    "workItemId": "12345"
  },
  "decision": {
    "enoughContext": true,
    "confidence": "high",
    "reason": "The scope, migration path, and CI/CD impacts are sufficiently described."
  },
  "finalArtifact": {
    "summary": "...",
    "scope": {
      "inScope": [],
      "outOfScope": []
    },
    "knownFacts": [],
    "assumptions": [],
    "proposedSplit": {
      "storyCount": 3,
      "rationale": "...",
      "stories": []
    },
    "crossCuttingConcerns": {
      "testing": [],
      "cicd": [],
      "infra": [],
      "data": [],
      "security": [],
      "observability": []
    },
    "deliveryPlan": {
      "recommendedOrder": [],
      "milestones": []
    },
    "openQuestions": []
  }
}
```

## 7. HTMX-friendly partial endpoints

These are optional but recommended if the page should refresh partial sections independently.

- `GET /api/refinement/sessions/{session_id}/partials/current-round`
- `GET /api/refinement/sessions/{session_id}/partials/summary`
- `GET /api/refinement/sessions/{session_id}/partials/final-artifact`

Response type:

- `text/html`

## 8. Export final artifact as markdown

### Request

`GET /api/refinement/sessions/{session_id}/export?format=markdown`

### Response

`text/markdown`

## 9. Error shape

```json
{
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "The LLM response did not match the expected schema.",
    "details": {
      "stage": "generate-questions",
      "retryable": true
    }
  }
}
```

## 10. Internal abstractions

```python
class WorkItemProvider(Protocol):
    async def search(self, query: str, limit: int = 10) -> list[dict]: ...
    async def get_by_id(self, work_item_id: str) -> dict: ...


class RefinementEngine(Protocol):
    async def start_session(self, input_data: dict) -> dict: ...
    async def resume_with_answers(self, session_id: str, answers: list[dict]) -> dict: ...
```
