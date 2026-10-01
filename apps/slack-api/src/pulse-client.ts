export interface SeoPulseBundle {
  siteLabel: string;
  periodLabel: string;
  clicksDelta: number;
  impressionsDelta: number;
  topQueries: { query: string; clicks: number; delta: number }[];
  bundleRef?: string;
}

export function pulseBridgeConfigured(): boolean {
  return Boolean(process.env.PULSE_API_BASE?.trim() && process.env.HUB_PULSE_SERVICE_TOKEN?.trim());
}

export async function fetchSeoPulseBundle(siteId: string): Promise<SeoPulseBundle> {
  const base = process.env.PULSE_API_BASE!.replace(/\/$/, "");
  const token = process.env.HUB_PULSE_SERVICE_TOKEN!;
  const res = await fetch(`${base}/api/internal/seo-pulse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Service-Token": token,
    },
    body: JSON.stringify({ siteId, period: "mom" }),
  });
  const json = (await res.json()) as SeoPulseBundle & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? `Pulse API ${res.status}`);
  }
  if (!json.siteLabel || !Array.isArray(json.topQueries)) {
    throw new Error("Pulse SEO pulse response shape invalid");
  }
  return json;
}

export function resolveSiteIdFromArg(arg: string): string | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return process.env.SEO_PULSE_DEFAULT_SITE_ID?.trim() || undefined;
  const mapJson = process.env.SEO_PULSE_SITE_MAP_JSON;
  if (!mapJson) return trimmed;
  try {
    const map = JSON.parse(mapJson) as Record<string, string>;
    return map[trimmed] ?? trimmed;
  } catch {
    return trimmed;
  }
}
