import type { Request, Response } from "express";
import { encryptString } from "./crypto.js";
import { initDb } from "./db.js";
import { saveSlackUserAccessToken } from "./connections.js";
import { applyRewriteInPlace } from "./rewrite-in-place.js";
import { createSlackMessageDraft } from "./slack-drafts.js";
import { rewriteSlackMessage } from "./message-rewrite.js";
import { rewriteModeFromToken, type RewriteMode } from "./message-rewrite-modes.js";
import { openRouterConfiguredAsync } from "./hub-settings.js";
import {
  buildOAuthState,
  parseOAuthState,
  PROOFREAD_RESUME_TEXT_MAX,
  type ProofreadOAuthResume,
} from "./oauth-state.js";
import { fetchSlackMessageText } from "./slack-fetch-message.js";
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

export function buildSlackUserConnectUrl(
  slackUserId: string,
  slackTeamId: string,
  resume?: ProofreadOAuthResume,
): string {
  const origin = apiPublicOrigin();
  const params = new URLSearchParams({
    slack_user_id: slackUserId,
    slack_team_id: slackTeamId,
  });
  if (resume?.channelId) params.set("channel_id", resume.channelId);
  if (resume?.messageTs) params.set("message_ts", resume.messageTs);
  if (resume?.originalText && resume.originalText.length <= PROOFREAD_RESUME_TEXT_MAX) {
    params.set(
      "resume_text",
      Buffer.from(resume.originalText, "utf8").toString("base64url"),
    );
  }
  if (resume?.mode) params.set("rewrite_mode", resume.mode);
  if (resume?.draftOnly) params.set("draft_only", "1");
  return `${origin}/oauth/slack/start?${params.toString()}`;
}

export async function handleSlackUserOAuthStart(req: Request, res: Response): Promise<void> {
  if (!(await slackUserOAuthConfiguredAsync())) {
    res.status(503).send("Slack user OAuth is not configured on the server.");
    return;
  }
  const slackUserId = String(req.query.slack_user_id ?? "");
  const slackTeamId = String(req.query.slack_team_id ?? "");
  const channelId = String(req.query.channel_id ?? "");
  const messageTs = String(req.query.message_ts ?? "");
  if (!slackUserId || !slackTeamId) {
    res.status(400).send("Missing slack_user_id or slack_team_id.");
    return;
  }

  let originalText: string | undefined;
  const resumeTextB64 = String(req.query.resume_text ?? "");
  if (resumeTextB64) {
    try {
      originalText = Buffer.from(resumeTextB64, "base64url").toString("utf8");
    } catch {
      originalText = undefined;
    }
  }

  const modeRaw = String(req.query.rewrite_mode ?? "");
  const mode = rewriteModeFromToken(modeRaw) ?? undefined;

  const draftOnly = String(req.query.draft_only ?? "") === "1";
  const resume: ProofreadOAuthResume | undefined = channelId
    ? { channelId, messageTs: messageTs || undefined, originalText, mode, draftOnly }
    : undefined;

  const state = buildOAuthState(slackUserId, slackTeamId, resume);
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
  let resume: ProofreadOAuthResume | undefined;
  try {
    ({ slackUserId, slackTeamId, resume } = parseOAuthState(state));
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
    team?: { id?: string };
    authed_user?: { id?: string; access_token?: string };
  };
  if (!tokenRes.ok || !tokenJson.ok || !tokenJson.authed_user?.access_token) {
    const errCode = tokenJson.error ?? "No user access token returned";
    const hint =
      errCode === "bad_client_secret"
        ? " Set Render SLACK_CLIENT_SECRET to the OAuth Client Secret on api.slack.com (Basic Information), not the Signing Secret."
        : "";
    res.status(400).send(`Slack token exchange failed: ${errCode}.${hint}`);
    return;
  }

  if (tokenJson.authed_user.id && tokenJson.authed_user.id !== slackUserId) {
    res.status(400).send("Slack user mismatch. Start connect from Slack again.");
    return;
  }

  await initDb();

  const slackUser = tokenJson.authed_user.id ?? slackUserId;
  const slackTeamFromToken = tokenJson.team?.id ?? slackTeamId;
  const accessEnc = encryptString(tokenJson.authed_user.access_token);
  await saveSlackUserAccessToken(slackUser, slackTeamFromToken, accessEnc);
  if (slackTeamFromToken !== slackTeamId) {
    await saveSlackUserAccessToken(slackUser, slackTeamId, accessEnc);
  }

  const userToken = tokenJson.authed_user.access_token;
  let proofreadDone = false;
  let proofreadNote = "Return to Slack. Proofread is ready from the ⋯ menu on your messages.";

  if (resume && (await openRouterConfiguredAsync())) {
    let original = resume.originalText?.trim() ?? "";
    if (!original && resume.messageTs) {
      const botToken = process.env.SLACK_BOT_TOKEN?.trim();
      if (botToken) {
        original =
          (await fetchSlackMessageText(botToken, resume.channelId, resume.messageTs)) ?? "";
      }
    }
    if (original) {
      try {
        const mode: RewriteMode = resume.mode ?? "correct";
        const rewritten = await rewriteSlackMessage(original, mode);
        if (resume.draftOnly || !resume.messageTs) {
          await createSlackMessageDraft(userToken, resume.channelId, rewritten);
          proofreadDone = true;
          proofreadNote = "Your rewrite is in the Slack message box. Review and send when ready.";
        } else {
          await applyRewriteInPlace(
            userToken,
            resume.channelId,
            resume.messageTs,
            original,
            mode,
          );
          proofreadDone = true;
          proofreadNote = "Your message was updated in Slack. You can close this tab.";
        }
      } catch (e) {
        proofreadNote = `Connected, but rewrite failed: ${e instanceof Error ? e.message : "unknown error"}. Run /write again in Slack.`;
      }
    } else {
      proofreadNote = "Connected. Run /write with your draft text again.";
    }
  }

  const title = proofreadDone ? "Write ready" : "Slack connected";
  res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><html><body style="font-family:sans-serif;padding:2rem;background:#09090b;color:#fafafa"><h1>${title}</h1><p>${proofreadNote}</p></body></html>`,
    );
}
