# Neo Agent Hub

TypeScript agent platform for Neo Digital: Slack invokes agents; this hub lists and manages them.

**Repository:** https://github.com/sean796/neo-agent-hub (transfer to `neodigitalca` when org admin access is available)

**Production**

| Component | URL |
|-----------|-----|
| API | https://neo-agent-hub-api.onrender.com |
| Hub UI | https://neo-agent-hub-web.onrender.com |
| Postgres | `neo-agent-hub-db` (Render dashboard) |

## Stack

- **apps/slack-api** — Express + Slack Bolt (Render web service)
- **apps/hub-web** — Vite + React admin UI (Render static site)
- **packages/core** — Agent registry and SQL schema

## Local development

```bash
npm install
npm run build
npm run dev:api   # port 10000
npm run dev:web   # Vite dev server; set VITE_API_BASE=http://localhost:10000
```

## Render services

| Service | Name |
|---------|------|
| Web | `neo-agent-hub-api` |
| Static | `neo-agent-hub-web` |
| Postgres | `neo-agent-hub-db` |

Health check: `GET /health`  
Agent list API: `GET /api/agents`

## Slack app setup

Create one Slack app **Neo Agent Hub** and set:

| Setting | URL |
|---------|-----|
| Events | `https://<api-host>/slack/events` |
| Slash commands | `/agent`, `/meeting-notes` → `https://<api-host>/slack/commands` |
| Interactivity | `https://<api-host>/slack/interactions` |

**OAuth scopes (bot):** `commands`, `chat:write`, `im:write`, `users:read`, `app_home:open`

## Environment variables (web service)

- `DATABASE_URL` — in [Render dashboard](https://dashboard.render.com/web/srv-dav99ibncjis73ambvk0), open **Environment** → **Add from database** → select **neo-agent-hub-db** → property **Internal Database URL**, then redeploy
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY` — 32-byte secret for token encryption at rest
- `OPENROUTER_API_KEY` — when meeting-notes LLM step is enabled

## Static site

- `VITE_API_BASE` — public URL of `neo-agent-hub-api` (no trailing slash)

## Google OAuth (planned)

- `GET /oauth/google/start` — begins user connect flow from Slack
- `GET /oauth/google/callback` — stores encrypted refresh token keyed by Slack user
