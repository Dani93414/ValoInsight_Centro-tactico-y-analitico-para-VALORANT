import type { EnrichedAgent } from "../types";
import { AgentCard } from "./AgentCard";

type Props = {
  agents: EnrichedAgent[];
  selectedAgent: EnrichedAgent | null;
  activeFilterLabels: string[];
  onSelect: (agent: EnrichedAgent) => void;
  onResetFilters: () => void;
};

function getAgentKey(agent: EnrichedAgent): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

export function AgentGrid({
  agents,
  selectedAgent,
  activeFilterLabels,
  onSelect,
  onResetFilters,
}: Props) {
  if (agents.length === 0) {
    return (
      <div className="agents-empty-state">
        <h2>No se encontraron agentes</h2>
        <p>
          No hay agentes que encajen con la búsqueda y filtros seleccionados.
        </p>
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
