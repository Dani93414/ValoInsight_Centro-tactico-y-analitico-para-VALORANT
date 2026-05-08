import { X } from "lucide-react";
import type { CSSProperties } from "react";
import type { EnrichedAgent } from "../types";
import { getAgentKey } from "../domain/agentKeys";
import { getAgentThemeColors } from "../domain/agentThemeColors";

type Props = {
  agents: EnrichedAgent[];
  compareAgents: EnrichedAgent[];
  isOpen: boolean;
  onClose: () => void;
  onToggleCompare: (agent: EnrichedAgent) => void;
  onClear: () => void;
};

export function AgentCompareSelector({
  agents,
  compareAgents,
  isOpen,
  onClose,
  onToggleCompare,
  onClear,
}: Props) {
  if (!isOpen) return null;

  return (
    <section className="agent-compare-selector" aria-label="Selector de comparacion de agentes">
      <header className="agent-compare-selector__header">
        <div>
          <span className="agents-section-eyebrow">Comparacion</span>
          <h2>Selecciona 2 agentes</h2>
          <p>{compareAgents.length}/2 agentes seleccionados</p>
        </div>
        <div className="agent-compare-selector__actions">
          {compareAgents.length > 0 && (
            <button type="button" onClick={onClear} aria-label="Limpiar seleccion de comparacion">
              Limpiar
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Cerrar selector de comparacion">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="agent-compare-selector__grid">
        {agents.map((agent) => {
          const key = getAgentKey(agent);
          const selected = compareAgents.some((item) => getAgentKey(item) === key);
          const disabled = !selected && compareAgents.length >= 2;
          const [accent, accent2, accent3] = getAgentThemeColors(
            agent.displayName,
            agent.backgroundGradientColors,
          );

          return (
            <button
              key={key}
              type="button"
              className={`agent-compare-selector-card${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${selected ? "Quitar" : "Agregar"} ${agent.displayName} a comparacion`}
              disabled={disabled}
              onClick={() => onToggleCompare(agent)}
              style={
                {
                  "--agent-accent": accent,
                  "--agent-accent-2": accent2,
                  "--agent-accent-3": accent3,
                } as CSSProperties
              }
            >
              {agent.displayIcon && <img src={agent.displayIcon} alt="" />}
              <span>
                <strong>{agent.displayName}</strong>
                <small>{agent.role.displayName}</small>
              </span>
              <em>Tier {agent.tier}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
