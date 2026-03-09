import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getPlayerDashboard } from "../api/stats";
import MatchDetailModal from "./MatchDetailModal";
import AgentDetailModal from "./AgentDetailModal";
import "./Estadisticas.css";

type PlayerStats = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  region?: string;
  accountLevel?: number;
  totalMatches?: number;
  totalWins?: number;
  totalKills?: number;
  totalDeaths?: number;
  totalAssists?: number;
  totalScore?: number;
  totalPlaytimeMillis?: number;
  totalRoundsPlayed?: number;
  totalHeadshots?: number;
  totalBodyshots?: number;
  totalLegshots?: number;
  mostPlayedAgents?: Array<{
    agentId: string;
    matches: number;
  }>;
};

type AnalyticsMatch = {
  id: string;
  match_id?: string;
  won_match?: boolean;
  map_name?: string;
  game_start_millis?: number;
  agent_id?: string;
  agent_name?: string;
  role?: string;
  overview?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    acs?: number;
    adr?: number;
    headshot_pct?: number;
    rounds?: number;
    wins?: number;
  };
  player_totals_from_match?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    score?: number;
    rounds_played?: number;
  };
};

type MatchCard = {
  id: string;
  seasonId: string;
  dateLabel: string;
  timestamp: number;
  map: string;
  agent: string;
  agentId?: string;
  role: string;
  queue: string;
  mode: string;
  result: "Victoria" | "Derrota";
  ranked: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  score: number;
  acs: number;
  adr: number;
  hs: number;
  kd: number;
};

type ActSummary = {
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kda: number;
  acs: number;
  killsPerMatch: number;
  hsAvg: number;
};

type RankInfo = {
  tier?: number;
  name: string;
  image?: string;
};

type HeaderVisualCard = {
  title: string;
  subtitle: string;
  image?: string | null;
};

type DashboardMetric = {
  label: string;
  value: number;
  percent: number;
  helper: string;
};

type DashboardPayload = {
  player: PlayerStats;
  agentNameMap: Record<string, string>;
  agentMediaMap: Record<string, { name?: string; image?: string | null }>;
  analyticsList: AnalyticsMatch[];
  currentRank: RankInfo;
  headerShowcase: HeaderVisualCard[];
  mostPlayedAgents: Array<{
    id: string;
    name: string;
    matches: number;
    image?: string | null;
  }>;
  metrics: {
    globalWinRate: number;
    globalKd: number;
    globalAcs: number;
    globalHeadshotPct: number;
    kdaOverall: number;
    avgDeathsPerMatch: number;
    avgAssistsPerMatch: number;
    avgRoundsPerMatch: number;
    killsPerRound: number;
    killsPerMatch: number;
  };
  shotChart: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  performanceMetrics: DashboardMetric[];
  insights: {
    primary?: string;
    mostPlayedAgent?: {
      id: string;
      name: string;
      matches: number;
    } | null;
    bestMap?: {
      map: string;
      matches: number;
      winRate: number;
    } | null;
    bestWeapon?: {
      name: string;
      matches: number;
      winRate: number;
    } | null;
  };
  actOptions: Array<{ id: string; label: string }>;
  actSections: Record<
    string,
    {
      summary: ActSummary;
      matches: MatchCard[];
    }
  >;
};

