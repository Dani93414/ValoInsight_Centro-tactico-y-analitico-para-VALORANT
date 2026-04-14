import React from "react";
import { useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Info } from "lucide-react";
import MatchDetailModal from "../../components/modals/MatchDetailModal";
import AgentDetailModal from "../../components/modals/AgentDetailModal";
import HeatmapModal from "../../components/modals/HeatmapModal";
import BackButton from "../../components/BackButton";
import {
  useEstadisticasViewModel,
  MATCHES_PER_PAGE,
  HISTORY_LOAD_STEP,
} from "./useEstadisticasViewModel";
import "../Estadisticas.scss";

import type {
  HeaderVisualCard,
  SideFilter,
  PartySizeFilter,
} from "../../types/dashboard";
import {
  formatNumber,
  formatPercent,
  formatHours,
  normalizeLabel,
} from "../../utils/formatters";
import { normalizeCompetitiveTierIconPath } from "../../utils/rankUtils";
import {
  ACT_FILTER_ALL,
  ACT_FILTER_CURRENT,
  AGENT_FILTER_ALL,
  MAP_FILTER_ALL,
  QUEUE_FILTER_COMPETITIVE,
  getPerformanceColor,
  getHeaderAgentImageAdjustmentByDisplayName,
  buildSvgPlaceholder,
  getHeaderCardKind,
} from "../../constants/dashboard";

// --- Resolve helpers (use normalizeLabel from utils) ---

function resolveMapImage(
  mapName?: string,
  mapMediaMap?: Record<string, string>,
) {
  const normalizedMapName = normalizeLabel(mapName);
  if (normalizedMapName && mapMediaMap?.[normalizedMapName]) {
    return mapMediaMap[normalizedMapName];
  }

  return buildSvgPlaceholder(
    mapName || "Mapa desconocido",
    "Mapa destacado",
    "#ff7a85",
  );
}

function resolveWeaponImage(weaponName?: string) {
  return buildSvgPlaceholder(
    weaponName || "Arma desconocida",
    "Arma con mas kills",
    "#ff4655",
  );
}

type MultikillTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
};

function MultikillTooltipContent({
  active,
  payload,
  label,
}: MultikillTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];

  return (
    <div className="multikill-tooltip">
      <div className="multikill-tooltip-title">{label ?? "-"}</div>
      <div className="multikill-tooltip-row">
        <span className="multikill-tooltip-label">Rondas:</span>
        <span className="multikill-tooltip-value">{point?.value ?? 0}</span>
      </div>
    </div>
  );
}

