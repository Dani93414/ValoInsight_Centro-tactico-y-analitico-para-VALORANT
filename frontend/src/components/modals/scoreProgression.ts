import type { RawMatchDetail } from "../../types/matches";

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

