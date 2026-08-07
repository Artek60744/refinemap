import { apiFetch } from "./client";
import type {
  CreateSessionRequest,
  ListSessionsParams,
  RenameSessionRequest,
  SessionDetailResponse,
  SessionListItem,
  SessionListResponse,
  SetModeRequest,
  StartSessionResponse,
  SubmitAnswersRequest,
  SubmitAnswersResponse,
} from "../types/api";

const BASE = "/api/refinement";

export function createSession(payload: CreateSessionRequest): Promise<StartSessionResponse> {
  return apiFetch(`${BASE}/sessions`, { method: "POST", body: JSON.stringify(payload) });
}

export function listSessions(params: ListSessionsParams = {}): Promise<SessionListResponse> {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch(`${BASE}/sessions${query ? `?${query}` : ""}`);
}

export function renameSession(
  sessionId: string,
  payload: RenameSessionRequest,
): Promise<SessionListItem> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteSession(sessionId: string): Promise<void> {
  return apiFetch(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
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
