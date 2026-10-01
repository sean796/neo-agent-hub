import type { App } from "@slack/bolt";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import {
  formatWriteCommandHelp,
  type RewriteMode,
  rewriteModeFromToken,
  WRITE_SLASH_COMMAND,
} from "./message-rewrite-modes.js";
import { rewriteSlackMessage } from "./message-rewrite.js";
import { openComposeRewriteModal } from "./rewrite-modal.js";

const DEFAULT_MODE: RewriteMode = "polish";

function parseWriteCommandText(text: string): { mode: RewriteMode; body: string } {
  const trimmed = text.trim();
  if (!trimmed) return { mode: DEFAULT_MODE, body: "" };
  const parts = trimmed.split(/\s+/);
  const maybeMode = rewriteModeFromToken(parts[0] ?? "");
  if (maybeMode) {
    return { mode: maybeMode, body: parts.slice(1).join(" ").trim() };
  }
  return { mode: DEFAULT_MODE, body: trimmed };
}

export function registerRewriteSlashCommands(app: App): void {
  app.command(WRITE_SLASH_COMMAND, async ({ command, ack, respond, body, client }) => {
    await ack();
    const raw = command.text.trim();
    if (raw === "help" || raw === "?") {
      await respond({
        response_type: "ephemeral",
        text: formatWriteCommandHelp(),
      });
      return;
    }

    const { mode, body: draft } = parseWriteCommandText(command.text);

    if (!(await openRouterConfiguredAsync())) {
      await respond({
        response_type: "ephemeral",
        text: "OpenRouter is not configured in Neo Agent Hub Settings.",
      });
      return;
    }

    if (!draft) {
      if (!body.trigger_id) {
        await respond({
          response_type: "ephemeral",
          text: formatWriteCommandHelp(),
        });
        return;
      }
      await openComposeRewriteModal(client, body.trigger_id, mode, "", command.channel_id);
      return;
    }

    void (async () => {
      try {
        const rewritten = await rewriteSlackMessage(draft, mode);
        await respond({
          response_type: "ephemeral",
          text: `*${mode}*\nCopy into your message:\n\`\`\`${rewritten}\`\`\``,
        });
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
