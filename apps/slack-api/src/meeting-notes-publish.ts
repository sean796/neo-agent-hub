import type { RespondFn } from "@slack/bolt";
import { fetchGeminiMeetingNoteById } from "./gmail-api.js";
import { buildChecklistFromNote } from "./meeting-notes-checklist.js";
import { publishMeetingRecapToDrive } from "./meeting-notes-drive.js";
import { ensureMeetingNotesReady, meetingNotesFailureMessage } from "./meeting-notes-ready.js";

export async function runPublishToDriveForMessageId(
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
    const { webViewLink } = await publishMeetingRecapToDrive(refreshToken, note, checklist);
    await respond({
      response_type: "ephemeral",
      text: `Published to Google Drive: <${webViewLink}|Open meeting recap doc>`,
    });
  } catch (e) {
    await respond({
      response_type: "ephemeral",
      text: meetingNotesFailureMessage(e),
    });
  }
}
