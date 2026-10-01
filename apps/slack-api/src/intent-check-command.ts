import type { RespondFn } from "@slack/bolt";
import { openRouterConfiguredAsync } from "./hub-settings.js";

export async function runIntentCheckCommand(respond: RespondFn, argText: string): Promise<void> {
  const trimmed = argText.trim();
  if (!trimmed) {
    await respond({
      response_type: "ephemeral",
      text: "Usage: `/intent-check <target query> | <outline or URL>`. Full SERP compare ships after DataForSEO wiring on the server.",
    });
    return;
  }

  if (!(await openRouterConfiguredAsync())) {
    await respond({
      response_type: "ephemeral",
      text: "Add an OpenRouter API key in Neo Agent Hub Settings.",
    });
    return;
  }

  await respond({
    response_type: "ephemeral",
    text: "Intent Check agent is registered but SERP fetch is not wired yet. See docs/engineering in neo-agent-hub for the Pulse and DataForSEO contract.",
  });
}
