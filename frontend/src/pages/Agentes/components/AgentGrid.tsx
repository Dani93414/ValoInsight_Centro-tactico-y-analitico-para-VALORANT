import { AgentCard } from "./AgentCard";
import type { EnrichedAgent } from "../types";

type Props = {
  agents: EnrichedAgent[];
  selectedAgent: EnrichedAgent | null;
  onSelect: (agent: EnrichedAgent) => void;
};

function getAgentKey(agent: EnrichedAgent): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

export function AgentGrid({ agents, selectedAgent, onSelect }: Props) {
  if (agents.length === 0) {
    return (
      <div className="agents-empty-state">
        <h2>No se encontraron agentes</h2>
        <p>Prueba con otro nombre o cambia el filtro de rol.</p>
      </div>
    );
  }

  return (
    <div className="agents-grid">
      {agents.map((agent) => {
        const active = getAgentKey(selectedAgent ?? agent) === getAgentKey(agent) && Boolean(selectedAgent);
        return (
          <AgentCard
            key={getAgentKey(agent)}
            agent={agent}
            active={active}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

