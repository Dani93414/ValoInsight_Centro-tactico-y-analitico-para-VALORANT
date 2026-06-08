export type TeamEconomyType = "ECO" | "SEMIECO" | "FULL";
export type EconomyThresholds = {
  ecoMaxExclusive: number;
  semiEcoMaxExclusive: number;
  fullMinInclusive: number;
};

export const BASE_ECONOMY_THRESHOLDS: EconomyThresholds = {
  ecoMaxExclusive: 8000,
  semiEcoMaxExclusive: 19000,
  fullMinInclusive: 19000,
};
export type EconomyEfficiency =
  | "optimal"
  | "acceptable"
  | "risky"
  | "inefficient";

export type EconomyDecisionInput = {
  roundNumber: number;
  teamCredits?: number;
  enemyCredits?: number;
  teamLoadout: number;
  enemyLoadout?: number;
  teamScore: number;
  enemyScore: number;
  previousRoundWon?: boolean;
  lossStreak?: number;
  winStreak?: number;
  side?: "attack" | "defense";
  isMatchPoint?: boolean;
  isPistolRound?: boolean;
  isOvertime?: boolean;
  roundWon?: boolean;
};

export type EconomyRecommendation = {
  recommendedType: TeamEconomyType;
  realType: TeamEconomyType;
  efficiency: EconomyEfficiency;
  efficiencyScore: number;
  reason: string;
  isHighValue: boolean;
  isEconomicSwing: boolean;
};

export type EconomyRoundTeamAnalysis = EconomyRecommendation & {
  loadout: number;
  credits?: number;
  result: "win" | "loss";
};

export type EconomyRoundAnalysis = {
  roundNumber: number;
  teamA: EconomyRoundTeamAnalysis;
  teamB: EconomyRoundTeamAnalysis;
};

export type EconomyEfficiencySummary = {
  teamAOptimalRounds: number;
  teamBOptimalRounds: number;
  teamAAverageEfficiency: number;
  teamBAverageEfficiency: number;
  teamAMostInefficientRound?: number;
  teamBMostInefficientRound?: number;
  biggestEconomicUpsetRound?: number;
};

export type EconomyEfficiencyAnalysis = {
  rounds: EconomyRoundAnalysis[];
  summary: EconomyEfficiencySummary;
};

export type EconomyRoundInput = {
  roundNumber: number;
  teamALoadout: number;
  teamBLoadout: number;
  teamACredits?: number;
  teamBCredits?: number;
  teamAScore: number;
  teamBScore: number;
  winnerTeamId?: string;
  teamAId: string;
  teamBId: string;
  teamASide?: "attack" | "defense";
  teamBSide?: "attack" | "defense";
};

const economyRank: Record<TeamEconomyType, number> = {
  ECO: 0,
  SEMIECO: 1,
  FULL: 2,
};

