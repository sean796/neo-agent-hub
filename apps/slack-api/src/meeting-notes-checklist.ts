import type { GeminiMeetingNote } from "./gmail-api.js";
import { getOpenRouterApiKey, getOpenRouterModel } from "./hub-settings.js";

export interface MeetingChecklistResult {
  meetingTitle: string;
  checklistItems: string[];
}

const CHECKLIST_SCHEMA = {
  type: "object",
  properties: {
    meetingTitle: { type: "string" },
    checklistItems: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
  },
  required: ["meetingTitle", "checklistItems"],
  additionalProperties: false,
} as const;

export async function buildChecklistFromNote(note: GeminiMeetingNote): Promise<MeetingChecklistResult> {
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
      "X-Title": "Neo Agent Hub meeting-notes",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You turn Gemini meeting-note emails into a short Slack checklist. Output JSON only matching the schema. Each checklist item is one actionable task (verb-led, under 120 chars). Use the email subject and body; do not invent facts.",
        },
        {
          role: "user",
          content: JSON.stringify({
            subject: note.subject,
            receivedAt: note.receivedAt,
            body: note.bodyText.slice(0, 24_000),
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meeting_checklist",
          strict: true,
          schema: CHECKLIST_SCHEMA,
        },
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
  if (!raw) {
    throw new Error("OpenRouter returned empty content");
  }

  let parsed: MeetingChecklistResult;
  try {
    parsed = JSON.parse(raw) as MeetingChecklistResult;
  } catch {
    throw new Error("OpenRouter returned invalid JSON");
  }

  if (!parsed.meetingTitle || !Array.isArray(parsed.checklistItems) || parsed.checklistItems.length === 0) {
    throw new Error("OpenRouter checklist shape invalid");
  }

  return parsed;
}

export function formatChecklistSlackMrkdwn(
  note: GeminiMeetingNote,
  checklist: MeetingChecklistResult,
): string {
  const when = note.receivedAt
    ? new Date(note.receivedAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" })
    : "";
  const lines = checklist.checklistItems.map((item) => `• ${item}`);
  return [
    `*${checklist.meetingTitle}*`,
    when ? `_Latest Gemini note (${when} MT)_` : "_Latest Gemini note_",
    "",
    "*Checklist*",
    ...lines,
  ].join("\n");
}
