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
        text: `*Neo Agent Hub*\n${lines.join("\n")}\n\nRun \`/agent meeting-notes\` or \`/meeting-notes\`.`,
      });
      return;
    }
    if (sub === "meeting-notes") {
      await runMeetingNotesCommand(command.user_id, command.team_id, respond);
      return;
    }
    await respond({
      response_type: "ephemeral",
      text: `Unknown agent \`${sub}\`. Try \`meeting-notes\`.`,
    });
  });

  app.command("/meeting-notes", async ({ command, ack, respond }) => {
    await ack();
    await runMeetingNotesCommand(command.user_id, command.team_id, respond);
  });
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
  res.status(200).json({
    ok: true,
    service: "neo-agent-hub-api",
    db,
    slack: Boolean(receiver),
    googleOAuth: googleOAuthConfigured(),
  });
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

api.listen(port, () => {
  console.log(`neo-agent-hub-api listening on ${port}`);
});
