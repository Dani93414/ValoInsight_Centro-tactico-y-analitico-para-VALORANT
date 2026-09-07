import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentContent } from "../../types/agents";
import type { RawMatchDetail, RawPlayer } from "../../types/matches";
import { formatNumber } from "../../utils/formatters";

type Metric = "acs" | "position";

export type ScoreProgressPlayer = {
  id: string;
  name: string;
  agentName: string;
  agentIcon?: string | null;
  teamId: string;
  color: string;
  dataKey: string;
};

export type ScoreProgressSnapshot = {
  round: number;
  values: Record<string, { score: number; acs: number; position: number }>;
};

const PLAYER_COLORS = [
  "#ff4655",
  "#56c8ff",
  "#f6c85f",
  "#7ee787",
  "#c792ea",
  "#ff9f43",
  "#45e0c1",
  "#ff78c6",
  "#9aa7ff",
  "#d4e157",
];

const clean = (value: unknown) => String(value ?? "").trim();

export function buildScoreProgression(
  match: RawMatchDetail,
  players: ScoreProgressPlayer[],
): ScoreProgressSnapshot[] {
  const cumulativeScores = new Map(players.map((player) => [player.id, 0]));
  const playerOrder = new Map(players.map((player, index) => [player.id, index]));
  const rounds = [...(match.roundResults ?? [])]
    .map((round, index) => ({
      round,
      roundNum: Number.isFinite(round.roundNum) ? Number(round.roundNum) : index,
    }))
    .sort((a, b) => a.roundNum - b.roundNum);

  return rounds.map(({ round }, roundIndex) => {
    for (const stat of round.playerStats ?? []) {
      const playerId = clean(stat.puuid);
      if (!cumulativeScores.has(playerId)) continue;
      cumulativeScores.set(
        playerId,
        (cumulativeScores.get(playerId) ?? 0) + Number(stat.score ?? 0),
      );
    }

    const ranked = players
      .map((player) => ({
        id: player.id,
        score: cumulativeScores.get(player.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (playerOrder.get(a.id) ?? 0) - (playerOrder.get(b.id) ?? 0),
      );
    const positionByPlayer = new Map(
      ranked.map((entry, index) => [entry.id, index + 1]),
    );
    const roundsPlayed = roundIndex + 1;
    const values = Object.fromEntries(
      players.map((player) => {
        const score = cumulativeScores.get(player.id) ?? 0;
        return [
          player.id,
          {
            score,
            acs: score / roundsPlayed,
            position: positionByPlayer.get(player.id) ?? players.length,
          },
        ];
      }),
    );

    return { round: roundsPlayed, values };
  });
}

export default function MatchScoreProgressChart({
  match,
  players,
  agentById,
  agentNameMap,
}: {
  match: RawMatchDetail;
  players: RawPlayer[];
  agentById: Map<string, AgentContent>;
  agentNameMap: Record<string, string>;
}) {
  const [metric, setMetric] = useState<Metric>("position");
  const [hoveredRound, setHoveredRound] = useState<number | null>(null);

  const chartPlayers = useMemo<ScoreProgressPlayer[]>(
    () =>
      players
        .filter((player) => !player.isObserver && clean(player.puuid))
        .slice(0, 10)
        .map((player, index) => {
          const id = clean(player.puuid);
          const agentId = clean(player.characterId);
          const agent = agentById.get(agentId);
          return {
            id,
            name:
              [player.gameName, player.tagLine].filter(Boolean).join("#") ||
              "Jugador desconocido",
            agentName:
              agent?.displayName ??
              agentNameMap[agentId] ??
              "Agente desconocido",
            agentIcon: agent?.displayIconSmall ?? agent?.displayIcon ?? null,
            teamId: clean(player.teamId),
            color: PLAYER_COLORS[index % PLAYER_COLORS.length],
            dataKey: `player${index}`,
          };
        }),
    [agentById, agentNameMap, players],
  );

  const snapshots = useMemo(
    () => buildScoreProgression(match, chartPlayers),
    [chartPlayers, match],
  );
  const selectedRound = Math.min(
    hoveredRound ?? snapshots.length,
    snapshots.length,
  );
  const selectedSnapshot = snapshots[selectedRound - 1] ?? snapshots.at(-1);
  const chartData = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        round: snapshot.round,
        ...Object.fromEntries(
          chartPlayers.map((player) => [
            player.dataKey,
            snapshot.round <= selectedRound
              ? snapshot.values[player.id]?.[metric] ?? 0
              : null,
          ]),
        ),
      })),
    [chartPlayers, metric, selectedRound, snapshots],
  );
  const ranking = useMemo(
    () =>
      chartPlayers
        .map((player) => ({
          player,
          value: selectedSnapshot?.values[player.id],
        }))
        .sort(
          (a, b) =>
            (a.value?.position ?? chartPlayers.length) -
            (b.value?.position ?? chartPlayers.length),
        ),
    [chartPlayers, selectedSnapshot],
  );

  if (chartPlayers.length === 0 || snapshots.length === 0) return null;

  return (
    <section className="match-score-progress-panel">
      <div className="match-score-progress-header">
        <div>
          <h3>Evolución de la clasificación</h3>
          <p>Rendimiento acumulado de los diez jugadores ronda a ronda.</p>
        </div>
        <div className="match-score-progress-controls">
          <div className="match-score-progress-toggle" aria-label="Métrica de evolución">
            <button
              type="button"
              className={metric === "acs" ? "is-active" : ""}
              onClick={() => setMetric("acs")}
              aria-pressed={metric === "acs"}
            >
              ACS
            </button>
            <button
              type="button"
              className={metric === "position" ? "is-active" : ""}
              onClick={() => setMetric("position")}
              aria-pressed={metric === "position"}
            >
              Posición
            </button>
          </div>
          <strong>{hoveredRound ? `Ronda ${selectedRound}` : "Final de partida"}</strong>
        </div>
      </div>

      <div className="match-score-progress-layout">
        <div
          className="match-score-progress-chart"
          onMouseLeave={() => setHoveredRound(null)}
        >
          <ResponsiveContainer width="100%" height={390}>
            <LineChart
              data={chartData}
              margin={{ top: 34, right: 24, bottom: 38, left: 30 }}
              onMouseMove={(state: unknown) => {
                const activeLabel = Number(
                  (state as { activeLabel?: number | string } | null)?.activeLabel,
                );
                if (Number.isFinite(activeLabel) && activeLabel > 0) {
                  setHoveredRound(activeLabel);
                }
              }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
              <XAxis
                dataKey="round"
                type="number"
                domain={[1, snapshots.length]}
                allowDecimals={false}
                tick={{ fill: "#aeb8c8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Rondas", position: "bottom", offset: 14, fill: "#8793a6" }}
              />
              <YAxis
                reversed={metric === "position"}
                domain={metric === "position" ? [1, chartPlayers.length] : [0, "auto"]}
                ticks={metric === "position" ? chartPlayers.map((_, index) => index + 1) : undefined}
                allowDecimals={metric !== "position"}
                tick={{ fill: "#aeb8c8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
                label={{ value: metric === "acs" ? "ACS" : "Posición", angle: -90, position: "left", offset: 16, fill: "#8793a6" }}
              />
              <ReTooltip content={() => null} />
              {chartPlayers.map((player) => (
                <Line
                  key={player.id}
                  type={metric === "position" ? "linear" : "monotone"}
                  dataKey={player.dataKey}
                  stroke={player.color}
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="match-score-progress-ranking">
          <header>
            <span>#</span>
            <span>Jugador</span>
            <span>{metric === "acs" ? "ACS" : "Pos."}</span>
          </header>
          {ranking.map(({ player, value }) => (
            <div key={player.id} className="match-score-progress-player">
              <strong>{value?.position ?? "-"}</strong>
              <span className="match-score-progress-identity">
                <i style={{ backgroundColor: player.color }} />
                {player.agentIcon ? (
                  <img src={player.agentIcon} alt="" />
                ) : (
                  <em>{player.agentName.charAt(0)}</em>
                )}
                <span>
                  <b>{player.name}</b>
                  <small>{player.agentName}</small>
                </span>
              </span>
              <strong>
                {metric === "acs"
                  ? formatNumber(value?.acs ?? 0, 1)
                  : value?.position ?? "-"}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
