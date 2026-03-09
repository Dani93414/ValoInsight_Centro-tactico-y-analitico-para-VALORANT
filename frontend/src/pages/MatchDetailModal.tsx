import { useEffect, useMemo, useState } from "react";
import { getMatchById } from "../api/stats";
import { getAgentes } from "../api/content";
import "./DetailModals.css";

type Props = {
  matchId: string;
  playerId: string;
  agentNameMap: Record<string, string>;
  onClose: () => void;
};

type AgentContent = {
  uuid?: string;
  id?: string;
  displayName?: string;
  name?: string;
  displayIconSmall?: string;
};

type RawKillEvent = {
  killer?: string;
  victim?: string;
  killerLocation?: { x?: number; y?: number };
  victimLocation?: { x?: number; y?: number };
  finishingDamage?: {
    item?: string;
    damageType?: string;
  };
  timeSinceRoundStartMillis?: number;
};

type RawRoundPlayerStat = {
  puuid?: string;
  kills?: RawKillEvent[];
};

type RawRound = {
  roundNum?: number;
  winningTeam?: string;
  bombPlanter?: string;
  bombDefuser?: string;
  plantSite?: string;
  playerStats?: RawRoundPlayerStat[];
};

type RawPlayer = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  teamId?: string;
  characterId?: string;
  stats?: {
    score?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
  };
};

type RawTeam = {
  teamId?: string;
  won?: boolean;
  roundsWon?: number;
  roundsLost?: number;
};

type RawMatchDetail = {
  matchInfo?: {
    matchId?: string;
    mapId?: string;
    gameStartMillis?: number;
    queueId?: string;
    gameMode?: string;
    isRanked?: boolean;
    seasonId?: string;
  };
  players?: RawPlayer[];
  teams?: RawTeam[];
  roundResults?: RawRound[];
};

function safeDivide(a: number, b: number) {
  return b > 0 ? a / b : 0;
}

function formatDate(ms?: number) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("es-ES");
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

function getMvp(currentMatch: RawMatchDetail) {
  const players = currentMatch.players ?? [];
  if (players.length === 0) return null;

  return [...players].sort((a, b) => {
    const scoreA = a.stats?.score ?? 0;
    const scoreB = b.stats?.score ?? 0;
    return scoreB - scoreA;
  })[0];
}

function getPlayerDisplay(player?: RawPlayer | null) {
  if (!player) return "Unknown";
  if (player.gameName && player.tagLine) {
    return `${player.gameName}#${player.tagLine}`;
  }
  return player.gameName ?? "Unknown";
}