function formatNumber(value?: number, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value?: number, decimals = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, decimals)}%`;
}

function formatHours(ms?: number) {
  if (!ms) return "-";
  return `${formatNumber(ms / 1000 / 60 / 60, 1)} h`;
}

function buildSvgPlaceholder(title: string, subtitle: string, accent = "#ff4655") {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const safeSubtitle = subtitle.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#21252d"/>
          <stop offset="100%" stop-color="#11141a"/>
        </linearGradient>
        <radialGradient id="g2" cx="80%" cy="20%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#g1)"/>
      <rect width="640" height="360" rx="24" fill="url(#g2)"/>
      <rect x="20" y="20" width="600" height="320" rx="18" fill="none" stroke="rgba(255,255,255,0.10)"/>
      <text x="40" y="70" fill="#8d94a1" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">${safeSubtitle}</text>
      <text x="40" y="130" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900">${safeTitle}</text>
      <circle cx="535" cy="105" r="54" fill="${accent}" opacity="0.18"/>
      <circle cx="535" cy="105" r="34" fill="${accent}" opacity="0.38"/>
      <rect x="40" y="250" width="180" height="12" rx="6" fill="rgba(255,255,255,0.10)"/>
      <rect x="40" y="276" width="260" height="12" rx="6" fill="rgba(255,255,255,0.06)"/>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function resolveMapImage(mapName?: string) {
  return buildSvgPlaceholder(mapName || "Mapa desconocido", "Mapa destacado", "#ff7a85");
}

function resolveWeaponImage(weaponName?: string) {
  return buildSvgPlaceholder(
    weaponName || "Arma desconocida",
    "Arma destacada",
    "#ff4655"
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

function HeaderShowcaseCard(props: HeaderVisualCard) {
  const { title, subtitle, image } = props;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 140,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(34,38,46,0.98) 0%, rgba(18,21,27,0.98) 100%)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
      }}
    >
      <img
        src={image || buildSvgPlaceholder(title, subtitle)}
        alt={title}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(12,14,18,0.22) 0%, rgba(12,14,18,0.82) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: "100%",
          padding: "1rem",
        }}
      >
        <span
          style={{
            color: "#ff9aa3",
            fontSize: "0.72rem",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: "1.2px",
            marginBottom: "0.45rem",
          }}
        >
          {subtitle}
        </span>
        <strong
          style={{
            fontSize: "1.05rem",
            fontWeight: 900,
            lineHeight: 1.2,
          }}
        >
          {title}
        </strong>
      </div>
    </div>
  );
}

const EMPTY_SUMMARY: ActSummary = {
  matches: 0,
  wins: 0,
  winRate: 0,
  kd: 0,
  kda: 0,
  acs: 0,
  killsPerMatch: 0,
  hsAvg: 0,
};

export default function Estadisticas() {
  const MATCHES_PER_PAGE = 8;
  const DASHBOARD_MATCH_LIMIT = 300;
  const { playerId } = useParams();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [selectedAct, setSelectedAct] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      setDashboard(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await getPlayerDashboard(playerId, DASHBOARD_MATCH_LIMIT);
        if (cancelled) return;
        setDashboard((result as DashboardPayload) ?? null);
      } catch {
        if (!cancelled) setDashboard(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const player = dashboard?.player;
  const actOptions = dashboard?.actOptions ?? [];

  useEffect(() => {
    const actIds = actOptions.map((option) => option.id);

    if (actIds.length === 0) {
      if (selectedAct) setSelectedAct("");
      return;
    }

    if (!selectedAct || !actIds.includes(selectedAct)) {
      setSelectedAct(actIds[0]);
    }
  }, [actOptions, selectedAct]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAct]);

  const selectedSection = useMemo(() => {
    if (!dashboard) return null;

    if (selectedAct && dashboard.actSections[selectedAct]) {
      return dashboard.actSections[selectedAct];
    }

    if (actOptions[0]?.id && dashboard.actSections[actOptions[0].id]) {
      return dashboard.actSections[actOptions[0].id];
    }

    return null;
  }, [dashboard, selectedAct, actOptions]);

  const matchesOfSelectedAct = selectedSection?.matches ?? [];
  const actSummary = selectedSection?.summary ?? EMPTY_SUMMARY;

  const totalActPages = useMemo(
    () => Math.max(1, Math.ceil(matchesOfSelectedAct.length / MATCHES_PER_PAGE)),
    [matchesOfSelectedAct.length]
  );

  const pagedMatchesOfSelectedAct = useMemo(() => {
    const start = (currentPage - 1) * MATCHES_PER_PAGE;
    return matchesOfSelectedAct.slice(start, start + MATCHES_PER_PAGE);
  }, [matchesOfSelectedAct, currentPage]);

  useEffect(() => {
    if (currentPage > totalActPages) {
      setCurrentPage(totalActPages);
    }
  }, [currentPage, totalActPages]);

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
            Usa el buscador de la pagina principal para abrir el perfil de un jugador.
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

  const metrics = dashboard.metrics;
  const currentRank = dashboard.currentRank;
  const mostPlayedAgents = dashboard.mostPlayedAgents ?? [];
  const primaryInsight = dashboard.insights.primary ?? "Progresion constante";
  const mostPlayedAgentInsight = dashboard.insights.mostPlayedAgent ?? null;
  const bestMapWinrateInsight = dashboard.insights.bestMap ?? null;
  const bestWeaponWrInsight = dashboard.insights.bestWeapon ?? null;

  const totalMatches = player.totalMatches ?? 0;
  const totalWins = player.totalWins ?? 0;
  const totalKills = player.totalKills ?? 0;
  const totalDeaths = player.totalDeaths ?? 0;
  const totalRounds = player.totalRoundsPlayed ?? 0;
  const totalHeadshots = player.totalHeadshots ?? 0;

  const headerShowcase = dashboard.headerShowcase.map((card) => {
    if (card.subtitle === "Mapa referencia" && !card.image) {
      return { ...card, image: resolveMapImage(card.title) };
    }
    if (card.subtitle === "Arma con mejor WR" && !card.image) {
      return { ...card, image: resolveWeaponImage(card.title) };
    }
    return card;
  });

  return (
    <div className="stats-container">
      <div className="stats-header">
        <span className="stats-eyebrow">Valorant</span>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            gap: "1.2rem",
            alignItems: "stretch",
          }}
        >
          <div className="player-header-main">
            <div>
              <h1 className="stats-title player-title-main">
                {player.gameName || "Jugador"}
                {player.tagLine ? (
                  <span className="player-tag">#{player.tagLine}</span>
                ) : null}
              </h1>

              <div className="player-rank-block">
                {currentRank.image ? (
                  <img
                    src={currentRank.image}
                    alt={currentRank.name}
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
                  <span className="player-rank-label">Rango actual</span>
                  <strong>{currentRank.name}</strong>
                </div>
              </div>
            </div>

            <div className="stats-divider" />

            <div className="player-hero" style={{ marginTop: "1.2rem" }}>
              <div className="player-identity" style={{ flex: 1, minWidth: 260 }}>
                <div className="player-meta">
                  <span className="meta-pill">Region: {player.region ?? "-"}</span>
                  <span className="meta-pill">
                    Nivel: {formatNumber(player.accountLevel)}
                  </span>
                  <span className="meta-pill">
                    Partidas: {formatNumber(player.totalMatches)}
                  </span>
                  <span className="meta-pill">
                    Horas jugadas: {formatHours(player.totalPlaytimeMillis)}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.8rem",
                  }}
                >
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
                    <span>Headshot %</span>
                    <strong>{formatPercent(metrics.globalHeadshotPct, 1)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "0.8rem",
              minWidth: 0,
            }}
          >
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

      <section className="hero-metrics">
        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">Win Rate</span>
          <strong className="hero-metric-value">
            {formatPercent(metrics.globalWinRate, 1)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalWins)} victorias de {formatNumber(totalMatches)} partidas
          </small>
        </div>

        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">KD Global</span>
          <strong className="hero-metric-value">
            {formatNumber(metrics.globalKd, 2)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalKills)} K / {formatNumber(totalDeaths)} D
          </small>
        </div>

        <div className="hero-metric hero-metric-primary">
          <span className="hero-metric-label">ACS</span>
          <strong className="hero-metric-value">
            {formatNumber(metrics.globalAcs, 1)}
          </strong>
          <small className="hero-metric-hint">impacto medio por ronda</small>
        </div>

        <div className="hero-metric hero-metric-secondary">
          <span className="hero-metric-label">Headshot %</span>
          <strong className="hero-metric-value">
            {formatPercent(metrics.globalHeadshotPct, 1)}
          </strong>
          <small className="hero-metric-hint">
            {formatNumber(totalHeadshots)} headshots totales
          </small>
        </div>
      </section>

      <section className="stats-kpis stats-kpis-secondary">
        <KpiCard
          label="Kills / partida"
          value={formatNumber(metrics.killsPerMatch, 2)}
          hint={`${formatNumber(totalKills)} kills totales`}
        />
        <KpiCard
          label="Deaths / partida"
          value={formatNumber(metrics.avgDeathsPerMatch, 2)}
          hint={`${formatNumber(player.totalDeaths)} muertes totales`}
        />
        <KpiCard
          label="Assists / partida"
          value={formatNumber(metrics.avgAssistsPerMatch, 2)}
          hint={`${formatNumber(player.totalAssists)} asistencias totales`}
        />
        <KpiCard
          label="KDA global"
          value={formatNumber(metrics.kdaOverall, 2)}
          hint="(kills + assists) / deaths"
        />
        <KpiCard
          label="Rondas / partida"
          value={formatNumber(metrics.avgRoundsPerMatch, 1)}
          hint={`${formatNumber(totalRounds)} rondas jugadas`}
        />
        <KpiCard
          label="Kills / ronda"
          value={formatNumber(metrics.killsPerRound, 2)}
          hint="ritmo ofensivo"
        />
      </section>

      <section className="insight-strip">
        <div className="insight-card">
          <span className="insight-label">Fortaleza principal</span>
          <strong className="insight-value">{primaryInsight}</strong>
          <small className="insight-hint">
            HS {formatPercent(metrics.globalHeadshotPct, 1)} · ACS {formatNumber(metrics.globalAcs, 1)}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Ritmo de juego</span>
          <strong className="insight-value">
            {formatNumber(metrics.killsPerMatch, 2)} kills/partida
          </strong>
          <small className="insight-hint">
            {formatNumber(metrics.killsPerRound, 2)} kills por ronda
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Consistencia</span>
          <strong className="insight-value">
            {formatNumber(metrics.avgRoundsPerMatch, 1)} rondas/partida
          </strong>
          <small className="insight-hint">KDA {formatNumber(metrics.kdaOverall, 2)}</small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Agente mas jugado</span>
          <strong className="insight-value">
            {mostPlayedAgentInsight?.name ?? "Sin datos"}
          </strong>
          <small className="insight-hint">
            {mostPlayedAgentInsight
              ? `${formatNumber(mostPlayedAgentInsight.matches)} partidas`
              : "No hay partidas suficientes"}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Mapa con mas win rate</span>
          <strong className="insight-value">
            {bestMapWinrateInsight?.map ?? "Sin datos de mapas"}
          </strong>
          <small className="insight-hint">
            {bestMapWinrateInsight
              ? `${formatPercent(bestMapWinrateInsight.winRate, 1)} · ${formatNumber(bestMapWinrateInsight.matches)} partidas`
              : "No hay suficientes datos"}
          </small>
        </div>

        <div className="insight-card">
          <span className="insight-label">Arma con mas win rate</span>
          <strong className="insight-value">
            {bestWeaponWrInsight?.name ?? "Sin datos de armas"}
          </strong>
          <small className="insight-hint">
            {bestWeaponWrInsight
              ? `${formatPercent(bestWeaponWrInsight.winRate, 1)} · ${formatNumber(bestWeaponWrInsight.matches)} partidas`
              : "No hay weapon_stats disponibles"}
          </small>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stats-panel panel-large">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Introduccion general</h3>
              <p className="panel-subtitle">
                Resumen consistente usando datos globales acumulados del jugador.
              </p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span>Rondas jugadas</span>
              <strong>{formatNumber(player.totalRoundsPlayed)}</strong>
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
              <span>Headshots totales</span>
              <strong>{formatNumber(player.totalHeadshots)}</strong>
            </div>
            <div className="summary-item">
              <span>Bodyshots totales</span>
              <strong>{formatNumber(player.totalBodyshots)}</strong>
            </div>
            <div className="summary-item">
              <span>Legshots totales</span>
              <strong>{formatNumber(player.totalLegshots)}</strong>
            </div>
          </div>
        </div>

        <div className="stats-panel stats-panel-precision">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Precision de disparos</h3>
              <p className="panel-subtitle">
                Distribucion global de impactos con cantidades y porcentajes.
              </p>
            </div>
          </div>

          <div className="shot-panel-layout">
            <div className="chart-box shot-chart-box">
              {dashboard.shotChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                    <Pie
                      data={dashboard.shotChart}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={84}
                      paddingAngle={3}
                    >
                      {dashboard.shotChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                    formatter={(value, _name, item) => {
                        const entry = item?.payload as { percentage?: number } | undefined;

                        return [
                        `${formatNumber(Number(value))} impactos (${formatPercent(entry?.percentage, 1)})`,
                        "Impactos",
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
              {dashboard.shotChart.map((item) => (
                <div key={item.name} className="shot-legend-item">
                  <div className="shot-legend-left">
                    <span className="legend-dot" style={{ background: item.color }} />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatNumber(item.value)} impactos</small>
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

        <div className="stats-panel stats-panel-performance">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Perfil de rendimiento</h3>
              <p className="panel-subtitle">
                Metricas explicadas con barras, mas legibles que el radar.
              </p>
            </div>
          </div>

          <div className="performance-list">
            {dashboard.performanceMetrics.map((metric) => (
              <div key={metric.label} className="performance-item">
                <div className="performance-top">
                  <span>{metric.label}</span>
                  <strong>
                    {metric.label.toLowerCase().includes("rate") || metric.label.includes("%")
                      ? formatPercent(metric.value, 1)
                      : formatNumber(metric.value, metric.label === "ACS" ? 1 : 2)}
                  </strong>
                </div>
                <div className="performance-bar">
                  <div
                    className="performance-bar-fill"
                    style={{ width: `${metric.percent}%` }}
                  />
                </div>
                <small>{metric.helper}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-panel panel-large stats-panel-agents">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Agentes mas jugados</h3>
              <p className="panel-subtitle">
                Pulsa sobre un agente para abrir su ficha.
              </p>
            </div>
          </div>

          <div className="agent-played-list">
            {mostPlayedAgents.length > 0 ? (
              <>
                {mostPlayedAgents[0] && (
                  <button
                    type="button"
                    className="agent-featured-card"
                    onClick={() => setSelectedAgentId(mostPlayedAgents[0].id)}
                  >
                    <div className="agent-featured-content">
                      <div className="agent-featured-copy">
                        <span className="agent-featured-label">Agente mas jugado</span>
                        <h4>{mostPlayedAgents[0].name}</h4>
                        <strong>{mostPlayedAgents[0].matches} partidas</strong>
                      </div>

                      {mostPlayedAgents[0].image ? (
                        <img
                          src={mostPlayedAgents[0].image || undefined}
                          alt={mostPlayedAgents[0].name}
                          className="agent-featured-image"
                        />
                      ) : null}
                    </div>
                  </button>
                )}

                {mostPlayedAgents.slice(1).map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className="agent-played-item agent-played-button"
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="agent-played-row">
                      {agent.image ? (
                        <img
                          src={agent.image || undefined}
                          alt={agent.name}
                          className="agent-played-thumb"
                        />
                      ) : null}

                      <div>
                        <span className="agent-played-name">{agent.name}</span>
                        <small>{agent.matches} partidas</small>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="empty-chart">Sin datos de agentes mas jugados.</div>
            )}
          </div>
        </div>
      </section>

      <section className="stats-section-history">
        <div className="stats-section-header history-header">
          <div>
            <span className="stats-eyebrow">Historial</span>
            <h2 className="stats-title history-title">Partidas por acto</h2>
            <p className="stats-subtitle history-subtitle">
              Filtra por acto y consulta todas las partidas disponibles para ese tramo.
            </p>
          </div>

          <div className="history-filter">
            <label htmlFor="act-filter">Acto</label>
            <select
              id="act-filter"
              value={selectedAct}
              onChange={(e) => setSelectedAct(e.target.value)}
              className="history-select"
            >
              {actOptions.length === 0 && <option value="">Sin actos</option>}
              {actOptions.map((actOption) => (
                <option key={actOption.id} value={actOption.id}>
                  {actOption.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stats-kpis act-kpis">
          <KpiCard label="Partidas del acto" value={formatNumber(actSummary.matches)} />
          <KpiCard
            label="Victorias"
            value={formatNumber(actSummary.wins)}
            hint={formatPercent(actSummary.winRate, 1)}
          />
          <KpiCard label="KD del acto" value={formatNumber(actSummary.kd, 2)} />
          <KpiCard label="KDA del acto" value={formatNumber(actSummary.kda, 2)} />
          <KpiCard label="ACS medio" value={formatNumber(actSummary.acs, 1)} />
          <KpiCard
            label="Kills / partida"
            value={formatNumber(actSummary.killsPerMatch, 2)}
          />
        </div>

        <div className="matches-list">
          {matchesOfSelectedAct.length === 0 ? (
            <div className="empty-panel">
              No hay partidas disponibles para el acto seleccionado.
            </div>
          ) : (
            pagedMatchesOfSelectedAct.map((match) => (
              <button
                key={match.id}
                type="button"
                className="match-card match-card-button"
                onClick={() => setSelectedMatchId(match.id)}
              >
                <div className="match-card-top">
                  <div>
                    <div className="match-card-mapline">
                      <h3 className="match-map">{match.map}</h3>
                      <span className={`match-mode-badge ${match.ranked ? "ranked" : ""}`}>
                        {match.ranked ? "Ranked" : "Normal"}
                      </span>
                    </div>
                    <p className="match-date">{match.dateLabel}</p>
                  </div>

                  <div
                    className={`match-result ${match.result === "Victoria" ? "win" : "loss"}`}
                  >
                    {match.result}
                  </div>
                </div>

                <div className="match-meta">
                  <span className="match-meta-accent">{match.agent}</span>
                  <span>{match.role}</span>
                  <span>{match.mode}</span>
                  <span>{match.queue}</span>
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
            ))
          )}
        </div>

        {matchesOfSelectedAct.length > 0 && (
          <div className="history-pagination">
            <button
              type="button"
              className="history-page-btn"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>

            <span className="history-page-info">
              Pagina {currentPage} de {totalActPages} · {matchesOfSelectedAct.length} partidas
            </span>

            <button
              type="button"
              className="history-page-btn"
              onClick={() => setCurrentPage((page) => Math.min(totalActPages, page + 1))}
              disabled={currentPage === totalActPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

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
          player={player}
          analyticsList={dashboard.analyticsList}
          agentNameMap={dashboard.agentNameMap}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  );
}