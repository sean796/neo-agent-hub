export type RewriteMode =
  | "correct"
  | "polish"
  | "shorten"
  | "friendly"
  | "formal"
  | "expand";

export const REWRITE_MODES: RewriteMode[] = [
  "correct",
  "polish",
  "shorten",
  "friendly",
  "formal",
  "expand",
];

export const REWRITE_MODE_LABELS: Record<RewriteMode, string> = {
  correct: "Correct (grammar and clarity)",
  polish: "Polish (smooth professional tone)",
  shorten: "Shorten (same meaning, fewer words)",
  friendly: "Friendlier (warm, still professional)",
  formal: "More formal (client-ready)",
  expand: "Expand (add helpful detail)",
};

export const MESSAGE_SHORTCUTS: Array<{
  callbackId: string;
  name: string;
  description: string;
  mode: RewriteMode;
}> = [
  {
    callbackId: "proofread_message",
    name: "Correct message",
    description: "Fix grammar and clarity in place",
    mode: "correct",
  },
  {
    callbackId: "polish_message",
    name: "Polish message",
    description: "Smooth tone and flow in place",
    mode: "polish",
  },
  {
    callbackId: "shorten_message",
    name: "Shorten message",
    description: "Tighter wording in place",
    mode: "shorten",
  },
  {
    callbackId: "adjust_message",
    name: "Adjust message",
    description: "Pick tone and rewrite in place",
    mode: "polish",
  },
];

export function rewriteModeFromToken(token: string): RewriteMode | null {
  const t = token.trim().toLowerCase();
  if ((REWRITE_MODES as string[]).includes(t)) return t as RewriteMode;
  if (t === "proofread") return "correct";
  return null;
}

export function systemPromptForMode(mode: RewriteMode): string {
  const base =
    "Rewrite Slack message text for Neo Digital (agency). Keep names, links, and intent. Do not add em dashes. Do not wrap in quotes. Output JSON only with correctedText as the full replacement message.";
  const byMode: Record<RewriteMode, string> = {
    correct: `${base} Fix grammar, spelling, and clarity. Light tone touch only.`,
    polish: `${base} Improve flow and professional tone without changing meaning.`,
    shorten: `${base} Make shorter and scannable. Remove filler.`,
    friendly: `${base} Warmer and approachable while staying professional.`,
    formal: `${base} More formal and client-ready.`,
    expand: `${base} Add brief helpful context where it improves clarity. Do not ramble.`,
  };
  return byMode[mode];
}

export const WRITE_SLASH_COMMAND = "/write";

export function formatWriteCommandHelp(): string {
  const styles = REWRITE_MODES.map((m) => `\`${m}\``).join(", ");
  return (
    `*${WRITE_SLASH_COMMAND}* rewrites a draft before you send it.\n` +
    `• \`${WRITE_SLASH_COMMAND}\` opens the editor\n` +
    `• \`${WRITE_SLASH_COMMAND} polish your text here\`\n` +
    `• Styles: ${styles} (default \`polish\`)\n` +
    `Sent messages: use *Write* from the message ⋯ menu to edit in place.`
  );
}

export function authorizeButtonLabel(mode: RewriteMode): string {
  if (mode === "correct") return "Authorize & correct";
  if (mode === "polish") return "Authorize & polish";
  return "Authorize & rewrite";
}
