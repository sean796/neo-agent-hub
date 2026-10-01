import type { App } from "@slack/bolt";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import { PROOFREAD_MESSAGE_CALLBACK_ID, proofreadSlackMessage } from "./proofread-message.js";

type MessageShortcutPayload = {
  user: { id: string };
  channel?: { id: string };
  message?: { text?: string };
};

export function registerProofreadShortcut(app: App): void {
  app.shortcut(PROOFREAD_MESSAGE_CALLBACK_ID, async ({ shortcut, ack, client }) => {
    await ack();
    if (!("message" in shortcut)) return;
    const payload = shortcut as MessageShortcutPayload;

    const channelId = payload.channel?.id;
    const userId = payload.user.id;
    const original = payload.message?.text ?? "";

    if (!channelId) return;

    if (!(await openRouterConfiguredAsync())) {
      await client.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: "Proofread needs an OpenRouter API key in Neo Agent Hub Settings.",
      });
      return;
    }

    void (async () => {
      try {
        const corrected = await proofreadSlackMessage(original);
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `*Proofread (only you see this)*\n${corrected}\n\n_Use Edit message (E) and paste if you want to replace your post._`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Proofread failed";
        await client.chat.postEphemeral({
          channel: channelId,
          user: userId,
          text: `Proofread failed: ${msg}`,
        });
      }
    })();
  });
}
