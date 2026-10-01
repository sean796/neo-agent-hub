import { getSlackClientSecret } from "./hub-settings.js";

export function slackOAuthRedirectUri(): string | null {
  return process.env.SLACK_USER_OAUTH_REDIRECT_URI?.trim() ?? null;
}

export function slackOAuthClientId(): string | null {
  return process.env.SLACK_CLIENT_ID?.trim() ?? null;
}

export async function slackUserOAuthConfiguredAsync(): Promise<boolean> {
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
