import { hmacSign, hmacVerify } from "./crypto.js";

export function buildOAuthState(slackUserId: string, slackTeamId: string): string {
  const payload = JSON.stringify({
    u: slackUserId,
    t: slackTeamId,
    exp: Date.now() + 60 * 60 * 1000,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function parseOAuthState(state: string): { slackUserId: string; slackTeamId: string } {
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
