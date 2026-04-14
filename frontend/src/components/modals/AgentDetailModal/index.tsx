import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  formatNumber,
  formatPercent,
  formatDate,
} from "../../../utils/formatters";
import type { AnalyticsMatch } from "../../../types/dashboard";
import { useAgentDetailStats } from "./useAgentDetailStats";
import "../DetailModals.css";

/* =====================================================
   TYPES
   ===================================================== */

type Props = {
  agentId: string;
  analyticsList: AnalyticsMatch[];
  agentNameMap: Record<string, string>;
  onClose: () => void;
};

/* =====================================================
   COMPONENT
   ===================================================== */

export default function AgentDetailModal({
  agentId,
  analyticsList,
  agentNameMap,
  onClose,
}: Props) {
  const {
    navigate,
    loading,
    agentContent,
    stats,
    recentMatches,
    miniChartData,
    radarData,
    sideStats,
    hasSideData,
    multikillData,
    displayName,
  } = useAgentDetailStats({ agentId, analyticsList, agentNameMap });

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel agent-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
          <div className="loading-card">
            <div className="loading-spinner" />
            <h2>Cargando agente</h2>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel agent-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {/* ── Header ── */}
        <div className="modal-header-block">
          <div className="agent-modal-header">
            {agentContent?.displayIcon && (
              <img
                src={agentContent.displayIcon}
                alt={displayName}
                className="agent-modal-portrait"
              />
            )}
            <div>
              <span className="stats-eyebrow">Agente</span>
              <h2 className="stats-title modal-title-small">{displayName}</h2>
              <p className="stats-subtitle">
                {agentContent?.role?.displayName ?? "Rol desconocido"}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="agent-view-btn"
            onClick={() => {
              onClose();
              navigate("/agentes", { state: { agentName: displayName } });
            }}
          >
            Ver el agente
          </button>
        </div>

        {/* ── KPIs ── */}
        <div className="stats-kpis modal-kpis">
          <div className="kpi-card">
            <span className="kpi-label">Partidas</span>
            <strong className="kpi-value">{formatNumber(stats.matches)}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Victorias</span>
            <strong className="kpi-value">{formatNumber(stats.wins)}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Win Rate</span>
            <strong className="kpi-value">
              {formatPercent(stats.winRate, 1)}
            </strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">KD</span>
            <strong className="kpi-value">{formatNumber(stats.kd, 2)}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">KDA</span>
            <strong className="kpi-value">{formatNumber(stats.kda, 2)}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">ACS medio</span>
            <strong className="kpi-value">
              {formatNumber(stats.acsAvg, 1)}
            </strong>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="detail-grid">
          {/* ── Resumen con este agente ── */}
          <section className="detail-card detail-card-half">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Resumen con este agente</h3>
                <p className="panel-subtitle">
                  Métricas acumuladas del jugador usando este agente.
                </p>
              </div>
            </div>
            <div className="summary-grid">
              <div className="summary-item">
                <span>Kills / partida</span>
                <strong>{formatNumber(stats.killsPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>Deaths / partida</span>
                <strong>{formatNumber(stats.deathsPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>Assists / partida</span>
                <strong>{formatNumber(stats.assistsPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>ADR medio</span>
                <strong>{formatNumber(stats.adrAvg, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>Headshot %</span>
                <strong>{formatPercent(stats.hsAvg, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>ACS medio</span>
                <strong>{formatNumber(stats.acsAvg, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>Diff. Daño / partida</span>
                <strong
                  className={
                    stats.damageDeltaPerMatch >= 0
                      ? "text-positive"
                      : "text-negative"
                  }
                >
                  {stats.damageDeltaPerMatch >= 0 ? "+" : ""}
                  {formatNumber(stats.damageDeltaPerMatch, 1)}
                </strong>
              </div>
              <div className="summary-item">
                <span>Supervivencia</span>
                <strong>{formatPercent(stats.survivalRate, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>Tasa Multikill</span>
                <strong>{formatPercent(stats.multikillRate, 1)}</strong>
              </div>
            </div>
          </section>

          {/* ── Tendencia de ACS ── */}
          <section className="detail-card detail-card-half">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Tendencia de ACS</h3>
                <p className="panel-subtitle">
                  Últimas {recentMatches.length} partidas con este agente (de
                  más antigua a más reciente).
                </p>
              </div>
            </div>
            <div className="modal-chart-box modal-chart-box--tall">
              {miniChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={miniChartData}
                    margin={{ top: 10, right: 14, bottom: 4, left: -6 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fill: "#b5b5b5", fontSize: 13, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#b5b5b5", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      domain={["dataMin - 20", "dataMax + 20"]}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: "rgba(20,22,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        fontSize: "0.85rem",
                      }}
                      formatter={(
                        value: unknown,
                        _name: unknown,
                        props: unknown,
                      ) => {
                        const p = (
                          props as {
                            payload?: { name?: string; result?: string };
                          }
                        )?.payload;
                        return [
                          `ACS: ${value}  ·  ${p?.result ?? ""}`,
                          p?.name ?? "",
                        ];
                      }}
                      labelFormatter={() => ""}
                    />
                    <Line
                      type="monotone"
                      dataKey="acs"
                      stroke="#ff4655"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#ff4655", strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: "#ff7a85", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">Sin suficientes partidas.</div>
              )}
            </div>
          </section>

          {/* ── First Blood / Opening Duels ── */}
          <section className="detail-card detail-card-half">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Duelos iniciales</h3>
                <p className="panel-subtitle">
                  First kills, first deaths y eficiencia de apertura.
                </p>
              </div>
            </div>
            <div className="summary-grid summary-grid--compact">
              <div className="summary-item">
                <span>FK / partida</span>
                <strong>{formatNumber(stats.fkPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>FD / partida</span>
                <strong>{formatNumber(stats.fdPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>FK/FD ratio</span>
                <strong>{formatNumber(stats.fkfdRatio, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>Duelo Win %</span>
                <strong>{formatPercent(stats.openingDuelWinPct, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>Trade kills / partida</span>
                <strong>{formatNumber(stats.tradeKillsPerMatch, 2)}</strong>
              </div>
              <div className="summary-item">
                <span>Clutch Win Rate</span>
                <strong>{formatPercent(stats.clutchWinRate, 1)}</strong>
              </div>
            </div>
          </section>

          {/* ── Perfil Táctico (Radar) ── */}
          <section className="detail-card detail-card-half">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Perfil táctico</h3>
                <p className="panel-subtitle">
                  Valoración porcentual en diferentes áreas tácticas.
                </p>
              </div>
            </div>
            <div className="modal-chart-box modal-chart-box--radar">
              <ResponsiveContainer width="100%" height={310}>
                <RadarChart
                  data={radarData}
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                >
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: "#c0c0c0", fontSize: 12, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="value"
                    stroke="#ff4655"
                    fill="#ff4655"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <ReTooltip
                    contentStyle={{
                      background: "rgba(20,22,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                    }}
                    formatter={(
                      _value: unknown,
                      _name: unknown,
                      props: unknown,
                    ) => {
                      const p = (props as { payload?: { real?: string } })
                        ?.payload;
                      return [p?.real ?? `${Number(_value).toFixed(1)}%`, ""];
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ── Ataque vs Defensa ── */}
          {hasSideData && (
            <section className="detail-card detail-card-large">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Ataque vs Defensa</h3>
                  <p className="panel-subtitle">
                    Rendimiento comparado por lado en las partidas con este
                    agente.
                  </p>
                </div>
              </div>
              <div className="side-comparison">
                <div className="side-comparison-header">
                  <span className="side-comp-metric"></span>
                  <span className="side-comp-side side-comp-side--atk">
                    Ataque
                  </span>
                  <span className="side-comp-side side-comp-side--def">
                    Defensa
                  </span>
                </div>
                <div className="side-comparison-row">
                  <span className="side-comp-metric">KD</span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.atkKD, 2)}
                  </span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.defKD, 2)}
                  </span>
                </div>
                <div className="side-comparison-row">
                  <span className="side-comp-metric">ADR</span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.atkADR, 1)}
                  </span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.defADR, 1)}
                  </span>
                </div>
                <div className="side-comparison-row">
                  <span className="side-comp-metric">Win Rate</span>
                  <span className="side-comp-value">
                    {formatPercent(sideStats.atkWinPct, 1)}
                  </span>
                  <span className="side-comp-value">
                    {formatPercent(sideStats.defWinPct, 1)}
                  </span>
                </div>
                <div className="side-comparison-row">
                  <span className="side-comp-metric">FK / ronda</span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.atkFKPerRound, 2)}
                  </span>
                  <span className="side-comp-value">
                    {formatNumber(sideStats.defFKPerRound, 2)}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* ── Multikills ── */}
          {multikillData.length > 0 && (
            <section className="detail-card">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Multikills</h3>
                  <p className="panel-subtitle">
                    Rondas con 2 o más kills acumuladas con este agente.
                  </p>
                </div>
              </div>
              <div className="modal-chart-box">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={multikillData}
                    margin={{ top: 10, right: 20, bottom: 4, left: -10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#b5b5b5", fontSize: 13, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#b5b5b5", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: "rgba(20,22,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "10px",
                        fontSize: "0.85rem",
                      }}
                    />
                    <Bar
                      dataKey="value"
                      name="Rondas"
                      radius={[6, 6, 0, 0]}
                      barSize={32}
                    >
                      {multikillData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* ── Últimas partidas ── */}
          <section className="detail-card detail-card-full">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  Últimas partidas con este agente
                </h3>
                <p className="panel-subtitle">
                  Vista rápida de rendimiento reciente.
                </p>
              </div>
            </div>
            <div className="mini-match-list">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => {
                  const kills =
                    match.player_totals_from_match?.kills ??
                    match.overview?.kills ??
                    0;
                  const deaths =
                    match.player_totals_from_match?.deaths ??
                    match.overview?.deaths ??
                    0;
                  const assists =
                    match.player_totals_from_match?.assists ??
                    match.overview?.assists ??
                    0;
                  const won = match.won_match;

                  return (
                    <div
                      key={match.match_id ?? `${match.game_start_millis}`}
                      className={`mini-match-item ${won ? "mini-match-item--win" : "mini-match-item--loss"}`}
                    >
                      <div>
                        <strong>{match.map_name ?? "Mapa desconocido"}</strong>
                        <small>{formatDate(match.game_start_millis)}</small>
                      </div>
                      <div className="mini-match-metrics">
                        <span className={won ? "badge-win" : "badge-loss"}>
                          {won ? "Victoria" : "Derrota"}
                        </span>
                        <span>
                          {kills}/{deaths}/{assists}
                        </span>
                        <span>ACS {formatNumber(match.overview?.acs, 1)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-chart">
                  No hay partidas con este agente.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
