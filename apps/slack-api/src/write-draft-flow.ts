import type { WebClient } from "@slack/web-api";
import {
  getSlackUserAccessToken,
  getUserConnectionWithSlackToken,
  hasSlackUserToken,
} from "./connections.js";
import { type RewriteMode, authorizeButtonLabel } from "./message-rewrite-modes.js";
import { rewriteSlackMessage } from "./message-rewrite.js";
import { buildSlackUserConnectUrl, slackUserOAuthConfiguredAsync } from "./slack-user-oauth.js";
import { slackClientSecretMisconfigured } from "./slack-oauth-config.js";
import { createSlackMessageDraft } from "./slack-drafts.js";

type ComposeMeta = {
  userId: string;
  teamId: string;
  channelId: string;
  mode: RewriteMode;
  originalText: string;
  respond?: (args: { response_type: "ephemeral"; text: string; blocks?: unknown[] }) => Promise<unknown>;
  client?: WebClient;
};

async function sayEphemeral(
  meta: ComposeMeta,
  text: string,
  blocks?: unknown[],
): Promise<void> {
  if (meta.respond) {
    await meta.respond({ response_type: "ephemeral", text, blocks });
    return;
  }
  if (meta.client) {
    await meta.client.chat.postEphemeral({
      channel: meta.channelId,
      user: meta.userId,
      text,
      blocks: blocks as never,
    });
  }
}

export async function deliverRewriteToComposer(params: ComposeMeta): Promise<void> {
  const { userId, teamId, channelId, mode, originalText } = params;
  const rewritten = await rewriteSlackMessage(originalText, mode);

  if (!(await slackUserOAuthConfiguredAsync())) {
    const misSecret = slackClientSecretMisconfigured();
    await sayEphemeral(
      params,
      misSecret
        ? "Slack OAuth client secret on Render is wrong."
        : "Composer drafts need Slack user OAuth on the server.",
    );
    return;
  }

  const row = await getUserConnectionWithSlackToken(userId, teamId);
  if (!hasSlackUserToken(row)) {
    const connectUrl = buildSlackUserConnectUrl(userId, teamId, {
      channelId,
      originalText,
      mode,
      draftOnly: true,
    });
    await sayEphemeral(params, "Connect Slack to put rewrites in your message box.", [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "One-time Slack approval so Neo Agent Hub can put the rewrite in *your* message box.",
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: authorizeButtonLabel(mode) },
              url: connectUrl,
              action_id: "write_draft_oauth",
            },
          ],
        },
    ]);
    return;
  }

  const tokenTeamId = row?.slack_team_id ?? teamId;
  const userToken = await getSlackUserAccessToken(userId, tokenTeamId);
  if (!userToken) {
    await sayEphemeral(params, "Slack connect expired. Run /write again.");
    return;
  }

  await createSlackMessageDraft(userToken, channelId, rewritten);
  await sayEphemeral(
    params,
    `*${mode}* draft is in your message box. Review and send when ready.`,
  );
}
