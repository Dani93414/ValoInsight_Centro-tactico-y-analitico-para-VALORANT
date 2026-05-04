import { useId, useState } from "react";
import { formatNumber, formatPercent, getSampleReliabilityLabel } from "../../../utils/formatters";
import type { EnrichedAgent } from "../types";

type Props = {
  agent: EnrichedAgent;
  isRoleOpen: boolean;
  onClose: () => void;
  onToggleRole: () => void;
};

const statLabels: Array<{ key: string; label: string; format?: "number" | "percent" }> = [
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

  return (
    <div className="agent-detail">
      <button
        type="button"
        className="agent-detail-close"
        onClick={onClose}
        aria-label="Cerrar detalle"
      >
        ×
      </button>

      <div className="agent-detail-content">
        <div className="agent-detail-left">
          <h2 className="agent-detail-name">{agent.displayName}</h2>

          <button
            type="button"
            className="agent-role-badge"
            onClick={onToggleRole}
            aria-expanded={isRoleOpen}
            aria-controls={roleId}
          >
            {agent.role.displayName}
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

          <div className="agent-extra-grid">
            <div>
              <span>Fecha de salida</span>
              <strong>{agent.releaseDate || "-"}</strong>
            </div>
            <div>
              <span>Origen</span>
              <strong>
                {agent.isBaseContent ? "Contenido base" : "Contenido añadido"}
              </strong>
            </div>
            <div>
              <span>Picks globales</span>
              <strong>{formatNumber(stats?.picks)}</strong>
            </div>
            <div>
              <span>Win rate global</span>
              <strong>{formatPercent(stats?.win_rate)}</strong>
            </div>
          </div>

          {(agent.characterTags?.length ?? 0) > 0 && (
            <div className="agent-tags">
              {agent.characterTags?.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          )}

          <section className="agent-collapsible">
            <button
              type="button"
              className="agent-collapsible-toggle"
              onClick={() => setStatsOpen((open) => !open)}
              aria-expanded={statsOpen}
              aria-controls={statsId}
            >
              <span>Estadísticas</span>
              <strong>{statsOpen ? "Cerrar" : "Abrir"}</strong>
            </button>
            {statsOpen && (
              <div id={statsId} className="agent-collapsible-panel">
                <span className="sample-reliability-badge">{reliability}</span>
                {visibleStats.length > 0 && sample > 0 ? (
                  <div className="agent-stats-grid">
                    {visibleStats.map((item) => {
                      const value = getStatValue(stats, item.key);
                      return (
                        <div key={item.key}>
                          <span>{item.label}</span>
                          <strong>
                            {item.format === "percent"
                              ? formatPercent(value)
                              : formatNumber(value, item.key === "picks" || item.key === "wins" ? 0 : 2)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="agent-panel-empty">
                    No hay estadísticas disponibles para este agente.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="agent-collapsible">
            <button
              type="button"
              className="agent-collapsible-toggle"
              onClick={() => setAbilitiesOpen((open) => !open)}
              aria-expanded={abilitiesOpen}
              aria-controls={abilitiesId}
            >
              <span>Habilidades</span>
              <strong>{abilitiesOpen ? "Cerrar" : "Abrir"}</strong>
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
    </div>
  );
}
