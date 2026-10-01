import type { App, RespondArguments } from "@slack/bolt";
import {
  CREATE_ACTION_ID,
  LATEST_ACTION_ID,
  PICKER_BLOCK_ID,
  SELECT_ACTION_ID,
  postResponseUrl,
  refreshPickerPreview,
} from "./meeting-notes-picker.js";
import { runChecklistForLatest, runChecklistForMessageId } from "./meeting-notes-run.js";
import { getRefreshTokenForSlackUser } from "./gmail-api.js";
import { meetingNotesFailureMessage } from "./meeting-notes-ready.js";
import type { RespondFn } from "@slack/bolt";

function respondFnFromUrl(responseUrl: string): RespondFn {
  return async (message) => {
    const args: RespondArguments & { blocks?: unknown[] } =
      typeof message === "string" ? { text: message } : (message as RespondArguments & { blocks?: unknown[] });
    const payload: Record<string, unknown> = {
      replace_original: true,
      response_type: "ephemeral",
      ...(args.text ? { text: args.text } : {}),
      ...(args.blocks ? { blocks: args.blocks } : {}),
    };
    if (!payload.text && !payload.blocks) {
      payload.text = "Meeting Notes";
    }
    await postResponseUrl(responseUrl, payload);
  };
}

type InteractionBody = {
  state?: { values?: Record<string, Record<string, { selected_option?: { value?: string } }>> };
  message?: { blocks?: Array<{ block_id?: string; accessory?: { initial_option?: { value?: string } } }> };
};

function selectedMessageId(body: InteractionBody): string | undefined {
  const fromState = body.state?.values?.[PICKER_BLOCK_ID]?.[SELECT_ACTION_ID]?.selected_option?.value;
  if (fromState) return fromState;
  const block = body.message?.blocks?.find((b) => b.block_id === PICKER_BLOCK_ID);
  return block?.accessory?.initial_option?.value;
}

export function registerMeetingNotesInteractions(app: App): void {
  app.action("connect_google", async ({ ack }) => {
    await ack();
  });

  app.action(SELECT_ACTION_ID, async ({ ack, body, action }) => {
    await ack();
    const blockBody = body as {
      response_url?: string;
      team?: { id?: string };
      user: { id: string };
    };
    const responseUrl = blockBody.response_url;
    const teamId = blockBody.team?.id;
    const userId = blockBody.user.id;
    const selectAction = action as { selected_option?: { value?: string } };
    const messageId = selectAction.selected_option?.value;
    if (!responseUrl || !teamId || !messageId) return;

    try {
      const refreshToken = await getRefreshTokenForSlackUser(userId, teamId);
      await refreshPickerPreview(refreshToken, messageId, responseUrl);
    } catch (e) {
      await postResponseUrl(responseUrl, {
        replace_original: true,
        response_type: "ephemeral",
        text: meetingNotesFailureMessage(e),
      });
    }
  });

  app.action(CREATE_ACTION_ID, async ({ ack, body }) => {
    await ack();
    const blockBody = body as {
      response_url?: string;
      team?: { id?: string };
      user: { id: string };
    };
    const responseUrl = blockBody.response_url;
    const teamId = blockBody.team?.id;
    const userId = blockBody.user.id;
    if (!responseUrl || !teamId) return;

    const messageId = selectedMessageId(blockBody as InteractionBody);
    if (!messageId) {
      await postResponseUrl(responseUrl, {
        replace_original: true,
        response_type: "ephemeral",
        text: "Choose a meeting note from the dropdown first.",
      });
      return;
    }

    await runChecklistForMessageId(userId, teamId, messageId, respondFnFromUrl(responseUrl));
  });

  app.action(LATEST_ACTION_ID, async ({ ack, body }) => {
    await ack();
    const blockBody = body as {
      response_url?: string;
      team?: { id?: string };
      user: { id: string };
    };
    const responseUrl = blockBody.response_url;
    const teamId = blockBody.team?.id;
    const userId = blockBody.user.id;
    if (!responseUrl || !teamId) return;

    await runChecklistForLatest(userId, teamId, respondFnFromUrl(responseUrl));
  });
}
