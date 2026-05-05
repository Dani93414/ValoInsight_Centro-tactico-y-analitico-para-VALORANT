import type { WeaponInsightItem } from "../types";

type Props = { insights: WeaponInsightItem[] };

export function WeaponsHighlights({ insights }: Props) {
  return (
    <section className="weapons-highlights" aria-label="Destacados de armas">
      {insights.map((insight) => (
        <article key={insight.label} className="weapons-highlight-card">
          <span>{insight.label}</span>
          <strong>{insight.value}</strong>
          <small>{insight.hint}</small>
        </article>
      ))}
    </section>
  );
}

