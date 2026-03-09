import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { getAgentes } from "../api/content";
import "./DetailModals.css";

type AgentContent = {
  uuid?: string;
  id?: string;
  displayName?: string;
  name?: string;
  displayIcon?: string;
  displayIconSmall?: string;
  description?: string;
  role?: {
    displayName?: string;
    description?: string;
    displayIcon?: string;
  };
  abilities?: Array<{
    slot?: string;
    displayName?: string;
    description?: string;
    displayIcon?: string | null;
  }>;
};

type PlayerStats = {
  mostPlayedAgents?: Array<{
    agentId: string;
    matches: number;
  }>;
};

type AnalyticsMatch = {
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

type Props = {
  agentId: string;
  player: PlayerStats;
  analyticsList: AnalyticsMatch[];
  agentNameMap: Record<string, string>;
  onClose: () => void;
};

function safeDivide(a: number, b: number) {
  return b > 0 ? a / b : 0;
}

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

function formatDate(ms?: number) {
  if (!ms) return "Fecha desconocida";
  return new Date(ms).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeAgentsResponse(raw: unknown): AgentContent[] {
  if (Array.isArray(raw)) return raw as AgentContent[];

  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data?: unknown[] }).data)
  ) {
    return (raw as { data: AgentContent[] }).data;
  }

  return [];
}

export default function AgentDetailModal({
  agentId,
  player,
  analyticsList,
  agentNameMap,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [agentContent, setAgentContent] = useState<AgentContent | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rawAgents = await getAgentes();
        if (cancelled) return;

        const agents = normalizeAgentsResponse(rawAgents);
        const found =
          agents.find((a) => a.uuid === agentId || a.id === agentId) ?? null;

        setAgentContent(found);
      } catch {
        if (!cancelled) setAgentContent(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const agentMatches = useMemo(
    () => analyticsList.filter((m) => m.agent_id === agentId),
    [analyticsList, agentId]
  );

  const totals = useMemo(() => {
    return agentMatches.reduce(
      (acc, match) => {
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
        const rounds =
          match.player_totals_from_match?.rounds_played ??
          match.overview?.rounds ??
          0;

        acc.matches += 1;
        acc.wins += match.won_match ? 1 : 0;
        acc.kills += kills;
        acc.deaths += deaths;
        acc.assists += assists;
        acc.rounds += rounds;
        acc.acs += match.overview?.acs ?? 0;
        acc.adr += match.overview?.adr ?? 0;
        acc.hs += match.overview?.headshot_pct ?? 0;
        return acc;
      },
      {
        matches: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        rounds: 0,
        acs: 0,
        adr: 0,
        hs: 0,
      }
    );
  }, [agentMatches]);

  const stats = useMemo(() => {
    const matches = totals.matches;
    return {
      matches,
      wins: totals.wins,
      winRate: safeDivide(totals.wins * 100, matches),
      kd: safeDivide(totals.kills, Math.max(totals.deaths, 1)),
      kda: safeDivide(totals.kills + totals.assists, Math.max(totals.deaths, 1)),
      killsPerMatch: safeDivide(totals.kills, Math.max(matches, 1)),
      deathsPerMatch: safeDivide(totals.deaths, Math.max(matches, 1)),
      assistsPerMatch: safeDivide(totals.assists, Math.max(matches, 1)),
      acsAvg: safeDivide(totals.acs, Math.max(matches, 1)),
      adrAvg: safeDivide(totals.adr, Math.max(matches, 1)),
      hsAvg: safeDivide(totals.hs, Math.max(matches, 1)),
    };
  }, [totals]);

  const topAgentsMapEntry = useMemo(() => {
    return (player.mostPlayedAgents ?? []).find((a) => a.agentId === agentId);
  }, [player, agentId]);

  const recentMatches = useMemo(() => {
    return [...agentMatches]
      .sort((a, b) => (b.game_start_millis ?? 0) - (a.game_start_millis ?? 0))
      .slice(0, 8);
  }, [agentMatches]);

  const miniChartData = useMemo(() => {
    return recentMatches
      .slice()
      .reverse()
      .map((match, index) => ({
        name: `M${index + 1}`,
        acs: Number((match.overview?.acs ?? 0).toFixed(1)),
      }));
  }, [recentMatches]);

  const displayName =
    agentContent?.displayName ??
    agentContent?.name ??
    agentNameMap[agentId] ??
    "Agente";

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

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
        </div>

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
            <strong className="kpi-value">{formatPercent(stats.winRate, 1)}</strong>
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
            <strong className="kpi-value">{formatNumber(stats.acsAvg, 1)}</strong>
          </div>
        </div>

        <div className="detail-grid">
          <section className="detail-card detail-card-large">
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
                <span>Headshot % medio</span>
                <strong>{formatPercent(stats.hsAvg, 1)}</strong>
              </div>
              <div className="summary-item">
                <span>Top acumulado</span>
                <strong>{formatNumber(topAgentsMapEntry?.matches ?? 0)} partidas</strong>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Tendencia de ACS</h3>
                <p className="panel-subtitle">
                  Últimas partidas jugadas con este agente.
                </p>
              </div>
            </div>

            <div className="modal-chart-box">
              {miniChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={miniChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#b5b5b5", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#b5b5b5", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="acs"
                      stroke="#ff4655"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#ff4655", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#ff7a85", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">Sin suficientes partidas.</div>
              )}
            </div>
          </section>

          <section className="detail-card detail-card-large">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Descripción y habilidades</h3>
                <p className="panel-subtitle">
                  Información del contenido oficial del agente.
                </p>
              </div>
            </div>

            {agentContent?.description && (
              <p className="agent-description-block">{agentContent.description}</p>
            )}

            <div className="agent-abilities-list">
              {(agentContent?.abilities ?? []).map((ability, index) => (
                <div key={`${ability.displayName ?? "ability"}-${index}`} className="agent-ability-card">
                  <div className="agent-ability-header">
                    {ability.displayIcon && (
                      <img
                        src={ability.displayIcon}
                        alt={ability.displayName ?? "Ability"}
                        className="agent-ability-icon"
                      />
                    )}
                    <div>
                      <span className="agent-ability-slot">{ability.slot ?? "Skill"}</span>
                      <strong>{ability.displayName ?? "Habilidad"}</strong>
                    </div>
                  </div>
                  <p>{ability.description ?? "Sin descripción."}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="detail-card detail-card-large">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Últimas partidas con este agente</h3>
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

                  return (
                    <div key={match.match_id ?? `${match.game_start_millis}`} className="mini-match-item">
                      <div>
                        <strong>{match.map_name ?? "Mapa desconocido"}</strong>
                        <small>{formatDate(match.game_start_millis)}</small>
                      </div>

                      <div className="mini-match-metrics">
                        <span>{match.won_match ? "Victoria" : "Derrota"}</span>
                        <span>{kills}/{deaths}/{assists}</span>
                        <span>ACS {formatNumber(match.overview?.acs, 1)}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-chart">No hay partidas con este agente.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}