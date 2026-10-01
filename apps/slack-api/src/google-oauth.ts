import type { Request, Response } from "express";
import { encryptString, hmacSign, hmacVerify } from "./crypto.js";
import { saveGoogleRefreshToken } from "./connections.js";

const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
const DOCUMENTS = "https://www.googleapis.com/auth/documents";

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT_URI &&
      process.env.TOKEN_ENCRYPTION_KEY,
  );
}

export function apiPublicOrigin(): string {
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (redirect) {
    try {
      return new URL(redirect).origin;
    } catch {
      /* fall through */
    }
  }
  return process.env.API_PUBLIC_URL ?? "https://neo-agent-hub-api.onrender.com";
}

function oauthState(slackUserId: string, slackTeamId: string): string {
  const payload = JSON.stringify({
    u: slackUserId,
    t: slackTeamId,
    exp: Date.now() + 60 * 60 * 1000,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

function parseOAuthState(state: string): { slackUserId: string; slackTeamId: string } {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig || !hmacVerify(payloadB64, sig)) {
    throw new Error("Invalid OAuth state");
  }
  const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    u: string;
    t: string;
    exp: number;
  };
  if (Date.now() > parsed.exp) throw new Error("OAuth state expired");
  return { slackUserId: parsed.u, slackTeamId: parsed.t };
}

export function buildGoogleConnectUrl(slackUserId: string, slackTeamId: string): string {
  const origin = apiPublicOrigin();
  const params = new URLSearchParams({
    slack_user_id: slackUserId,
    slack_team_id: slackTeamId,
  });
  return `${origin}/oauth/google/start?${params.toString()}`;
}

export async function handleGoogleOAuthStart(req: Request, res: Response): Promise<void> {
  if (!googleOAuthConfigured()) {
    res.status(503).send("Google OAuth is not configured on the server.");
    return;
  }
  const slackUserId = String(req.query.slack_user_id ?? "");
  const slackTeamId = String(req.query.slack_team_id ?? "");
  if (!slackUserId || !slackTeamId) {
    res.status(400).send("Missing slack_user_id or slack_team_id.");
    return;
  }

  const state = oauthState(slackUserId, slackTeamId);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: ["openid", "email", GMAIL_READONLY, DRIVE_FILE, DOCUMENTS].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export async function handleGoogleOAuthCallback(req: Request, res: Response): Promise<void> {
  if (!googleOAuthConfigured()) {
    res.status(503).send("Google OAuth is not configured on the server.");
    return;
  }
  const err = req.query.error;
  if (err) {
    res.status(400).send(`Google authorization failed: ${String(err)}`);
    return;
  }
  const code = req.query.code;
  const state = req.query.state;
  if (typeof code !== "string" || typeof state !== "string") {
    res.status(400).send("Missing authorization code.");
    return;
  }

  let slackUserId: string;
  let slackTeamId: string;
  try {
    ({ slackUserId, slackTeamId } = parseOAuthState(state));
  } catch (e) {
    res.status(400).send(e instanceof Error ? e.message : "Invalid state");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.refresh_token) {
    const msg = tokenJson.error_description ?? tokenJson.error ?? "No refresh token returned";
    res.status(400).send(`Google token exchange failed: ${msg}`);
    return;
  }

  const refreshEnc = encryptString(tokenJson.refresh_token);
  await saveGoogleRefreshToken(slackUserId, slackTeamId, refreshEnc);

  res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;background:#09090b;color:#fafafa"><h1>Google connected</h1><p>Gmail and Drive publish are linked. Return to Slack and run <code>/meeting-notes</code> again.</p></body></html>`,
    );
}
