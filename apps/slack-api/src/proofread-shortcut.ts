import type { App } from "@slack/bolt";
import {
  getSlackUserAccessToken,
  getUserConnectionWithSlackToken,
  hasSlackUserToken,
} from "./connections.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import { PROOFREAD_MESSAGE_CALLBACK_ID, proofreadSlackMessage } from "./proofread-message.js";
import { slackClientSecretMisconfigured } from "./slack-oauth-config.js";
import { buildSlackUserConnectUrl, slackUserOAuthConfiguredAsync } from "./slack-user-oauth.js";
import { updateMessageAsUser } from "./slack-message-update.js";

type SlackMessagePayload = {
  user?: string;
  ts?: string;
  text?: string;
  blocks?: Array<{ type?: string; text?: { text?: string } }>;
};

function textFromMessage(message: SlackMessagePayload): string {
  const plain = message.text?.trim() ?? "";
  if (plain) return plain;
  const fromBlocks = (message.blocks ?? [])
    .map((b) => (b.type === "section" ? b.text?.text?.trim() : ""))
    .filter(Boolean)
    .join("\n");
  return fromBlocks.trim();
}

export function registerProofreadShortcut(app: App): void {
  app.shortcut(PROOFREAD_MESSAGE_CALLBACK_ID, async ({ shortcut, ack, respond }) => {
    await ack();

    if (shortcut.type !== "message_action") return;

    const message = shortcut.message as SlackMessagePayload;
    const authorId = message.user;
    const actorId = shortcut.user.id;
    const channelId = shortcut.channel.id;
    const messageTs = message.ts;

    if (!messageTs) {
      await respond({
        response_type: "ephemeral",
        text: "Could not read this message timestamp.",
      });
      return;
    }

    if (authorId && authorId !== actorId) {
      await respond({
        response_type: "ephemeral",
        text: "Proofread can only rewrite messages you posted.",
      });
      return;
    }

    const original = textFromMessage(message);
    if (!original) {
      await respond({
        response_type: "ephemeral",
        text: "This message has no text to rewrite (for example only images).",
      });
      return;
    }

    if (!(await openRouterConfiguredAsync())) {
      await respond({
        response_type: "ephemeral",
        text: "OpenRouter is not configured in Neo Agent Hub Settings.",
      });
      return;
    }

    const teamId = shortcut.team?.id ?? shortcut.user.team_id;
    if (!teamId) return;

    if (!(await slackUserOAuthConfiguredAsync())) {
      const misSecret = slackClientSecretMisconfigured();
      await respond({
        response_type: "ephemeral",
        text: misSecret
          ? "Slack OAuth client secret on Render is wrong: use Client Secret from api.slack.com Basic Information, not Signing Secret."
          : "Proofread rewrite is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_USER_OAUTH_REDIRECT_URI on Render.",
      });
      return;
    }

    const row = await getUserConnectionWithSlackToken(actorId, teamId);
    if (!hasSlackUserToken(row)) {
      const connectUrl = buildSlackUserConnectUrl(actorId, teamId);
      await respond({
        response_type: "ephemeral",
        text: `Connect Slack once so Neo Agent Hub can edit your messages.\n<${connectUrl}|Connect Slack>`,
      });
      return;
    }

    void (async () => {
      try {
        const tokenTeamId = row?.slack_team_id ?? teamId;
        const userToken = await getSlackUserAccessToken(actorId, tokenTeamId);
        if (!userToken) {
          await respond({
            response_type: "ephemeral",
            text: "Slack connect expired. Use the Connect Slack link from Proofread again.",
          });
          return;
        }
        const corrected = await proofreadSlackMessage(original);
        await updateMessageAsUser(userToken, channelId, messageTs, corrected);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Proofread failed";
        const reconnect =
          msg === "not_authed" || msg === "invalid_auth" || msg === "token_revoked"
            ? ` ${buildSlackUserConnectUrl(actorId, teamId)}`
            : "";
        await respond({
          response_type: "ephemeral",
          text: `Proofread failed: ${msg}${reconnect}`,
        });
      }
    })();
  });
}
