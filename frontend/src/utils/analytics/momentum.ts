import { classifyTeamEconomy } from "./economyDecision";
import type { TeamEconomyType } from "./economyDecision";
import type {
  PlayerRoundImpactBreakdown,
  RoundPlayerImpactResult,
} from "./playerRoundImpact";

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
  kills?: Array<{ killerId: string; victimId: string; timeMs: number }>;
  playerTeams?: Record<string, string>;
  playerNames?: Record<string, string>;
  bombPlanter?: string;
  bombDefuser?: string;
  plantRoundTime?: number;
  defuseRoundTime?: number;
  roundResult?: string;
  roundCeremony?: string;
  playerImpact?: RoundPlayerImpactResult;
};

export type MomentumContribution = {
  id: string;
  label: string;
  value: number;
  kind: "carryover" | "result" | "economy" | "event" | "players";
  detail: string;
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
  roundImpact: number;
  previousMomentumDiff: number;
  carryoverImpact: number;
  contributions: MomentumContribution[];
  baseImpact: number;
  teamAPlayerImpact: number;
  teamBPlayerImpact: number;
  playerImpact?: RoundPlayerImpactResult;
  roundMvp?: PlayerRoundImpactBreakdown;
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

// Old rounds retain 75% of their value; contextual decays reduce carry-over.
export const MOMENTUM_DECAY = 0.75;
export const SIDE_SWITCH_DECAY = MOMENTUM_DECAY;
export const OVERTIME_DECAY = MOMENTUM_DECAY;
export const SIDE_SWITCH_ROUND_BONUS = 0;
export const SIDE_SWITCH_FOLLOWUP_BONUS = 0;

// Round caps separate ordinary, critical and genuinely exceptional rounds.
export const NORMAL_ROUND_IMPACT_CAP = 2;
export const CRITICAL_ROUND_IMPACT_CAP = 2.5;
export const EXTREME_ROUND_IMPACT_CAP = 3;

// Individual impact reinforces team results without replacing the round winner.
export const TEAM_PLAYER_IMPACT_WEIGHT = 0.06;
export const TEAM_PLAYER_IMPACT_CAP = 0.4;
export const TEAM_PLAYER_IMPACT_CRITICAL_CAP = 0.55;

export const BALANCED_THRESHOLD = 0.75;
export const MEDIUM_IMPACT_THRESHOLD = 0.75;
export const HIGH_IMPACT_THRESHOLD = 1.5;
export const DECISIVE_IMPACT_THRESHOLD = 2.4;

const economyRank: Record<TeamEconomyType, number> = {
  ECO: 0,
  SEMIECO: 1,
  FULL: 2,
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDominanceLevel(diff: number): DominanceLevel {
  const absDiff = Math.abs(diff);
  if (absDiff >= DECISIVE_IMPACT_THRESHOLD) return "high";
  if (absDiff >= HIGH_IMPACT_THRESHOLD) return "medium";
  if (absDiff >= BALANCED_THRESHOLD) return "low";
  return "neutral";
}

function getDominantTeam(
  diff: number,
  teamAId: string,
  teamBId: string,
): string | null {
  if (getDominanceLevel(diff) === "neutral") return null;
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
  const teamAScoreBefore =
    round.teamAScore - (round.winnerTeamId === round.teamAId ? 1 : 0);
  const teamBScoreBefore =
    round.teamBScore - (round.winnerTeamId === round.teamBId ? 1 : 0);
  return (
    round.roundNumber !== 13 &&
    (round.roundNumber >= 25 ||
      Math.max(teamAScoreBefore, teamBScoreBefore) >= 11)
  );
}

function getRoundDecay(round: MomentumInputRound): number {
  if (round.roundNumber === 13) return SIDE_SWITCH_DECAY;
  if (criticalRound(round)) return OVERTIME_DECAY;
  return MOMENTUM_DECAY;
}

function getEconomicModifier(
  winnerEconomy: TeamEconomyType,
  loserEconomy: TeamEconomyType,
) {
  if (winnerEconomy === "FULL" && loserEconomy === "ECO") return -0.35;
  if (winnerEconomy === "FULL" && loserEconomy === "SEMIECO") return -0.25;
  if (winnerEconomy === "SEMIECO" && loserEconomy === "FULL") return 0.35;
  if (winnerEconomy === "ECO" && loserEconomy === "FULL") return 0.55;
  if (winnerEconomy === "ECO" && loserEconomy === "SEMIECO") return 0.15;
  if (winnerEconomy === "SEMIECO" && loserEconomy === "ECO") return -0.1;
  return 0;
}

function getRoundEventModifiers(
  round: MomentumInputRound,
  winnerTeamId: string,
) {
  const modifiers: Array<Omit<MomentumContribution, "kind">> = [];
  const add = (id: string, label: string, value: number, detail: string) => {
    if (value !== 0) modifiers.push({ id, label, value, detail });
  };
  const kills = [...(round.kills ?? [])].sort((a, b) => a.timeMs - b.timeMs);
  const playerTeams = round.playerTeams ?? {};
  const playerNames = round.playerNames ?? {};
  const teamOf = (playerId?: string) => playerTeams[playerId ?? ""] ?? "";
  const opponentTeamId =
    winnerTeamId === round.teamAId ? round.teamBId : round.teamAId;
  const firstTeams = kills.slice(0, 3).map((kill) => teamOf(kill.killerId));
  const openingTeam = firstTeams[0];
  let openingReversalModifier: Omit<MomentumContribution, "kind"> | null = null;
  if (openingTeam) {
    if (openingTeam === winnerTeamId) {
      add(
        "opening-converted",
        "Primera baja convertida",
        0.1,
        "El ganador consiguió la primera baja.",
      );
    } else if (
      firstTeams.length >= 3 &&
      firstTeams.every((teamId) => teamId === openingTeam)
    ) {
      openingReversalModifier = {
        id: "triple-opening-lost",
        label: "Ventaja triple rival desperdiciada",
        value: 0.55,
        detail: "El rival consiguió las tres primeras bajas y perdió.",
      };
    } else if (
      firstTeams.length >= 2 &&
      firstTeams[0] === firstTeams[1]
    ) {
      openingReversalModifier = {
        id: "double-opening-lost",
        label: "Ventaja doble rival desperdiciada",
        value: 0.35,
        detail: "El rival consiguió las dos primeras bajas y perdió.",
      };
    } else {
      openingReversalModifier = {
        id: "opening-recovered",
        label: "Victoria tras perder la apertura",
        value: 0.2,
        detail: "El ganador recibió la primera baja.",
      };
    }
  }

  const aliveByTeam = new Map<string, Set<string>>();
  for (const [playerId, teamId] of Object.entries(playerTeams)) {
    const alive = aliveByTeam.get(teamId) ?? new Set<string>();
    alive.add(playerId);
    aliveByTeam.set(teamId, alive);
  }
  let hardestSituation: {
    winnerAlive: number;
    rivalAlive: number;
    soleSurvivorId?: string;
  } | null = null;
  let largestDisadvantage = 0;
  let unreliableAliveTracking = false;
  const deadPlayers = new Set<string>();
  for (const kill of kills) {
    if (
      !teamOf(kill.killerId) ||
      !teamOf(kill.victimId) ||
      deadPlayers.has(kill.killerId) ||
      deadPlayers.has(kill.victimId)
    ) {
      unreliableAliveTracking = true;
    }
    deadPlayers.add(kill.victimId);
    aliveByTeam.get(teamOf(kill.victimId))?.delete(kill.victimId);
    const winnerAlive = aliveByTeam.get(winnerTeamId)?.size ?? 0;
    const rivalAlive = aliveByTeam.get(opponentTeamId)?.size ?? 0;
    const disadvantage = rivalAlive - winnerAlive;
    if (disadvantage > largestDisadvantage) {
      largestDisadvantage = disadvantage;
      hardestSituation = {
        winnerAlive,
        rivalAlive,
        soleSurvivorId:
          winnerAlive === 1
            ? [...(aliveByTeam.get(winnerTeamId) ?? [])][0]
            : undefined,
      };
    }
  }
  const clutchPlayerId = hardestSituation?.soleSurvivorId;
  const clutchPlayerSurvived = Boolean(
    clutchPlayerId && aliveByTeam.get(winnerTeamId)?.has(clutchPlayerId),
  );
  let hasNumericalComeback = false;
  if (
    hardestSituation?.winnerAlive === 1 &&
    hardestSituation.rivalAlive >= 2 &&
    clutchPlayerSurvived &&
    !unreliableAliveTracking
  ) {
    const enemies = hardestSituation.rivalAlive;
    const clutchPlayerName = clutchPlayerId
      ? playerNames[clutchPlayerId] ?? "Un jugador"
      : "Un jugador";
    hasNumericalComeback = true;
    add(
      "clutch",
      `Clutch 1v${enemies}`,
      enemies >= 4 ? 0.8 : enemies === 3 ? 0.55 : 0.3,
      `${clutchPlayerName} quedó como único superviviente y convirtió la ronda.`,
    );
  } else if (
    hardestSituation &&
    hardestSituation.winnerAlive >= 2 &&
    largestDisadvantage > 0 &&
    !unreliableAliveTracking
  ) {
    const { winnerAlive, rivalAlive } = hardestSituation;
    hasNumericalComeback = true;
    const value =
      winnerAlive === 2 && rivalAlive >= 5
        ? 0.65
        : largestDisadvantage >= 2
          ? 0.4
          : 0.25;
    add(
      "collective-comeback",
      `Remontada ${winnerAlive}v${rivalAlive}`,
      value,
      "El equipo ganó después de quedar en desventaja numérica.",
    );
  }
  if (openingReversalModifier && !hasNumericalComeback) {
    modifiers.push(openingReversalModifier);
  }

  const winnerDeaths = kills.filter(
    (kill) => teamOf(kill.victimId) === winnerTeamId,
  ).length;
  if (winnerDeaths === 0 && kills.length > 0) {
    add("flawless", "Ronda perfecta", 0.15, "El ganador no perdió jugadores.");
  } else if (winnerDeaths >= 4) {
    add(
      "costly",
      "Ronda costosa",
      -0.1,
      "El ganador perdió cuatro o más jugadores.",
    );
  }

  const text = `${round.roundResult ?? ""} ${round.roundCeremony ?? ""}`.toLowerCase();
  const isDefuse =
    Boolean(round.bombDefuser) ||
    text.includes("defuse") ||
    text.includes("defused");
  if (isDefuse) {
    let value = 0.1;
    let label = "Defuse";
    let detail = "La ronda se resolvió mediante defuse.";
    const defuseTime = round.defuseRoundTime ?? 0;
    if (defuseTime > 0) {
      const aliveAtDefuse = new Map<string, Set<string>>();
      for (const [playerId, teamId] of Object.entries(playerTeams)) {
        const alive = aliveAtDefuse.get(teamId) ?? new Set<string>();
        alive.add(playerId);
        aliveAtDefuse.set(teamId, alive);
      }
      for (const kill of kills.filter((kill) => kill.timeMs <= defuseTime)) {
        aliveAtDefuse.get(teamOf(kill.victimId))?.delete(kill.victimId);
      }
      const winnerAlive = aliveAtDefuse.get(winnerTeamId)?.size ?? 0;
      const rivalsAlive = aliveAtDefuse.get(opponentTeamId)?.size ?? 0;
      if (rivalsAlive > winnerAlive) {
        value = 0.4;
        label = `Defuse en desventaja ${winnerAlive}v${rivalsAlive}`;
        detail = "El defuse terminó con menos defensores vivos que rivales.";
      } else if (rivalsAlive > 0) {
        value = 0.25;
        label = "Defuse con enemigos vivos";
        detail = `Quedaban ${rivalsAlive} rivales vivos al completar el defuse.`;
      }
    }
    const plantTime = round.plantRoundTime ?? 0;
    if (plantTime > 0 && defuseTime > plantTime) {
      const remainingMs = 45_000 - (defuseTime - plantTime);
      if (remainingMs >= 0 && remainingMs <= 1_000) {
        value = Math.max(value, 0.6);
        label = "Defuse extremo";
        detail = `El defuse terminó con aproximadamente ${(remainingMs / 1000).toFixed(1)} s restantes.`;
      }
    }
    add("defuse", label, value, detail);
  } else if (
    round.bombPlanter &&
    (text.includes("detonate") || text.includes("detonated"))
  ) {
    add(
      "spike-detonated",
      "Spike detonada",
      0.1,
      "El equipo convirtió el plant mediante la detonación.",
    );
  }

  const playerKillCounts = new Map<string, number>();
  for (const kill of kills) {
    if (teamOf(kill.killerId) !== winnerTeamId) continue;
    playerKillCounts.set(
      kill.killerId,
      (playerKillCounts.get(kill.killerId) ?? 0) + 1,
    );
  }
  const maximumKills = Math.max(0, ...playerKillCounts.values());
  const topKillerId = [...playerKillCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  const topKillerName = playerNames[topKillerId] ?? "Un jugador";
  if (!hardestSituation || hardestSituation.winnerAlive !== 1) {
    if (maximumKills >= 5) {
      add("ace", "Ace decisivo", 0.35, `${topKillerName} consiguió cinco bajas.`);
    } else if (maximumKills === 4) {
      add("quad", "Cuatro bajas decisivas", 0.2, `${topKillerName} consiguió cuatro bajas.`);
    } else if (maximumKills === 3) {
      add("triple", "Triple decisiva", 0.1, `${topKillerName} consiguió tres bajas.`);
    }
  }

  return modifiers;
}

function getResidualTeamPlayerImpact(
  playerImpact: RoundPlayerImpactResult | undefined,
  teamId: string,
) {
  const representedSeparately = new Set([
    "first_blood",
    "double_kill",
    "triple_kill",
    "quad_kill",
    "ace",
    "rapid_double",
    "rapid_triple",
    "plant",
    "plant_win",
    "plant_survival",
    "defuse",
    "defuse_win",
    "defuse_under_one",
    "extreme_defuse",
    "eco_kill",
    "semi_eco_kill",
    "critical_action",
    "side_switch_action",
  ]);
  return (
    playerImpact?.players
      .filter((player) => player.teamId === teamId)
      .reduce(
        (teamTotal, player) =>
          teamTotal +
          player.milestones
            .filter(
              (milestone) =>
                !representedSeparately.has(milestone.type) &&
                !milestone.type.startsWith("clutch_"),
            )
            .reduce((sum, milestone) => sum + milestone.value, 0),
        0,
      ) ?? 0
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
  let previousEstablishedDominantTeamId: string | null = null;

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

    const baseImpact = winnerTeamId ? 1 : 0;
    const contributions: MomentumContribution[] = [];
    if (winnerTeamId) {
      contributions.push({
        id: "round-result",
        label: "Resultado de la ronda",
        value: 1,
        kind: "result",
        detail: `${winnerLabel} ganó la ronda.`,
      });
    }
    let impact = baseImpact;
    const economyModifier =
      winnerLoadout > 0 && loserLoadout > 0
        ? getEconomicModifier(winnerEconomy, loserEconomy)
        : 0;
    if (economyModifier !== 0) {
      impact += economyModifier;
      contributions.push({
        id: "economy",
        label:
          economyModifier > 0
            ? "Victoria con economía inferior"
            : "Victoria esperada por economía",
        value: economyModifier,
        kind: "economy",
        detail: `${winnerEconomy} contra ${loserEconomy}.`,
      });
    }
    if (
      winnerLoadout > 0 &&
      loserLoadout > 0 &&
      economyRank[winnerEconomy] < economyRank[loserEconomy]
    ) {
      tags.push("Victoria con economía inferior");
    }
    if (previousOpponentStreak >= 3) {
      const streakModifier = previousOpponentStreak >= 5 ? 0.35 : 0.2;
      impact += streakModifier;
      contributions.push({
        id: "streak-break",
        label: "Ruptura de racha",
        value: streakModifier,
        kind: "event",
        detail: `El rival acumulaba ${previousOpponentStreak} victorias seguidas.`,
      });
      tags.push("Ruptura de racha");
    }
    if (criticalRound(round)) {
      const scoreBefore = Math.max(
        round.teamAScore - (winnerIsA ? 1 : 0),
        round.teamBScore - (winnerIsB ? 1 : 0),
      );
      const criticalModifier = scoreBefore >= 12 ? 0.35 : 0.2;
      impact += criticalModifier;
      contributions.push({
        id: "critical-round",
        label: scoreBefore >= 12 ? "Match point salvado o convertido" : "Ronda crítica",
        value: criticalModifier,
        kind: "event",
        detail: "La ronda se disputó en una situación crítica de marcador.",
      });
      tags.push("Ronda crítica");
    }
    if (round.roundNumber === 13) {
      tags.push("Cambio de lado favorable");
    }
    const eventModifiers = winnerTeamId
      ? getRoundEventModifiers(round, winnerTeamId)
      : [];
    for (const modifier of eventModifiers) {
      impact += modifier.value;
      contributions.push({ ...modifier, kind: "event" });
    }
    if (isEliminationWin(round) && killDiff >= 2) tags.push("Eliminación con ventaja amplia");
    if (winCondition && !tags.some((tag) => tag.includes("Eliminación"))) {
      tags.push(`Victoria por ${winCondition}`);
    }

    const teamAPlayerImpact = getResidualTeamPlayerImpact(
      round.playerImpact,
      teams.teamAId,
    );
    const teamBPlayerImpact = getResidualTeamPlayerImpact(
      round.playerImpact,
      teams.teamBId,
    );
    const winnerPlayerImpact = winnerIsA
      ? teamAPlayerImpact
      : winnerIsB
        ? teamBPlayerImpact
        : 0;
    const loserPlayerImpact = winnerIsA
      ? teamBPlayerImpact
      : winnerIsB
        ? teamAPlayerImpact
        : 0;
    const playerImpactCap = criticalRound(round)
      ? TEAM_PLAYER_IMPACT_CRITICAL_CAP
      : TEAM_PLAYER_IMPACT_CAP;
    const winnerPlayerContribution = clamp(
      Math.max(0, winnerPlayerImpact) * TEAM_PLAYER_IMPACT_WEIGHT,
      0,
      playerImpactCap,
    );
    const loserResistance = clamp(
      Math.max(0, loserPlayerImpact) * TEAM_PLAYER_IMPACT_WEIGHT * 0.35,
      0,
      0.3,
    );
    const netPlayerContribution = winnerPlayerContribution - loserResistance;
    impact += netPlayerContribution;
    if (Math.abs(netPlayerContribution) >= 0.01) {
      contributions.push({
        id: "player-impact",
        label: "Aportación individual agregada",
        value: netPlayerContribution,
        kind: "players",
        detail:
          "Daño, bajas, asistencias y trades no representados por otro modificador específico.",
      });
    }
    if (winnerPlayerContribution >= 0.25) {
      tags.push("Impacto colectivo de jugadores");
    }
    if (round.playerImpact?.mvp) {
      tags.push(`MVP: ${round.playerImpact.mvp.playerName ?? "jugador destacado"}`);
    }

    const impactCap = round.playerImpact?.hasExtremeEvent
      ? EXTREME_ROUND_IMPACT_CAP
      : criticalRound(round)
        ? CRITICAL_ROUND_IMPACT_CAP
        : NORMAL_ROUND_IMPACT_CAP;
    const unclampedImpact = impact;
    impact = clamp(impact, winnerTeamId ? 0.35 : 0, impactCap);
    if (Math.abs(unclampedImpact - impact) >= 0.01) {
      contributions.push({
        id: "impact-cap",
        label: "Límite de impacto",
        value: impact - unclampedImpact,
        kind: "event",
        detail: `La ronda está limitada a ${impactCap.toFixed(1)} puntos para evitar valores desproporcionados.`,
      });
    }

    const signedImpact = winnerIsA ? impact : winnerIsB ? -impact : 0;
    const decay = getRoundDecay(round);
    const previousMomentumDiff = teamAMomentum - teamBMomentum;
    const carryoverImpact = previousMomentumDiff * decay;
    teamAMomentum = teamAMomentum * decay + Math.max(signedImpact, 0);
    teamBMomentum = teamBMomentum * decay + Math.max(-signedImpact, 0);

    const momentumDiff = teamAMomentum - teamBMomentum;
    const dominantTeamId = getDominantTeam(
      momentumDiff,
      teams.teamAId,
      teams.teamBId,
    );
    const dominanceLevel = getDominanceLevel(momentumDiff);
    const isStreakBreaker = previousOpponentStreak >= 3;
    const teamAScoreBefore =
      round.teamAScore - (winnerIsA ? 1 : 0);
    const teamBScoreBefore =
      round.teamBScore - (winnerIsB ? 1 : 0);
    const isComebackSignal =
      (winnerIsA && teamAScoreBefore < teamBScoreBefore && isStreakBreaker) ||
      (winnerIsB && teamBScoreBefore < teamAScoreBefore && isStreakBreaker);
    const establishedDomainChange =
      dominantTeamId !== null &&
      dominantTeamId !== previousEstablishedDominantTeamId;

    if (establishedDomainChange) {
      const reason =
        tags.find((tag) => tag === "Ruptura de racha") ??
        tags.find((tag) => tag === "Victoria con economía inferior") ??
        tags.find((tag) => tag === "Cambio de lado favorable") ??
        tags.find((tag) => tag === "Ronda crítica") ??
        "Acumulación de rondas consecutivas";
      domainChanges.push({
        roundNumber: round.roundNumber,
        fromTeamId: previousEstablishedDominantTeamId,
        toTeamId: dominantTeamId,
        reason,
      });
      tags.push("Cambio de dominio");
      previousEstablishedDominantTeamId = dominantTeamId;
    }
    const contributionDirection = winnerIsA ? 1 : winnerIsB ? -1 : 0;
    const rawAccountingContributions: MomentumContribution[] = [
      {
        id: "carryover",
        label: `Arrastre del momentum anterior (${Math.round(decay * 100)}%)`,
        value: carryoverImpact,
        kind: "carryover",
        detail: `Parte de ${roundToOneDecimal(previousMomentumDiff)} de momentum previo.`,
      },
      ...contributions.map((contribution) => ({
        ...contribution,
        value: contributionDirection * contribution.value,
      })),
    ];
    const accountingContributions = rawAccountingContributions.map(
      (contribution) => ({
        ...contribution,
        value: roundToTwoDecimals(contribution.value),
      }),
    );
    const accountingTotal = accountingContributions.reduce(
      (sum, contribution) => sum + contribution.value,
      0,
    );
    let accountingResidual = roundToTwoDecimals(
      roundToTwoDecimals(momentumDiff) - accountingTotal,
    );
    while (Math.abs(accountingResidual) >= 0.01) {
      const direction = Math.sign(accountingResidual);
      const recipientIndex = rawAccountingContributions
        .map((contribution, index) => ({
          index,
          roundingError:
            contribution.value - accountingContributions[index].value,
        }))
        .sort((a, b) =>
          direction > 0
            ? b.roundingError - a.roundingError
            : a.roundingError - b.roundingError,
        )[0]?.index;
      if (recipientIndex === undefined) break;
      accountingContributions[recipientIndex].value = roundToTwoDecimals(
        accountingContributions[recipientIndex].value + direction * 0.01,
      );
      accountingResidual = roundToTwoDecimals(
        accountingResidual - direction * 0.01,
      );
    }

    momentumRounds.push({
      roundNumber: round.roundNumber,
      winnerTeamId,
      winnerSide: round.winnerSide,
      teamAScore: round.teamAScore,
      teamBScore: round.teamBScore,
      teamAMomentum: roundToOneDecimal(teamAMomentum),
      teamBMomentum: roundToOneDecimal(teamBMomentum),
      momentumDiff: roundToTwoDecimals(momentumDiff),
      dominantTeamId,
      dominanceLevel,
      isSwingRound:
        Math.abs(signedImpact) >= HIGH_IMPACT_THRESHOLD ||
        establishedDomainChange,
      isComebackSignal,
      isStreakBreaker,
      roundImpact: roundToOneDecimal(signedImpact),
      previousMomentumDiff: roundToTwoDecimals(previousMomentumDiff),
      carryoverImpact: roundToTwoDecimals(carryoverImpact),
      contributions: accountingContributions,
      baseImpact: roundToOneDecimal(baseImpact),
      teamAPlayerImpact: roundToOneDecimal(teamAPlayerImpact),
      teamBPlayerImpact: roundToOneDecimal(teamBPlayerImpact),
      playerImpact: round.playerImpact,
      roundMvp: round.playerImpact?.mvp,
      explanation: buildExplanation(tags, winnerLabel),
      tags,
    });

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
    (a, b) => Math.abs(b.roundImpact) - Math.abs(a.roundImpact),
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
