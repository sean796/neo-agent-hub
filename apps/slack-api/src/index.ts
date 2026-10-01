import cors from "cors";
import express from "express";
import { App, ExpressReceiver } from "@slack/bolt";
import { AGENT_REGISTRY } from "@neo-agent-hub/core";
import { initDb, listAgentsFromDb } from "./db.js";
import {
  googleOAuthConfigured,
  handleGoogleOAuthCallback,
  handleGoogleOAuthStart,
} from "./google-oauth.js";
import { runMeetingNotesCommand } from "./meeting-notes-command.js";
import { registerMeetingNotesInteractions } from "./meeting-notes-interactions.js";
import { registerRewriteSlashCommands } from "./rewrite-commands.js";
import { registerRewriteModals } from "./rewrite-modal.js";
import { registerRewriteShortcuts } from "./rewrite-shortcuts.js";
import { formatWriteCommandHelp } from "./message-rewrite-modes.js";
import { meetingNotesDriveConfigured } from "./meeting-notes-drive.js";
import {
  handleSlackUserOAuthCallback,
  handleSlackUserOAuthStart,
  slackUserOAuthConfiguredAsync,
} from "./slack-user-oauth.js";
import { slackClientSecretMisconfigured } from "./slack-oauth-config.js";
import { saveHubSlackOAuthSettings } from "./hub-settings.js";
import { assertHubAdmin, hubAdminTokenConfigured } from "./hub-admin.js";
import {
  getHubSettingsPublic,
  openRouterConfiguredAsync,
  saveHubOpenRouterSettings,
} from "./hub-settings.js";

const port = Number(process.env.PORT) || 10000;

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const receiver =
  slackSigningSecret && slackBotToken
    ? new ExpressReceiver({
        signingSecret: slackSigningSecret,
        endpoints: {
          events: "/slack/events",
          commands: "/slack/commands",
          actions: "/slack/interactions",
        },
      })
    : null;

if (receiver) {
  const app = new App({
    token: slackBotToken,
    receiver,
  });

  app.command("/agent", async ({ command, ack, respond }) => {
    await ack();
    const sub = command.text.trim().split(/\s+/)[0];
    if (!sub) {
      const lines = AGENT_REGISTRY.map(
        (a) => `• \`${a.slashCommand ?? a.id}\` — ${a.name} (${a.status})`,
      );
      await respond({
        response_type: "ephemeral",
        text: `*Neo Agent Hub*\n${lines.join("\n")}\n\n${formatWriteCommandHelp()}\n\nRun \`/agent meeting-notes\` or \`/meeting-notes\`.`,
      });
      return;
    }
    if (sub === "meeting-notes") {
      const rest = command.text.trim().split(/\s+/).slice(1).join(" ");
      void runMeetingNotesCommand(command.user_id, command.team_id, respond, rest);
      return;
    }
    await respond({
      response_type: "ephemeral",
      text: `Unknown agent \`${sub}\`. Try \`meeting-notes\`.`,
    });
  });

  app.command("/meeting-notes", async ({ command, ack, respond }) => {
    await ack();
    void runMeetingNotesCommand(command.user_id, command.team_id, respond, command.text);
  });

  registerMeetingNotesInteractions(app);
  registerRewriteSlashCommands(app);
  registerRewriteShortcuts(app);
  registerRewriteModals(app);
}

const api = express();
api.use(cors({ origin: true }));
api.use(express.json());

if (receiver) {
  api.use(receiver.router);
}

api.get("/health", async (_req, res) => {
  let db: { ok: boolean; error?: string } = { ok: false, error: "DATABASE_URL not set" };
  try {
    db = await initDb();
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : "db error" };
  }
  let openRouter = false;
  try {
    openRouter = await openRouterConfiguredAsync();
  } catch {
    openRouter = false;
  }
  res.status(200).json({
    ok: true,
    service: "neo-agent-hub-api",
    db,
    slack: Boolean(receiver),
    googleOAuth: googleOAuthConfigured(),
    openRouter,
    hubSettingsAdmin: hubAdminTokenConfigured(),
    meetingNotesDrive: meetingNotesDriveConfigured(),
    slackUserOAuth: await slackUserOAuthConfiguredAsync(),
    slackUserOAuthClientSecretMisconfigured: slackClientSecretMisconfigured(),
  });
});

api.get("/api/hub/settings", async (_req, res) => {
  try {
    const settings = await getHubSettingsPublic();
    res.json(settings);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load settings",
    });
  }
});

api.put("/api/hub/settings/slack-oauth", async (req, res) => {
  try {
    assertHubAdmin(req);
    const body = req.body as { slackClientSecret?: string };
    const secret = String(body.slackClientSecret ?? "").trim();
    if (!secret) {
      res.status(400).json({ error: "slackClientSecret is required" });
      return;
    }
    await saveHubSlackOAuthSettings(secret);
    res.json({ ok: true, slackUserOAuth: await slackUserOAuthConfiguredAsync() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    res.status(status).json({ error: msg });
  }
});

api.put("/api/hub/settings/openrouter", async (req, res) => {
  try {
    assertHubAdmin(req);
    const body = req.body as { openRouterApiKey?: string; openRouterModel?: string };
    const key = String(body.openRouterApiKey ?? "").trim();
    if (!key) {
      res.status(400).json({ error: "openRouterApiKey is required" });
      return;
    }
    await saveHubOpenRouterSettings(key, body.openRouterModel);
    res.json(await getHubSettingsPublic());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    const status = msg === "Unauthorized" ? 401 : 400;
    res.status(status).json({ error: msg });
  }
});

api.get("/api/agents", async (_req, res) => {
  try {
    const rows = await listAgentsFromDb();
    if (rows) {
      res.json({ agents: rows, source: "database" });
      return;
    }
  } catch {
    /* fall through to registry */
  }
  res.json({
    agents: AGENT_REGISTRY.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      description: a.description,
      enabled: a.status !== "disabled",
    })),
    source: "registry",
  });
});

api.get("/oauth/google/start", (req, res) => {
  void handleGoogleOAuthStart(req, res);
});

api.get("/oauth/google/callback", (req, res) => {
  void handleGoogleOAuthCallback(req, res);
});

api.get("/oauth/slack/start", (req, res) => {
  void handleSlackUserOAuthStart(req, res);
});

api.get("/oauth/slack/callback", (req, res) => {
  void handleSlackUserOAuthCallback(req, res);
});

void initDb().catch((e) => {
  console.error("initDb on startup failed:", e instanceof Error ? e.message : e);
});

api.listen(port, () => {
  console.log(`neo-agent-hub-api listening on ${port}`);
});
