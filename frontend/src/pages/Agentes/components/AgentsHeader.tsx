import { formatNumber } from "../../../utils/formatters";
import type { AgentsOverviewStats } from "../types";

type Props = {
  overview: AgentsOverviewStats;
};

export function AgentsHeader({ overview }: Props) {
  const kpis = [
    {
      label: "Total agentes",
      value: formatNumber(overview.totalAgents),
      hint: "Plantilla disponible",
    },
    {
      label: "Con stats",
      value: formatNumber(overview.agentsWithStats),
      hint: "Agentes con muestra global",
    },
    {
      label: "Rol mas usado",
      value: overview.mostUsedRole,
      hint: "Por picks acumulados",
    },
    {
      label: "Mejor rol WR",
      value: overview.bestWinRateRole,
      hint: "Con muestra suficiente",
    },
    {
      label: "Picks globales",
      value: formatNumber(overview.totalPicks),
      hint: "Volumen total analizado",
    },
  ];

  return (
    <header className="agents-header">
      <div className="agents-header-copy">
        <span className="agents-eyebrow">Valorant</span>
        <h1 className="agents-title">Agentes</h1>
        <p className="agents-subtitle">
          Explora la plantilla, compara roles y detecta picks con impacto global
          dentro de ValoInsight.
        </p>
        <div className="agents-divider" />
      </div>

      <div className="agents-overview-kpis" aria-label="KPIs rapidos de agentes">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="agents-kpi-card">
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.hint}</small>
          </article>
        ))}
      </div>
    </header>
  );
}