export default function MatchDetailModal({
  matchId,
  playerId,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [currentMatch, setCurrentMatch] = useState<RawMatchDetail | null>(null);
  const [agents, setAgents] = useState<AgentContent[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [matchData, agentsData] = await Promise.all([
          getMatchById(matchId),
          getAgentes(),
        ]);

        if (cancelled) return;

        setCurrentMatch(matchData as RawMatchDetail | null);
        setAgents(normalizeAgentsResponse(agentsData));
      } catch {
        if (!cancelled) {
          setCurrentMatch(null);
          setAgents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const agentById = useMemo(() => {
    return agents.reduce<Record<string, AgentContent>>((acc, agent) => {
      const id = agent.uuid ?? agent.id;
      if (id) acc[id] = agent;
      return acc;
    }, {});
  }, [agents]);

  const mvp = useMemo(
    () => (currentMatch ? getMvp(currentMatch) : null),
    [currentMatch]
  );

  const playerInfo = useMemo(() => {
    return (
      (currentMatch?.players ?? []).find((p) => p.puuid === playerId) ?? null
    );
  }, [currentMatch, playerId]);

  const playerTeam = playerInfo?.teamId;
  const teamInfo =
    (currentMatch?.teams ?? []).find((t) => t.teamId === playerTeam) ?? null;

  const totalRounds = (currentMatch?.roundResults ?? []).length;

  const playerKills = playerInfo?.stats?.kills ?? 0;
  const playerDeaths = playerInfo?.stats?.deaths ?? 0;
  const playerAssists = playerInfo?.stats?.assists ?? 0;
  const playerScore = playerInfo?.stats?.score ?? 0;
  const playerKd = safeDivide(playerKills, Math.max(playerDeaths, 1));

  if (!loading && !currentMatch) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-panel modal-panel-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
          <div className="empty-panel">No se pudo cargar la partida.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel modal-panel-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {loading ? (
          <div className="loading-card">
            <div className="loading-spinner" />
            <h2>Cargando partida</h2>
          </div>
        ) : (
          <>
            <div className="modal-header-block">
              <div>
                <span className="stats-eyebrow">Detalle de partida</span>
                <h2 className="stats-title modal-title-small">
                  {currentMatch?.matchInfo?.mapId ?? "Mapa desconocido"}
                </h2>
                <p className="stats-subtitle">
                  {formatDate(currentMatch?.matchInfo?.gameStartMillis)} ·{" "}
                  {currentMatch?.matchInfo?.gameMode ?? "-"} ·{" "}
                  {currentMatch?.matchInfo?.queueId ?? "-"}
                </p>
              </div>
            </div>

            <div className="stats-kpis modal-kpis">
              <div className="kpi-card">
                <span className="kpi-label">Resultado</span>
                <strong className="kpi-value">
                  {teamInfo?.won ? "Victoria" : "Derrota"}
                </strong>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Tu K / D / A</span>
                <strong className="kpi-value">
                  {playerKills}/{playerDeaths}/{playerAssists}
                </strong>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Tu score</span>
                <strong className="kpi-value">{playerScore}</strong>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Tu KD</span>
                <strong className="kpi-value">{playerKd.toFixed(2)}</strong>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">MVP</span>
                <strong className="kpi-value">{getPlayerDisplay(mvp)}</strong>
              </div>

              <div className="kpi-card">
                <span className="kpi-label">Rondas</span>
                <strong className="kpi-value">{totalRounds}</strong>
              </div>
            </div>

            <div className="detail-grid">
              <section className="detail-card detail-card-large">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Línea general de la partida</h3>
                    <p className="panel-subtitle">
                      Resumen global del match y del jugador.
                    </p>
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-item">
                    <span>Rondas ganadas</span>
                    <strong>{teamInfo?.roundsWon ?? "-"}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Rondas perdidas</span>
                    <strong>{teamInfo?.roundsLost ?? "-"}</strong>
                  </div>
                  <div className="summary-item">
                    <span>MVP score</span>
                    <strong>{mvp?.stats?.score ?? "-"}</strong>
                  </div>
                  <div className="summary-item">
                    <span>MVP KD</span>
                    <strong>
                      {safeDivide(
                        mvp?.stats?.kills ?? 0,
                        Math.max(mvp?.stats?.deaths ?? 0, 1)
                      ).toFixed(2)}
                    </strong>
                  </div>
                  <div className="summary-item">
                    <span>Tu agente</span>
                    <strong>
                      {agentById[playerInfo?.characterId ?? ""]?.displayName ??
                        "Agente desconocido"}
                    </strong>
                  </div>
                  <div className="summary-item">
                    <span>Ranked</span>
                    <strong>
                      {currentMatch?.matchInfo?.isRanked ? "Sí" : "No"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="detail-card detail-card-large">
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">Rondas</h3>
                    <p className="panel-subtitle">
                      Resumen de kills, plants, defuses y eventos por ronda.
                    </p>
                  </div>
                </div>

                <div className="rounds-list">
                  {(currentMatch?.roundResults ?? []).map((round) => {
                    const killEvents = (round.playerStats ?? []).flatMap((p) =>
                      (p.kills ?? []).map((kill) => ({
                        ...kill,
                        killerPuuid: p.puuid,
                      }))
                    );

                    return (
                      <div
                        key={`round-${round.roundNum ?? Math.random()}`}
                        className="round-card"
                      >
                        <div className="round-card-header">
                          <strong>Ronda {round.roundNum ?? "-"}</strong>
                          <span>{round.winningTeam ?? "-"}</span>
                        </div>

                        <div className="round-tags">
                          {round.plantSite && (
                            <span className="meta-pill">
                              Plant en {round.plantSite}
                            </span>
                          )}
                          {round.bombPlanter && (
                            <span className="meta-pill">Hubo plant</span>
                          )}
                          {round.bombDefuser && (
                            <span className="meta-pill">Hubo defuse</span>
                          )}
                          <span className="meta-pill">
                            {killEvents.length} kills
                          </span>
                        </div>

                        <div className="round-events">
                          {killEvents.length === 0 && (
                            <div className="empty-chart">
                              Sin kills registradas.
                            </div>
                          )}

                          {killEvents.map((kill, index) => {
                            const killer = (currentMatch?.players ?? []).find(
                              (p) => p.puuid === kill.killer
                            );
                            const victim = (currentMatch?.players ?? []).find(
                              (p) => p.puuid === kill.victim
                            );

                            const killerAgent =
                              agentById[killer?.characterId ?? ""];
                            const victimAgent =
                              agentById[victim?.characterId ?? ""];

                            return (
                              <div
                                key={`kill-${round.roundNum ?? 0}-${index}`}
                                className="round-event-item"
                              >
                                <div className="round-event-main">
                                  <div className="round-agent-inline">
                                    {killerAgent?.displayIconSmall && (
                                      <img
                                        src={killerAgent.displayIconSmall}
                                        alt={killerAgent.displayName}
                                        className="round-agent-icon"
                                      />
                                    )}
                                    <span>{getPlayerDisplay(killer)}</span>
                                  </div>

                                  <span className="round-event-separator">
                                    eliminó a
                                  </span>

                                  <div className="round-agent-inline">
                                    {victimAgent?.displayIconSmall && (
                                      <img
                                        src={victimAgent.displayIconSmall}
                                        alt={victimAgent.displayName}
                                        className="round-agent-icon"
                                      />
                                    )}
                                    <span>{getPlayerDisplay(victim)}</span>
                                  </div>
                                </div>

                                <small>
                                  {kill.finishingDamage?.item ??
                                    "Arma desconocida"}{" "}
                                  ·{" "}
                                  {Math.round(
                                    (kill.timeSinceRoundStartMillis ?? 0) / 1000
                                  )}
                                  s
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}