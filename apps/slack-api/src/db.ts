import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { AGENT_REGISTRY } from "@neo-agent-hub/core";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSchemaPath(): string {
  const candidates = [
    path.join(moduleDir, "../../../packages/core/src/db/schema.sql"),
    path.join(process.cwd(), "packages/core/src/db/schema.sql"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`schema.sql not found (tried ${candidates.join(", ")})`);
}

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

  const sql = fs.readFileSync(resolveSchemaPath(), "utf8");
  await p.query(sql);

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
