import { apiFetch } from "./client";
import type {
  CreateSessionRequest,
  SessionDetailResponse,
  SetModeRequest,
  StartSessionResponse,
  SubmitAnswersRequest,
  SubmitAnswersResponse,
} from "../types/api";

const BASE = "/api/refinement";

export function createSession(payload: CreateSessionRequest): Promise<StartSessionResponse> {
  return apiFetch(`${BASE}/sessions`, { method: "POST", body: JSON.stringify(payload) });
}

export function getSession(sessionId: string): Promise<SessionDetailResponse> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}`);
}

export function setSessionMode(
  sessionId: string,
  payload: SetModeRequest,
): Promise<SessionDetailResponse> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}/mode`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
