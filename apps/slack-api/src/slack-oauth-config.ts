import { getSlackClientSecret } from "./hub-settings.js";

function signingSecret(): string | null {
  return process.env.SLACK_SIGNING_SECRET?.trim() ?? null;
}

/** OAuth client secret must not be the request Signing Secret from Slack. */
export function slackClientSecretMisconfigured(): boolean {
  const signing = signingSecret();
  if (!signing) return false;
  const envSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  if (envSecret && envSecret === signing) return true;
  return false;
}

export function slackOAuthRedirectUri(): string | null {
  return process.env.SLACK_USER_OAUTH_REDIRECT_URI?.trim() ?? null;
}

export function slackOAuthClientId(): string | null {
  return process.env.SLACK_CLIENT_ID?.trim() ?? null;
}

export async function slackUserOAuthConfiguredAsync(): Promise<boolean> {
  if (slackClientSecretMisconfigured()) return false;
  return Boolean(
    slackOAuthClientId() &&
      slackOAuthRedirectUri() &&
      process.env.TOKEN_ENCRYPTION_KEY &&
      (await getSlackClientSecret()),
  );
}

export async function resolveSlackClientSecret(): Promise<string> {
  const secret = await getSlackClientSecret();
  if (!secret) throw new Error("SLACK_CLIENT_SECRET is not configured.");
  return secret;
}