export function classifyTeamEconomy(
  loadoutValue: number,
  thresholds: EconomyThresholds = BASE_ECONOMY_THRESHOLDS,
): TeamEconomyType {
  if (loadoutValue < thresholds.ecoMaxExclusive) return "ECO";
  if (loadoutValue >= thresholds.ecoMaxExclusive && loadoutValue < thresholds.fullMinInclusive) {
    return "SEMIECO";
  }
  return "FULL";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function typeDistance(a: TeamEconomyType, b: TeamEconomyType): number {
  return Math.abs(economyRank[a] - economyRank[b]);
}

function isCriticalScore(teamScore: number, enemyScore: number): boolean {
  return Math.max(teamScore, enemyScore) >= 11 || Math.abs(teamScore - enemyScore) <= 1;
}

export function recommendEconomyDecision(
  input: EconomyDecisionInput,
): EconomyRecommendation {
  const realType = classifyTeamEconomy(input.teamLoadout);
  const enemyType = classifyTeamEconomy(input.enemyLoadout ?? 0);
  const creditsProxy = input.teamCredits ?? input.teamLoadout;
  const enemyCreditsProxy = input.enemyCredits ?? input.enemyLoadout ?? 0;
  const hasCredits = input.teamCredits !== undefined;
  const isCritical =
    Boolean(input.isMatchPoint) ||
    Boolean(input.isOvertime) ||
    isCriticalScore(input.teamScore, input.enemyScore);

  let recommendedType: TeamEconomyType = "SEMIECO";
  let reason = hasCredits
    ? "SEMIECO recomendada por economía intermedia."
    : "SEMIECO recomendada usando loadout como proxy por falta de créditos.";

  if (input.isPistolRound) {
    recommendedType = realType;
    reason = "Ronda de pistola: compra especial sin penalización económica.";
  } else if (
    creditsProxy >= BASE_ECONOMY_THRESHOLDS.fullMinInclusive ||
    input.teamLoadout >= BASE_ECONOMY_THRESHOLDS.fullMinInclusive
  ) {
    recommendedType = "FULL";
    reason = "Compra completa recomendada por ventaja de créditos.";
  } else if (
    (input.lossStreak ?? 0) >= 2 &&
    creditsProxy < BASE_ECONOMY_THRESHOLDS.fullMinInclusive &&
    enemyCreditsProxy > creditsProxy + 4500
  ) {
    recommendedType = "ECO";
    reason = "ECO recomendada para estabilizar economía tras derrotas consecutivas.";
  } else if (
    creditsProxy < BASE_ECONOMY_THRESHOLDS.ecoMaxExclusive &&
    enemyCreditsProxy > creditsProxy + 3500
  ) {
    recommendedType = "ECO";
    reason = "ECO recomendada por desventaja económica frente al rival.";
  } else if (
    creditsProxy >= BASE_ECONOMY_THRESHOLDS.ecoMaxExclusive &&
    creditsProxy < BASE_ECONOMY_THRESHOLDS.fullMinInclusive
  ) {
    recommendedType = isCritical ? "SEMIECO" : "ECO";
    reason = isCritical
      ? "SEMIECO aceptable por ronda crítica."
      : "ECO recomendada para llegar a compra completa posterior.";
  }

  const distance = typeDistance(realType, recommendedType);
  let efficiency: EconomyEfficiency = "optimal";
  let efficiencyScore = 92;
  let isHighValue = false;
  let isEconomicSwing = false;

  if (distance === 0) {
    efficiency = "optimal";
    efficiencyScore = input.roundWon ? 96 : 84;
  } else if (distance === 1) {
    efficiency = isCritical ? "acceptable" : "risky";
    efficiencyScore = isCritical ? 78 : 64;
  } else {
    efficiency = "inefficient";
    efficiencyScore = 42;
  }

  if (realType === "ECO" && enemyType === "FULL" && input.roundWon) {
    efficiency = "optimal";
    efficiencyScore = 100;
    isHighValue = true;
    isEconomicSwing = true;
    reason = "Alta eficiencia: victoria con economía inferior.";
  } else if (realType === "FULL" && enemyType === "ECO" && input.roundWon === false) {
    efficiency = "inefficient";
    efficiencyScore = 24;
    isEconomicSwing = true;
    reason = "Ineficiente: derrota con FULL contra ECO rival.";
  } else if (
    economyRank[realType] > economyRank[recommendedType] &&
    input.roundWon === false
  ) {
    efficiency = distance > 1 ? "inefficient" : "risky";
    efficiencyScore = distance > 1 ? 34 : 52;
    reason = "Compra arriesgada: inversión alta con baja rentabilidad.";
  } else if (
    economyRank[realType] < economyRank[recommendedType] &&
    input.roundWon === false
  ) {
    efficiency = distance > 1 ? "inefficient" : "risky";
    efficiencyScore = distance > 1 ? 38 : 58;
    reason = "Compra real inferior a la recomendada y ronda perdida.";
  }

  if (isCritical && efficiency === "risky") {
    efficiency = "acceptable";
    efficiencyScore = Math.max(efficiencyScore, 72);
    reason = "SEMIECO aceptable por ronda crítica.";
  }

  return {
    recommendedType,
    realType,
    efficiency,
    efficiencyScore: clampScore(efficiencyScore),
    reason,
    isHighValue,
    isEconomicSwing,
  };
}

function updateStreaks(won: boolean, winStreak: number, lossStreak: number) {
  return won
    ? { winStreak: winStreak + 1, lossStreak: 0 }
    : { winStreak: 0, lossStreak: lossStreak + 1 };
}

export function analyzeEconomyEfficiency(
  rounds: EconomyRoundInput[],
): EconomyEfficiencyAnalysis {
  let teamAWinStreak = 0;
  let teamBWinStreak = 0;
  let teamALossStreak = 0;
  let teamBLossStreak = 0;
  let previousTeamAWon: boolean | undefined;
  let previousTeamBWon: boolean | undefined;

  const analyzedRounds = rounds.map((round) => {
    const teamAWon = round.winnerTeamId === round.teamAId;
    const teamBWon = round.winnerTeamId === round.teamBId;
    const common = {
      roundNumber: round.roundNumber,
      isPistolRound: round.roundNumber === 1 || round.roundNumber === 13,
      isOvertime: round.roundNumber >= 25,
      isMatchPoint: Math.max(round.teamAScore, round.teamBScore) >= 12,
    };

    const teamA = {
      ...recommendEconomyDecision({
        ...common,
        teamCredits: round.teamACredits,
        enemyCredits: round.teamBCredits,
        teamLoadout: round.teamALoadout,
        enemyLoadout: round.teamBLoadout,
        teamScore: round.teamAScore,
        enemyScore: round.teamBScore,
        previousRoundWon: previousTeamAWon,
        lossStreak: teamALossStreak,
        winStreak: teamAWinStreak,
        side: round.teamASide,
        roundWon: teamAWon,
      }),
      loadout: round.teamALoadout,
      credits: round.teamACredits,
      result: teamAWon ? "win" : "loss",
    } satisfies EconomyRoundTeamAnalysis;

    const teamB = {
      ...recommendEconomyDecision({
        ...common,
        teamCredits: round.teamBCredits,
        enemyCredits: round.teamACredits,
        teamLoadout: round.teamBLoadout,
        enemyLoadout: round.teamALoadout,
        teamScore: round.teamBScore,
        enemyScore: round.teamAScore,
        previousRoundWon: previousTeamBWon,
        lossStreak: teamBLossStreak,
        winStreak: teamBWinStreak,
        side: round.teamBSide,
        roundWon: teamBWon,
      }),
      loadout: round.teamBLoadout,
      credits: round.teamBCredits,
      result: teamBWon ? "win" : "loss",
    } satisfies EconomyRoundTeamAnalysis;

    const nextA = updateStreaks(teamAWon, teamAWinStreak, teamALossStreak);
    const nextB = updateStreaks(teamBWon, teamBWinStreak, teamBLossStreak);
    teamAWinStreak = nextA.winStreak;
    teamALossStreak = nextA.lossStreak;
    teamBWinStreak = nextB.winStreak;
    teamBLossStreak = nextB.lossStreak;
    previousTeamAWon = teamAWon;
    previousTeamBWon = teamBWon;

    return {
      roundNumber: round.roundNumber,
      teamA,
      teamB,
    };
  });

  const summarize = (team: "teamA" | "teamB") => {
    const optimalRounds = analyzedRounds.filter(
      (round) => round[team].efficiency === "optimal",
    ).length;
    const averageEfficiency =
      analyzedRounds.reduce((sum, round) => sum + round[team].efficiencyScore, 0) /
      Math.max(analyzedRounds.length, 1);
    const mostInefficient = [...analyzedRounds].sort(
      (a, b) => a[team].efficiencyScore - b[team].efficiencyScore,
    )[0];
    return {
      optimalRounds,
      averageEfficiency: Math.round(averageEfficiency),
      mostInefficientRound: mostInefficient?.roundNumber,
    };
  };

  const teamA = summarize("teamA");
  const teamB = summarize("teamB");
  const biggestUpset = analyzedRounds
    .filter((round) => round.teamA.isHighValue || round.teamB.isHighValue)
    .sort(
      (a, b) =>
        Math.max(b.teamA.efficiencyScore, b.teamB.efficiencyScore) -
        Math.max(a.teamA.efficiencyScore, a.teamB.efficiencyScore),
    )[0];

  return {
    rounds: analyzedRounds,
    summary: {
      teamAOptimalRounds: teamA.optimalRounds,
      teamBOptimalRounds: teamB.optimalRounds,
      teamAAverageEfficiency: teamA.averageEfficiency,
      teamBAverageEfficiency: teamB.averageEfficiency,
      teamAMostInefficientRound: teamA.mostInefficientRound,
      teamBMostInefficientRound: teamB.mostInefficientRound,
      biggestEconomicUpsetRound: biggestUpset?.roundNumber,
    },
  };
}
