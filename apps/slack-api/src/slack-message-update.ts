export async function updateMessageAsUser(
  userAccessToken: string,
  channelId: string,
  messageTs: string,
  text: string,
): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelId,
      ts: messageTs,
      text,
      blocks: [],
    }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json.ok) {
    throw new Error(json.error ?? "chat.update failed");
  }
}
