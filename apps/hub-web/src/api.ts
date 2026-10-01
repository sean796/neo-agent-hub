const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface HubSettingsPublic {
  openRouter: { configured: boolean; suffix: string | null };
  openRouterModel: string;
}

export async function fetchHubSettings(): Promise<HubSettingsPublic> {
  const res = await fetch(apiUrl("/api/hub/settings"));
  if (!res.ok) throw new Error(`Settings ${res.status}`);
  return res.json() as Promise<HubSettingsPublic>;
}

export async function saveOpenRouterSettings(
  adminToken: string,
  openRouterApiKey: string,
  openRouterModel: string,
): Promise<HubSettingsPublic> {
  const res = await fetch(apiUrl("/api/hub/settings/openrouter"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Admin-Token": adminToken,
    },
    body: JSON.stringify({ openRouterApiKey, openRouterModel }),
  });
  const data = (await res.json()) as HubSettingsPublic & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Save ${res.status}`);
  return data;
}

const ADMIN_TOKEN_KEY = "neo_agent_hub_admin_token";

export function loadAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function saveAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
}
