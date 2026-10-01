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
    id: "client-seo-pulse",
    name: "Client SEO Pulse",
    description: "GSC digest via Pulse internal API + OpenRouter summary. Slash: /seo-pulse.",
    status: "beta",
    slashCommand: "seo-pulse",
    requiresGoogle: false,
  },
  {
    id: "intent-check",
    name: "Intent Check",
    description: "SERP intent compare before publish. Slash: /intent-check (SERP wiring pending).",
    status: "beta",
    slashCommand: "intent-check",
    requiresGoogle: false,
  },
];

export function getAgentById(id: string): AgencyAgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
