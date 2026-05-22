import { classifyTeamEconomy } from "./economyDecision";
import type { TeamEconomyType } from "./economyDecision";

export type MomentumSide = "attack" | "defense";
export type DominanceLevel = "neutral" | "low" | "medium" | "high";

export type MomentumInputRound = {
  roundNumber: number;
  winnerTeamId?: string;
  winnerSide?: MomentumSide;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  teamALoadout?: number;
  teamBLoadout?: number;
  teamAKills?: number;
  teamBKills?: number;
  roundResult?: string;
  roundCeremony?: string;
  playerImpactScore?: number;
};

export type MomentumRound = {
  roundNumber: number;
  winnerTeamId: string;
  winnerSide?: MomentumSide;
  teamAScore: number;
  teamBScore: number;
  teamAMomentum: number;
  teamBMomentum: number;
  momentumDiff: number;
  dominantTeamId: string | null;
  dominanceLevel: DominanceLevel;
  isSwingRound: boolean;
  isComebackSignal: boolean;
  isStreakBreaker: boolean;
  explanation: string;
  tags: string[];
};

export type DomainChange = {
  roundNumber: number;
  fromTeamId: string | null;
  toTeamId: string | null;
  reason: string;
};

export type MatchMomentumResult = {
  rounds: MomentumRound[];
  globalDominantTeamId: string | null;
  biggestSwingRound?: MomentumRound;
  comebackRounds: MomentumRound[];
  domainChanges: DomainChange[];
  summary: {
    teamAControlPercentage: number;
    teamBControlPercentage: number;
    totalDomainChanges: number;
    maxMomentumDiff: number;
  };
};

