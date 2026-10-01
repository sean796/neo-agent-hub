import type { RespondFn } from "@slack/bolt";
import { getUserConnection, hasGoogleConnection } from "./connections.js";
import { buildGoogleConnectUrl, googleOAuthConfigured } from "./google-oauth.js";
import { fetchLatestGeminiMeetingNote, getRefreshTokenForSlackUser } from "./gmail-api.js";
import {
  buildChecklistFromNote,
  formatChecklistSlackMrkdwn,
  openRouterConfigured,
} from "./meeting-notes-checklist.js";

export async function runMeetingNotesCommand(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
): Promise<void> {
  if (!googleOAuthConfigured()) {
    await respond({
      response_type: "ephemeral",
      text: "Hub Google login is not available. Contact Neo Digital ops.",
    });
    return;
  }

  const row = await getUserConnection(slackUserId, slackTeamId);
  if (!hasGoogleConnection(row)) {
    const connectUrl = buildGoogleConnectUrl(slackUserId, slackTeamId);
    await respond({
      response_type: "ephemeral",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Meeting Notes*\nConnect your Google account once (Gmail read-only).\n<${connectUrl}|Connect Google>`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Connect Google" },
              url: connectUrl,
              action_id: "connect_google",
            },
          ],
        },
      ],
      text: "Connect Google to use Meeting Notes.",
    });
    return;
  }

  if (!openRouterConfigured()) {
    await respond({
      response_type: "ephemeral",
      text: "Meeting Notes checklist is not available. Contact Neo Digital ops (OpenRouter not configured).",
    });
    return;
  }

  try {
    const refreshToken = await getRefreshTokenForSlackUser(slackUserId, slackTeamId);
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Meeting notes failed";
    const reconnect =
      /invalid_grant|Token refresh failed|invalid authentication credentials/i.test(msg)
        ? " Reconnect Google with `/meeting-notes` (Connect Google)."
        : "";
    await respond({
      response_type: "ephemeral",
      text: `Meeting Notes failed: ${msg}${reconnect}`,
    });
  }
}
