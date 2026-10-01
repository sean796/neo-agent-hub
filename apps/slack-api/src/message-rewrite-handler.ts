import type { App } from "@slack/bolt";
import {
  getSlackUserAccessToken,
  getUserConnectionWithSlackToken,
  hasSlackUserToken,
} from "./connections.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import {
  authorizeButtonLabel,
  type RewriteMode,
} from "./message-rewrite-modes.js";
import { slackClientSecretMisconfigured } from "./slack-oauth-config.js";
import { buildSlackUserConnectUrl, slackUserOAuthConfiguredAsync } from "./slack-user-oauth.js";
import { applyRewriteInPlace } from "./rewrite-in-place.js";
import { openMessageRewriteModal } from "./rewrite-modal.js";

type SlackMessagePayload = {
  user?: string;
  ts?: string;
  text?: string;
  blocks?: Array<{ type?: string; text?: { text?: string } }>;
};

export function textFromSlackMessage(message: SlackMessagePayload): string {
  const plain = message.text?.trim() ?? "";
  if (plain) return plain;
  const fromBlocks = (message.blocks ?? [])
    .map((b) => (b.type === "section" ? b.text?.text?.trim() : ""))
    .filter(Boolean)
    .join("\n");
  return fromBlocks.trim();
}

export function registerMessageRewriteHandler(
  app: App,
  callbackId: string,
  mode: RewriteMode,
  options?: { openAdjustModal?: boolean },
): void {
  app.shortcut(callbackId, async ({ shortcut, ack, respond, client }) => {
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
        text: "AI rewrite only works on messages you posted.",
      });
      return;
    }

    const original = textFromSlackMessage(message);
    if (!original) {
      await respond({
        response_type: "ephemeral",
        text: "This message has no text to rewrite.",
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

    if (options?.openAdjustModal && "trigger_id" in shortcut && shortcut.trigger_id) {
      await openMessageRewriteModal(client, shortcut.trigger_id, {
        channelId,
        messageTs,
        actorId,
        teamId,
        originalText: original,
        defaultMode: mode,
      });
      return;
    }

    if (!(await slackUserOAuthConfiguredAsync())) {
      const misSecret = slackClientSecretMisconfigured();
      await respond({
        response_type: "ephemeral",
        text: misSecret
          ? "Slack OAuth client secret on Render is wrong: use Client Secret from api.slack.com Basic Information, not Signing Secret."
          : "In-place rewrite is not configured on the server (Slack user OAuth).",
      });
      return;
    }

    const row = await getUserConnectionWithSlackToken(actorId, teamId);
    if (!hasSlackUserToken(row)) {
      const connectUrl = buildSlackUserConnectUrl(actorId, teamId, {
        channelId,
        messageTs,
        originalText: original,
        mode,
      });
      await respond({
        response_type: "ephemeral",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "One-time Slack approval so Neo Agent Hub can edit *your* messages. Then this rewrite runs automatically.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: authorizeButtonLabel(mode) },
                url: connectUrl,
                action_id: `rewrite_oauth_${mode}`,
              },
            ],
          },
        ],
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
            text: "Slack connect expired. Run the message shortcut again.",
          });
          return;
        }
        await applyRewriteInPlace(userToken, channelId, messageTs, original, mode);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Rewrite failed";
        await respond({
          response_type: "ephemeral",
          text: `Rewrite failed: ${msg}`,
        });
      }
    })();
  });
}
