import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { formatNumber } from "../../../utils/formatters";
import type { AgentCompareMetric, EnrichedAgent } from "../types";

type Props = {
  agents: EnrichedAgent[];
  metrics: AgentCompareMetric[];
  onClear: () => void;
  onRemove: (agent: EnrichedAgent) => void;
};

export function AgentCompareDrawer({ agents, metrics, onClear, onRemove }: Props) {
  if (agents.length !== 2) return null;

  const [first, second] = agents;

  return (
    <aside className="agent-compare-drawer" aria-label={`Comparar: ${first.displayName} vs ${second.displayName}`}>
      <div className="agent-compare-drawer__header">
        <div>
          <span className="agents-section-eyebrow">Comparación</span>
          <h2>
            Comparar: {first.displayName} vs {second.displayName}
          </h2>
        </div>
        <button type="button" className="agent-compare-drawer__close" onClick={onClear} aria-label="Limpiar comparación">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="agent-compare-drawer__agents">
        {agents.map((agent) => (
          <div key={agent.uuid ?? agent.id ?? agent.displayName} className="agent-compare-chip">
            {agent.displayIcon && <img src={agent.displayIcon} alt="" />}
            <span>
              <strong>{agent.displayName}</strong>
              <small>
                Score {formatNumber(agent.score, 1)} · Tier {agent.tier}
              </small>
            </span>
            <button type="button" onClick={() => onRemove(agent)} aria-label={`Quitar ${agent.displayName} de comparación`}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="agent-compare-table" role="table" aria-label="Métricas comparadas entre agentes">
        <div className="agent-compare-row agent-compare-row--head" role="row">
          <span role="columnheader">Métrica</span>
          <span role="columnheader">{first.displayName} real</span>
          <span role="columnheader" title="Valor ajustado por muestra para suavizar comparativas con pocos datos">{first.displayName} norm.</span>
          <span role="columnheader">{second.displayName} real</span>
          <span role="columnheader" title="Valor ajustado por muestra para suavizar comparativas con pocos datos">{second.displayName} norm.</span>
        </div>
        {metrics.map((metric) => (
          <div key={metric.key} className="agent-compare-row" role="row">
            <span role="cell">{metric.label}</span>
            <strong role="cell">{metric.firstLabel}</strong>
            <strong role="cell">{metric.firstNormalizedLabel ?? "-"}</strong>
            <strong role="cell">{metric.secondLabel}</strong>
            <strong role="cell">{metric.secondNormalizedLabel ?? "-"}</strong>
          </div>
        ))}
      </div>

      <div className="agent-compare-profile" aria-label="Perfil comparativo">
        {first.profileMetrics.map((metric) => {
          const secondMetric = second.profileMetrics.find((item) => item.key === metric.key);
          return (
            <div key={metric.key} className="agent-compare-profile-row">
              <span>{metric.label}</span>
              <div className="agent-compare-bars">
                <i
                  className="agent-compare-bars__first"
                  style={{ "--bar-value": `${metric.value}%` } as CSSProperties}
                />
                <i
                  className="agent-compare-bars__second"
                  style={{ "--bar-value": `${secondMetric?.value ?? 0}%` } as CSSProperties}
                />
              </div>
              <strong>
                {formatNumber(metric.value, 0)} / {formatNumber(secondMetric?.value, 0)}
              </strong>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
