import cors from "cors";
import express from "express";
import { App, ExpressReceiver } from "@slack/bolt";
import { AGENT_REGISTRY } from "@neo-agent-hub/core";
import { initDb, listAgentsFromDb } from "./db.js";

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
    await respond({
      response_type: "ephemeral",
      text: `Agent \`${sub}\` is not wired yet. Connect Google and run meeting-notes when OAuth is configured.`,
    });
  });

  app.command("/meeting-notes", async ({ ack, respond }) => {
    await ack();
    await respond({
      response_type: "ephemeral",
      text: "Meeting Notes agent shell is live. Google OAuth and Gmail fetch are the next implementation step.",
    });
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

api.get("/oauth/google/start", (_req, res) => {
  res.status(501).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
});

api.get("/oauth/google/callback", (_req, res) => {
  res.status(501).send("Google OAuth callback not configured.");
});

api.listen(port, () => {
  console.log(`neo-agent-hub-api listening on ${port}`);
});
