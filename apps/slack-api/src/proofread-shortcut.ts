import type { App } from "@slack/bolt";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import { PROOFREAD_MESSAGE_CALLBACK_ID, proofreadSlackMessage } from "./proofread-message.js";

type SlackMessagePayload = {
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

    const original = textFromMessage(shortcut.message);
    if (!(await openRouterConfiguredAsync())) {
      await respond({
        response_type: "ephemeral",
        text: "Proofread needs an OpenRouter API key in Neo Agent Hub Settings.",
      });
      return;
    }

    if (!original) {
      await respond({
        response_type: "ephemeral",
        text: "This message has no plain text to proofread (for example only images). Paste the text in a new message and try again.",
      });
      return;
    }

    void (async () => {
      try {
        const corrected = await proofreadSlackMessage(original);
        await respond({
          response_type: "ephemeral",
          text: `*Proofread (only you see this)*\n${corrected}\n\n_Use Edit message (E) and paste if you want to replace your post._`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Proofread failed";
        await respond({
          response_type: "ephemeral",
          text: `Proofread failed: ${msg}`,
        });
      }
    })();
  });
}
