export type AgentStatus = "active" | "beta" | "disabled";

export interface AgencyAgentDefinition {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  slashCommand?: string;
  requiresGoogle?: boolean;
}

/** Code registry at deploy time; DB stores enabled overrides. */
export const AGENT_REGISTRY: AgencyAgentDefinition[] = [
  {
    id: "meeting-notes",
    name: "Meeting Notes → Checklist",
    description: "Pick a Gemini meeting note from Gmail or use latest; OpenRouter builds a Slack task list and checklist.",
    status: "beta",
    slashCommand: "meeting-notes",
    requiresGoogle: true,
  },
  {
    id: "meeting-notes-drive",
    name: "Meeting Notes → Drive",
    description: "Publish to Drive button after checklist; creates or copies a Google Doc recap (Drive + Docs API).",
    status: "beta",
    requiresGoogle: true,
  },
  {
    id: "write",
    name: "Write",
    description: "Fix or rewrite drafts: `/write`, composer drafts, and message shortcuts (correct, polish, shorten, adjust).",
    status: "active",
    slashCommand: "write",
    requiresGoogle: false,
  },
];

export function getAgentById(id: string): AgencyAgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
