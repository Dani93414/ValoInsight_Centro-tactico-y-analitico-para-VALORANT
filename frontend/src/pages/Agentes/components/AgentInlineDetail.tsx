import { useId, useState } from "react";
import {
  formatNumber,
  formatPercent,
  getSampleReliabilityLabel,
} from "../../../utils/formatters";
import type { EnrichedAgent } from "../types";

type Props = {
  agent: EnrichedAgent;
  isRoleOpen: boolean;
  onClose: () => void;
  onToggleRole: () => void;
};

const statLabels: Array<{
  key: string;
  label: string;
  format?: "number" | "percent";
}> = [
  { key: "picks", label: "Picks globales", format: "number" },
  { key: "wins", label: "Wins", format: "number" },
  { key: "win_rate", label: "Win rate", format: "percent" },
  { key: "pick_rate", label: "Pick rate", format: "percent" },
  { key: "avg_kd", label: "KD medio", format: "number" },
  { key: "avg_acs", label: "ACS medio", format: "number" },
  { key: "avg_adr", label: "ADR medio", format: "number" },
  { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
  { key: "avg_fk_rate", label: "FK rate", format: "percent" },
  { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
  { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
];

function getStatValue(stats: EnrichedAgent["globalStats"], key: string) {
  if (!stats) return undefined;
  const value = stats[key as keyof typeof stats];
  return typeof value === "number" ? value : undefined;
}

function getMetricTone(key: string, value?: number) {
  if (value === undefined) return "neutral";
  if (key === "win_rate" || key === "pick_rate" || key.includes("rate")) {
    if (value >= 52) return "positive";
    if (value < 45) return "low";
  }
  if (key === "avg_kd") {
    if (value >= 1.05) return "positive";
    if (value < 0.9) return "low";
  }
  return "neutral";
}

export function AgentInlineDetail({
  agent,
  isRoleOpen,
  onClose,
  onToggleRole,
}: Props) {
  const [abilitiesOpen, setAbilitiesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const abilitiesId = useId();
  const statsId = useId();
  const roleId = useId();
  const stats = agent.globalStats;
  const sample = stats?.picks ?? 0;
  const reliability = getSampleReliabilityLabel(sample);
  const visibleStats = statLabels.filter(
    (item) => getStatValue(stats, item.key) !== undefined,
  );
  const quickStats = [
    { label: "Picks", value: formatNumber(stats?.picks) },
    { label: "Wins", value: formatNumber(stats?.wins) },
    { label: "Win rate", value: formatPercent(stats?.win_rate) },
    { label: "Pick rate", value: formatPercent(stats?.pick_rate) },
  ];
  const statsPreview =
    sample > 0
      ? `${formatNumber(stats?.picks)} picks · ${formatPercent(stats?.win_rate)} WR · ${reliability}`
      : "Sin estadisticas globales";
  const winRateWidth = Math.max(0, Math.min(stats?.win_rate ?? 0, 100));
  const pickRateWidth = Math.max(0, Math.min(stats?.pick_rate ?? 0, 100));

  return (
    <article className="agent-detail">
      <button
        type="button"
        className="agent-detail-close"
        onClick={onClose}
        aria-label="Cerrar detalle"
      >
        x
      </button>

      <div className="agent-detail-content">
        <div className="agent-detail-left">
          <div className="agent-detail-heading">
            <div>
              <span className="agents-section-eyebrow">Ficha tactica</span>
              <h2 className="agent-detail-name">{agent.displayName}</h2>
            </div>
            <span className="sample-reliability-badge">{reliability}</span>
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

          <div className="agent-extra-grid">
            <div>
              <span>Fecha de salida</span>
              <strong>{agent.releaseDate || "-"}</strong>
            </div>
            <div>
              <span>Origen</span>
              <strong>
                {agent.isBaseContent ? "Contenido base" : "Contenido anadido"}
              </strong>
            </div>
          </div>

          {(agent.characterTags?.length ?? 0) > 0 && (
            <div className="agent-tags">
              {agent.characterTags?.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}

          <section className={`agent-collapsible ${statsOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="agent-collapsible-toggle"
              onClick={() => setStatsOpen((open) => !open)}
              aria-expanded={statsOpen}
              aria-controls={statsId}
            >
              <span>Estadisticas</span>
              <strong>{statsPreview}</strong>
              <i className="agent-collapsible-chevron" aria-hidden="true" />
            </button>
            {statsOpen && (
              <div id={statsId} className="agent-collapsible-panel">
                <div className="agent-stat-bars">
                  <div>
                    <span>Win rate</span>
                    <strong>{formatPercent(stats?.win_rate)}</strong>
                    <div className="agent-stat-bar" aria-hidden="true">
                      <i style={{ width: `${sample > 0 ? winRateWidth : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <span>Pick rate</span>
                    <strong>{formatPercent(stats?.pick_rate)}</strong>
                    <div className="agent-stat-bar" aria-hidden="true">
                      <i style={{ width: `${sample > 0 ? pickRateWidth : 0}%` }} />
                    </div>
                  </div>
                </div>

                <span className="sample-reliability-badge">{reliability}</span>
                {visibleStats.length > 0 && sample > 0 ? (
                  <div className="agent-stats-grid">
                    {visibleStats.map((item) => {
                      const value = getStatValue(stats, item.key);
                      const tone = getMetricTone(item.key, value);
                      return (
                        <div key={item.key} className={`metric-tone-${tone}`}>
                          <span>{item.label}</span>
                          <strong>
                            {item.format === "percent"
                              ? formatPercent(value)
                              : formatNumber(
                                  value,
                                  item.key === "picks" || item.key === "wins"
                                    ? 0
                                    : 2,
                                )}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="agent-panel-empty">
                    No hay estadisticas disponibles para este agente.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className={`agent-collapsible ${abilitiesOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="agent-collapsible-toggle"
              onClick={() => setAbilitiesOpen((open) => !open)}
              aria-expanded={abilitiesOpen}
              aria-controls={abilitiesId}
            >
              <span>Habilidades · {agent.abilities.length}</span>
              <strong className="ability-preview-icons">
                {agent.abilities.slice(0, 4).map((ability) =>
                  ability.displayIcon ? (
                    <img
                      key={`${ability.slot}-${ability.displayName}`}
                      src={ability.displayIcon}
                      alt=""
                    />
                  ) : null,
                )}
              </strong>
              <i className="agent-collapsible-chevron" aria-hidden="true" />
            </button>
            {abilitiesOpen && (
              <div id={abilitiesId} className="agent-collapsible-panel">
                <div className="abilities-list">
                  {agent.abilities.map((ability) => (
                    <div
                      key={`${ability.slot}-${ability.displayName}`}
                      className="ability-card"
                    >
                      <div className="ability-header">
                        {ability.displayIcon && (
                          <img
                            src={ability.displayIcon}
                            alt={ability.displayName}
                            className="ability-icon"
                          />
                        )}
                        <span className="ability-slot">{ability.slot}</span>
                        <h4 className="ability-name">{ability.displayName}</h4>
                      </div>

                      <p className="ability-description">{ability.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
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
    </article>
  );
}
