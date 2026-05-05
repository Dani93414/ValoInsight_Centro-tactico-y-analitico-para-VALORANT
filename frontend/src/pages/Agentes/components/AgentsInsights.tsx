import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { TopAgentSummary } from "../types";

type Props = {
  topAgents: TopAgentSummary[];
};

export function AgentsInsights({ topAgents }: Props) {
  return (
    <section className="agents-top-strip" aria-label="Top 3 agentes por win rate">
      {topAgents.map((agent) => (
        <article key={agent.key} className="agents-top-pill">
          <div className="agents-top-avatar">
            {agent.displayIcon && (
              <img src={agent.displayIcon} alt="" loading="lazy" />
            )}
          </div>
          <div className="agents-top-title-row">
            <strong className="agents-top-name">{agent.name}</strong>
            <span className="agents-top-role">{agent.roleName}</span>
          </div>
          <span className="agents-top-stat">
            {formatNumber(agent.picks)} picks · {formatPercent(agent.usagePct)} PR
          </span>
          <span className="agents-top-stat agents-top-stat--wr">
            {formatPercent(agent.winRate)} WR
          </span>
        </article>
      ))}
    </section>
  );
}
