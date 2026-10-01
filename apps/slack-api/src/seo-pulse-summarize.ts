import type { SeoPulseBundle } from "./pulse-client.js";
import { getOpenRouterApiKey, getOpenRouterModel } from "./hub-settings.js";

export interface SeoPulseDigest {
  headline: string;
  bullets: string[];
  recommendedAction: string;
  ownerHint: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
    recommendedAction: { type: "string" },
    ownerHint: { type: "string" },
  },
  required: ["headline", "bullets", "recommendedAction", "ownerHint"],
  additionalProperties: false,
} as const;

export async function summarizeSeoPulse(bundle: SeoPulseBundle): Promise<SeoPulseDigest> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured. Add it in Neo Agent Hub Settings.");
  }
  const model = await getOpenRouterModel();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.API_PUBLIC_URL ?? "https://neo-agent-hub-api.onrender.com",
      "X-Title": "Neo Agent Hub seo-pulse",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You write a short Slack SEO pulse for an agency client channel. Use only the JSON metrics provided. One clear recommended action. ownerHint is a plain name or role, not a Slack mention unless data includes it. No ranking guarantees.",
        },
        { role: "user", content: JSON.stringify(bundle) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "seo_pulse_digest", strict: true, schema: SCHEMA },
      },
    }),
  });

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? "OpenRouter request failed");
  }
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter returned empty content");

  const parsed = JSON.parse(raw) as SeoPulseDigest;
  if (!parsed.headline || !parsed.recommendedAction || !Array.isArray(parsed.bullets)) {
    throw new Error("OpenRouter SEO pulse shape invalid");
  }
  return parsed;
}

export function formatSeoPulseMrkdwn(bundle: SeoPulseBundle, digest: SeoPulseDigest): string {
  const lines = [
    `*${digest.headline}*`,
    `_${bundle.siteLabel} · ${bundle.periodLabel}_`,
    "",
    ...digest.bullets.map((b) => `• ${b}`),
    "",
    `*Recommended action:* ${digest.recommendedAction}`,
    `*Owner:* ${digest.ownerHint}`,
  ];
  if (bundle.bundleRef) {
    lines.push("", `_Ref: ${bundle.bundleRef}_`);
  }
  return lines.join("\n");
}
