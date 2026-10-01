export async function fetchSlackMessageText(
  botToken: string,
  channelId: string,
  messageTs: string,
): Promise<string | null> {
  const res = await fetch(
    `https://slack.com/api/conversations.history?${new URLSearchParams({
      channel: channelId,
      oldest: messageTs,
      latest: messageTs,
      inclusive: "true",
      limit: "1",
    })}`,
    {
      headers: { Authorization: `Bearer ${botToken}` },
    },
  );
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    messages?: Array<{ text?: string; ts?: string }>;
  };
  if (!json.ok || !json.messages?.length) return null;
  const text = json.messages[0]?.text?.trim();
  return text || null;
}
