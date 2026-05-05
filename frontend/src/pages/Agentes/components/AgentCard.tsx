import type { CSSProperties } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { EnrichedAgent } from "../types";

type Props = {
  agent: EnrichedAgent;
  active: boolean;
  onSelect: (agent: EnrichedAgent) => void;
  style?: CSSProperties;
};

export function AgentCard({ agent, active, onSelect, style }: Props) {
  const picks = agent.globalStats?.picks ?? 0;
  const winRate = agent.globalStats?.win_rate;
  const hasStats = picks > 0;
  const cardStyle = {
    ...style,
    "--agent-accent": agent.backgroundGradientColors?.[0] ?? "#ff4655",
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`agent-card ${active ? "active" : ""}`}
      onClick={() => onSelect(agent)}
      aria-pressed={active}
      style={cardStyle}
    >
      {agent.displayIcon && (
        <div className="agent-image-frame">
          <img
            src={agent.displayIcon}
            alt={agent.displayName}
            className="agent-image"
            loading="lazy"
          />
        </div>
      )}

      <div className="agent-card-body">
        <h2 className="agent-name">{agent.displayName}</h2>
        <p className="agent-role">{agent.role.displayName}</p>
        <div className="agent-card-metrics">
          <div>
            <span>Picks</span>
            <strong>{hasStats ? formatNumber(picks) : "-"}</strong>
          </div>
          <div>
            <span>Win rate</span>
            <strong>{hasStats ? formatPercent(winRate) : "-"}</strong>
          </div>
        </div>
      </div>
    </button>
  );
}
