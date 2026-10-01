import { decryptString } from "./crypto.js";
import { getPool } from "./db.js";

export interface UserConnectionRow {
  slack_user_id: string;
  slack_team_id: string;
  google_refresh_enc: string | null;
  slack_user_token_enc: string | null;
  connected_at: Date | null;
  error: string | null;
}

export async function getUserConnection(
  slackUserId: string,
  slackTeamId: string,
): Promise<UserConnectionRow | null> {
  const pool = getPool();
  if (!pool) return null;
  const res = await pool.query<UserConnectionRow>(
    `SELECT slack_user_id, slack_team_id, google_refresh_enc, slack_user_token_enc, connected_at, error
     FROM user_connections WHERE slack_user_id = $1 AND slack_team_id = $2`,
    [slackUserId, slackTeamId],
  );
  return res.rows[0] ?? null;
}

export async function saveGoogleRefreshToken(
  slackUserId: string,
  slackTeamId: string,
  refreshEnc: string,
): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not set");
  await pool.query(
    `INSERT INTO user_connections (slack_user_id, slack_team_id, google_refresh_enc, connected_at, error)
     VALUES ($1, $2, $3, now(), NULL)
     ON CONFLICT (slack_user_id, slack_team_id) DO UPDATE SET
       google_refresh_enc = EXCLUDED.google_refresh_enc,
       connected_at = now(),
       error = NULL`,
    [slackUserId, slackTeamId, refreshEnc],
  );
}

export function hasGoogleConnection(row: UserConnectionRow | null): boolean {
  return Boolean(row?.google_refresh_enc);
}

export async function saveSlackUserAccessToken(
  slackUserId: string,
  slackTeamId: string,
  accessEnc: string,
): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL not set");
  await pool.query(
    `INSERT INTO user_connections (slack_user_id, slack_team_id, slack_user_token_enc, connected_at, error)
     VALUES ($1, $2, $3, now(), NULL)
     ON CONFLICT (slack_user_id, slack_team_id) DO UPDATE SET
       slack_user_token_enc = EXCLUDED.slack_user_token_enc,
       connected_at = now(),
       error = NULL`,
    [slackUserId, slackTeamId, accessEnc],
  );
}

export async function getSlackUserAccessToken(
  slackUserId: string,
  slackTeamId: string,
): Promise<string | null> {
  const row = await getUserConnection(slackUserId, slackTeamId);
  if (!row?.slack_user_token_enc) return null;
  return decryptString(row.slack_user_token_enc);
}

export function hasSlackUserToken(row: UserConnectionRow | null): boolean {
  return Boolean(row?.slack_user_token_enc);
}
