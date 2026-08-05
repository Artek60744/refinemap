import { apiFetch } from "./client";
import type {
  CreateSessionRequest,
  GetWorkItemResponse,
  SearchWorkItemsResponse,
  SessionDetailResponse,
  StartSessionResponse,
  SubmitAnswersRequest,
  SubmitAnswersResponse,
} from "../types/api";

const BASE = "/api/refinement";

export function searchWorkItems(query: string, limit = 10): Promise<SearchWorkItemsResponse> {
  return apiFetch(`${BASE}/work-items/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function getWorkItem(workItemId: string): Promise<GetWorkItemResponse> {
  return apiFetch(`${BASE}/work-items/${encodeURIComponent(workItemId)}`);
}

export function createSession(payload: CreateSessionRequest): Promise<StartSessionResponse> {
  return apiFetch(`${BASE}/sessions`, { method: "POST", body: JSON.stringify(payload) });
}

export function getSession(sessionId: string): Promise<SessionDetailResponse> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}`);
}

export function submitAnswers(
  sessionId: string,
  payload: SubmitAnswersRequest,
): Promise<SubmitAnswersResponse> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function exportUrl(sessionId: string): string {
  return `${BASE}/sessions/${encodeURIComponent(sessionId)}/export`;
}
