import { apiFetch } from "./client";
import type {
  AzureDevOpsProjectsResponse,
  ConnectionTestRequest,
  ConnectionTestResponse,
  SaveSettingsRequest,
  SaveSettingsResponse,
  SettingsViewResponse,
} from "../types/api";

const BASE = "/api/settings";

export function getSettings(): Promise<SettingsViewResponse> {
  return apiFetch(BASE);
}

export function saveSettings(payload: SaveSettingsRequest): Promise<SaveSettingsResponse> {
  return apiFetch(BASE, { method: "POST", body: JSON.stringify(payload) });
}

export function testLlm(payload: ConnectionTestRequest): Promise<ConnectionTestResponse> {
  return apiFetch(`${BASE}/test/llm`, { method: "POST", body: JSON.stringify(payload) });
}

export function testAzureDevOps(payload: ConnectionTestRequest): Promise<ConnectionTestResponse> {
  return apiFetch(`${BASE}/test/azure-devops`, { method: "POST", body: JSON.stringify(payload) });
}

export function listAdoProjects(payload: ConnectionTestRequest): Promise<AzureDevOpsProjectsResponse> {
  return apiFetch(`${BASE}/azure-devops/projects`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
