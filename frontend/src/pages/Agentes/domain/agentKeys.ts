import type { Agente } from "../../../types/agents";
import { normalizeLabel } from "../../../utils/formatters";

export function getAgentKey(
  agent: Pick<Agente, "uuid" | "id" | "displayName">,
): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

export function buildAgentLookup(agents: Agente[]) {
  const keyByMatchValue = new Map<string, string>();

  agents.forEach((agent) => {
    const agentKey = getAgentKey(agent);
    [agent.uuid, agent.id, agent.displayName].forEach((value) => {
      if (value) keyByMatchValue.set(normalizeLabel(value), agentKey);
    });
  });

  return keyByMatchValue;
}
