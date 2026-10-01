import { encryptString, decryptString } from "./crypto.js";
import { getPool } from "./db.js";

const KEY_OPENROUTER = "openrouter_api_key";
const KEY_OPENROUTER_MODEL = "openrouter_model";

export interface HubSettingsPublic {
  openRouter: { configured: boolean; suffix: string | null };
  openRouterModel: string;
}

function keySuffix(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 8) return null;
  return t.slice(-4);
}

async function readEncrypted(key: string): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<{ value_enc: string }>(
    `SELECT value_enc FROM hub_settings WHERE key = $1`,
    [key],
  );
  const enc = res.rows[0]?.value_enc;
  if (!enc) return null;
  return decryptString(enc);
}

async function writeEncrypted(key: string, plain: string): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not set");
  const valueEnc = encryptString(plain);
  await pool.query(
    `INSERT INTO hub_settings (key, value_enc, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value_enc = EXCLUDED.value_enc, updated_at = now()`,
    [key, valueEnc],
  );
}

/** Copy Render env into DB once when UI has no key yet. */
export async function seedHubSettingsFromEnv(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  const existing = await readEncrypted(KEY_OPENROUTER);
  if (existing?.trim()) return;
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  if (!fromEnv) return;
  await writeEncrypted(KEY_OPENROUTER, fromEnv);
}

export async function getOpenRouterApiKey(): Promise<string | null> {
  const fromDb = await readEncrypted(KEY_OPENROUTER);
  if (fromDb?.trim()) return fromDb.trim();
  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  return fromEnv ?? null;
}

export async function getOpenRouterModel(): Promise<string> {
  const fromDb = await readEncrypted(KEY_OPENROUTER_MODEL);
  if (fromDb?.trim()) return fromDb.trim();
  return process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
}

export async function openRouterConfiguredAsync(): Promise<boolean> {
  return Boolean(await getOpenRouterApiKey());
}

export async function getHubSettingsPublic(): Promise<HubSettingsPublic> {
  const key = await getOpenRouterApiKey();
  const model = await getOpenRouterModel();
  return {
    openRouter: {
      configured: Boolean(key),
      suffix: key ? keySuffix(key) : null,
    },
    openRouterModel: model,
  };
}

export async function saveHubOpenRouterSettings(
  openRouterApiKey: string,
  openRouterModel?: string,
): Promise<void> {
  const key = openRouterApiKey.trim();
  if (!key.startsWith("sk-or-")) {
    throw new Error("OpenRouter API key must start with sk-or-");
  }
  await writeEncrypted(KEY_OPENROUTER, key);
  if (openRouterModel !== undefined) {
    const model = openRouterModel.trim();
    if (model) await writeEncrypted(KEY_OPENROUTER_MODEL, model);
  }
}
