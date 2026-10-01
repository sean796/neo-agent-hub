import { randomUUID } from "node:crypto";

function plainTextToDraftBlocks(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Draft text is empty.");
  return [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [{ type: "text", text: trimmed }],
        },
      ],
    },
  ];
}

export async function createSlackMessageDraft(
  userAccessToken: string,
  channelId: string,
  text: string,
  threadTs?: string,
): Promise<void> {
  const destination: Record<string, string> = { channel_id: channelId };
  if (threadTs) destination.thread_ts = threadTs;

  const res = await fetch("https://slack.com/api/drafts.create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      blocks: plainTextToDraftBlocks(text),
      destinations: [destination],
      file_ids: [],
      is_from_composer: false,
      client_msg_id: randomUUID(),
    }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json.ok) {
    if (json.error === "attached_draft_exists") {
      throw new Error(
        "You already have a draft in this conversation. Send or delete it in the message box, then run /write again.",
      );
    }
    if (json.error === "missing_scope") {
      throw new Error("Reconnect Slack from a Write message shortcut to allow drafts in the composer.");
    }
    throw new Error(json.error ?? "drafts.create failed");
  }
}
