# Neo Agent Hub

TypeScript agent platform for Neo Digital: Slack invokes agents; this hub lists and manages them.

**Strategy and build maps:** [Q4 priority selection](./docs/strategy/q4-priority-selection.md), [one-pagers](./docs/one-pagers/), [engineering maps](./docs/engineering/).

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

Health check: `GET /health` (includes `googleOAuth` when OAuth env is set)  
Agent list API: `GET /api/agents`

## Slack app setup

**Fast path:** at https://api.slack.com/apps choose **Create New App** → **From a manifest** → pick **Neo Digital** workspace → paste [`slack-app-manifest.json`](./slack-app-manifest.json) → create → **Install to Workspace**. Copy **Signing Secret** and **Bot User OAuth Token** into Render (below).

**App icon (slash-command autocomplete):** Neo Digital mark (lime `#9AE941` on `#09090b`). Source SVG: [`assets/neo-mark.svg`](./assets/neo-mark.svg). Slack needs a **512×512 PNG**: hosted at `https://neo-agent-hub-web.onrender.com/slack-app-icon.png` (built from [`apps/hub-web/public/slack-app-icon.svg`](./apps/hub-web/public/slack-app-icon.svg)). After deploying hub-web, **App Manifest** → **Update from manifest** (or **Basic Information** → upload [`assets/slack-app-icon-512.png`](./assets/slack-app-icon-512.png)) so `/meeting-notes` shows the green mark instead of the default notebook.

Or configure manually:

Create one Slack app **Neo Agent Hub** and set:

| Setting | URL |
|---------|-----|
| Events | `https://<api-host>/slack/events` |
| Slash commands | `/agent`, `/meeting-notes` → `https://<api-host>/slack/commands` |
| Interactivity | `https://<api-host>/slack/interactions` |

**OAuth scopes (bot):** `commands`, `chat:write`, `im:write`, `users:read`

### Meeting notes in Slack

| Command | What it does |
|---------|----------------|
| `/meeting-notes` | Picker: choose a Gemini note (subject preview), then **Create task list** |
| `/meeting-notes latest` | Task list + checklist from the newest Gemini note |
| `/agent meeting-notes` | Same as `/meeting-notes` |
| `/agent meeting-notes latest` | Same as `/meeting-notes latest` |
| `/meeting-notes` → **Publish to Drive** | Google Doc recap after checklist (re-consent Google if connected before Drive scopes) |
| `/seo-pulse [site-slug]` | GSC digest when `PULSE_API_BASE` + `HUB_PULSE_SERVICE_TOKEN` are set |
| `/intent-check` | Registered; SERP compare wiring pending |
| Message **⋯** → **Connect to apps** → **Proofread message** | Rewrites **your** message in place (one-time Slack user connect with `chat:write`) |

## Environment variables (web service)

- `DATABASE_URL` — Render **Internal Database URL** for `neo-agent-hub-db`
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (see Google OAuth below)
- `TOKEN_ENCRYPTION_KEY` — 32-byte secret for token encryption at rest
- `API_PUBLIC_URL` — public API origin (no trailing slash)
- `OPENROUTER_API_KEY` — Neo Digital OpenRouter key for **matt@neodigital.ca** only (bootstraps encrypted DB on deploy; not Cursor MCP)
- `HUB_ADMIN_TOKEN` — required to save settings from the hub UI (header `X-Hub-Admin-Token`)
- `OPENROUTER_MODEL` — optional; default `deepseek/deepseek-v4.1-flash` (editable in Settings)

**Hub settings UI:** https://neo-agent-hub-web.onrender.com → **Settings** → admin token + OpenRouter key. Runtime reads the encrypted Postgres key only. Billing account: **matt@neodigital.ca**.

## Static site

- `VITE_API_BASE` — public URL of `neo-agent-hub-api` (no trailing slash)

## Google OAuth (meeting-notes, one client, per-user tokens)

Use **one** OAuth 2.0 **Web application** client in Google Cloud (project e.g. `neopulse-505422`). Do not create credentials per Slack user.

| GCP (once) | Render (once) | Runtime (automatic per user) |
|------------|---------------|------------------------------|
| Web client + Gmail API + scopes `gmail.readonly`, `drive.file`, `documents` on consent screen | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI, encryption key; optional `MEETING_NOTES_DRIVE_TEMPLATE_ID`, `MEETING_NOTES_DRIVE_FOLDER_ID` | Connect URL carries `slack_user_id` + signed `state`; Postgres stores encrypted refresh token per `(slack_user_id, slack_team_id)` |

**Authorized redirect URI:** `https://neo-agent-hub-api.onrender.com/oauth/google/callback`

**Slack flow:** teammate runs `/meeting-notes` → ephemeral **Connect Google** (button + link) → browser consent → success page → `/meeting-notes` again uses stored token.

**Routes**

- `GET /oauth/google/start?slack_user_id=&slack_team_id=` — begins connect from Slack
- `GET /oauth/google/callback` — exchanges code and stores encrypted refresh token

Ops: `GET /health` must report `googleOAuth: true` before expecting the Connect UI in Slack.
