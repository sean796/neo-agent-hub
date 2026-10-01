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
    description: "Pick a Gemini meeting note from Gmail or use latest; OpenRouter builds a Slack checklist.",
    status: "beta",
    slashCommand: "meeting-notes",
    requiresGoogle: true,
  },
];

export function getAgentById(id: string): AgencyAgentDefinition | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
