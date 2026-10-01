import type { RespondFn } from "@slack/bolt";
import {
  fetchGeminiMeetingNoteById,
  fetchLatestGeminiMeetingNote,
} from "./gmail-api.js";
import { buildChecklistFromNote, formatChecklistSlackMrkdwn } from "./meeting-notes-checklist.js";
import { checklistResponseBlocks } from "./meeting-notes-response-blocks.js";
import { ensureMeetingNotesReady, meetingNotesFailureMessage } from "./meeting-notes-ready.js";

export async function runChecklistForMessageId(
  slackUserId: string,
  slackTeamId: string,
  messageId: string,
  respond: RespondFn,
): Promise<void> {
  const refreshToken = await ensureMeetingNotesReady(slackUserId, slackTeamId, respond);
  if (!refreshToken) return;

  try {
    const note = await fetchGeminiMeetingNoteById(refreshToken, messageId);
    const checklist = await buildChecklistFromNote(note);
    const text = formatChecklistSlackMrkdwn(note, checklist);
    await respond({
      response_type: "ephemeral",
      text,
      blocks: checklistResponseBlocks(text, note.messageId),
    });
  } catch (e) {
    await respond({
      response_type: "ephemeral",
      text: meetingNotesFailureMessage(e),
    });
  }
}

export async function runChecklistForLatest(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
): Promise<void> {
  const refreshToken = await ensureMeetingNotesReady(slackUserId, slackTeamId, respond);
  if (!refreshToken) return;

  try {
    const note = await fetchLatestGeminiMeetingNote(refreshToken);
    if (!note) {
      await respond({
        response_type: "ephemeral",
        text: "No Gemini meeting notes found in Gmail (from gemini-notes@google.com).",
      });
      return;
    }
    const checklist = await buildChecklistFromNote(note);
    const text = formatChecklistSlackMrkdwn(note, checklist);
    await respond({
      response_type: "ephemeral",
      text,
      blocks: checklistResponseBlocks(text, note.messageId),
    });
  } catch (e) {
    await respond({
      response_type: "ephemeral",
      text: meetingNotesFailureMessage(e),
    });
  }
}
