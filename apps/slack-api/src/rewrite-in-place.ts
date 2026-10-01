import { type RewriteMode } from "./message-rewrite-modes.js";
import { rewriteSlackMessage } from "./message-rewrite.js";
import { updateMessageAsUser } from "./slack-message-update.js";

export async function applyRewriteInPlace(
  userAccessToken: string,
  channelId: string,
  messageTs: string,
  originalText: string,
  mode: RewriteMode,
): Promise<void> {
  const corrected = await rewriteSlackMessage(originalText, mode);
  await updateMessageAsUser(userAccessToken, channelId, messageTs, corrected);
}

/** @deprecated Use applyRewriteInPlace with mode "correct" */
export async function applyProofreadInPlace(
  userAccessToken: string,
  channelId: string,
  messageTs: string,
  originalText: string,
): Promise<void> {
  await applyRewriteInPlace(userAccessToken, channelId, messageTs, originalText, "correct");
}
