import type { RespondFn } from "@slack/bolt";
import { openMeetingNotesPicker } from "./meeting-notes-picker.js";
import { runChecklistForLatest } from "./meeting-notes-run.js";

function parseMode(argsText: string): "latest" | "pick" {
  const token = argsText.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (token === "latest") return "latest";
  return "pick";
}

export async function runMeetingNotesCommand(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
  argsText = "",
): Promise<void> {
  const mode = parseMode(argsText);
  if (mode === "latest") {
    await runChecklistForLatest(slackUserId, slackTeamId, respond);
    return;
  }
  await openMeetingNotesPicker(slackUserId, slackTeamId, respond);
}
