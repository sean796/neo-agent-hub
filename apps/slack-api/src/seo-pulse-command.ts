import type { RespondFn } from "@slack/bolt";
import {
  fetchSeoPulseBundle,
  pulseBridgeConfigured,
  resolveSiteIdFromArg,
} from "./pulse-client.js";
import { formatSeoPulseMrkdwn, summarizeSeoPulse } from "./seo-pulse-summarize.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";

export async function runSeoPulseCommand(respond: RespondFn, argText: string): Promise<void> {
  if (!pulseBridgeConfigured()) {
    await respond({
      response_type: "ephemeral",
      text: "SEO Pulse is not configured. Set PULSE_API_BASE and HUB_PULSE_SERVICE_TOKEN on the API, and add Pulse route POST /api/internal/seo-pulse.",
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

  const siteId = resolveSiteIdFromArg(argText);
  if (!siteId) {
    await respond({
      response_type: "ephemeral",
      text: "Usage: `/seo-pulse [site-slug]`. Set SEO_PULSE_DEFAULT_SITE_ID or SEO_PULSE_SITE_MAP_JSON on the server.",
    });
    return;
  }

  try {
    const bundle = await fetchSeoPulseBundle(siteId);
    const digest = await summarizeSeoPulse(bundle);
    const text = formatSeoPulseMrkdwn(bundle, digest);
    await respond({ response_type: "ephemeral", text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SEO Pulse failed";
    await respond({ response_type: "ephemeral", text: `SEO Pulse failed: ${msg}` });
  }
}
