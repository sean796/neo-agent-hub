/** Keep in sync with schema.sql (source of truth for editors). */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'beta', 'disabled')),
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_connections (
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  google_refresh_enc TEXT,
  connected_at TIMESTAMPTZ,
  error TEXT,
  PRIMARY KEY (slack_user_id, slack_team_id)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  dedupe_key TEXT,
  error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_dedupe_idx ON agent_runs (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS hub_settings (
  key TEXT PRIMARY KEY,
  value_enc TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`.trim();
