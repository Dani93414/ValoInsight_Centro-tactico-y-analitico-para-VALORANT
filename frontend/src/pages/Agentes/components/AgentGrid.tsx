import type { EnrichedAgent } from "../types";
import { AgentCard } from "./AgentCard";
import type { CSSProperties } from "react";

type Props = {
  agents: EnrichedAgent[];
  compareAgents: EnrichedAgent[];
  selectedAgent: EnrichedAgent | null;
  activeFilterLabels: string[];
  onSelect: (agent: EnrichedAgent) => void;
  onToggleCompare: (agent: EnrichedAgent) => void;
  onResetFilters: () => void;
};

function getAgentKey(agent: EnrichedAgent): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

export function AgentGrid({
  agents,
  compareAgents,
  selectedAgent,
  activeFilterLabels,
  onSelect,
  onToggleCompare,
  onResetFilters,
}: Props) {
  if (agents.length === 0) {
    return (
      <div className="agents-empty-state">
        <h2>No hay agentes en esta composición</h2>
        <p>Prueba a limpiar filtros o cambiar mapa, rango o región.</p>
        {activeFilterLabels.length > 0 && (
          <div className="agents-empty-filters">
            {activeFilterLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        )}
        <button type="button" className="agents-empty-action" onClick={onResetFilters}>
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="agents-grid">
      {agents.map((agent, index) => {
        const active = getAgentKey(selectedAgent ?? agent) === getAgentKey(agent) && Boolean(selectedAgent);
        const compared = compareAgents.some(
          (compareAgent) => getAgentKey(compareAgent) === getAgentKey(agent),
        );
        return (
          <AgentCard
            key={getAgentKey(agent)}
            agent={agent}
            active={active}
            compared={compared}
            compareDisabled={!compared && compareAgents.length >= 2}
            onSelect={onSelect}
            onToggleCompare={onToggleCompare}
            style={{ "--delay": `${Math.min(index * 38, 420)}ms` } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
