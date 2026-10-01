import { decryptString } from "./crypto.js";
import { getUserConnection } from "./connections.js";

const GEMINI_FROM = "gemini-notes@google.com";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GeminiMeetingNote {
  subject: string;
  receivedAt: string;
  bodyText: string;
  messageId: string;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    const msg = json.error_description ?? json.error ?? "Token refresh failed";
    throw new Error(msg);
  }
  return json.access_token;
}

function decodeBodyData(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function headerValue(headers: { name?: string; value?: string }[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value?.trim() ?? "";
}

function collectBodyParts(
  part: GmailPart | undefined,
  plain: string[],
  html: string[],
): void {
  if (!part) return;
  const mime = part.mimeType ?? "";
  if (part.body?.data) {
    const text = decodeBodyData(part.body.data);
    if (mime === "text/plain") plain.push(text);
    else if (mime === "text/html") html.push(text);
  }
  for (const child of part.parts ?? []) {
    collectBodyParts(child, plain, html);
  }
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};

type GmailMessage = {
  id?: string;
  internalDate?: string;
  snippet?: string;
  payload?: { headers?: { name?: string; value?: string }[]; parts?: GmailPart[]; body?: { data?: string } };
};

function messageBodyText(msg: GmailMessage): string {
  const plain: string[] = [];
  const html: string[] = [];
  if (msg.payload?.body?.data) {
    plain.push(decodeBodyData(msg.payload.body.data));
  }
  collectBodyParts(msg.payload as GmailPart, plain, html);
  const body = plain.join("\n\n").trim() || html.join("\n\n").trim();
  if (body) return body;
  return msg.snippet?.trim() ?? "";
}

export async function getRefreshTokenForSlackUser(
  slackUserId: string,
  slackTeamId: string,
): Promise<string> {
  const row = await getUserConnection(slackUserId, slackTeamId);
  if (!row?.google_refresh_enc) {
    throw new Error("Google is not connected for this Slack user.");
  }
  return decryptString(row.google_refresh_enc);
}

export async function fetchLatestGeminiMeetingNote(
  refreshToken: string,
): Promise<GeminiMeetingNote | null> {
  const accessToken = await refreshAccessToken(refreshToken);
  const q = encodeURIComponent(`from:${GEMINI_FROM} subject:Notes`);
  const listRes = await fetch(`${GMAIL}/messages?maxResults=1&q=${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = (await listRes.json()) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!listRes.ok) {
    throw new Error(listJson.error?.message ?? "Gmail list failed");
  }
  const id = listJson.messages?.[0]?.id;
  if (!id) return null;

  const msgRes = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const msg = (await msgRes.json()) as GmailMessage & { error?: { message?: string } };
  if (!msgRes.ok) {
    throw new Error(msg.error?.message ?? "Gmail get message failed");
  }

  const subject = headerValue(msg.payload?.headers, "Subject");
  const ms = msg.internalDate ? Number(msg.internalDate) : NaN;
  const receivedAt = Number.isFinite(ms) ? new Date(ms).toISOString() : headerValue(msg.payload?.headers, "Date");

  return {
    subject: subject || "Gemini meeting notes",
    receivedAt,
    bodyText: messageBodyText(msg),
    messageId: id,
  };
}
