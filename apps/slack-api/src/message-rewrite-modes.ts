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

export const DEFAULT_WRITE_MODE: RewriteMode = "correct";

export function systemPromptForMode(mode: RewriteMode): string {
  const base =
    "Edit Slack message text for Neo Digital (agency). Keep names and links. Do not add em dashes. Do not wrap in quotes. Output JSON only with correctedText as the full replacement message. If the message has profanity, slurs, or obscene language, remove or replace those words with clean wording suitable for work Slack. Do not leave censored asterisk placeholders unless the author used them.";
  const byMode: Record<RewriteMode, string> = {
    correct: `${base} MINIMAL copy-edit only. Keep the author's exact words, slang, and casual tone except profanity as above. Fix spelling, punctuation, and clear grammar mistakes only. Do not replace clean phrases (keep "hey whats up" as "Hey, what's up?" not "Hello"). Do not formalize, summarize, or rephrase for style.`,
    polish: `${base} Smooth flow and tone but keep the same words and casual level when the message is informal. Do not replace slang with formal greetings.`,
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
    `*${WRITE_SLASH_COMMAND}* puts the rewrite in your message box (after one-time Slack connect).\n` +
    `• \`${WRITE_SLASH_COMMAND}\` opens the editor\n` +
    `• \`${WRITE_SLASH_COMMAND} polish your text here\`\n` +
    `• Styles: ${styles} (default \`correct\` = grammar only, keeps your words)\n` +
    `Already sent: message ⋯ → *Write:* … to edit in place.`
  );
}

export function authorizeButtonLabel(mode: RewriteMode): string {
  if (mode === "correct") return "Authorize & correct";
  if (mode === "polish") return "Authorize & polish";
  return "Authorize & rewrite";
}
