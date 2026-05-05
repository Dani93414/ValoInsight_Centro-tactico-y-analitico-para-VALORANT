import { useEffect, useId, useState } from "react";
import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { AgentComparisonMetric, EnrichedAgent } from "../types";

type Props = {
  agent: EnrichedAgent;
  hasSession: boolean;
  isRoleOpen: boolean;
  onClose: () => void;
  onToggleRole: () => void;
};

type StatConfig = {
  key: string;
  label: string;
  format?: "number" | "percent";
};

const statGroups: Array<{ title: string; items: StatConfig[] }> = [
  {
    title: "Impacto",
    items: [
      { key: "avg_kd", label: "KD medio", format: "number" },
      { key: "avg_acs", label: "ACS medio", format: "number" },
      { key: "avg_adr", label: "ADR medio", format: "number" },
      { key: "avg_fk_rate", label: "FK rate", format: "percent" },
    ],
  },
  {
    title: "Precisión y supervivencia",
    items: [
      { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
      { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
      { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
    ],
  },
];

function getStatValue(stats: EnrichedAgent["globalStats"], key: string) {
  if (!stats) return undefined;
  const value = stats[key as keyof typeof stats];
  return typeof value === "number" ? value : undefined;
}

function getDiffTone(metric: AgentComparisonMetric) {
  if (typeof metric.diff === "number") {
    if (metric.diff > 0) return "positive";
    if (metric.diff < 0) return "negative";
    return "neutral";
  }

  const normalized = metric.diffLabel.trim();
  if (normalized.startsWith("+")) return "positive";
  if (normalized.startsWith("-")) return "negative";
  return "neutral";
}

function formatStatValue(value: number | undefined, format?: "number" | "percent") {
  return format === "percent" ? formatPercent(value) : formatNumber(value, 2);
}

export function AgentInlineDetail({
  agent,
  hasSession,
  isRoleOpen,
  onClose,
  onToggleRole,
}: Props) {
  const [activeAbilityIndex, setActiveAbilityIndex] = useState(0);
  const abilityTabsId = useId();
  const roleId = useId();
  const stats = agent.globalStats;
  const sample = stats?.picks ?? 0;
  const showComparison =
    hasSession &&
    Boolean(agent.personalStats?.picks) &&
    agent.comparisonMetrics.length > 0;
  const quickStats = [
    { label: "Picks", value: formatNumber(stats?.picks) },
    { label: "Wins", value: formatNumber(stats?.wins) },
    { label: "Win rate", value: formatPercent(stats?.win_rate) },
    { label: "Pick rate", value: formatPercent(stats?.pick_rate) },
  ];
  const comparisonSummary = agent.comparisonMetrics.reduce(
    (summary, metric) => {
      const tone = getDiffTone(metric);
      return {
        ...summary,
        [tone]: summary[tone] + 1,
      };
    },
    { positive: 0, negative: 0, neutral: 0 },
  );
  const activeAbility = agent.abilities[activeAbilityIndex] ?? agent.abilities[0];

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setActiveAbilityIndex(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [agent.uuid, agent.id, agent.displayName]);

  return (
    <article className="agent-detail">
      <button
        type="button"
        className="agent-detail-close"
        onClick={onClose}
        aria-label="Cerrar detalle"
      >
        ×
      </button>

      <div className="agent-detail-hero">
        <div className="agent-detail-left">
          <div className="agent-detail-heading">
            <div>
              <span className="agents-section-eyebrow">Ficha táctica</span>
              <h2 className="agent-detail-name">{agent.displayName}</h2>
            </div>
          </div>

          <button
            type="button"
            className="agent-role-badge"
            onClick={onToggleRole}
            aria-expanded={isRoleOpen}
            aria-controls={roleId}
          >
            {agent.role.displayIcon && <img src={agent.role.displayIcon} alt="" />}
            <span>{agent.role.displayName}</span>
            <i aria-hidden="true" />
          </button>

          {isRoleOpen && (
            <div id={roleId} className="agent-role-info">
              {agent.role.displayIcon && (
                <img src={agent.role.displayIcon} alt={agent.role.displayName} />
              )}
              <p>{agent.role.description}</p>
            </div>
          )}

          <p className="agent-description">{agent.description}</p>

          <div className="agent-quick-kpis" aria-label="KPIs del agente">
            {quickStats.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="agent-detail-right">
          {agent.background && (
            <img src={agent.background} alt="" className="agent-background" />
          )}

          {agent.fullPortrait && (
            <img
              src={agent.fullPortrait}
              alt={agent.displayName}
              className="agent-fullportrait"
            />
          )}
        </div>
      </div>

      <section className="agent-detail-section" aria-labelledby="agent-performance-title">
        <div className="agent-detail-section-heading">
          <span className="agents-section-eyebrow">Rendimiento</span>
          <h3 id="agent-performance-title">Global vs personal</h3>
        </div>

        {showComparison ? (
          <>
            <div className="agent-comparison-summary" aria-label="Resumen de comparación">
              <span className="metric-diff metric-diff-positive">
                {comparisonSummary.positive} por encima
              </span>
              <span className="metric-diff metric-diff-negative">
                {comparisonSummary.negative} por debajo
              </span>
              <span className="metric-diff metric-diff-neutral">
                {comparisonSummary.neutral} igualadas
              </span>
            </div>

            <div
              className="agents-comparison-table"
              role="table"
              aria-label="Comparativa global vs tu rendimiento"
            >
              <div className="agents-comparison-row agents-comparison-row--head" role="row">
                <span role="columnheader">Métrica</span>
                <span role="columnheader">Global</span>
                <span role="columnheader">Tú</span>
                <span role="columnheader">Diferencia</span>
              </div>
              {agent.comparisonMetrics.map((metric) => {
                const diffTone = getDiffTone(metric);
                return (
                  <div key={metric.key} className="agents-comparison-row" role="row">
                    <span role="cell">{metric.label}</span>
                    <strong role="cell">{metric.globalLabel}</strong>
                    <strong role="cell">{metric.personalLabel}</strong>
                    <em
                      role="cell"
                      className={`metric-diff metric-diff-${diffTone}`}
                    >
                      {metric.diffLabel}
                    </em>
                  </div>
                );
              })}
            </div>
          </>
        ) : sample > 0 ? (
          <div className="agent-stat-groups">
            {statGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => getStatValue(stats, item.key) !== undefined,
              );
              if (visibleItems.length === 0) return null;

              return (
                <section key={group.title} className="agent-stat-group">
                  <h4>{group.title}</h4>
                  <div className="agent-stats-grid">
                    {visibleItems.map((item) => {
                      const value = getStatValue(stats, item.key);
                      return (
                        <div key={item.key}>
                          <span>{item.label}</span>
                          <strong>{formatStatValue(value, item.format)}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className="agent-panel-empty">
            No hay estadísticas disponibles para este agente.
          </p>
        )}
      </section>

      <section className="agent-detail-section" aria-labelledby="agent-abilities-title">
        <div className="agent-detail-section-heading">
          <span className="agents-section-eyebrow">Kit</span>
          <h3 id="agent-abilities-title">Habilidades</h3>
        </div>

        <div className="ability-tabs" role="tablist" aria-label="Habilidades del agente">
          {agent.abilities.map((ability, index) => {
            const tabId = `${abilityTabsId}-tab-${index}`;
            const panelId = `${abilityTabsId}-panel-${index}`;
            const selected = activeAbilityIndex === index;

            return (
              <button
                key={`${ability.slot}-${ability.displayName}`}
                id={tabId}
                type="button"
                className={`ability-tab ${selected ? "active" : ""}`}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                onClick={() => setActiveAbilityIndex(index)}
              >
                {ability.displayIcon ? (
                  <img src={ability.displayIcon} alt="" />
                ) : (
                  <strong>{ability.slot.charAt(0) || ability.displayName.charAt(0)}</strong>
                )}
                <span>{ability.displayName}</span>
              </button>
            );
          })}
        </div>

        {activeAbility && (
          <div
            id={`${abilityTabsId}-panel-${activeAbilityIndex}`}
            className="ability-tab-panel"
            role="tabpanel"
            aria-labelledby={`${abilityTabsId}-tab-${activeAbilityIndex}`}
          >
            <div className="ability-tab-panel-icon">
              {activeAbility.displayIcon ? (
                <img src={activeAbility.displayIcon} alt="" />
              ) : (
                <strong>
                  {activeAbility.slot.charAt(0) || activeAbility.displayName.charAt(0)}
                </strong>
              )}
            </div>
            <div>
              <span className="ability-slot">{activeAbility.slot}</span>
              <h4 className="ability-name">{activeAbility.displayName}</h4>
              <p className="ability-description">{activeAbility.description}</p>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
