from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


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


class RefinementDeliverable(StrictModel):
    summary: str = ""
    brief: list[BriefSection] = Field(default_factory=list)
    plan: list[PlanStep] = Field(default_factory=list)
    codeDraft: str | None = None
    openQuestions: list[str] = Field(default_factory=list)


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
    createdAt: datetime | None = None


class DecisionModel(StrictModel):
    enoughContext: bool
    confidence: str
    reason: str


class CreateSessionRequest(StrictModel):
    objective: str = ""
    mode: str = "auto"
    extraContext: str = ""
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


class SessionDetailResponse(StrictModel):
    session: SessionModel
    subject: SubjectModel
    currentQuestionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    deliverable: RefinementDeliverable | None = None


class SubmitAnswersResponse(StrictModel):
    session: SessionModel
    decision: DecisionModel
    questionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    deliverable: RefinementDeliverable | None = None


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
