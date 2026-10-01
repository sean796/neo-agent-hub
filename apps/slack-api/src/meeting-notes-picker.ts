import type { RespondFn } from "@slack/bolt";
import type { KnownBlock } from "@slack/types";
import type { GeminiMeetingNoteSummary } from "./gmail-api.js";
import { listGeminiMeetingNotes } from "./gmail-api.js";
import { ensureMeetingNotesReady, meetingNotesFailureMessage } from "./meeting-notes-ready.js";

export const PICKER_BLOCK_ID = "meeting_notes_picker";
export const SELECT_ACTION_ID = "meeting_notes_select";
export const CREATE_ACTION_ID = "meeting_notes_create_checklist";
export const LATEST_ACTION_ID = "meeting_notes_latest";

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatOptionLabel(summary: GeminiMeetingNoteSummary): string {
  const d = summary.receivedAt ? new Date(summary.receivedAt) : null;
  const datePart = d
    ? d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Edmonton" })
    : "Unknown date";
  return truncate(`${datePart} · ${summary.subject}`, 75);
}

function formatPreview(summary: GeminiMeetingNoteSummary | undefined): string {
  if (!summary) {
    return "*Preview*\nChoose a meeting note above.";
  }
  const d = summary.receivedAt
    ? new Date(summary.receivedAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" })
    : "";
  const when = d ? `_ ${d} MT_` : "";
  const snippet = summary.snippet ? `\n>${truncate(summary.snippet, 280)}` : "";
  return `*Preview* ${when}\n*${summary.subject}*${snippet}`;
}

export function buildPickerBlocks(
  summaries: GeminiMeetingNoteSummary[],
  selectedId?: string,
): KnownBlock[] {
  const selected = selectedId
    ? summaries.find((s) => s.messageId === selectedId)
    : summaries[0];
  const initial = selected?.messageId;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Meeting Notes*\nPick a Gemini note, preview it, then create a task list and checklist.",
      },
    },
    {
      type: "section",
      block_id: PICKER_BLOCK_ID,
      accessory: {
        type: "static_select",
        action_id: SELECT_ACTION_ID,
        placeholder: { type: "plain_text", text: "Meeting note subject" },
        initial_option: initial
          ? {
              text: { type: "plain_text", text: formatOptionLabel(selected!) },
              value: initial,
            }
          : undefined,
        options: summaries.map((s) => ({
          text: { type: "plain_text", text: formatOptionLabel(s) },
          value: s.messageId,
        })),
      },
      text: { type: "mrkdwn", text: " " },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: formatPreview(selected) },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Create task list" },
          action_id: CREATE_ACTION_ID,
          style: "primary",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Latest task list" },
          action_id: LATEST_ACTION_ID,
        },
      ],
    },
  ];
}

export async function postResponseUrl(
  responseUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack response_url failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export async function openMeetingNotesPicker(
  slackUserId: string,
  slackTeamId: string,
  respond: RespondFn,
): Promise<void> {
  const refreshToken = await ensureMeetingNotesReady(slackUserId, slackTeamId, respond);
  if (!refreshToken) return;

  try {
    const summaries = await listGeminiMeetingNotes(refreshToken, 15);
    if (summaries.length === 0) {
      await respond({
        response_type: "ephemeral",
        text: "No Gemini meeting notes found in Gmail (from gemini-notes@google.com).",
      });
      return;
    }
    await respond({
      response_type: "ephemeral",
      blocks: buildPickerBlocks(summaries),
      text: "Meeting Notes picker",
    });
  } catch (e) {
    await respond({
      response_type: "ephemeral",
      text: meetingNotesFailureMessage(e),
    });
  }
}

export async function refreshPickerPreview(
  refreshToken: string,
  selectedId: string,
  responseUrl: string,
): Promise<void> {
  const summaries = await listGeminiMeetingNotes(refreshToken, 15);
  if (!summaries.some((s) => s.messageId === selectedId)) {
    await postResponseUrl(responseUrl, {
      replace_original: true,
      response_type: "ephemeral",
      text: "That meeting note is no longer in the list. Run `/meeting-notes` again.",
    });
    return;
  }
  await postResponseUrl(responseUrl, {
    replace_original: true,
    response_type: "ephemeral",
    blocks: buildPickerBlocks(summaries, selectedId),
    text: "Meeting Notes picker",
  });
}
