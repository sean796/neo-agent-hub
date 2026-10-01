import type { RespondFn } from "@slack/bolt";
import { getUserConnection, hasGoogleConnection } from "./connections.js";
import { buildGoogleConnectUrl, googleOAuthConfigured } from "./google-oauth.js";
import { getRefreshTokenForSlackUser } from "./gmail-api.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";

/** Returns refresh token when ready; otherwise sends ephemeral Slack message and returns null. */
export async function ensureMeetingNotesReady(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
): Promise<string | null> {
  if (!googleOAuthConfigured()) {
    await respond({
      response_type: "ephemeral",
      text: "Hub Google login is not available. Contact Neo Digital ops.",
    });
    return null;
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
    return null;
  }

  if (!(await openRouterConfiguredAsync())) {
    await respond({
      response_type: "ephemeral",
      text: "Meeting Notes checklist is not available. Add an OpenRouter API key in Neo Agent Hub Settings.",
    });
    return null;
  }

  try {
    return await getRefreshTokenForSlackUser(slackUserId, slackTeamId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google connection error";
    await respond({ response_type: "ephemeral", text: msg });
    return null;
  }
}

export function meetingNotesFailureMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Meeting notes failed";
  const reconnect =
    /invalid_grant|Token refresh failed|invalid authentication credentials/i.test(msg)
      ? " Reconnect Google with `/meeting-notes` (Connect Google)."
      : "";
  return `Meeting Notes failed: ${msg}${reconnect}`;
}
