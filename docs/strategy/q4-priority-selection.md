# Q4 priority: three agents to build next

**Decision date:** 2026-10-01  
**Scope:** Neo Digital agency stack (Neo Agent Hub + Pulse/Flowbie + Slack + Drive)

## Selected ideas (2–3)

| Priority | Plan # | Agent id | Rationale |
|----------|--------|----------|-----------|
| 1 (ship first) | #2 | `meeting-notes-drive` | Extends shipped `meeting-notes` (Gmail + OpenRouter + Slack). Smallest new surface: one OAuth scope bump, one block action, one Docs template. Internal time savings every meeting day. |
| 2 | #1 | `client-seo-pulse` | Weekly habit in client Slack channels; reuses Pulse GSC reporting bundle (service account already in Flowbie). Visible client value without new SEO “product” UI. |
| 3 | #3 | `intent-check` | Productizes AISEO QA before publish; server-side SERP + OpenRouter schema. Differentiator for strategists; can stay internal first, client PDF later. |

## Explicitly deferred (this quarter)

- #4 content debt sweeper, #5 entity map onboarding, #6 approval gate, #7 AIO monitoring, #8 client `/request`, #9 Drive brief → Pulse, #10 `/neo-ask` RAG.

Revisit when the three above are **beta** in production and agent run metrics exist in `agent_runs`.

## Success criteria (Q4)

| Agent | Done when |
|-------|-----------|
| `meeting-notes-drive` | After checklist in Slack, **Publish to Drive** creates/updates a Doc; link posted ephemerally; failures show OAuth or API error text. |
| `client-seo-pulse` | Cron or `/seo-pulse` posts MoM-style summary + one recommended action to a configured channel; data sourced from Pulse GSC bundle only. |
| `intent-check` | `/intent-check` with URL or pasted outline returns structured match score + gaps in Slack ephemeral; SERP fetch server-side only. |

## Ownership (suggested)

- **Hub / Slack:** neo-agent-hub (`apps/slack-api`)
- **GSC data + site config:** Pulse (`/api/gsc/*`, site settings)
- **OpenRouter:** hub `hub_settings` (matt@neodigital.ca account)

See [one-pagers](../one-pagers/) for client-facing language and [engineering maps](../engineering/) for build wiring.
