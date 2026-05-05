import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { AgentInsightItem } from "../types";

type Props = {
  insights: AgentInsightItem[];
  isLoggedIn?: boolean;
};

export function AgentsInsights({ insights, isLoggedIn }: Props) {
  const top = insights.slice(0, 3);

  return (
    <section className="agents-insights" aria-label="Top agentes">
      <div className="agents-top-grid">
        {top.map(({ agent, rank }) => (
          <article key={agent.displayName} className="agents-top-card">
            {agent.displayIcon && (
              <img
                src={agent.displayIcon}
                alt={agent.displayName}
                className="agents-top-image"
              />
            )}
            <div className="agents-top-body">
              <strong>{agent.displayName}</strong>
              <small>{agent.role.displayName}</small>
              <div className="agents-top-metrics">
                <span>{formatNumber(agent.globalStats?.picks)} picks</span>
                <strong>{formatPercent(agent.globalStats?.win_rate)} WR</strong>
              </div>
            </div>
          </article>
        ))}
      </div>

      {isLoggedIn && top[0]?.agent.comparisonMetrics.length > 0 && (
        <div className="agents-comparison-table">
          {top[0].agent.comparisonMetrics.map((m) => (
            <div key={m.key} className="agents-comparison-row">
              <span>{m.label}</span>
              <span>
                {m.format === "percent"
                  ? formatPercent(m.globalValue)
                  : formatNumber(m.globalValue, 2)}
              </span>
              <span>
                {m.format === "percent"
                  ? formatPercent(m.personalValue)
                  : formatNumber(m.personalValue, 2)}
              </span>
              <span>
                {m.delta !== undefined
                  ? (m.delta > 0 ? "+" : "") +
                    (m.format === "percent"
                      ? formatPercent(m.delta)
                      : formatNumber(m.delta, 2))
                  : "-"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
