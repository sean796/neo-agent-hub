import { proofreadSlackMessage } from "./proofread-message.js";
import { updateMessageAsUser } from "./slack-message-update.js";

export async function applyProofreadInPlace(
  userAccessToken: string,
  channelId: string,
  messageTs: string,
  originalText: string,
): Promise<void> {
  const corrected = await proofreadSlackMessage(originalText);
  await updateMessageAsUser(userAccessToken, channelId, messageTs, corrected);
}
