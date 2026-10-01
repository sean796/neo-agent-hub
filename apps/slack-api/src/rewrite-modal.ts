import type { WebClient } from "@slack/web-api";
import type { App } from "@slack/bolt";
import {
  REWRITE_MODE_LABELS,
  REWRITE_MODES,
  type RewriteMode,
  rewriteModeFromToken,
} from "./message-rewrite-modes.js";
import { deliverRewriteToComposer } from "./write-draft-flow.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import {
  getSlackUserAccessToken,
  getUserConnectionWithSlackToken,
  hasSlackUserToken,
} from "./connections.js";
import { applyRewriteInPlace } from "./rewrite-in-place.js";
import { slackUserOAuthConfiguredAsync } from "./slack-user-oauth.js";

export const COMPOSE_MODAL_CALLBACK = "rewrite_compose_modal";
export const MESSAGE_MODAL_CALLBACK = "rewrite_message_modal";

type MessageModalMeta = {
  channelId: string;
  messageTs: string;
  actorId: string;
  teamId: string;
  originalText: string;
  defaultMode: RewriteMode;
};

function modeOptions() {
  return REWRITE_MODES.map((m) => ({
    text: { type: "plain_text" as const, text: REWRITE_MODE_LABELS[m] },
    value: m,
  }));
}

type ComposeModalMeta = {
  channelId: string;
  userId: string;
  teamId: string;
};

export function buildComposeModalView(
  defaultMode: RewriteMode,
  draftText = "",
  meta?: ComposeModalMeta,
) {
  return {
    type: "modal" as const,
    callback_id: COMPOSE_MODAL_CALLBACK,
    private_metadata: meta ? JSON.stringify(meta) : undefined,
    title: { type: "plain_text" as const, text: "AI compose" },
    submit: { type: "plain_text" as const, text: "Rewrite" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input" as const,
        block_id: "mode_block",
        label: { type: "plain_text" as const, text: "Style" },
        element: {
          type: "static_select" as const,
          action_id: "mode",
          initial_option: {
            text: { type: "plain_text" as const, text: REWRITE_MODE_LABELS[defaultMode] },
            value: defaultMode,
          },
          options: modeOptions(),
        },
      },
      {
        type: "input" as const,
        block_id: "draft_block",
        label: { type: "plain_text" as const, text: "Draft message" },
        element: {
          type: "plain_text_input" as const,
          action_id: "draft",
          multiline: true,
          initial_value: draftText.slice(0, 3000),
          placeholder: {
            type: "plain_text" as const,
            text: "Paste or type the message you are about to send",
          },
        },
      },
    ],
  };
}

function buildMessageModalView(meta: MessageModalMeta) {
  return {
    type: "modal" as const,
    callback_id: MESSAGE_MODAL_CALLBACK,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text" as const, text: "Adjust message" },
    submit: { type: "plain_text" as const, text: "Update in Slack" },
    close: { type: "plain_text" as const, text: "Cancel" },
    blocks: [
      {
        type: "input" as const,
        block_id: "mode_block",
        label: { type: "plain_text" as const, text: "Style" },
        element: {
          type: "static_select" as const,
          action_id: "mode",
          initial_option: {
            text: {
              type: "plain_text" as const,
              text: REWRITE_MODE_LABELS[meta.defaultMode],
            },
            value: meta.defaultMode,
          },
          options: modeOptions(),
        },
      },
      {
        type: "input" as const,
        block_id: "draft_block",
        label: { type: "plain_text" as const, text: "Message" },
        element: {
          type: "plain_text_input" as const,
          action_id: "draft",
          multiline: true,
          initial_value: meta.originalText.slice(0, 3000),
        },
      },
    ],
  };
}

export async function openComposeRewriteModal(
  client: WebClient,
  triggerId: string,
  defaultMode: RewriteMode,
  draftText: string,
  channelId: string,
  userId: string,
  teamId: string,
): Promise<void> {
  await client.views.open({
    trigger_id: triggerId,
    view: buildComposeModalView(defaultMode, draftText, { channelId, userId, teamId }),
  });
}

export async function openMessageRewriteModal(
  client: WebClient,
  triggerId: string,
  meta: MessageModalMeta,
): Promise<void> {
  await client.views.open({
    trigger_id: triggerId,
    view: buildMessageModalView(meta),
  });
}

function parseModeFromView(values: Record<string, Record<string, unknown>>): RewriteMode {
  const select = values.mode_block?.mode as
    | { selected_option?: { value?: string } }
    | undefined;
  const fromSelect = rewriteModeFromToken(select?.selected_option?.value ?? "");
  if (fromSelect) return fromSelect;
  return "polish";
}

function parseDraftFromView(values: Record<string, Record<string, unknown>>): string {
  const input = values.draft_block?.draft as { value?: string } | undefined;
  return String(input?.value ?? "").trim();
}

export function registerRewriteModals(app: App): void {
  app.view(COMPOSE_MODAL_CALLBACK, async ({ ack, view, client }) => {
    const mode = parseModeFromView(view.state.values);
    const draft = parseDraftFromView(view.state.values);
    if (!draft) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "Enter a draft message." },
      });
      return;
    }
    if (!(await openRouterConfiguredAsync())) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "OpenRouter is not configured." },
      });
      return;
    }
    let meta: ComposeModalMeta | null = null;
    try {
      meta = JSON.parse(view.private_metadata || "{}") as ComposeModalMeta;
    } catch {
      meta = null;
    }
    if (!meta?.channelId || !meta.userId || !meta.teamId) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "Missing channel context. Run /write from the conversation again." },
      });
      return;
    }
    await ack();
    try {
      await deliverRewriteToComposer({
        userId: meta.userId,
        teamId: meta.teamId,
        channelId: meta.channelId,
        mode,
        originalText: draft,
        client,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rewrite failed";
      await client.chat.postEphemeral({
        channel: meta.channelId,
        user: meta.userId,
        text: `Rewrite failed: ${msg}`,
      });
    }
  });

  app.view(MESSAGE_MODAL_CALLBACK, async ({ ack, view }) => {
    const meta = JSON.parse(view.private_metadata) as MessageModalMeta;
    const mode = parseModeFromView(view.state.values);
    const draft = parseDraftFromView(view.state.values);
    if (!draft) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "Message text is required." },
      });
      return;
    }
    if (!(await openRouterConfiguredAsync())) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "OpenRouter is not configured." },
      });
      return;
    }
    if (!(await slackUserOAuthConfiguredAsync())) {
      await ack({
        response_action: "errors",
        errors: { draft_block: "Slack user OAuth is not configured on the server." },
      });
      return;
    }
    const row = await getUserConnectionWithSlackToken(meta.actorId, meta.teamId);
    if (!hasSlackUserToken(row)) {
      await ack({
        response_action: "errors",
        errors: {
          draft_block: "Connect Slack first (use Correct or Polish from the message menu once).",
        },
      });
      return;
    }
    try {
      const tokenTeamId = row?.slack_team_id ?? meta.teamId;
      const userToken = await getSlackUserAccessToken(meta.actorId, tokenTeamId);
      if (!userToken) throw new Error("Slack connect expired.");
      await applyRewriteInPlace(
        userToken,
        meta.channelId,
        meta.messageTs,
        draft,
        mode,
      );
      await ack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Rewrite failed";
      await ack({
        response_action: "errors",
        errors: { draft_block: msg },
      });
    }
  });
}
