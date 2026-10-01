import type { App } from "@slack/bolt";
import { MESSAGE_SHORTCUTS } from "./message-rewrite-modes.js";
import { registerMessageRewriteHandler } from "./message-rewrite-handler.js";

export function registerRewriteShortcuts(app: App): void {
  for (const shortcut of MESSAGE_SHORTCUTS) {
    registerMessageRewriteHandler(app, shortcut.callbackId, shortcut.mode, {
      openAdjustModal: shortcut.callbackId === "adjust_message",
    });
  }
}
