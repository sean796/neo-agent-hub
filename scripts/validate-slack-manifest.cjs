const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.join(__dirname, "..", "slack-app-manifest.json");
const raw = fs.readFileSync(manifestPath, "utf8");

let json;
try {
  json = JSON.parse(raw);
} catch (e) {
  console.error("Invalid JSON:", e.message);
  process.exit(1);
}

const errors = [];
const slash = json.features?.slash_commands ?? [];
const shortcuts = json.features?.shortcuts ?? [];

if (slash.length > 5) errors.push(`slash_commands: max 5 (have ${slash.length})`);
if (shortcuts.length > 5) errors.push(`shortcuts: max 5 (have ${shortcuts.length})`);

for (const cmd of slash) {
  if (!cmd.command?.startsWith("/")) errors.push(`slash command must start with /: ${cmd.command}`);
  if ((cmd.command?.length ?? 0) > 32) errors.push(`slash command too long: ${cmd.command}`);
  if (!cmd.url?.startsWith("https://")) errors.push(`slash command needs https url: ${cmd.command}`);
  if (/[^\x20-\x7E]/.test(cmd.usage_hint ?? "")) {
    errors.push(`usage_hint must be ASCII: ${cmd.command}`);
  }
}

const subs = json.settings?.event_subscriptions;
if (subs?.bot_events?.length && !subs.request_url && !json.settings?.socket_mode_enabled) {
  errors.push("event_subscriptions needs request_url or socket_mode");
}
if (json.settings?.interactivity?.is_enabled && !json.settings.interactivity.request_url) {
  errors.push("interactivity needs request_url");
}

if (errors.length) {
  console.error("Manifest checks failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("slack-app-manifest.json OK (JSON + local Slack limits)");
