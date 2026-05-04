import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { EnrichedAgent } from "../types";

type Props = {
  agent: EnrichedAgent;
  active: boolean;
  onSelect: (agent: EnrichedAgent) => void;
};

export function AgentCard({ agent, active, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`agent-card ${active ? "active" : ""}`}
      onClick={() => onSelect(agent)}
      aria-pressed={active}
    >
      {agent.displayIcon && (
        <img
          src={agent.displayIcon}
          alt={agent.displayName}
          className="agent-image"
          loading="lazy"
        />
      )}

      <h2 className="agent-name">{agent.displayName}</h2>
      <p className="agent-role">{agent.role.displayName}</p>
      {(agent.globalStats?.picks ?? 0) > 0 ? (
        <p className="agent-global-line">
          {formatNumber(agent.globalStats?.picks)} picks ·{" "}
          {formatPercent(agent.globalStats?.win_rate)}
        </p>
      ) : null}
    </button>
  );
}

