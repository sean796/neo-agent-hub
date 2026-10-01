import { getOpenRouterApiKey, getOpenRouterModel } from "./hub-settings.js";
import {
  type RewriteMode,
  systemPromptForMode,
} from "./message-rewrite-modes.js";

const SCHEMA = {
  type: "object",
  properties: {
    correctedText: { type: "string" },
  },
  required: ["correctedText"],
  additionalProperties: false,
} as const;

export async function rewriteSlackMessage(
  originalText: string,
  mode: RewriteMode,
): Promise<string> {
  const apiKey = await getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured. Add it in Neo Agent Hub Settings.");
  }
  const model = await getOpenRouterModel();
  const trimmed = originalText.trim();
  if (!trimmed) {
    throw new Error("Message has no text to rewrite.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.API_PUBLIC_URL ?? "https://neo-agent-hub-api.onrender.com",
      "X-Title": `Neo Agent Hub ${mode}`,
    },
    body: JSON.stringify({
      model,
      temperature: mode === "correct" ? 0 : 0.2,
      messages: [
        { role: "system", content: systemPromptForMode(mode) },
        { role: "user", content: trimmed.slice(0, 12_000) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "rewrite", strict: true, schema: SCHEMA },
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

  const parsed = JSON.parse(raw) as { correctedText?: string };
  if (!parsed.correctedText?.trim()) {
    throw new Error("OpenRouter rewrite shape invalid");
  }
  return parsed.correctedText.trim();
}
