// Mirrors src/api/schemas_refinement.py and src/api/schemas_settings.py.

// --- refinement ------------------------------------------------------------

export type SessionStatus = "DRAFT" | "QUESTIONING" | "ANALYZING" | "FINAL_READY";

export interface WorkItemRelation {
  type: string;
  targetId: string | null;
  url: string | null;
}

export interface WorkItemSearchItem {
  id: string;
  type: string;
  title: string;
  state: string | null;
  tags: string[];
  areaPath: string | null;
  iterationPath: string | null;
}

export interface WorkItemDetail extends WorkItemSearchItem {
  url: string | null;
  description: string | null;
  acceptanceCriteria: string | null;
  priority: number | null;
  relations: WorkItemRelation[];
}

export interface SearchWorkItemsResponse {
  items: WorkItemSearchItem[];
}

export interface GetWorkItemResponse {
  workItem: WorkItemDetail;
}

export interface QuestionItem {
  id: string;
  theme: string;
  priority: string;
  question: string;
  why: string;
}

export interface QuestionRoundModel {
  id: string;
  round: number;
  questions: QuestionItem[];
}

export interface SessionSummaryModel {
  facts: string[];
  assumptions: string[];
  unknowns: string[];
  dependencies: string[];
  risks: string[];
  confidence: string;
  enoughContext: boolean;
  reason: string;
}

export interface StoryModel {
  title: string;
  goal: string;
  acceptanceCriteria: string[];
  technicalNotes: string[];
  dependencies: string[];
  risks: string[];
}

export interface ProposedSplitModel {
  storyCount: number;
  rationale: string;
  stories: StoryModel[];
}

export interface CrossCuttingConcernsModel {
  testing: string[];
  cicd: string[];
  infra: string[];
  data: string[];
  security: string[];
  observability: string[];
}

export interface DeliveryPlanModel {
  recommendedOrder: string[];
  milestones: string[];
}

export interface FinalRefinementModel {
  summary: string;
  scope: Record<string, string[]>;
  knownFacts: string[];
  assumptions: string[];
  proposedSplit: ProposedSplitModel;
  crossCuttingConcerns: CrossCuttingConcernsModel;
  deliveryPlan: DeliveryPlanModel;
  openQuestions: string[];
}

export interface SessionModel {
  id: string;
  status: SessionStatus;
  round: number;
  maxRounds: number;
  workItemId: string;
  createdAt: string | null;
}

export interface DecisionModel {
  enoughContext: boolean;
  confidence: string;
  reason: string;
}

export interface CreateSessionRequest {
  workItemId: string;
  extraContext: string;
  maxRounds?: number;
  maxQuestionsPerRound?: number;
}

export interface AnswerInput {
  questionId: string;
  answer: string;
}

export interface SubmitAnswersRequest {
  answers: AnswerInput[];
}

export interface StartSessionResponse {
  session: SessionModel;
  questionRound: QuestionRoundModel | null;
  sessionSummary: SessionSummaryModel;
}

export interface SessionDetailResponse {
  session: SessionModel;
  workItem: WorkItemDetail;
  currentQuestionRound: QuestionRoundModel | null;
  sessionSummary: SessionSummaryModel;
  finalArtifact: FinalRefinementModel | null;
}

export interface SubmitAnswersResponse {
  session: SessionModel;
  decision: DecisionModel;
  questionRound: QuestionRoundModel | null;
  sessionSummary: SessionSummaryModel;
  finalArtifact: FinalRefinementModel | null;
}

// --- settings --------------------------------------------------------------

export interface LlmSettingsModel {
  provider: string;
  endpoint: string;
  deployment: string;
  model: string;
  keyConfigured: boolean;
  keyHint: string | null;
  source: string;
}

export interface AzureDevOpsSettingsModel {
  orgUrl: string;
  project: string;
  mockMode: boolean;
  patConfigured: boolean;
  patHint: string | null;
  source: string;
}

export interface SettingsViewResponse {
  llm: LlmSettingsModel;
  azureDevOps: AzureDevOpsSettingsModel;
}

export interface SaveSettingsRequest {
  llmProvider: string;
  llmEndpoint: string;
  llmApiKey: string;
  llmDeployment: string;
  llmModel: string;
  adoOrgUrl: string;
  adoProject: string;
  adoPat: string;
  adoMockMode: boolean;
}

export interface ConnectionTestRequest {
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  model?: string;
  orgUrl?: string;
  project?: string;
  pat?: string;
  mockMode?: boolean;
}

export interface AzureDevOpsProjectModel {
  id: string;
  name: string;
}

export interface AzureDevOpsProjectsResponse {
  success: boolean;
  message: string;
  projects: AzureDevOpsProjectModel[];
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  details: Record<string, string | number | boolean>;
}

export interface SaveSettingsResponse {
  success: boolean;
  message: string;
  settings: SettingsViewResponse;
}
