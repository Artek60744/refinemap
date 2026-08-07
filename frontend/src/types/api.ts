// Mirrors src/api/schemas_refinement.py and src/api/schemas_settings.py.

// --- refinement ------------------------------------------------------------

export type SessionStatus = "DRAFT" | "QUESTIONING" | "ANALYZING" | "FINAL_READY";
export type RefinementMode = "po" | "technique" | "hybride" | "auto";
export type RefinementGrid = "po" | "technique" | "hybride";

export interface SubjectModel {
  id: string;
  title: string;
  description: string;
  mode: string;
  grid: string;
  notes: string;
}

export interface QuestionItem {
  id: string;
  theme: string;
  priority: string;
  question: string;
  why: string;
  suggestions?: string[];
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

export interface BriefSection {
  heading: string;
  items: string[];
}

export interface PlanStep {
  title: string;
  detail: string;
}

export interface RefinementDeliverable {
  summary: string;
  brief: BriefSection[];
  plan: PlanStep[];
  codeDraft: string | null;
  openQuestions: string[];
}

export interface SessionModel {
  id: string;
  status: SessionStatus;
  round: number;
  maxRounds: number;
  subjectId: string;
  mode: string;
  grid: string;
  detectedGrid: string | null;
  createdAt: string | null;
}

export interface SessionListItem {
  id: string;
  title: string;
  status: SessionStatus;
  grid: string;
  mode: string;
  round: number;
  maxRounds: number;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface SessionListResponse {
  items: SessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListSessionsParams {
  q?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface RenameSessionRequest {
  title: string;
}

export interface DecisionModel {
  enoughContext: boolean;
  confidence: string;
  reason: string;
}

export interface CreateSessionRequest {
  objective: string;
  mode?: string;
  extraContext?: string;
  maxRounds?: number;
  maxQuestionsPerRound?: number;
}

export interface SetModeRequest {
  mode: string;
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
  degraded: boolean;
}

export interface AnswerHistoryItem {
  questionId: string;
  round: number;
  answer: string;
}

export interface SessionDetailResponse {
  session: SessionModel;
  subject: SubjectModel;
  currentQuestionRound: QuestionRoundModel | null;
  questionRounds: QuestionRoundModel[];
  answers: AnswerHistoryItem[];
  sessionSummary: SessionSummaryModel;
  deliverable: RefinementDeliverable | null;
}

export interface SubmitAnswersResponse {
  session: SessionModel;
  decision: DecisionModel;
  questionRound: QuestionRoundModel | null;
  sessionSummary: SessionSummaryModel;
  deliverable: RefinementDeliverable | null;
  degraded: boolean;
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

export interface SettingsViewResponse {
  llm: LlmSettingsModel;
}

export interface SaveSettingsRequest {
  llmProvider: string;
  llmEndpoint: string;
  llmApiKey: string;
  llmDeployment: string;
  llmModel: string;
}

export interface ConnectionTestRequest {
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  deployment?: string;
  model?: string;
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
