import pg from "pg";
import { AGENT_REGISTRY, SCHEMA_SQL } from "@neo-agent-hub/core";
import { seedHubSettingsFromEnv } from "./hub-settings.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    const isRenderPg =
      url.includes("render.com") || url.includes("@dpg-") || url.includes("render-internal");
    pool = new pg.Pool({
      connectionString: url,
      ssl: isRenderPg ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function initDb(): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "DATABASE_URL not set" };

  await p.query(SCHEMA_SQL);

  for (const agent of AGENT_REGISTRY) {
    await p.query(
      `INSERT INTO agents (id, name, status, description, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         description = EXCLUDED.description,
         updated_at = now()`,
      [agent.id, agent.name, agent.status, agent.description],
    );
  }
  await seedHubSettingsFromEnv();
  return { ok: true };
}

export interface AgentRow {
  id: string;
  name: string;
  status: string;
  description: string;
  enabled: boolean;
}

export async function listAgentsFromDb(): Promise<AgentRow[] | null> {
  const p = getPool();
  if (!p) return null;
  const res = await p.query<AgentRow>(
    `SELECT id, name, status, description, enabled FROM agents ORDER BY name`,
  );
  return res.rows;
}