function HeaderShowcaseCard(props: HeaderVisualCard) {
  const { title, subtitle, image } = props;
  const kind = getHeaderCardKind(subtitle);
  const resolvedImage = image || buildSvgPlaceholder(title, subtitle);

  if (kind === "agent") {
    const adj = getHeaderAgentImageAdjustmentByDisplayName(title);
    const figureStyle: React.CSSProperties = {
      ["--agent-obj-x" as string]: `${adj.objX}%`,
      ["--agent-scale" as string]: adj.scale,
      ["--agent-shift-y" as string]: `${adj.shiftY}%`,
      ["--agent-flip" as string]: adj.flip ? -1 : 1,
      ["--agent-fade-start" as string]: `${adj.fadeStart}%`,
      ["--agent-fade-mid" as string]: `${adj.fadeMid}%`,
      ["--agent-fade-end" as string]: `${adj.fadeEnd}%`,
    };

    return (
      <article className="header-showcase-agent-stage" data-kind={kind}>
        <div className="header-showcase-agent-media">
          <img
            src={resolvedImage}
            alt={title}
            className="header-showcase-agent-figure"
            style={figureStyle}
          />
        </div>
      </article>
    );
  }

  const cardClassName = [
    "header-showcase-card",
    "header-showcase-card-vertical",
    kind === "map" ? "header-showcase-card-map" : "",
    kind === "weapon" ? "header-showcase-card-weapon" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const imageClassName = [
    "header-showcase-image",
    kind === "weapon" ? "header-showcase-image-weapon" : "",
    kind === "map" ? "header-showcase-image-map" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClassName = [
    "header-showcase-overlay",
    kind === "map" ? "header-showcase-overlay-map" : "",
    kind === "weapon" ? "header-showcase-overlay-weapon" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Render map cards via <img> to avoid background-image refresh issues.
  if (kind === "map") {
    return (
      <article className={cardClassName} data-kind={kind}>
        <div className="header-showcase-media">
          <img src={resolvedImage} alt={title} className={imageClassName} />
          <div className={overlayClassName} />
        </div>

        <div className="header-showcase-copy">
          <span className="header-showcase-subtitle">{subtitle}</span>
          <strong className="header-showcase-title">{title}</strong>
        </div>
      </article>
    );
  }

  return (
    <article className={cardClassName} data-kind={kind}>
      <div className="header-showcase-media">
        <img src={resolvedImage} alt={title} className={imageClassName} />
        <div className={overlayClassName} />
      </div>

      <div className="header-showcase-copy">
        <span className="header-showcase-subtitle">{subtitle}</span>
        <strong className="header-showcase-title">{title}</strong>
      </div>
    </article>
  );
}

export default function Estadisticas() {
  const { playerId } = useParams();

  const {
    loading,
    dashboard,
    player,
    filters,
    setFilters,
    filtersOpen,
    setFiltersOpen,
    actFilterOptions,
    agentOptions,
    mapOptions,
    queueOptions,
    partySizeOptions,
    effectiveActId,
    selectedMatchId,
    setSelectedMatchId,
    selectedAgentId,
    setSelectedAgentId,
    heatmapOpen,
    setHeatmapOpen,
    historyModalOpen,
    setHistoryModalOpen,
    agentsModalOpen,
    setAgentsModalOpen,
    weaponsModalOpen,
    setWeaponsModalOpen,
    setHistoryVisibleCount,
    historyExpanded,
    setHistoryExpanded,
    visibleHistoryMatches,
    canLoadMoreHistory,
    canCollapseHistory,
    filteredMatches,
    sortedFilteredMatches,
    filteredAnalyticsList,
    globalRadarData,
    globalMultikillData,
    displayedRankName,
    displayedRankVisual,
    highestRankName,
    highestRankVisual,
    derivedSummary,
    metrics,
    filteredShotChart,
    filteredPlaytimeMillis,
    latestFilteredAccountLevel,
    mostPlayedAgents,
    mostPlayedWeapons,
    bestMapWinrateInsight,
    bestWeaponInsight,
    mostPlayedAgentInsight,
    performanceMetrics,
    floatingTooltip,
    getFloatingInfoHoverHandlers,
  } = useEstadisticasViewModel(playerId);

  const MetricInfo = ({ content }: { content: string }) => (
    <button
      type="button"
      className="metric-info-button"
      {...getFloatingInfoHoverHandlers(content)}
      aria-label={`Informacion: ${content}`}
    >
      <Info size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );

  const TACTICAL_HELP: Record<string, string> = {
    "Duelos iniciales":
      "Duelos iniciales: Porcentaje de duelos 1v1 ganados en los primeros instantes de la ronda. Mide ventaja en entradas y control de espacios clave.",
    Clutches:
      "Clutches: Éxito en situaciones 1vX (finales de ronda en inferioridad numérica). Indica capacidad para resolver rondas en desventaja.",
    "Trade Kills":
      "Trade Kills: Eficiencia intercambiando bajas tras muertes de compañeros. Un trade efectivo reduce la ventaja del enemigo.",
    Supervivencia:
      "Supervivencia: Cantidad de rondas en las que has terminado con vida. Refleja posicionamiento, rotaciones y toma de decisiones defensivas/seguras.",
    Multikills:
      "Multikills: Proporción de rondas con 2+ kills. Mide tu capacidad para generar impacto múltiple y cambiar el curso de una ronda.",
    Headshot:
      "Headshot: Porcentaje de disparos acertados que fueron headshots. Es un indicador directo de precisión y puntería en el enfrentamiento.",
  };

  const PERFORMANCE_HELP: Record<string, string> = {
    KD: "Kill/Death (KD): Relación entre kills y muertes. Un KD > 1 indica que eliminas más jugadores de los que mueres. Útil para medir eficiencia individual.",
    "Win Rate":
      "Win Rate: Porcentaje de partidas ganadas respecto al total. Refleja capacidad de cerrar partidas con victoria.",
    "Win Rate (Rondas)":
      "Win Rate (Rondas): Porcentaje de rondas ganadas en las partidas filtradas. Útil para evaluar control de rondas independientemente del resultado final.",
    Headshot:
      "Headshot: Porcentaje de disparos acertados que fueron headshots. Indica precisión en disparos a la cabeza.",
    ACS: "ACS (Average Combat Score): Mide el impacto medio por ronda combinando daño, kills, asistencias y objetivos. Mayor ACS suele indicar mayor influencia en las rondas.",
    "Kills / partida":
      "Kills por partida: Promedio de kills por partida. Indica cuántas bajas aportas en cada partida.",
    KDA: "KDA: (Kills + Assists) / Deaths. Mide tu contribución neta por muerte; valores más altos indican mejor aportación y supervivencia.",
  };

  const CustomPolarAngleTick = (props: {
    x?: number | string;
    y?: number | string;
    cx?: number | string;
    cy?: number | string;
    payload?: { value?: string | number };
  }) => {
    const toNumber = (value?: number | string) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const x = toNumber(props.x);
    const y = toNumber(props.y);
    const cx = toNumber(props.cx);
    const cy = toNumber(props.cy);
    const label = String(props.payload?.value ?? "");
    const help = TACTICAL_HELP[label] ?? "";
    const hoverHandlers = getFloatingInfoHoverHandlers(help);

    const fontSize = 11;
    const iconSize = 14;
    const iconGap = 4;
    const approxCharWidth = fontSize * 0.58;
    const labelWidth = Math.max(18, Math.round(label.length * approxCharWidth));
    const compoundWidth = labelWidth + iconGap + iconSize;

    const centerX = typeof cx === "number" ? cx : 0;
    const centerY = typeof cy === "number" ? cy : 0;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.hypot(dx, dy) || 1;

    // Push labels outward from the radar edge so icon+text stay outside the grid/polygon.
    const outwardOffset = 12;
    const anchorX = x + (dx / dist) * outwardOffset;
    const anchorY = y + (dy / dist) * outwardOffset;

    let blockStartX = -compoundWidth / 2;
    if (dx < -2) {
      // Left side: keep the block to the left of its anchor (icon still to the right of text).
      blockStartX = -compoundWidth;
    } else if (dx > 2) {
      // Right side: keep the block to the right of its anchor.
      blockStartX = 0;
    }

    const textCenterX = blockStartX + labelWidth / 2;
    const iconCenterX = blockStartX + labelWidth + iconGap + iconSize / 2;

    return (
      <g transform={`translate(${anchorX},${anchorY})`}>
        <text
          x={textCenterX}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#c0c0c0"
          fontSize={fontSize}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>

        <g
          transform={`translate(${iconCenterX},0)`}
          className="tactical-info-trigger"
        >
          <Info
            x={-iconSize / 2}
            y={-iconSize / 2}
            size={iconSize}
            strokeWidth={2}
            className="tactical-info-icon"
            {...hoverHandlers}
            aria-hidden="true"
          />
        </g>
      </g>
    );
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando estadisticas</h2>
          <p>Preparando el dashboard del jugador...</p>
        </div>
      </div>
    );
  }

  if (!playerId) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <span className="stats-eyebrow">Valorant</span>
          <h1 className="stats-title">Estadisticas</h1>
          <p className="stats-subtitle">
            Usa el buscador de la pagina principal para abrir el perfil de un
            jugador.
          </p>
          <div className="stats-divider" />
        </div>

        <div className="empty-panel">No hay un jugador seleccionado.</div>
      </div>
    );
  }

  if (!dashboard || !player) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <span className="stats-eyebrow">Valorant</span>
          <h1 className="stats-title">Estadisticas</h1>
          <p className="stats-subtitle">
            No se encontraron datos del jugador seleccionado.
          </p>
          <div className="stats-divider" />
        </div>

        <div className="empty-panel">
          No se pudieron cargar estadisticas para este jugador.
        </div>
      </div>
    );
  }

  const currentRank = dashboard.currentRank;
  const rankVisual = normalizeCompetitiveTierIconPath(
    displayedRankVisual ?? currentRank.image ?? currentRank.smallIcon ?? null,
  );
  const highestRankVisualAsset = normalizeCompetitiveTierIconPath(
    highestRankVisual ?? null,
  );

  const totalMatches = derivedSummary.matches;
  const totalRounds = derivedSummary.rounds;

  const headerShowcase: HeaderVisualCard[] = [
    {
      title: mostPlayedAgentInsight?.name ?? "Agente",
      subtitle: "Agente mas jugado",
      image: mostPlayedAgentInsight?.id
        ? (dashboard.agentMediaMap?.[mostPlayedAgentInsight.id]?.image ?? null)
        : null,
    },
    {
      title: bestMapWinrateInsight?.map ?? "Mapa destacado",
      subtitle: "Mapa con mejor winrate",
      image: bestMapWinrateInsight?.map
        ? resolveMapImage(bestMapWinrateInsight.map, dashboard.mapMediaMap)
        : (dashboard?.headerShowcase?.[1]?.image ?? null),
    },
    {
      title: bestWeaponInsight?.name ?? "Arma destacada",
      subtitle: "Arma con mas kills",
      image: bestWeaponInsight?.name
        ? (dashboard?.headerShowcase?.[2]?.image ??
          resolveWeaponImage(bestWeaponInsight.name))
        : null,
    },
  ].map((card) => {
    const kind = getHeaderCardKind(card.subtitle);

    if (kind === "map" && !card.image) {
      return {
        ...card,
        image: resolveMapImage(card.title, dashboard.mapMediaMap),
      };
    }

    if (kind === "weapon" && !card.image) {
      return { ...card, image: resolveWeaponImage(card.title) };
    }

    return card;
  });

  return (
    <div className="stats-container">
      <BackButton />
      <div className="stats-header">
        <span className="stats-eyebrow">Valorant</span>

        <div className="stats-header-grid">
          <div className="player-header-main">
            <div>
              <h1 className="stats-title player-title-main">
                <span className="player-name-line">
                  {player.gameName || "Jugador"}
                </span>
                {player.tagLine ? (
                  <span className="player-tag">#{player.tagLine}</span>
                ) : null}
              </h1>

              <div className="player-rank-row">
                <div className="player-rank-block">
                  {rankVisual ? (
                    <img
                      src={rankVisual}
                      alt={displayedRankName}
                      className="player-rank-image"
                    />
                  ) : (
                    <div
                      className="player-rank-image player-rank-image-fallback"
                      aria-label="Icono de rango no disponible"
                    >
                      N/A
                    </div>
                  )}

                  <div className="player-rank-text">
                    <span className="player-rank-label">
                      {filters.actId === ACT_FILTER_ALL
                        ? "Rango medio global"
                        : "Rango actual"}
                    </span>
                    <strong>{displayedRankName}</strong>
                  </div>
                </div>

                <div className="player-rank-block">
                  {highestRankVisualAsset ? (
                    <img
                      src={highestRankVisualAsset}
                      alt={highestRankName}
                      className="player-rank-image"
                    />
                  ) : (
                    <div
                      className="player-rank-image player-rank-image-fallback"
                      aria-label="Icono de rango mas alto no disponible"
                    >
                      N/A
                    </div>
                  )}

                  <div className="player-rank-text">
                    <span className="player-rank-label">Rango mas alto</span>
                    <strong>{highestRankName}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="stats-divider" />

            <div className="player-hero player-hero-spacing">
              <div className="player-identity player-identity-main">
                <div className="player-meta">
                  <span className="meta-pill">
                    Region: {player.region ?? "-"}
                  </span>
                  <span className="meta-pill">
                    Nivel: {formatNumber(latestFilteredAccountLevel)}
                  </span>
                  <span className="meta-pill">
                    Partidas: {formatNumber(totalMatches)}
                  </span>
                  <span className="meta-pill">
                    H Jugadas: {formatHours(filteredPlaytimeMillis)}
                  </span>
                </div>

                <div className="player-highlight-grid">
                  <div className="highlight-box">
                    <span>Win Rate</span>
                    <strong>{formatPercent(metrics.globalWinRate, 1)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>KD</span>
                    <strong>{formatNumber(metrics.globalKd, 2)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>ACS</span>
                    <strong>{formatNumber(metrics.globalAcs, 1)}</strong>
                  </div>
                  <div className="highlight-box">
                    <span>Headshot</span>
                    <strong>
                      {formatPercent(metrics.globalHeadshotPct, 1)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="header-showcase-grid header-showcase-grid-vertical">
            {headerShowcase.map((card) => (
              <HeaderShowcaseCard
                key={`${card.subtitle}-${card.title}`}
                title={card.title}
                subtitle={card.subtitle}
                image={card.image}
              />
            ))}
          </div>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="no-stats-screen">
          <div className="no-stats-icon">📊</div>
          <h2 className="no-stats-title">No hay estadísticas disponibles</h2>
          <p className="no-stats-subtitle">
            No se encontraron partidas para los filtros seleccionados. Prueba a
            cambiar el acto, agente o mapa.
          </p>
          {(filters.actId !== ACT_FILTER_CURRENT ||
            filters.agentId !== AGENT_FILTER_ALL ||
            filters.map !== MAP_FILTER_ALL) && (
            <button
              type="button"
              className="no-stats-reset-btn"
              onClick={() =>
                setFilters({
                  actId: ACT_FILTER_CURRENT,
                  agentId: AGENT_FILTER_ALL,
                  map: MAP_FILTER_ALL,
                  side: "all",
                  partySize: "all",
                  queueId: QUEUE_FILTER_COMPETITIVE,
                })
              }
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── ROW 1: Intro + Precision (same height) ── */}
          <section className="dashboard-row-top">
            <div className="stats-panel panel-large">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Introduccion general</h3>
                  <p className="panel-subtitle">
                    Resumen calculado a partir de las partidas filtradas.
                  </p>
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-item">
                  <span>Rondas jugadas</span>
                  <strong>{formatNumber(totalRounds)}</strong>
                </div>
                <div className="summary-item">
                  <span>Rondas por partida</span>
                  <strong>{formatNumber(metrics.avgRoundsPerMatch, 1)}</strong>
                </div>
                <div className="summary-item">
                  <span>Kills por ronda</span>
                  <strong>{formatNumber(metrics.killsPerRound, 2)}</strong>
                </div>
                <div className="summary-item">
                  <span>Kills por partida</span>
                  <strong>{formatNumber(metrics.killsPerMatch, 2)}</strong>
                </div>
                <div className="summary-item">
                  <span>Muertes por partida</span>
                  <strong>{formatNumber(metrics.avgDeathsPerMatch, 2)}</strong>
                </div>
                <div className="summary-item">
                  <span>Asistencias por partida</span>
                  <strong>{formatNumber(metrics.avgAssistsPerMatch, 2)}</strong>
                </div>
              </div>
            </div>

            <div className="stats-panel stats-panel-precision">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Precision de disparos</h3>
                  <p className="panel-subtitle">
                    Distribucion calculada sobre las partidas filtradas.
                  </p>
                </div>
              </div>

              <div className="shot-panel-layout">
                <div className="chart-box shot-chart-box">
                  {filteredShotChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Pie
                          data={filteredShotChart}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {filteredShotChart.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, _name, item) => {
                            const entry = item?.payload as
                              | { percentage?: number }
                              | undefined;

                            return [
                              `${formatNumber(Number(value))} (${formatPercent(entry?.percentage, 1)})`,
                              "Disparos",
                            ];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">Sin datos de precision.</div>
                  )}
                </div>

                <div className="shot-legend">
                  {filteredShotChart.map((item) => (
                    <div key={item.name} className="shot-legend-item">
                      <div className="shot-legend-left">
                        <span
                          className="legend-dot"
                          style={{ background: item.color }}
                        />
                        <div>
                          <strong>{item.name}</strong>
                          <small>{formatNumber(item.value)}</small>
                        </div>
                      </div>
                      <span className="shot-legend-value">
                        {formatPercent(item.percentage, 1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── INLINE MATCH HISTORY ── */}
          <section className="match-history-inline">
            <div className="match-history-inline-header">
              <div>
                <h3 className="panel-title">Historial de partidas</h3>
                <p className="panel-subtitle">
                  {sortedFilteredMatches.length} partidas registradas
                </p>
              </div>
              {sortedFilteredMatches.length > 1 && (
                <button
                  type="button"
                  className="match-history-expand-btn"
                  onClick={() => {
                    setHistoryExpanded((prev) => !prev);
                    setHistoryVisibleCount(MATCHES_PER_PAGE);
                  }}
                >
                  {historyExpanded ? "Colapsar" : "Ver todas las partidas"}
                </button>
              )}
            </div>

            {sortedFilteredMatches.length === 0 ? (
              <div className="empty-panel">
                No hay partidas disponibles para la combinacion de filtros
                seleccionada.
              </div>
            ) : historyExpanded ? (
              <>
                <div className="matches-list">
                  {visibleHistoryMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      className={`match-card match-card-button match-card--${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                      onClick={() => setSelectedMatchId(match.id)}
                    >
                      <div className="match-card-top">
                        <div className="match-card-left">
                          <div className="match-card-left-content">
                            <h3 className="match-map">{match.map}</h3>
                            <p className="match-date">{match.dateLabel}</p>
                            <div className="match-meta">
                              <span className="match-meta-agent">
                                {match.agent}
                              </span>
                              <span className="match-meta-role">
                                {match.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        {match.agentId && (
                          <div className="match-card-portrait">
                            <img
                              src={
                                dashboard.agentMediaMap?.[match.agentId]
                                  ?.image ||
                                dashboard.agentMediaMap?.[match.agentId]
                                  ?.displayIcon ||
                                ""
                              }
                              alt={match.agent}
                            />
                          </div>
                        )}
                        <div
                          className={`match-result ${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                        >
                          <span className="match-result-text">
                            {match.result}
                          </span>
                          <span className="match-result-score">
                            {match.roundScore.replace(/-/g, " - ")}
                          </span>
                        </div>
                        <div className="match-card-right">
                          <span
                            className={`match-mode-badge ${match.ranked ? "ranked" : ""}`}
                          >
                            {match.ranked ? "Competitivo" : "Normal"}
                          </span>
                        </div>
                      </div>
                      <div className="match-stats-grid">
                        <div className="match-stat">
                          <span>K / D / A</span>
                          <strong>
                            {match.kills} / {match.deaths} / {match.assists}
                          </strong>
                        </div>
                        <div className="match-stat">
                          <span>KD</span>
                          <strong>{formatNumber(match.kd, 2)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>ACS</span>
                          <strong>{formatNumber(match.acs, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>ADR</span>
                          <strong>{formatNumber(match.adr, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>HS%</span>
                          <strong>{formatPercent(match.hs, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>Rondas</span>
                          <strong>{formatNumber(match.rounds)}</strong>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {sortedFilteredMatches.length > MATCHES_PER_PAGE && (
                  <div className="history-pagination">
                    <span className="history-page-info">
                      Mostrando {visibleHistoryMatches.length} de{" "}
                      {sortedFilteredMatches.length} partidas
                    </span>
                    {canLoadMoreHistory && (
                      <button
                        type="button"
                        className="history-page-btn"
                        onClick={() =>
                          setHistoryVisibleCount((prev) =>
                            Math.min(
                              prev + HISTORY_LOAD_STEP,
                              sortedFilteredMatches.length,
                            ),
                          )
                        }
                      >
                        Cargar mas
                      </button>
                    )}
                    {canCollapseHistory && (
                      <button
                        type="button"
                        className="history-page-btn"
                        onClick={() => setHistoryVisibleCount(MATCHES_PER_PAGE)}
                      >
                        Mostrar menos
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="matches-list">
                {(() => {
                  const match = sortedFilteredMatches[0];
                  return (
                    <button
                      key={match.id}
                      type="button"
                      className={`match-card match-card-button match-card--${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                      onClick={() => setSelectedMatchId(match.id)}
                    >
                      <div className="match-card-top">
                        <div className="match-card-left">
                          <div className="match-card-left-content">
                            <h3 className="match-map">{match.map}</h3>
                            <p className="match-date">{match.dateLabel}</p>
                            <div className="match-meta">
                              <span className="match-meta-agent">
                                {match.agent}
                              </span>
                              <span className="match-meta-role">
                                {match.role}
                              </span>
                            </div>
                          </div>
                        </div>
                        {match.agentId && (
                          <div className="match-card-portrait">
                            <img
                              src={
                                dashboard.agentMediaMap?.[match.agentId]
                                  ?.image ||
                                dashboard.agentMediaMap?.[match.agentId]
                                  ?.displayIcon ||
                                ""
                              }
                              alt={match.agent}
                            />
                          </div>
                        )}
                        <div
                          className={`match-result ${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                        >
                          <span className="match-result-text">
                            {match.result}
                          </span>
                          <span className="match-result-score">
                            {match.roundScore.replace(/-/g, " - ")}
                          </span>
                        </div>
                        <div className="match-card-right">
                          <span
                            className={`match-mode-badge ${match.ranked ? "ranked" : ""}`}
                          >
                            {match.ranked ? "Competitivo" : "Normal"}
                          </span>
                        </div>
                      </div>
                      <div className="match-stats-grid">
                        <div className="match-stat">
                          <span>K / D / A</span>
                          <strong>
                            {match.kills} / {match.deaths} / {match.assists}
                          </strong>
                        </div>
                        <div className="match-stat">
                          <span>KD</span>
                          <strong>{formatNumber(match.kd, 2)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>ACS</span>
                          <strong>{formatNumber(match.acs, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>ADR</span>
                          <strong>{formatNumber(match.adr, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>HS%</span>
                          <strong>{formatPercent(match.hs, 1)}</strong>
                        </div>
                        <div className="match-stat">
                          <span>Rondas</span>
                          <strong>{formatNumber(match.rounds)}</strong>
                        </div>
                      </div>
                    </button>
                  );
                })()}
              </div>
            )}
          </section>

          {/* ── ROW 2: Performance (left) + Tactical (center) + Side Panels (right) ── */}
          <section className="dashboard-row-bottom">
            {/* ── Column 1: Perfil de rendimiento ── */}
            <div className="stats-panel stats-panel-performance">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">Perfil de rendimiento</h3>
                  <p className="panel-subtitle">
                    Métricas clave con barras de progreso.
                  </p>
                </div>
              </div>

              <div className="performance-list">
                {performanceMetrics.map((metric) => (
                  <div key={metric.label} className="performance-item">
                    <div className="performance-top">
                      <div className="performance-label">
                        <span>{metric.label}</span>
                        <MetricInfo
                          content={
                            PERFORMANCE_HELP[metric.label] ??
                            `${metric.helper}. ${metric.benchmark}`
                          }
                        />
                      </div>
                      <strong>
                        {metric.label.toLowerCase().includes("rate") ||
                        metric.label.includes("%")
                          ? formatPercent(metric.value, 1)
                          : formatNumber(
                              metric.value,
                              metric.label === "ACS" ? 1 : 2,
                            )}
                      </strong>
                    </div>
                    <div className="performance-bar">
                      <div
                        className="performance-bar-fill"
                        style={{
                          width: `${metric.percent}%`,
                          background: getPerformanceColor(metric.percent),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Column 2: Perfil táctico + Multikills ── */}
            <div className="tactical-column">
              <div className="stats-panel tactical-radar-panel">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Perfil táctico</h3>
                    <p className="panel-subtitle">
                      Valoración porcentual global.
                    </p>
                  </div>
                </div>
                <div className="tactical-radar-box">
                  <ResponsiveContainer width="100%" height={186}>
                    <RadarChart
                      data={globalRadarData}
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                    >
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={(props) => <CustomPolarAngleTick {...props} />}
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
                      <Tooltip
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
                          return [
                            p?.real ?? `${Number(_value).toFixed(1)}%`,
                            "",
                          ];
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {globalMultikillData.length > 0 && (
                <div className="stats-panel tactical-multikill-panel">
                  <div className="panel-header">
                    <div>
                      <h3 className="panel-title">Multikills</h3>
                      <p className="panel-subtitle">Rondas con 2+ kills.</p>
                    </div>
                  </div>
                  <div className="tactical-multikill-box">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={globalMultikillData}
                        margin={{ top: 8, right: 12, bottom: 4, left: -16 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.06)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fill: "#b5b5b5",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#b5b5b5", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={<MultikillTooltipContent />}
                          wrapperStyle={{
                            background: "transparent",
                            boxShadow: "none",
                          }}
                          contentStyle={{
                            background: "transparent",
                            border: "none",
                            boxShadow: "none",
                          }}
                          cursor={false}
                          isAnimationActive={false}
                          animationDuration={0}
                        />
                        <Bar
                          dataKey="value"
                          name="Rondas"
                          radius={[6, 6, 0, 0]}
                          barSize={28}
                          isAnimationActive={false}
                        >
                          {globalMultikillData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* ── Column 3: Agentes + Armas ── */}
            <div className="side-panels-stack">
              {/* ── Panel: Agentes más jugados ── */}
              <div className="side-panel-card">
                <div className="side-panel-header">
                  <h4 className="side-panel-card-title">Agentes más jugados</h4>
                  <button
                    type="button"
                    className="side-panel-view-all-btn"
                    onClick={() => setAgentsModalOpen(true)}
                  >
                    Ver Todos
                  </button>
                </div>
                <div className="side-panel-card-items">
                  {mostPlayedAgents.slice(0, 3).map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      className="side-panel-mini"
                      onClick={() => setSelectedAgentId(agent.id)}
                    >
                      {agent.displayIcon || agent.image ? (
                        <img
                          className="side-panel-mini-img side-panel-mini-img--agent"
                          src={agent.displayIcon || agent.image || ""}
                          alt={agent.name}
                        />
                      ) : (
                        <div className="side-panel-mini-img side-panel-mini-img--agent side-panel-mini-placeholder">
                          {agent.name.charAt(0)}
                        </div>
                      )}
                      <span className="side-panel-mini-name">{agent.name}</span>
                      <span className="side-panel-mini-stat">
                        {agent.matches} partidas
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Panel: Armas más jugadas ── */}
              <div className="side-panel-card">
                <div className="side-panel-header">
                  <h4 className="side-panel-card-title">Armas más jugadas</h4>
                  <button
                    type="button"
                    className="side-panel-view-all-btn"
                    onClick={() => setWeaponsModalOpen(true)}
                  >
                    Ver Todos
                  </button>
                </div>
                <div className="side-panel-card-items">
                  {mostPlayedWeapons.slice(0, 3).map((weapon) => (
                    <button
                      key={weapon.id}
                      type="button"
                      className="side-panel-mini"
                      onClick={() => {
                        setWeaponsModalOpen(true);
                      }}
                    >
                      {weapon.image ? (
                        <img
                          className="side-panel-mini-img side-panel-mini-img--weapon"
                          src={weapon.image}
                          alt={weapon.name}
                        />
                      ) : (
                        <div className="side-panel-mini-img side-panel-mini-img--weapon side-panel-mini-placeholder">
                          {weapon.name.charAt(0)}
                        </div>
                      )}
                      <span className="side-panel-mini-name">
                        {weapon.name}
                      </span>
                      <span className="side-panel-mini-stat">
                        {weapon.kills} kills
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── HEATMAP CARD ── */}
          <section className="heatmap-entry-section">
            <button
              className="heatmap-entry-card"
              onClick={() => setHeatmapOpen(true)}
            >
              <div className="heatmap-entry-copy">
                <h3 className="heatmap-entry-title">Rendimiento en mapas</h3>
                <p className="heatmap-entry-desc">
                  Mapas de calor interactivos: visualiza dónde ocurren kills,
                  muertes, first bloods, plants y defuses. Filtra por agente,
                  lado y fase de ronda.
                </p>
              </div>
            </button>
          </section>
        </>
      )}

      <div className="floating-filters">
        {filtersOpen && (
          <div className="floating-filters-panel">
            <div className="floating-filters-header">
              <strong>Filtros</strong>
              <button
                type="button"
                className="floating-filters-close"
                onClick={() => setFiltersOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* ── General ── */}
            <span className="filter-section-title">General</span>
            <div className="history-filter-group">
              <div className="history-filter">
                <label htmlFor="act-filter">Acto</label>
                <select
                  id="act-filter"
                  value={filters.actId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, actId: e.target.value }))
                  }
                  className="history-select"
                >
                  {actFilterOptions.map((actOption) => (
                    <option key={actOption.id} value={actOption.id}>
                      {actOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-filter">
                <label htmlFor="agent-filter">Agente</label>
                <select
                  id="agent-filter"
                  value={filters.agentId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, agentId: e.target.value }))
                  }
                  className="history-select"
                >
                  {agentOptions.map((agentOption) => (
                    <option key={agentOption.id} value={agentOption.id}>
                      {agentOption.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-filter">
                <label htmlFor="map-filter">Mapa</label>
                <select
                  id="map-filter"
                  value={filters.map}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, map: e.target.value }))
                  }
                  className="history-select"
                >
                  {mapOptions.map((mapOption) => (
                    <option key={mapOption.id} value={mapOption.id}>
                      {mapOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Partida ── */}
            <span className="filter-section-title">Partida</span>
            <div className="history-filter-group">
              <div className="history-filter">
                <label htmlFor="queue-filter">Tipo de partida</label>
                <select
                  id="queue-filter"
                  value={filters.queueId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, queueId: e.target.value }))
                  }
                  className="history-select"
                >
                  {queueOptions.map((qo) => (
                    <option key={qo.id} value={qo.id}>
                      {qo.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="history-filter">
                <label htmlFor="party-filter">Compañeros</label>
                <select
                  id="party-filter"
                  value={filters.partySize}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      partySize: e.target.value as PartySizeFilter,
                    }))
                  }
                  className="history-select"
                >
                  {partySizeOptions.map((po) => (
                    <option key={po.value} value={po.value}>
                      {po.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Lado ── */}
            <span className="filter-section-title">Lado</span>
            <div className="side-toggle">
              {(["all", "attack", "defense"] as SideFilter[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`side-toggle-btn${filters.side === s ? " active" : ""}`}
                  onClick={() => setFilters((prev) => ({ ...prev, side: s }))}
                >
                  {s === "all"
                    ? "Ambos"
                    : s === "attack"
                      ? "Ataque"
                      : "Defensa"}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="floating-filters-button"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          Filtros
          {(() => {
            let count = 0;
            if (filters.actId !== ACT_FILTER_CURRENT) count++;
            if (filters.agentId !== AGENT_FILTER_ALL) count++;
            if (filters.map !== MAP_FILTER_ALL) count++;
            if (filters.queueId !== QUEUE_FILTER_COMPETITIVE) count++;
            if (filters.partySize !== "all") count++;
            if (filters.side !== "all") count++;
            return count > 0 ? (
              <span className="filter-badge">{count}</span>
            ) : null;
          })()}
        </button>
      </div>

      {/* ── MATCH HISTORY MODAL ── */}
      {historyModalOpen && (
        <div
          className="list-modal-overlay"
          onClick={() => setHistoryModalOpen(false)}
        >
          <div
            className="list-modal-content list-modal-history"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="list-modal-header">
              <h3>Historial de partidas</h3>
              <button
                type="button"
                className="list-modal-close"
                onClick={() => setHistoryModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="list-modal-body">
              {filteredMatches.length === 0 ? (
                <div className="empty-panel">
                  No hay partidas disponibles para la combinacion de filtros
                  seleccionada.
                </div>
              ) : (
                <>
                  <div className="matches-list">
                    {visibleHistoryMatches.map((match) => (
                      <button
                        key={match.id}
                        type="button"
                        className={`match-card match-card-button match-card--${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                        onClick={() => {
                          setHistoryModalOpen(false);
                          setSelectedMatchId(match.id);
                        }}
                      >
                        <div className="match-card-top">
                          <div className="match-card-left">
                            <div className="match-card-left-content">
                              <h3 className="match-map">{match.map}</h3>
                              <p className="match-date">{match.dateLabel}</p>
                              <div className="match-meta">
                                <span className="match-meta-agent">
                                  {match.agent}
                                </span>
                                <span className="match-meta-role">
                                  {match.role}
                                </span>
                              </div>
                            </div>
                          </div>
                          {match.agentId && (
                            <div className="match-card-portrait">
                              <img
                                src={
                                  dashboard.agentMediaMap?.[match.agentId]
                                    ?.image ||
                                  dashboard.agentMediaMap?.[match.agentId]
                                    ?.displayIcon ||
                                  ""
                                }
                                alt={match.agent}
                              />
                            </div>
                          )}
                          <div
                            className={`match-result ${match.result === "Victoria" ? "win" : match.result === "Empate" ? "draw" : "loss"}`}
                          >
                            <span className="match-result-text">
                              {match.result}
                            </span>
                            <span className="match-result-score">
                              {match.roundScore.replace(/-/g, " - ")}
                            </span>
                          </div>
                          <div className="match-card-right">
                            <span
                              className={`match-mode-badge ${match.ranked ? "ranked" : ""}`}
                            >
                              {match.ranked ? "Competitivo" : "Normal"}
                            </span>
                          </div>
                        </div>
                        <div className="match-stats-grid">
                          <div className="match-stat">
                            <span>K / D / A</span>
                            <strong>
                              {match.kills} / {match.deaths} / {match.assists}
                            </strong>
                          </div>
                          <div className="match-stat">
                            <span>KD</span>
                            <strong>{formatNumber(match.kd, 2)}</strong>
                          </div>
                          <div className="match-stat">
                            <span>ACS</span>
                            <strong>{formatNumber(match.acs, 1)}</strong>
                          </div>
                          <div className="match-stat">
                            <span>ADR</span>
                            <strong>{formatNumber(match.adr, 1)}</strong>
                          </div>
                          <div className="match-stat">
                            <span>HS%</span>
                            <strong>{formatPercent(match.hs, 1)}</strong>
                          </div>
                          <div className="match-stat">
                            <span>Rondas</span>
                            <strong>{formatNumber(match.rounds)}</strong>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {sortedFilteredMatches.length > MATCHES_PER_PAGE && (
                    <div className="history-pagination">
                      <span className="history-page-info">
                        Mostrando {visibleHistoryMatches.length} de{" "}
                        {sortedFilteredMatches.length} partidas
                      </span>
                      {canLoadMoreHistory && (
                        <button
                          type="button"
                          className="history-page-btn"
                          onClick={() =>
                            setHistoryVisibleCount((prev) =>
                              Math.min(
                                prev + HISTORY_LOAD_STEP,
                                sortedFilteredMatches.length,
                              ),
                            )
                          }
                        >
                          Cargar mas
                        </button>
                      )}
                      {canCollapseHistory && (
                        <button
                          type="button"
                          className="history-page-btn"
                          onClick={() =>
                            setHistoryVisibleCount(MATCHES_PER_PAGE)
                          }
                        >
                          Mostrar menos
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AGENTS LIST MODAL ── */}
      {agentsModalOpen && (
        <div
          className="list-modal-overlay"
          onClick={() => setAgentsModalOpen(false)}
        >
          <div
            className="list-modal-content list-modal-agents"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="list-modal-header">
              <h3>Agentes jugados</h3>
              <button
                type="button"
                className="list-modal-close"
                onClick={() => setAgentsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="list-modal-body">
              {mostPlayedAgents.length === 0 ? (
                <div className="empty-panel">Sin datos de agentes.</div>
              ) : (
                <div className="list-modal-items">
                  {mostPlayedAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      className="list-modal-item"
                      onClick={() => {
                        setAgentsModalOpen(false);
                        setSelectedAgentId(agent.id);
                      }}
                    >
                      {agent.displayIcon || agent.image ? (
                        <img
                          src={agent.displayIcon || agent.image || ""}
                          alt={agent.name}
                          className="list-modal-item-img"
                        />
                      ) : (
                        <div className="list-modal-item-img list-modal-item-placeholder">
                          {agent.name.charAt(0)}
                        </div>
                      )}
                      <div className="list-modal-item-info">
                        <strong>{agent.name}</strong>
                        <small>{agent.matches} partidas</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WEAPONS LIST MODAL ── */}
      {weaponsModalOpen && (
        <div
          className="list-modal-overlay"
          onClick={() => setWeaponsModalOpen(false)}
        >
          <div
            className="list-modal-content list-modal-weapons"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="list-modal-header">
              <h3>Armas utilizadas</h3>
              <button
                type="button"
                className="list-modal-close"
                onClick={() => setWeaponsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="list-modal-body">
              {mostPlayedWeapons.length === 0 ? (
                <div className="empty-panel">Sin datos de armas.</div>
              ) : (
                <div className="list-modal-items">
                  {mostPlayedWeapons.map((weapon) => (
                    <button
                      key={weapon.id}
                      type="button"
                      className="list-modal-item"
                      onClick={() => setWeaponsModalOpen(false)}
                    >
                      {weapon.image ? (
                        <img
                          src={weapon.image}
                          alt={weapon.name}
                          className="list-modal-item-img list-modal-item-weapon-img"
                        />
                      ) : (
                        <div className="list-modal-item-img list-modal-item-placeholder">
                          {weapon.name.charAt(0)}
                        </div>
                      )}
                      <div className="list-modal-item-info">
                        <strong>{weapon.name}</strong>
                        <small>
                          {weapon.kills} kills · {weapon.matches} partidas
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedMatchId && (
        <MatchDetailModal
          matchId={selectedMatchId}
          playerId={playerId ?? ""}
          agentNameMap={dashboard.agentNameMap}
          onClose={() => setSelectedMatchId(null)}
        />
      )}

      {selectedAgentId && (
        <AgentDetailModal
          agentId={selectedAgentId}
          analyticsList={filteredAnalyticsList}
          agentNameMap={dashboard.agentNameMap}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {heatmapOpen && dashboard && (
        <HeatmapModal
          playerId={playerId ?? ""}
          agentNameMap={dashboard.agentNameMap}
          actOptions={dashboard.actOptions ?? []}
          initialFilters={{
            mapName: filters.map !== MAP_FILTER_ALL ? filters.map : undefined,
            agentId:
              filters.agentId !== AGENT_FILTER_ALL
                ? filters.agentId
                : undefined,
            seasonIds: effectiveActId ? [effectiveActId] : undefined,
            side:
              filters.side === "attack" || filters.side === "defense"
                ? filters.side
                : "",
          }}
          onClose={() => setHeatmapOpen(false)}
        />
      )}
      {floatingTooltip && floatingTooltip.visible && (
        <div
          className="floating-info-tooltip"
          style={{ left: floatingTooltip.x, top: floatingTooltip.y }}
        >
          {floatingTooltip.content}
        </div>
      )}
    </div>
  );
}
