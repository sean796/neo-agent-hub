import type { KnownBlock } from "@slack/types";

export const PUBLISH_DRIVE_ACTION_ID = "meeting_notes_publish_drive";

export function checklistResponseBlocks(mrkdwnText: string, gmailMessageId: string): KnownBlock[] {
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: mrkdwnText },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: PUBLISH_DRIVE_ACTION_ID,
          text: { type: "plain_text", text: "Publish to Drive" },
          value: gmailMessageId,
        },
      ],
    },
  ];
}
