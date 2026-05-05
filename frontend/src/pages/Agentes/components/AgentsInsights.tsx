import type { AgentInsightItem } from "../types";

type Props = {
  insights: AgentInsightItem[];
};

export function AgentsInsights({ insights }: Props) {
  return (
    <section className="agents-insights" aria-label="Destacados de agentes">
      {insights.map((insight) => (
        <article key={insight.label} className="agents-insight-card">
          <span className="agents-insight-label">{insight.label}</span>
          <strong className="agents-insight-value">{insight.value}</strong>
          <small className="agents-insight-hint">{insight.hint}</small>
        </article>
      ))}
    </section>
  );
}
