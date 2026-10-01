import { decryptString } from "./crypto.js";
import { getUserConnection } from "./connections.js";
import { refreshGoogleAccessToken } from "./google-access-token.js";

const GEMINI_FROM = "gemini-notes@google.com";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GEMINI_QUERY = `from:${GEMINI_FROM} subject:Notes`;

export interface GeminiMeetingNote {
  subject: string;
  receivedAt: string;
  bodyText: string;
  messageId: string;
}

export interface GeminiMeetingNoteSummary {
  messageId: string;
  subject: string;
  receivedAt: string;
  snippet: string;
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

function receivedAtFromMessage(msg: GmailMessage): string {
  const ms = msg.internalDate ? Number(msg.internalDate) : NaN;
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  return headerValue(msg.payload?.headers, "Date");
}

function messageToNote(msg: GmailMessage, id: string): GeminiMeetingNote {
  const subject = headerValue(msg.payload?.headers, "Subject");
  return {
    subject: subject || "Gemini meeting notes",
    receivedAt: receivedAtFromMessage(msg),
    bodyText: messageBodyText(msg),
    messageId: id,
  };
}

function messageToSummary(msg: GmailMessage, id: string): GeminiMeetingNoteSummary {
  const subject = headerValue(msg.payload?.headers, "Subject");
  return {
    messageId: id,
    subject: subject || "Gemini meeting notes",
    receivedAt: receivedAtFromMessage(msg),
    snippet: msg.snippet?.trim() ?? "",
  };
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

async function listMessageIds(accessToken: string, maxResults: number): Promise<string[]> {
  const q = encodeURIComponent(GEMINI_QUERY);
  const listRes = await fetch(`${GMAIL}/messages?maxResults=${maxResults}&q=${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const listJson = (await listRes.json()) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!listRes.ok) {
    throw new Error(listJson.error?.message ?? "Gmail list failed");
  }
  return (listJson.messages ?? []).map((m) => m.id).filter(Boolean);
}

async function fetchMessageMetadata(accessToken: string, id: string): Promise<GeminiMeetingNoteSummary> {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "Subject",
  });
  params.append("metadataHeaders", "Date");
  const msgRes = await fetch(`${GMAIL}/messages/${id}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const msg = (await msgRes.json()) as GmailMessage & { error?: { message?: string } };
  if (!msgRes.ok) {
    throw new Error(msg.error?.message ?? "Gmail get message failed");
  }
  return messageToSummary(msg, id);
}

export async function listGeminiMeetingNotes(
  refreshToken: string,
  maxResults = 15,
): Promise<GeminiMeetingNoteSummary[]> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const ids = await listMessageIds(accessToken, maxResults);
  const summaries: GeminiMeetingNoteSummary[] = [];
  for (const id of ids) {
    summaries.push(await fetchMessageMetadata(accessToken, id));
  }
  return summaries;
}

export async function fetchGeminiMeetingNoteById(
  refreshToken: string,
  messageId: string,
): Promise<GeminiMeetingNote> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const msgRes = await fetch(`${GMAIL}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const msg = (await msgRes.json()) as GmailMessage & { error?: { message?: string } };
  if (!msgRes.ok) {
    throw new Error(msg.error?.message ?? "Gmail get message failed");
  }
  return messageToNote(msg, messageId);
}

export async function fetchLatestGeminiMeetingNote(
  refreshToken: string,
): Promise<GeminiMeetingNote | null> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const ids = await listMessageIds(accessToken, 1);
  const id = ids[0];
  if (!id) return null;
  return fetchGeminiMeetingNoteById(refreshToken, id);
}
