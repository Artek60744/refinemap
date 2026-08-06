import { apiFetch } from "./client";
import type {
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