const economyRank: Record<TeamEconomyType, number> = {
  ECO: 0,
  SEMIECO: 1,
  FULL: 2,
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getDominanceLevel(diff: number): DominanceLevel {
  const absDiff = Math.abs(diff);
  if (absDiff >= 2.5) return "high";
  if (absDiff >= 1.5) return "medium";
  if (absDiff >= 0.75) return "low";
  return "neutral";
}

function getDominantTeam(
  diff: number,
  teamAId: string,
  teamBId: string,
): string | null {
  const level = getDominanceLevel(diff);
  if (level === "neutral") return null;
  return diff > 0 ? teamAId : teamBId;
}

function isEliminationWin(round: MomentumInputRound): boolean {
  const text = `${round.roundResult ?? ""} ${round.roundCeremony ?? ""}`.toLowerCase();
  return (
    text.includes("elim") ||
    text.includes("kill") ||
    text.includes("ace") ||
    text.includes("flawless") ||
    text.includes("survived")
  );
}

function getWinConditionLabel(round: MomentumInputRound): string | null {
  const text = `${round.roundResult ?? ""} ${round.roundCeremony ?? ""}`.toLowerCase();
  if (text.includes("defuse") || text.includes("defused")) return "defuse";
  if (text.includes("time") || text.includes("timeout") || text.includes("expired")) {
    return "tiempo agotado";
  }
  if (text.includes("detonate") || text.includes("spike")) return "spike";
  if (isEliminationWin(round)) return "eliminación";
  return null;
}

function criticalRound(round: MomentumInputRound): boolean {
  return (
    round.roundNumber === 12 ||
    round.roundNumber === 13 ||
    round.roundNumber >= 25 ||
    Math.max(round.teamAScore, round.teamBScore) >= 12
  );
}

function buildExplanation(tags: string[], winnerLabel: string): string {
  if (tags.length === 0) return `${winnerLabel} suma control por victoria de ronda.`;
  return `${winnerLabel}: ${tags.join(", ")}.`;
}

export function calculateMatchMomentum(
  rounds: MomentumInputRound[],
  teams: { teamAId: string; teamBId: string },
): MatchMomentumResult {
  let teamAMomentum = 0;
  let teamBMomentum = 0;
  let teamAStreak = 0;
  let teamBStreak = 0;
  let previousDominantTeamId: string | null = null;

  const momentumRounds: MomentumRound[] = [];
  const domainChanges: DomainChange[] = [];

  for (const round of rounds) {
    const winnerTeamId = round.winnerTeamId ?? "";
    const winnerIsA = winnerTeamId === teams.teamAId;
    const winnerIsB = winnerTeamId === teams.teamBId;
    const winnerLabel = winnerIsA ? "Team A" : winnerIsB ? "Team B" : "Equipo ganador";
    const loserLoadout = winnerIsA ? round.teamBLoadout ?? 0 : round.teamALoadout ?? 0;
    const winnerLoadout = winnerIsA ? round.teamALoadout ?? 0 : round.teamBLoadout ?? 0;
    const winnerEconomy = classifyTeamEconomy(winnerLoadout);
    const loserEconomy = classifyTeamEconomy(loserLoadout);
    const previousOpponentStreak = winnerIsA ? teamBStreak : teamAStreak;
    const killDiff = Math.abs((round.teamAKills ?? 0) - (round.teamBKills ?? 0));
    const winCondition = getWinConditionLabel(round);
    const tags: string[] = [];

    let impact = winnerTeamId ? 1 : 0;
    if (economyRank[winnerEconomy] < economyRank[loserEconomy]) {
      impact += 0.5;
      tags.push("Victoria con economía inferior");
    }
    if (previousOpponentStreak >= 3) {
      impact += 0.4;
      tags.push("Ruptura de racha");
    }
    if (criticalRound(round)) {
      impact += 0.3;
      tags.push("Ronda crítica");
    }
    if (round.roundNumber === 13) {
      impact += 0.3;
      tags.push("Cambio de lado favorable");
    }
    if (isEliminationWin(round) && killDiff >= 2) {
      impact += 0.2;
      tags.push("Eliminación con ventaja amplia");
    }
    if (winnerLoadout >= 16500 && loserLoadout < 7500 && !winnerTeamId) {
      tags.push("Datos económicos parciales");
    }
    if (winCondition && !tags.some((tag) => tag.includes("Eliminación"))) {
      tags.push(`Victoria por ${winCondition}`);
    }
    if ((round.playerImpactScore ?? 0) >= 300) {
      impact += 0.2;
      tags.push("Impacto alto del jugador analizado");
    }

    const signedImpact = winnerIsA ? impact : winnerIsB ? -impact : 0;
    teamAMomentum = teamAMomentum * 0.65 + Math.max(signedImpact, 0);
    teamBMomentum = teamBMomentum * 0.65 + Math.max(-signedImpact, 0);

    const momentumDiff = teamAMomentum - teamBMomentum;
    const dominantTeamId = getDominantTeam(
      momentumDiff,
      teams.teamAId,
      teams.teamBId,
    );
    const dominanceLevel = getDominanceLevel(momentumDiff);
    const isStreakBreaker = previousOpponentStreak >= 3;
    const isComebackSignal =
      (winnerIsA && round.teamAScore < round.teamBScore && isStreakBreaker) ||
      (winnerIsB && round.teamBScore < round.teamAScore && isStreakBreaker);

    if (dominantTeamId !== previousDominantTeamId) {
      const reason =
        tags.find((tag) => tag === "Ruptura de racha") ??
        tags.find((tag) => tag === "Victoria con economía inferior") ??
        tags.find((tag) => tag === "Cambio de lado favorable") ??
        tags.find((tag) => tag === "Ronda crítica") ??
        "Acumulación de rondas consecutivas";
      domainChanges.push({
        roundNumber: round.roundNumber,
        fromTeamId: previousDominantTeamId,
        toTeamId: dominantTeamId,
        reason,
      });
      if (dominantTeamId !== null) tags.push("Cambio de dominio");
    }

    const momentumRound: MomentumRound = {
      roundNumber: round.roundNumber,
      winnerTeamId,
      winnerSide: round.winnerSide,
      teamAScore: round.teamAScore,
      teamBScore: round.teamBScore,
      teamAMomentum: roundToOneDecimal(teamAMomentum),
      teamBMomentum: roundToOneDecimal(teamBMomentum),
      momentumDiff: roundToOneDecimal(momentumDiff),
      dominantTeamId,
      dominanceLevel,
      isSwingRound: Math.abs(signedImpact) >= 1.7 || dominantTeamId !== previousDominantTeamId,
      isComebackSignal,
      isStreakBreaker,
      explanation: buildExplanation(tags, winnerLabel),
      tags,
    };

    momentumRounds.push(momentumRound);
    previousDominantTeamId = dominantTeamId;

    if (winnerIsA) {
      teamAStreak += 1;
      teamBStreak = 0;
    } else if (winnerIsB) {
      teamBStreak += 1;
      teamAStreak = 0;
    }
  }

  const teamAControlRounds = momentumRounds.filter(
    (round) => round.dominantTeamId === teams.teamAId,
  ).length;
  const teamBControlRounds = momentumRounds.filter(
    (round) => round.dominantTeamId === teams.teamBId,
  ).length;
  const biggestSwingRound = [...momentumRounds].sort(
    (a, b) => Math.abs(b.momentumDiff) - Math.abs(a.momentumDiff),
  )[0];
  const maxMomentumDiff = momentumRounds.reduce(
    (max, round) => Math.max(max, Math.abs(round.momentumDiff)),
    0,
  );

  return {
    rounds: momentumRounds,
    globalDominantTeamId:
      teamAControlRounds === teamBControlRounds
        ? null
        : teamAControlRounds > teamBControlRounds
          ? teams.teamAId
          : teams.teamBId,
    biggestSwingRound,
    comebackRounds: momentumRounds.filter((round) => round.isComebackSignal),
    domainChanges,
    summary: {
      teamAControlPercentage: Math.round(
        (teamAControlRounds / Math.max(momentumRounds.length, 1)) * 100,
      ),
      teamBControlPercentage: Math.round(
        (teamBControlRounds / Math.max(momentumRounds.length, 1)) * 100,
      ),
      totalDomainChanges: domainChanges.length,
      maxMomentumDiff: roundToOneDecimal(maxMomentumDiff),
    },
  };
}
