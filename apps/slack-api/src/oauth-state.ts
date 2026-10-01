import { hmacSign, hmacVerify } from "./crypto.js";

const STATE_TTL_MS = 60 * 60 * 1000;
/** Keep resume text in signed state when under this size (avoids huge OAuth URLs). */
export const PROOFREAD_RESUME_TEXT_MAX = 2000;

export type ProofreadOAuthResume = {
  channelId: string;
  messageTs: string;
  originalText?: string;
};

export function buildOAuthState(
  slackUserId: string,
  slackTeamId: string,
  resume?: ProofreadOAuthResume,
): string {
  const payload: Record<string, unknown> = {
    u: slackUserId,
    t: slackTeamId,
    exp: Date.now() + STATE_TTL_MS,
  };
  if (resume?.channelId && resume.messageTs) {
    payload.r = {
      c: resume.channelId,
      m: resume.messageTs,
      o:
        resume.originalText && resume.originalText.length <= PROOFREAD_RESUME_TEXT_MAX
          ? resume.originalText
          : undefined,
    };
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = hmacSign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function parseOAuthState(state: string): {
  slackUserId: string;
  slackTeamId: string;
  resume?: ProofreadOAuthResume;
} {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig || !hmacVerify(payloadB64, sig)) {
    throw new Error("Invalid OAuth state");
  }
  const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    u: string;
    t: string;
    exp: number;
    r?: { c?: string; m?: string; o?: string };
  };
  if (Date.now() > parsed.exp) throw new Error("OAuth state expired");
  const resume =
    parsed.r?.c && parsed.r.m
      ? {
          channelId: parsed.r.c,
          messageTs: parsed.r.m,
          originalText: parsed.r.o,
        }
      : undefined;
  return { slackUserId: parsed.u, slackTeamId: parsed.t, resume };
}
