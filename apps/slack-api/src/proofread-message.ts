import { rewriteSlackMessage } from "./message-rewrite.js";

export const PROOFREAD_MESSAGE_CALLBACK_ID = "proofread_message";

/** @deprecated Use rewriteSlackMessage(text, "correct") */
export async function proofreadSlackMessage(originalText: string): Promise<string> {
  return rewriteSlackMessage(originalText, "correct");
}
