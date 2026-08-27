from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- subject ---------------------------------------------------------------


class SubjectModel(StrictModel):
    id: str
    title: str
    description: str = ""
    mode: str = "auto"
    grid: str = "po"
    notes: str = ""


# --- questions & summary ---------------------------------------------------


class QuestionItem(StrictModel):
    id: str
    theme: str
    priority: str
    question: str
    why: str
    # Short candidate answers proposed by the model, offered as one-click chips.
    suggestions: list[str] = Field(default_factory=list)


class QuestionRoundModel(StrictModel):
    id: str
    round: int
    questions: list[QuestionItem] = Field(default_factory=list)


class SessionSummaryModel(StrictModel):
    facts: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    confidence: str = "low"
    enoughContext: bool = False
    reason: str = ""


# --- deliverable (Brief / Plan / Code Draft) -------------------------------


class BriefSection(StrictModel):
    heading: str
    items: list[str] = Field(default_factory=list)


class PlanStep(StrictModel):
    title: str
    detail: str = ""


DecisionRecommendation = Literal["go", "explore", "rework", "drop"]


class DecisionReport(StrictModel):
    """Explicit verdict closing the refinement: not a summary, an arbitration."""

    recommendation: DecisionRecommendation = "explore"
    # Solidity of the verdict itself, not of the project context.
    confidence: str = "low"
    # 2-4 blunt reasons, each citing a specific fact/risk/unknown.
    reasons: list[str] = Field(default_factory=list)
    # The 1-3 conditions that actually prevent moving forward (framing, not implementation).
    blockers: list[str] = Field(default_factory=list)
    # What is already validated and justifies not dropping the idea.
    strengths: list[str] = Field(default_factory=list)
    # The single priority action, imperative form.
    nextAction: str = ""

    @model_validator(mode="before")
    @classmethod
    def _migrate_v1(cls, data: object) -> object:
        # Sessions finalized with the first report format persisted rationale /
        # changeTriggers / objections / validationConditions; map them so stored
        # payloads keep validating under extra="forbid".
        if not isinstance(data, dict) or "rationale" not in data:
            return data
        migrated = dict(data)
        rationale = migrated.pop("rationale", "")
        triggers = migrated.pop("changeTriggers", [])
        objections = migrated.pop("objections", [])
        conditions = migrated.pop("validationConditions", [])
        migrated.setdefault("reasons", [rationale] if rationale else [])
        blockers = list(triggers) + [item for item in conditions if item not in triggers]
        migrated.setdefault("blockers", blockers)
        migrated.setdefault("strengths", list(objections))
        migrated.setdefault("nextAction", "")
        return migrated

    @field_validator("recommendation", "confidence", mode="before")
    @classmethod
    def _normalize(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class RefinementDeliverable(StrictModel):
    summary: str = ""
    brief: list[BriefSection] = Field(default_factory=list)
    plan: list[PlanStep] = Field(default_factory=list)
    codeDraft: str | None = None
    openQuestions: list[str] = Field(default_factory=list)
    # None on sessions finalized before decision reports existed.
    decisionReport: DecisionReport | None = None


# --- product memory --------------------------------------------------------


class ProductModel(StrictModel):
    id: str
    name: str
    factCount: int = 0
    createdAt: datetime | None = None


class ProductMemoryItem(StrictModel):
    """One durable fact about the product, carried across sessions."""

    id: str
    category: str
    statement: str
    confirmed: bool = False
    sourceSessionId: str | None = None
    updatedAt: datetime | None = None


class ProductMemoryListResponse(StrictModel):
    product: ProductModel
    facts: list[ProductMemoryItem] = Field(default_factory=list)


class CreateProductRequest(StrictModel):
    name: str = Field(min_length=1, max_length=255)


class CreateMemoryFactRequest(StrictModel):
    category: str = "produit"
    statement: str = Field(min_length=1)


class UpdateMemoryFactRequest(StrictModel):
    statement: str | None = None
    confirmed: bool | None = None


# --- session ---------------------------------------------------------------


class SessionModel(StrictModel):
    id: str
    status: str
    round: int
    maxRounds: int
    subjectId: str
    mode: str = "auto"
    grid: str = "po"
    detectedGrid: str | None = None
    productId: str | None = None
    productName: str = ""
    createdAt: datetime | None = None


class DecisionModel(StrictModel):
    enoughContext: bool
    confidence: str
    reason: str


class CreateSessionRequest(StrictModel):
    objective: str = ""
    mode: str = "auto"
    extraContext: str = ""
    # Scope of the product memory. productId wins; productName creates on the fly.
    # Both empty means a session without memory.
    productId: str | None = None
    productName: str = ""
    maxRounds: int | None = None
    maxQuestionsPerRound: int | None = None


class SetModeRequest(StrictModel):
    mode: str


class AnswerInput(StrictModel):
    questionId: str
    answer: str


class SubmitAnswersRequest(StrictModel):
    answers: list[AnswerInput]


class StartSessionResponse(StrictModel):
    session: SessionModel
    questionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    # Facts injected from past sessions, so round 0 can show what is assumed known.
    productMemory: list[ProductMemoryItem] = Field(default_factory=list)
    # True when the LLM failed and the offline engine produced this content.
    degraded: bool = False


class AnswerHistoryItem(StrictModel):
    questionId: str
    round: int
    answer: str


class SessionDetailResponse(StrictModel):
    session: SessionModel
    subject: SubjectModel
    currentQuestionRound: QuestionRoundModel | None = None
    # Full history so the UI can render the whole conversation, not just the open round.
    questionRounds: list[QuestionRoundModel] = Field(default_factory=list)
    answers: list[AnswerHistoryItem] = Field(default_factory=list)
    sessionSummary: SessionSummaryModel
    productMemory: list[ProductMemoryItem] = Field(default_factory=list)
    deliverable: RefinementDeliverable | None = None


class RenameSessionRequest(StrictModel):
    title: str = Field(min_length=1, max_length=512)


class SessionListItem(StrictModel):
    """One row of the history list. SessionModel carries no title and no updatedAt."""

    id: str
    title: str
    status: str
    grid: str
    mode: str
    round: int
    maxRounds: int
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    completedAt: datetime | None = None


class SessionListResponse(StrictModel):
    items: list[SessionListItem] = Field(default_factory=list)
    total: int
    limit: int
    offset: int


class SubmitAnswersResponse(StrictModel):
    session: SessionModel
    decision: DecisionModel
    questionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    deliverable: RefinementDeliverable | None = None
    # True when the LLM failed and the offline engine produced this content.
    degraded: bool = False


# --- LLM structured outputs ------------------------------------------------


class GenerateQuestionsOutput(StrictModel):
    questions: list[QuestionItem]
    reasoningSummary: str
    potentialRisks: list[str] = Field(default_factory=list)
    missingAreas: list[str] = Field(default_factory=list)
    stopCriteria: bool = False


class SessionSummaryOutput(SessionSummaryModel):
    pass


class RefinementDeliverableOutput(RefinementDeliverable):
    pass


class DetectModeOutput(StrictModel):
    grid: str
    reason: str = ""


class ProductMemoryOp(StrictModel):
    """One entry of the extraction diff. `id` targets an existing fact on update/remove."""

    # Deliberately a plain str, not a Literal: an unknown action is skipped by the
    # repository, whereas a Literal would fail the whole diff over one bad entry.
    action: str = "add"
    id: str | None = None
    category: str = "produit"
    statement: str = ""

    @field_validator("action", "category", mode="before")
    @classmethod
    def _normalize_op(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class ProductMemoryOpsOutput(StrictModel):
    ops: list[ProductMemoryOp] = Field(default_factory=list)
    reason: str = ""
