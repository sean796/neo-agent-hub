import type { GeminiMeetingNote } from "./gmail-api.js";
import type { MeetingChecklistResult } from "./meeting-notes-checklist.js";
import { refreshGoogleAccessToken } from "./google-access-token.js";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1/documents";

export function meetingNotesDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function docTitle(checklist: MeetingChecklistResult, note: GeminiMeetingNote): string {
  const when = note.receivedAt
    ? new Date(note.receivedAt).toLocaleDateString("en-CA", { timeZone: "America/Edmonton" })
    : new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
  return `Meeting recap – ${checklist.meetingTitle} – ${when}`;
}

function docBodyText(note: GeminiMeetingNote, checklist: MeetingChecklistResult): string {
  const when = note.receivedAt
    ? new Date(note.receivedAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" })
    : "";
  const lines: string[] = [
    checklist.meetingTitle,
    "",
    `Gemini note subject: ${note.subject}`,
    when ? `Received: ${when} (Mountain Time)` : "",
    `Gmail message id: ${note.messageId}`,
    "",
    "Task list",
    ...checklist.taskItems.map((item) => `• ${item}`),
    "",
    "Checklist",
    ...checklist.checklistItems.map((item) => `• ${item}`),
  ];
  return lines.join("\n").trimEnd();
}

export async function publishMeetingRecapToDrive(
  refreshToken: string,
  note: GeminiMeetingNote,
  checklist: MeetingChecklistResult,
): Promise<{ webViewLink: string; fileId: string }> {
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const title = docTitle(checklist, note);
  const bodyText = docBodyText(note, checklist);
  const templateId = process.env.MEETING_NOTES_DRIVE_TEMPLATE_ID?.trim();
  const folderId = process.env.MEETING_NOTES_DRIVE_FOLDER_ID?.trim();

  let fileId: string;

  if (templateId) {
    const copyParams = new URLSearchParams({ supportsAllDrives: "true" });
    const copyRes = await fetch(`${DRIVE}/files/${templateId}/copy?${copyParams}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        ...(folderId ? { parents: [folderId] } : {}),
      }),
    });
    const copyJson = (await copyRes.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (!copyRes.ok || !copyJson.id) {
      const msg = copyJson.error?.message ?? "Drive copy failed";
      if (copyRes.status === 403) {
        throw new Error(`${msg}. Reconnect Google to allow Drive publish.`);
      }
      throw new Error(msg);
    }
    fileId = copyJson.id;
    await replaceDocContent(accessToken, fileId, bodyText);
  } else {
    const createRes = await fetch(`${DRIVE}/files?supportsAllDrives=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.document",
        ...(folderId ? { parents: [folderId] } : {}),
      }),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) {
      const msg = createJson.error?.message ?? "Drive create failed";
      if (createRes.status === 403) {
        throw new Error(`${msg}. Reconnect Google to allow Drive publish.`);
      }
      throw new Error(msg);
    }
    fileId = createJson.id;
    await replaceDocContent(accessToken, fileId, bodyText);
  }

  const metaRes = await fetch(
    `${DRIVE}/files/${fileId}?fields=webViewLink&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const meta = (await metaRes.json()) as { webViewLink?: string; error?: { message?: string } };
  if (!metaRes.ok || !meta.webViewLink) {
    throw new Error(meta.error?.message ?? "Could not read Drive link");
  }

  return { webViewLink: meta.webViewLink, fileId };
}

async function replaceDocContent(accessToken: string, documentId: string, text: string): Promise<void> {
  const getRes = await fetch(`${DOCS}/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const doc = (await getRes.json()) as {
    body?: { content?: { endIndex?: number }[] };
    error?: { message?: string };
  };
  if (!getRes.ok) {
    throw new Error(doc.error?.message ?? "Docs read failed");
  }
  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;
  const requests: object[] = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex: endIndex - 1 },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text,
    },
  });
  const batchRes = await fetch(`${DOCS}/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  const batchJson = (await batchRes.json()) as { error?: { message?: string } };
  if (!batchRes.ok) {
    throw new Error(batchJson.error?.message ?? "Docs update failed");
  }
}
