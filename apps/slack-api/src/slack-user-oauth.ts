import type { Request, Response } from "express";
import { encryptString } from "./crypto.js";
import { saveSlackUserAccessToken } from "./connections.js";
import { buildOAuthState, parseOAuthState } from "./oauth-state.js";
import { apiPublicOrigin } from "./google-oauth.js";
import {
  resolveSlackClientSecret,
  slackOAuthClientId,
  slackOAuthRedirectUri,
  slackUserOAuthConfiguredAsync,
} from "./slack-oauth-config.js";

const SLACK_USER_SCOPE = "chat:write";

export function slackUserOAuthConfigured(): boolean {
  return Boolean(
    slackOAuthClientId() && slackOAuthRedirectUri() && process.env.TOKEN_ENCRYPTION_KEY,
  );
}

export { slackUserOAuthConfiguredAsync };

export function buildSlackUserConnectUrl(slackUserId: string, slackTeamId: string): string {
  const origin = apiPublicOrigin();
  const params = new URLSearchParams({
    slack_user_id: slackUserId,
    slack_team_id: slackTeamId,
  });
  return `${origin}/oauth/slack/start?${params.toString()}`;
}

export async function handleSlackUserOAuthStart(req: Request, res: Response): Promise<void> {
  if (!(await slackUserOAuthConfiguredAsync())) {
    res.status(503).send("Slack user OAuth is not configured on the server.");
    return;
  }
  const slackUserId = String(req.query.slack_user_id ?? "");
  const slackTeamId = String(req.query.slack_team_id ?? "");
  if (!slackUserId || !slackTeamId) {
    res.status(400).send("Missing slack_user_id or slack_team_id.");
    return;
  }

  const state = buildOAuthState(slackUserId, slackTeamId);
  const params = new URLSearchParams({
    client_id: slackOAuthClientId()!,
    user_scope: SLACK_USER_SCOPE,
    redirect_uri: slackOAuthRedirectUri()!,
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}

export async function handleSlackUserOAuthCallback(req: Request, res: Response): Promise<void> {
  if (!(await slackUserOAuthConfiguredAsync())) {
    res.status(503).send("Slack user OAuth is not configured on the server.");
    return;
  }
  const err = req.query.error;
  if (err) {
    res.status(400).send(`Slack authorization failed: ${String(err)}`);
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

  const clientSecret = await resolveSlackClientSecret();
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: slackOAuthClientId()!,
      client_secret: clientSecret,
      code,
      redirect_uri: slackOAuthRedirectUri()!,
    }),
  });
  const tokenJson = (await tokenRes.json()) as {
    ok?: boolean;
    error?: string;
    authed_user?: { id?: string; access_token?: string };
  };
  if (!tokenRes.ok || !tokenJson.ok || !tokenJson.authed_user?.access_token) {
    const msg = tokenJson.error ?? "No user access token returned";
    res.status(400).send(`Slack token exchange failed: ${msg}`);
    return;
  }

  if (tokenJson.authed_user.id && tokenJson.authed_user.id !== slackUserId) {
    res.status(400).send("Slack user mismatch. Start connect from Slack again.");
    return;
  }

  const accessEnc = encryptString(tokenJson.authed_user.access_token);
  await saveSlackUserAccessToken(slackUserId, slackTeamId, accessEnc);

  res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;background:#09090b;color:#fafafa"><h1>Slack connected</h1><p>Return to Slack. Proofread will rewrite your messages in place.</p></body></html>`,
    );
}
