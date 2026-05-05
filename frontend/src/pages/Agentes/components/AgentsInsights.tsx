import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { AgentComparisonInsight, AgentsInsightsModel } from "../types";

type Props = {
  insights: AgentsInsightsModel;
};

function ComparisonBars({ row, showPersonal }: { row: AgentComparisonInsight; showPersonal: boolean }) {
  const personalUsage = row.personalUsagePct ?? 0;
  const personalWinRate = row.personalWinRate ?? 0;

  return (
    <div className="agents-comparison-bars">
      <div className="agents-comparison-bar-group">
        <div className="agents-comparison-bar-label">
          <span>Uso global</span>
          <strong>{formatNumber(row.globalPicks)} picks · {formatPercent(row.globalUsagePct)}</strong>
        </div>
        <div className="agents-comparison-bar">
          <i style={{ width: `${Math.min(row.globalUsagePct, 100)}%` }} />
        </div>
      </div>

      {showPersonal && (
        <div className="agents-comparison-bar-group is-personal">
          <div className="agents-comparison-bar-label">
            <span>Tu uso</span>
            <strong>{formatNumber(row.personalPicks ?? 0)} picks · {formatPercent(personalUsage)}</strong>
          </div>
          <div className="agents-comparison-bar">
            <i style={{ width: `${Math.min(personalUsage, 100)}%` }} />
          </div>
        </div>
      )}

      <div className="agents-comparison-bar-group">
        <div className="agents-comparison-bar-label">
          <span>WR global</span>
          <strong>{formatPercent(row.globalWinRate)} WR</strong>
        </div>
        <div className="agents-comparison-bar">
          <i style={{ width: `${Math.min(row.globalWinRate, 100)}%` }} />
        </div>
      </div>

      {showPersonal && (
        <div className="agents-comparison-bar-group is-personal">
          <div className="agents-comparison-bar-label">
            <span>Tu WR</span>
            <strong>{formatPercent(personalWinRate)} WR</strong>
          </div>
          <div className="agents-comparison-bar">
            <i style={{ width: `${Math.min(personalWinRate, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentsInsights({ insights }: Props) {
  const showPersonal = insights.hasSession && insights.hasPersonalData;

  return (
    <section className="agents-insights" aria-label="Comparativa global vs tu rendimiento">
      <div className="agents-insights-heading">
        <span className="agents-section-eyebrow">Estadísticas globales</span>
        <h2>Comparativa global vs tu rendimiento</h2>
        <p>
          {insights.hasSession
            ? showPersonal
              ? "Tus agentes más usados frente a la referencia global de la región seleccionada."
              : insights.isLoadingPersonal
                ? "Cargando tus estadísticas personales..."
                : "Aún no hay suficientes partidas personales para comparar."
            : "Rendimiento global de los agentes con más presencia en la región seleccionada."}
        </p>
      </div>

      <div className="agents-comparison-grid">
        {insights.rows.map((row) => (
          <article key={row.key} className="agents-comparison-card">
            <div className="agents-comparison-card-heading">
              <div>
                <strong>{row.agentName}</strong>
                <span>{row.roleName}</span>
              </div>
            </div>
            <ComparisonBars row={row} showPersonal={showPersonal} />
          </article>
        ))}
      </div>
    </section>
  );
}
