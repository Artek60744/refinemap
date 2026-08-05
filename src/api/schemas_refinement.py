from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WorkItemRelation(StrictModel):
    type: str
    targetId: str | None = None
    url: str | None = None


class WorkItemSearchItem(StrictModel):
    id: str
    type: str
    title: str
    state: str | None = None
    tags: list[str] = Field(default_factory=list)
    areaPath: str | None = None
    iterationPath: str | None = None


class WorkItemDetail(WorkItemSearchItem):
    url: str | None = None
    description: str | None = None
    acceptanceCriteria: str | None = None
    priority: int | None = None
    relations: list[WorkItemRelation] = Field(default_factory=list)


class SearchWorkItemsResponse(StrictModel):
    items: list[WorkItemSearchItem]


class GetWorkItemResponse(StrictModel):
    workItem: WorkItemDetail


class QuestionItem(StrictModel):
    id: str
    theme: str
    priority: str
    question: str
    why: str


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


class StoryModel(StrictModel):
    title: str
    goal: str
    acceptanceCriteria: list[str] = Field(default_factory=list)
    technicalNotes: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class ProposedSplitModel(StrictModel):
    storyCount: int
    rationale: str
    stories: list[StoryModel] = Field(default_factory=list)


class CrossCuttingConcernsModel(StrictModel):
    testing: list[str] = Field(default_factory=list)
    cicd: list[str] = Field(default_factory=list)
    infra: list[str] = Field(default_factory=list)
    data: list[str] = Field(default_factory=list)
    security: list[str] = Field(default_factory=list)
    observability: list[str] = Field(default_factory=list)


class DeliveryPlanModel(StrictModel):
    recommendedOrder: list[str] = Field(default_factory=list)
    milestones: list[str] = Field(default_factory=list)


class FinalRefinementModel(StrictModel):
    summary: str
    scope: dict[str, list[str]]
    knownFacts: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    proposedSplit: ProposedSplitModel
    crossCuttingConcerns: CrossCuttingConcernsModel
    deliveryPlan: DeliveryPlanModel
    openQuestions: list[str] = Field(default_factory=list)


class SessionModel(StrictModel):
    id: str
    status: str
    round: int
    maxRounds: int
    workItemId: str
    createdAt: datetime | None = None


class DecisionModel(StrictModel):
    enoughContext: bool
    confidence: str
    reason: str


class WorkItemCharacteristics(StrictModel):
    businessPriority: int = 3
    technicalComplexity: int = 3
    risk: int = 3
    effort: int = 5
    businessValue: int = 3


class CreateSessionRequest(StrictModel):
    workItemId: str
    extraContext: str = ""
    maxRounds: int | None = None
    maxQuestionsPerRound: int | None = None
    characteristics: WorkItemCharacteristics | None = None


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
    workItem: WorkItemDetail
    currentQuestionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    finalArtifact: FinalRefinementModel | None = None


class SubmitAnswersResponse(StrictModel):
    session: SessionModel
    decision: DecisionModel
    questionRound: QuestionRoundModel | None = None
    sessionSummary: SessionSummaryModel
    finalArtifact: FinalRefinementModel | None = None


class GenerateQuestionsOutput(StrictModel):
    questions: list[QuestionItem]
    reasoningSummary: str
    potentialRisks: list[str] = Field(default_factory=list)
    missingAreas: list[str] = Field(default_factory=list)
    stopCriteria: bool = False


class SessionSummaryOutput(SessionSummaryModel):
    pass


class FinalRefinementOutput(FinalRefinementModel):
    pass
