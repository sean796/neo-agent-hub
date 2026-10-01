import type { RespondFn } from "@slack/bolt";
import { getUserConnection, hasGoogleConnection } from "./connections.js";
import { buildGoogleConnectUrl, googleOAuthConfigured } from "./google-oauth.js";

export async function runMeetingNotesCommand(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
): Promise<void> {
  if (!googleOAuthConfigured()) {
    await respond({
      response_type: "ephemeral",
      text: "Google OAuth is not configured on the server yet. Ask an admin to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, and TOKEN_ENCRYPTION_KEY on Render.",
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
            text: "*Meeting Notes*\nConnect your Google account once so Neo Agent Hub can read Gemini meeting notes in Gmail.",
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

  await respond({
    response_type: "ephemeral",
    text: "Google is connected. Fetching the latest meeting note from Gmail is the next step (not implemented yet).",
  });
}
