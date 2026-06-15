import {
  classifyTeamEconomy,
  type EconomyEfficiencyAnalysis,
  type TeamEconomyType,
} from "./economyDecision";
import type { MatchMomentumResult } from "./momentum";
import {
  calculateMatchPlayerImpacts,
  type RoundPlayerImpactResult,
} from "./playerRoundImpact";

export type MomentumConfidence = "high" | "medium" | "low";

export type MomentumEventType =
  | "CLUTCH_INFERRED"
  | "MULTIKILL"
  | "ACE"
  | "EXTREME_DEFUSE"
  | "ECO_WIN"
  | "SEMIECO_WIN_VS_FULL"
  | "FULL_LOSS_VS_ECO"
  | "ECONOMIC_SWING"
  | "STREAK_BREAKER"
  | "STREAK_START"
  | "COMEBACK_SIGNAL"
  | "MATCH_POINT_SAVED"
  | "MATCH_POINT_REACHED"
  | "OVERTIME_TURN"
  | "FIRST_BLOOD_SWING"
  | "TRADE_SWING"
  | "PLAYER_ACTIVATION"
  | "CARRY_DROP"
  | "DUEL_REVERSAL"
  | "SIDE_SWITCH_DOMINANCE"
  | "OBJECTIVE_CONTROL"
  | "COSTLY_WIN";

export type MomentumEconomyLink = {
  roundNumber: number;
  teamId: string;
  realEconomyType: TeamEconomyType;
  rivalEconomyType: TeamEconomyType;
  ownLoadout: number;
  rivalLoadout: number;
  loadoutDifference: number;
  recommendedEconomyType?: TeamEconomyType;
  recommendationSource?: "historical-model" | "rules-fallback";
  expectedUtilityDifference?: number;
  economicEventType?: "ECO_WIN" | "FULL_LOSS_VS_ECO" | "COSTLY_WIN" | "RECOVERY";
  momentumDelta: number;
  causedDomainChange: boolean;
  explanation: string;
};

export type MomentumEvent = {
  id: string;
  roundNumber: number;
  type: MomentumEventType;
  teamId: string;
  playerId?: string;
  playerName?: string;
  agentName?: string;
  title: string;
  description: string;
  factualEvidence: string[];
  interpretation?: string;
  spectacularityScore: number;
  contextScore: number;
  economicSwingScore: number;
  individualScore: number;
  objectiveScore: number;
  postEventMomentumDelta: number;
  totalImpactScore: number;
  isTurningPoint: boolean;
  isHighlight: boolean;
  confidence: MomentumConfidence;
  missingData?: string[];
  economyLink?: MomentumEconomyLink;
};

export type AdvancedMomentumPlayer = {
  id: string;
  teamId: string;
  playerName: string;
  agentName?: string;
  agentIcon?: string | null;
};

export type AdvancedMomentumKill = {
  killerId: string;
  victimId: string;
  timeMs: number;
  assistants?: string[];
};

export type AdvancedMomentumPlayerRound = {
  playerId: string;
  kills: number;
  assists: number;
  deaths: number;
  score: number;
  damage?: number;
  firstKill: boolean;
  firstDeath: boolean;
};

export type AdvancedMomentumRound = {
  roundNumber: number;
  winnerTeamId: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  scoreBefore?: Record<string, number>;
  scoreAfter?: Record<string, number>;
  teamALoadout: number;
  teamBLoadout: number;
  teamASpent?: number;
  teamBSpent?: number;
  teamARemaining?: number;
  teamBRemaining?: number;
  teamASide?: "attack" | "defense";
  teamBSide?: "attack" | "defense";
  roundResult?: string;
  roundCeremony?: string;
  plantRoundTime?: number;
  defuseRoundTime?: number;
  bombPlanter?: string;
  bombDefuser?: string;
  kills: AdvancedMomentumKill[];
  playerRounds: AdvancedMomentumPlayerRound[];
};

export type AdvancedMomentumInput = {
  existingMomentum: MatchMomentumResult | null;
  rounds: AdvancedMomentumRound[];
  players: AdvancedMomentumPlayer[];
  teamAId: string;
  teamBId: string;
  economyAnalysis?: EconomyEfficiencyAnalysis | null;
  playerImpacts?: RoundPlayerImpactResult[];
};

export type AdvancedMomentumResult = {
  existingMomentum: MatchMomentumResult | null;
  rounds: AdvancedMomentumRound[];
  playerImpacts: RoundPlayerImpactResult[];
  events: MomentumEvent[];
  mainTurningPoint?: MomentumEvent;
  biggestEconomicSwing?: MomentumEvent;
  mostEpicPlay?: MomentumEvent;
  unexpectedPlayerActivation?: MomentumEvent;
  carryDropEvent?: MomentumEvent;
  sideSwitchImpact?: MomentumEvent;
  structuralChanges: MomentumEvent[];
  narrativeSummary: string;
  dataQuality: {
    availableSignals: string[];
    unavailableSignals: string[];
    overallConfidence: MomentumConfidence;
  };
};

type MomentumEventDraft = Omit<
  MomentumEvent,
  | "postEventMomentumDelta"
  | "totalImpactScore"
  | "isTurningPoint"
  | "isHighlight"
  | "confidence"
> & {
  confidence?: MomentumConfidence;
};

export const MOMENTUM_SCORING = {
  result: { win: 1 },
  economy: {
    semiEcoBeatsFull: 0.7,
    ecoBeatsFull: 1.2,
    fullLostToEco: 1.2,
    largeLoadoutGap: 0.5,
    rivalDegradedNextRound: 0.35,
  },
  clutch: {
    clutch1v1: 0.25,
    clutch1v2: 0.55,
    clutch1v3: 0.9,
    clutch1v4Plus: 1.3,
  },
  multikill: { triple: 0.2, quad: 0.45, ace: 0.7 },
  objective: { defuse: 0.15, defuseUnderOne: 0.9, defuseUnderHalf: 1.3 },
  context: {
    streakBreak3: 0.4,
    streakBreak5: 0.7,
    matchPointSaved: 0.7,
    overtime: 0.6,
    sideSwitchRound: 0.2,
  },
  individual: {
    unexpectedActivation: 0.45,
    carryDrop: 0.5,
    duelReversal: 0.4,
  },
  postEvent: {
    domainChange: 1,
    threeWinsNextFive: 0.6,
    fourWinsNextFive: 1,
    deltaScale: 0.35,
  },
  thresholds: {
    turningPoint: 2.2,
    highlight: 0.7,
    momentumDelta: 1,
  },
};

// Valorant spike fuse is 45 seconds. We only use this when both plant and defuse
// timestamps are positive and the derived interval is plausible.
const SPIKE_FUSE_MS = 45000;

function roundId(type: MomentumEventType, roundNumber: number, suffix: string) {
  return `${type}-${roundNumber}-${suffix}`;
}

function getPlayer(players: AdvancedMomentumPlayer[], id?: string) {
  return players.find((player) => player.id === id);
}

function opponentOf(round: AdvancedMomentumRound, teamId: string) {
  return teamId === round.teamAId ? round.teamBId : round.teamAId;
}

function loadoutOf(round: AdvancedMomentumRound, teamId: string) {
  return teamId === round.teamAId ? round.teamALoadout : round.teamBLoadout;
}

function economyOf(round: AdvancedMomentumRound, teamId: string) {
  return classifyTeamEconomy(loadoutOf(round, teamId));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function getMomentumForTeam(
  momentum: MatchMomentumResult | null,
  roundNumber: number,
  teamId: string,
  teamAId: string,
) {
  const round = momentum?.rounds.find((entry) => entry.roundNumber === roundNumber);
  if (!round) return 0;
  return teamId === teamAId ? round.momentumDiff : -round.momentumDiff;
}

function postMomentumDelta(input: AdvancedMomentumInput, roundNumber: number, teamId: string) {
  const maximumRound = Math.max(0, ...input.rounds.map((round) => round.roundNumber));
  const before = [roundNumber - 3, roundNumber - 2, roundNumber - 1]
    .filter((round) => round > 0)
    .map((round) => getMomentumForTeam(input.existingMomentum, round, teamId, input.teamAId));
  const after = [roundNumber + 1, roundNumber + 2, roundNumber + 3, roundNumber + 4, roundNumber + 5]
    .filter((round) => round <= maximumRound)
    .map((round) => getMomentumForTeam(input.existingMomentum, round, teamId, input.teamAId));
  return Math.round((average(after) - average(before)) * 10) / 10;
}

function winsInWindow(
  rounds: AdvancedMomentumRound[],
  teamId: string,
  startRound: number,
  size: number,
) {
  return rounds.filter(
    (round) =>
      round.roundNumber >= startRound &&
      round.roundNumber < startRound + size &&
      round.winnerTeamId === teamId,
  ).length;
}

function previousOpponentStreak(
  rounds: AdvancedMomentumRound[],
  roundNumber: number,
  teamId: string,
) {
  let streak = 0;
  for (const round of rounds.filter((item) => item.roundNumber < roundNumber).sort((a, b) => b.roundNumber - a.roundNumber)) {
    if (round.winnerTeamId === opponentOf(round, teamId)) streak += 1;
    else break;
  }
  return streak;
}

function domainChangeAfter(
  momentum: MatchMomentumResult | null,
  roundNumber: number,
  teamId: string,
) {
  return Boolean(
    momentum?.domainChanges.some(
      (change) =>
        change.roundNumber >= roundNumber &&
        change.roundNumber <= roundNumber + 3 &&
        change.toTeamId === teamId,
    ),
  );
}

function isOvertime(roundNumber: number) {
  return roundNumber >= 25;
}

function matchPointSaved(round: AdvancedMomentumRound, teamId: string) {
  const before = round.scoreBefore ?? {
    [round.teamAId]: Math.max(0, round.teamAScore - (round.winnerTeamId === round.teamAId ? 1 : 0)),
    [round.teamBId]: Math.max(0, round.teamBScore - (round.winnerTeamId === round.teamBId ? 1 : 0)),
  };
  return round.winnerTeamId === teamId && (before[opponentOf(round, teamId)] ?? 0) >= 12;
}

function nextRoundEconomyChanged(
  input: AdvancedMomentumInput,
  round: AdvancedMomentumRound,
  teamId: string,
) {
  const next = input.rounds.find((entry) => entry.roundNumber === round.roundNumber + 1);
  if (!next) return false;
  if (loadoutOf(round, teamId) <= 0 || loadoutOf(next, teamId) <= 0) return false;
  return economyOf(round, teamId) !== economyOf(next, teamId);
}

export function evaluatePostEventImpact(
  event: MomentumEventDraft,
  input: AdvancedMomentumInput,
  round: AdvancedMomentumRound,
): MomentumEvent {
  const momentumDelta = postMomentumDelta(input, event.roundNumber, event.teamId);
  const nextWins = winsInWindow(input.rounds, event.teamId, event.roundNumber + 1, 5);
  const brokenStreak = previousOpponentStreak(input.rounds, event.roundNumber, event.teamId);
  const changedDomain = domainChangeAfter(input.existingMomentum, event.roundNumber, event.teamId);
  const isAdverseEvent = event.type === "FULL_LOSS_VS_ECO" || event.type === "CARRY_DROP";
  const directionalMomentumDelta = isAdverseEvent ? -momentumDelta : momentumDelta;
  const streakBonus =
    isAdverseEvent
      ? 0
      : nextWins >= 4
      ? MOMENTUM_SCORING.postEvent.fourWinsNextFive
      : nextWins >= 3
        ? MOMENTUM_SCORING.postEvent.threeWinsNextFive
        : 0;
  const contextScore =
    event.contextScore +
    (event.type === "STREAK_BREAKER"
      ? 0
      : brokenStreak >= 5
      ? MOMENTUM_SCORING.context.streakBreak5
      : brokenStreak >= 3
        ? MOMENTUM_SCORING.context.streakBreak3
        : 0) +
    (matchPointSaved(round, event.teamId) ? MOMENTUM_SCORING.context.matchPointSaved : 0) +
    (isOvertime(round.roundNumber) ? MOMENTUM_SCORING.context.overtime : 0) +
    (round.roundNumber === 13 && event.type !== "SIDE_SWITCH_DOMINANCE"
      ? MOMENTUM_SCORING.context.sideSwitchRound
      : 0);
  const postScore =
    (changedDomain ? MOMENTUM_SCORING.postEvent.domainChange : 0) +
    streakBonus +
    Math.min(
      1.4,
      Math.max(0, directionalMomentumDelta) * MOMENTUM_SCORING.postEvent.deltaScale,
    );
  const totalImpactScore =
    event.spectacularityScore +
    contextScore +
    event.economicSwingScore +
    event.individualScore +
    event.objectiveScore +
    postScore;
  const isHighlight =
    event.spectacularityScore >= MOMENTUM_SCORING.thresholds.highlight ||
    event.economicSwingScore >= MOMENTUM_SCORING.economy.semiEcoBeatsFull ||
    event.objectiveScore >= MOMENTUM_SCORING.objective.defuseUnderOne;
  const isTurningPoint =
    totalImpactScore >= MOMENTUM_SCORING.thresholds.turningPoint &&
    (changedDomain ||
      directionalMomentumDelta >= MOMENTUM_SCORING.thresholds.momentumDelta ||
      nextWins >= 3 ||
      event.economicSwingScore >= MOMENTUM_SCORING.economy.ecoBeatsFull ||
      (event.type === "CLUTCH_INFERRED" && event.spectacularityScore >= MOMENTUM_SCORING.clutch.clutch1v3) ||
      (event.type === "EXTREME_DEFUSE" && event.objectiveScore >= MOMENTUM_SCORING.objective.defuseUnderHalf) ||
      matchPointSaved(round, event.teamId) ||
      isOvertime(round.roundNumber));

  return {
    ...event,
    contextScore: Math.round(contextScore * 10) / 10,
    postEventMomentumDelta: momentumDelta,
    totalImpactScore: Math.round(totalImpactScore * 10) / 10,
    isTurningPoint,
    isHighlight,
    confidence:
      event.confidence ??
      (event.missingData?.length ? "medium" : event.playerId || event.economicSwingScore > 0 ? "high" : "low"),
  };
}

export const calculateMomentumEventImpact = evaluatePostEventImpact;

export function detectEconomicSwingEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    const winner = round.winnerTeamId;
    if (!winner) continue;
    const loser = opponentOf(round, winner);
    const winnerEconomy = economyOf(round, winner);
    const loserEconomy = economyOf(round, loser);
    const winnerLoadout = loadoutOf(round, winner);
    const loserLoadout = loadoutOf(round, loser);
    if (winnerLoadout <= 0 || loserLoadout <= 0) continue;
    const diff = winnerLoadout - loserLoadout;
    const nextLoserChanged = nextRoundEconomyChanged(input, round, loser);

    if ((winnerEconomy === "ECO" || winnerEconomy === "SEMIECO") && loserEconomy === "FULL") {
      const type: MomentumEventType = winnerEconomy === "ECO" ? "ECO_WIN" : "SEMIECO_WIN_VS_FULL";
      drafts.push({
        id: roundId(type, round.roundNumber, winner),
        roundNumber: round.roundNumber,
        type,
        teamId: winner,
        title: "Swing económico · Victoria con economía inferior",
        description: `${winnerEconomy} ganó contra FULL rival con ${Math.abs(diff).toLocaleString("es-ES")} menos de loadout.`,
        factualEvidence: [
          `Compra ganadora: ${winnerEconomy}.`,
          "Compra rival: FULL.",
          `Diferencia de loadout: ${diff.toLocaleString("es-ES")}.`,
          nextLoserChanged ? "El rival cambió de tipo de economía en la siguiente ronda." : "No se observa degradación directa de tipo económico rival en la siguiente ronda.",
        ],
        interpretation: "Swing económico validado si precede a racha, cambio de dominio o delta de momentum posterior.",
        spectacularityScore: 0.15,
        contextScore: 0,
        economicSwingScore:
          winnerEconomy === "ECO"
            ? MOMENTUM_SCORING.economy.ecoBeatsFull
            : MOMENTUM_SCORING.economy.semiEcoBeatsFull,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "high",
        economyLink: {
          roundNumber: round.roundNumber,
          teamId: winner,
          realEconomyType: winnerEconomy,
          rivalEconomyType: loserEconomy,
          ownLoadout: winnerLoadout,
          rivalLoadout: loserLoadout,
          loadoutDifference: diff,
          economicEventType: "ECO_WIN",
          momentumDelta: 0,
          causedDomainChange: domainChangeAfter(input.existingMomentum, round.roundNumber, winner),
          explanation: "Victoria con compra inferior frente a FULL rival.",
        },
      });

      drafts.push({
        id: roundId("FULL_LOSS_VS_ECO", round.roundNumber, loser),
        roundNumber: round.roundNumber,
        type: "FULL_LOSS_VS_ECO",
        teamId: loser,
        title: "Oportunidad de mejora económica · FULL perdida",
        description: `FULL perdida contra ${winnerEconomy} rival.`,
        factualEvidence: [
          "El equipo derrotado tenía FULL.",
          `El rival tenía ${winnerEconomy}.`,
          `Diferencia de loadout: ${Math.abs(diff).toLocaleString("es-ES")}.`,
        ],
        interpretation: "La caída económica se informa como asociación con momentum, no como causalidad absoluta.",
        spectacularityScore: 0,
        contextScore: 0,
        economicSwingScore: MOMENTUM_SCORING.economy.fullLostToEco,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "high",
        economyLink: {
          roundNumber: round.roundNumber,
          teamId: loser,
          realEconomyType: loserEconomy,
          rivalEconomyType: winnerEconomy,
          ownLoadout: loserLoadout,
          rivalLoadout: winnerLoadout,
          loadoutDifference: loserLoadout - winnerLoadout,
          economicEventType: "FULL_LOSS_VS_ECO",
          momentumDelta: 0,
          causedDomainChange: domainChangeAfter(input.existingMomentum, round.roundNumber, winner),
          explanation: "FULL perdida contra compra inferior rival.",
        },
      });
    }
  }
  return drafts;
}

export function detectMultikillEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    for (const playerRound of round.playerRounds) {
      if (playerRound.kills < 3) continue;
      const player = getPlayer(input.players, playerRound.playerId);
      if (!player) continue;
      const isAce = playerRound.kills >= 5;
      drafts.push({
        id: roundId(isAce ? "ACE" : "MULTIKILL", round.roundNumber, playerRound.playerId),
        roundNumber: round.roundNumber,
        type: isAce ? "ACE" : "MULTIKILL",
        teamId: player.teamId,
        playerId: playerRound.playerId,
        playerName: player?.playerName,
        agentName: player?.agentName,
        title: `${isAce ? "Jugada más épica" : "Jugada destacada"} · Ronda ${round.roundNumber}`,
        description: `${player?.agentName ?? player?.playerName ?? "Un jugador"} consiguió ${playerRound.kills} bajas en la ronda.`,
        factualEvidence: [
          `${playerRound.kills} kills registrados en la ronda.`,
          round.winnerTeamId === player?.teamId
            ? "Su equipo ganó la ronda."
            : "La acción individual no ganó la ronda por sí sola.",
        ],
        interpretation: "Una multikill solo se marca como punto de inflexión si el tramo posterior confirma cambio observable.",
        spectacularityScore: isAce
          ? MOMENTUM_SCORING.multikill.ace
          : playerRound.kills === 4
            ? MOMENTUM_SCORING.multikill.quad
            : MOMENTUM_SCORING.multikill.triple,
        contextScore: 0,
        economicSwingScore: 0,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "high",
      });
    }
  }
  return drafts;
}

export function detectInferredClutchEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    if (round.kills.length === 0 || !round.winnerTeamId) continue;
    const aliveByTeam = new Map<string, Set<string>>();
    for (const player of input.players) {
      const alive = aliveByTeam.get(player.teamId) ?? new Set<string>();
      alive.add(player.id);
      aliveByTeam.set(player.teamId, alive);
    }
    const candidates = new Map<string, number>();
    const deadPlayers = new Set<string>();
    let reliable =
      (aliveByTeam.get(round.teamAId)?.size ?? 0) >= 5 &&
      (aliveByTeam.get(round.teamBId)?.size ?? 0) >= 5;
    for (const kill of [...round.kills].sort((a, b) => a.timeMs - b.timeMs)) {
      const killer = getPlayer(input.players, kill.killerId);
      const victim = getPlayer(input.players, kill.victimId);
      if (
        !killer ||
        !victim ||
        killer.teamId === victim.teamId ||
        deadPlayers.has(kill.killerId) ||
        deadPlayers.has(kill.victimId)
      ) {
        reliable = false;
        continue;
      }
      const killerAlive = aliveByTeam.get(killer.teamId);
      const victimAlive = aliveByTeam.get(victim.teamId);
      const aliveTeammates = Math.max(0, (killerAlive?.size ?? 0) - 1);
      const aliveEnemies = victimAlive?.size ?? 0;
      if (
        killer.teamId === round.winnerTeamId &&
        aliveTeammates === 0 &&
        aliveEnemies >= 2
      ) {
        candidates.set(killer.id, Math.max(candidates.get(killer.id) ?? 0, aliveEnemies));
      }
      deadPlayers.add(victim.id);
      victimAlive?.delete(victim.id);
    }

    if (!reliable) continue;
    for (const [playerId, enemies] of candidates) {
      const player = getPlayer(input.players, playerId);
      if (!player || !aliveByTeam.get(round.winnerTeamId)?.has(playerId)) continue;
      drafts.push({
        id: roundId("CLUTCH_INFERRED", round.roundNumber, playerId),
        roundNumber: round.roundNumber,
        type: "CLUTCH_INFERRED",
        teamId: player?.teamId ?? round.winnerTeamId,
        playerId,
        playerName: player?.playerName,
        agentName: player?.agentName,
        title: `Evento decisivo · Clutch inferido 1v${enemies}`,
        description: `${player?.agentName ?? player?.playerName ?? "Un jugador"} ganó una situación 1v${enemies} inferida por secuencia de bajas.`,
        factualEvidence: [
          "Reconstrucción basada en kills ordenadas por timestamp.",
          `Situación máxima inferida: 1v${enemies}.`,
          "No existe snapshot completo de HP/vivos, por eso se marca como inferido.",
        ],
        interpretation: "Clutch inferido; no se afirma HP ni estado exacto no almacenado.",
        spectacularityScore:
          enemies >= 4
            ? MOMENTUM_SCORING.clutch.clutch1v4Plus
            : enemies === 3
              ? MOMENTUM_SCORING.clutch.clutch1v3
              : MOMENTUM_SCORING.clutch.clutch1v2,
        contextScore: 0,
        economicSwingScore: 0,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "medium",
        missingData: ["Snapshot completo de vivos/HP no disponible."],
      });
    }
  }
  return drafts;
}

export const detectClutchEvents = detectInferredClutchEvents;

export function detectExtremeDefuseEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    if (!round.bombPlanter || !round.bombDefuser || !round.plantRoundTime || !round.defuseRoundTime) continue;
    const fuseElapsed = round.defuseRoundTime - round.plantRoundTime;
    const remainingMs = SPIKE_FUSE_MS - fuseElapsed;
    if (fuseElapsed <= 0 || fuseElapsed > SPIKE_FUSE_MS || remainingMs > 1000) continue;
    const player = getPlayer(input.players, round.bombDefuser);
    if (player && player.teamId !== round.winnerTeamId) continue;
    drafts.push({
      id: roundId("EXTREME_DEFUSE", round.roundNumber, round.bombDefuser),
      roundNumber: round.roundNumber,
      type: "EXTREME_DEFUSE",
      teamId: player?.teamId ?? round.winnerTeamId,
      playerId: round.bombDefuser,
      playerName: player?.playerName,
      agentName: player?.agentName,
      title: "Control del objetivo · Defuse extremo",
      description: `Defuse verificable con aproximadamente ${(remainingMs / 1000).toFixed(1)} s restantes.`,
      factualEvidence: [
        `Plant registrado en ${Math.round(round.plantRoundTime / 1000)} s.`,
        `Defuse registrado en ${Math.round(round.defuseRoundTime / 1000)} s.`,
        "Cálculo aplicado solo porque ambos timestamps son positivos y plausibles.",
      ],
      interpretation: "Evento objetivo verificable; no se calcula cuando faltan tiempos fiables.",
      spectacularityScore: 0,
      contextScore: 0,
      economicSwingScore: 0,
      individualScore: 0,
      objectiveScore:
        remainingMs <= 200
          ? MOMENTUM_SCORING.objective.defuseUnderHalf
          : MOMENTUM_SCORING.objective.defuseUnderOne,
      confidence: "high",
    });
  }
  return drafts;
}

export function detectObjectiveControlEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    const text = `${round.roundResult ?? ""} ${round.roundCeremony ?? ""}`.toLowerCase();
    const isDefuse =
      Boolean(round.bombDefuser) ||
      text.includes("defuse") ||
      text.includes("defused");
    if (!isDefuse || !round.winnerTeamId) continue;
    drafts.push({
      id: roundId("OBJECTIVE_CONTROL", round.roundNumber, round.winnerTeamId),
      roundNumber: round.roundNumber,
      type: "OBJECTIVE_CONTROL",
      teamId: round.winnerTeamId,
      playerId: round.bombDefuser,
      playerName: getPlayer(input.players, round.bombDefuser)?.playerName,
      agentName: getPlayer(input.players, round.bombDefuser)?.agentName,
      title: "Control del objetivo · Victoria por defuse",
      description: "La ronda se resolvió por defuse verificable o señal de ceremonia.",
      factualEvidence: ["Hay defuser válido o texto de ronda compatible con defuse."],
      interpretation: "Se marca como control de objetivo, no como retake exacto.",
      spectacularityScore: 0,
      contextScore: 0,
      economicSwingScore: 0,
      individualScore: 0,
      objectiveScore: MOMENTUM_SCORING.objective.defuse,
      confidence: round.bombDefuser ? "high" : "medium",
    });
  }
  return drafts;
}

export function detectStreakAndComebackEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    if (!round.winnerTeamId) continue;
    const broken = previousOpponentStreak(input.rounds, round.roundNumber, round.winnerTeamId);
    if (broken >= 3) {
      drafts.push({
        id: roundId("STREAK_BREAKER", round.roundNumber, round.winnerTeamId),
        roundNumber: round.roundNumber,
        type: "STREAK_BREAKER",
        teamId: round.winnerTeamId,
        title: "Punto de inflexión potencial · Ruptura de racha",
        description: `Rompió una racha rival de ${broken} rondas.`,
        factualEvidence: [`Racha rival previa: ${broken} rondas.`, "La secuencia se calcula desde roundResults, no desde teams.roundsWon."],
        interpretation: "Ruptura de racha validada como punto de inflexión solo si el tramo posterior consolida recuperación.",
        spectacularityScore: 0,
        contextScore: broken >= 5 ? MOMENTUM_SCORING.context.streakBreak5 : MOMENTUM_SCORING.context.streakBreak3,
        economicSwingScore: 0,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "high",
      });
    }
    const before = round.scoreBefore ?? {};
    const ownBefore = before[round.winnerTeamId] ?? 0;
    const enemyBefore = before[opponentOf(round, round.winnerTeamId)] ?? 0;
    if (enemyBefore - ownBefore >= 4 && winsInWindow(input.rounds, round.winnerTeamId, round.roundNumber, 5) >= 3) {
      drafts.push({
        id: roundId("COMEBACK_SIGNAL", round.roundNumber, round.winnerTeamId),
        roundNumber: round.roundNumber,
        type: "COMEBACK_SIGNAL",
        teamId: round.winnerTeamId,
        title: "Señal de remontada",
        description: "La ronda inicia o acompaña una recuperación tras desventaja relevante.",
        factualEvidence: [`Desventaja previa: ${ownBefore}-${enemyBefore}.`, "El equipo ganó al menos 3 de las 5 rondas del tramo."],
        interpretation: "Remontada inferida por marcador y resultados posteriores.",
        spectacularityScore: 0,
        contextScore: 0.5,
        economicSwingScore: 0,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "medium",
      });
    }
  }
  return drafts;
}

export const detectStreakBreakEvents = detectStreakAndComebackEvents;

export function detectFirstBloodSwingEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (let i = 0; i <= input.rounds.length - 3; i += 1) {
    const window = input.rounds.slice(i, i + 6);
    for (const teamId of [input.teamAId, input.teamBId]) {
      const firstBloodRounds = window.filter((round) => {
        const firstKill = [...round.kills].sort((a, b) => a.timeMs - b.timeMs)[0];
        const killer = getPlayer(input.players, firstKill?.killerId);
        return killer?.teamId === teamId;
      });
      if (firstBloodRounds.length < 3) continue;
      const wins = window.filter((round) => round.winnerTeamId === teamId).length;
      if (wins < 3 && !domainChangeAfter(input.existingMomentum, window[0].roundNumber, teamId)) continue;
      drafts.push({
        id: roundId("FIRST_BLOOD_SWING", window[0].roundNumber, teamId),
        roundNumber: window[0].roundNumber,
        type: "FIRST_BLOOD_SWING",
        teamId,
        title: "Cambio de dominio · Primeras bajas",
        description: `El equipo consiguió la primera baja en ${firstBloodRounds.length} de ${window.length} rondas del tramo.`,
        factualEvidence: [
          "Las primeras bajas se obtienen por menor timestamp de kill.",
          `${wins}/${window.length} rondas ganadas en el tramo observado.`,
        ],
        interpretation: "Impacto competitivo inferido por relación entre iniciativa y dominio posterior.",
        spectacularityScore: 0,
        contextScore: 0.5,
        economicSwingScore: 0,
        individualScore: 0,
        objectiveScore: 0,
        confidence: "high",
      });
    }
  }
  return drafts;
}

export const detectFirstBloodMomentumEvents = detectFirstBloodSwingEvents;

export function detectSideSwitchDominance(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const firstSecondHalf = input.rounds.find((round) => round.roundNumber === 13);
  if (!firstSecondHalf) return [];
  return [input.teamAId, input.teamBId].flatMap((teamId) => {
    const before = input.rounds.filter((round) => round.roundNumber <= 12);
    const after = input.rounds.filter((round) => round.roundNumber >= 13 && round.roundNumber <= 20);
    const beforeWins = before.filter((round) => round.winnerTeamId === teamId).length;
    const afterWins = after.filter((round) => round.winnerTeamId === teamId).length;
    const beforeRate = beforeWins / Math.max(before.length, 1);
    const afterRate = afterWins / Math.max(after.length, 1);
    if (after.length < 4 || afterWins < Math.ceil(after.length * 0.625) || afterRate - beforeRate < 0.2) {
      return [];
    }
    const side = teamId === firstSecondHalf.teamAId ? firstSecondHalf.teamASide : firstSecondHalf.teamBSide;
    return [{
      id: roundId("SIDE_SWITCH_DOMINANCE", 13, teamId),
      roundNumber: 13,
      type: "SIDE_SWITCH_DOMINANCE" as const,
      teamId,
      title: "Cambio estructural · Cambio de lado",
      description: `Tras el cambio de lado, el equipo ganó ${afterWins} de las primeras ${after.length} rondas del tramo.`,
      factualEvidence: [
        `Primer tramo: ${beforeWins}/${before.length} rondas.`,
        `Tramo tras cambio: ${afterWins}/${after.length} rondas.`,
        `Lado inferido tras cambio: ${side === "attack" ? "ataque" : side === "defense" ? "defensa" : "desconocido"}.`,
      ],
      interpretation: "Cambio observable principalmente colectivo y estructural; no depende de winningTeamRole.",
      spectacularityScore: 0,
      contextScore: MOMENTUM_SCORING.context.sideSwitchRound,
      economicSwingScore: 0,
      individualScore: 0,
      objectiveScore: 0,
      confidence: "medium" as const,
    }];
  });
}

function playerImpact(
  input: AdvancedMomentumInput,
  roundNumber: number,
  round: AdvancedMomentumPlayerRound,
) {
  return (
    input.playerImpacts
      ?.find((entry) => entry.roundNumber === roundNumber)
      ?.players.find((player) => player.playerId === round.playerId)
      ?.totalImpact ?? 0
  );
}

function playerImpactInWindow(
  input: AdvancedMomentumInput,
  playerId: string,
  firstRound: number,
  lastRound: number,
) {
  return (input.playerImpacts ?? [])
    .filter(
      (round) =>
        round.roundNumber >= firstRound && round.roundNumber <= lastRound,
    )
    .reduce(
      (sum, round) =>
        sum +
        (round.players.find((player) => player.playerId === playerId)
          ?.totalImpact ?? 0),
      0,
    );
}

export function detectPlayerActivationEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    for (const current of round.playerRounds) {
      const player = getPlayer(input.players, current.playerId);
      if (!player) continue;
      const teamPlayers = input.players.filter((item) => item.teamId === player.teamId);
      const previousTeamAverage = average(
        teamPlayers.map((candidate) =>
          playerImpactInWindow(
            input,
            candidate.id,
            round.roundNumber - 3,
            round.roundNumber - 1,
          ),
        ),
      );
      const previous = playerImpactInWindow(
        input,
        current.playerId,
        round.roundNumber - 3,
        round.roundNumber - 1,
      );
      const currentImpact = playerImpact(input, round.roundNumber, current);
      const next = playerImpactInWindow(
        input,
        current.playerId,
        round.roundNumber + 1,
        round.roundNumber + 5,
      );
      if (previous >= previousTeamAverage || currentImpact < 1 || next < 1.5) continue;
      if (winsInWindow(input.rounds, player.teamId, round.roundNumber, 5) < 3) continue;
      drafts.push({
        id: roundId("PLAYER_ACTIVATION", round.roundNumber, current.playerId),
        roundNumber: round.roundNumber,
        type: "PLAYER_ACTIVATION",
        teamId: player.teamId,
        playerId: player.id,
        playerName: player.playerName,
        agentName: player.agentName,
        title: "Activación inesperada",
        description: `${player.agentName ?? player.playerName} pasó de impacto inferior a la media del equipo a protagonizar un tramo favorable.`,
        factualEvidence: [
          `Impacto previo: ${Math.round(previous)} vs media de equipo ${Math.round(previousTeamAverage)}.`,
          `Impacto de la ronda: ${Math.round(currentImpact)}.`,
          `Impacto posterior en 5 rondas: ${Math.round(next)}.`,
        ],
        interpretation: "Activación inferida por ventanas antes/después; no usa estadísticas finales como causa.",
        spectacularityScore: current.kills >= 3 ? MOMENTUM_SCORING.multikill.triple : 0,
        contextScore: 0,
        economicSwingScore: 0,
        individualScore: MOMENTUM_SCORING.individual.unexpectedActivation,
        objectiveScore: 0,
        confidence: "medium",
      });
    }
  }
  return drafts;
}

export function detectCarryDropEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const drafts: MomentumEventDraft[] = [];
  for (const round of input.rounds) {
    if (round.roundNumber < 6) continue;
    for (const teamId of [input.teamAId, input.teamBId]) {
      const leaders = input.players
        .filter((player) => player.teamId === teamId)
        .map((player) => ({
          player,
          impact: playerImpactInWindow(
            input,
            player.id,
            round.roundNumber - 5,
            round.roundNumber - 1,
          ),
        }))
        .sort((a, b) => b.impact - a.impact);
      const leader = leaders[0];
      if (!leader || leader.impact < 2) continue;
      const nextWindow = input.rounds
        .filter((entry) => entry.roundNumber >= round.roundNumber && entry.roundNumber < round.roundNumber + 3)
        .flatMap((entry) => entry.playerRounds)
        .filter((entry) => entry.playerId === leader.player.id);
      const firstDeaths = nextWindow.filter((entry) => entry.firstDeath).length;
      const kills = nextWindow.reduce((sum, entry) => sum + entry.kills, 0);
      const losses = input.rounds
        .filter((entry) => entry.roundNumber >= round.roundNumber && entry.roundNumber < round.roundNumber + 3)
        .filter((entry) => entry.winnerTeamId !== teamId).length;
      if (firstDeaths < 2 || kills > 1 || losses < 2) continue;
      drafts.push({
        id: roundId("CARRY_DROP", round.roundNumber, leader.player.id),
        roundNumber: round.roundNumber,
        type: "CARRY_DROP",
        teamId,
        playerId: leader.player.id,
        playerName: leader.player.playerName,
        agentName: leader.player.agentName,
        title: "Caída de impacto",
        description: `${leader.player.agentName ?? leader.player.playerName} lideraba el impacto previo, pero acumuló primeras muertes en el tramo.`,
        factualEvidence: [
          `Impacto previo estimado: ${Math.round(leader.impact)}.`,
          `${firstDeaths} primeras muertes en tres rondas.`,
          `${losses} derrotas del equipo en ese tramo.`,
        ],
        interpretation: "Caída de impacto observable; no representa estado emocional.",
        spectacularityScore: 0,
        contextScore: 0,
        economicSwingScore: 0,
        individualScore: MOMENTUM_SCORING.individual.carryDrop,
        objectiveScore: 0,
        confidence: "medium",
      });
    }
  }
  return drafts;
}

export function detectDuelReversalEvents(input: AdvancedMomentumInput): MomentumEventDraft[] {
  const duelTimeline = new Map<string, { killer: string; victim: string; roundNumber: number }[]>();
  for (const round of input.rounds) {
    for (const kill of round.kills) {
      const killer = getPlayer(input.players, kill.killerId);
      const victim = getPlayer(input.players, kill.victimId);
      if (!killer || !victim || killer.teamId === victim.teamId) continue;
      const key = [killer.id, victim.id].sort().join(":");
      const events = duelTimeline.get(key) ?? [];
      events.push({ killer: killer.id, victim: victim.id, roundNumber: round.roundNumber });
      duelTimeline.set(key, events);
    }
  }
  const drafts: MomentumEventDraft[] = [];
  for (const events of duelTimeline.values()) {
    if (events.length < 6) continue;
    const firstHalf = events.slice(0, Math.floor(events.length / 2));
    const secondHalf = events.slice(Math.floor(events.length / 2));
    const candidates = [...new Set(events.flatMap((event) => [event.killer, event.victim]))];
    for (const playerId of candidates) {
      const earlyWins = firstHalf.filter((event) => event.killer === playerId).length;
      const earlyLosses = firstHalf.filter((event) => event.victim === playerId).length;
      const lateWins = secondHalf.filter((event) => event.killer === playerId).length;
      if (earlyLosses < 3 || earlyWins > 1 || lateWins < 3) continue;
      const player = getPlayer(input.players, playerId);
      if (!player) continue;
      drafts.push({
        id: roundId("DUEL_REVERSAL", secondHalf[0].roundNumber, playerId),
        roundNumber: secondHalf[0].roundNumber,
        type: "DUEL_REVERSAL",
        teamId: player.teamId,
        playerId,
        playerName: player.playerName,
        agentName: player.agentName,
        title: "Cambio de dominio · Inversión de duelo",
        description: `${player.agentName ?? player.playerName} invirtió un enfrentamiento individual repetido.`,
        factualEvidence: [
          `Primer tramo del duelo: ${earlyWins}-${earlyLosses}.`,
          `Segundo tramo: ${lateWins} kills a favor.`,
        ],
        interpretation: "Inversión de rivalidad agregada desde killer/victim; se asocia al momentum si coincide con cambio posterior.",
        spectacularityScore: 0,
        contextScore: 0,
        economicSwingScore: 0,
        individualScore: MOMENTUM_SCORING.individual.duelReversal,
        objectiveScore: 0,
        confidence: "medium",
      });
    }
  }
  return drafts;
}

function eventPriority(event: MomentumEvent) {
  const typePriority: Partial<Record<MomentumEventType, number>> = {
    SIDE_SWITCH_DOMINANCE: 0.35,
    COMEBACK_SIGNAL: 0.35,
    STREAK_BREAKER: 0.25,
    ECO_WIN: 0.2,
    SEMIECO_WIN_VS_FULL: 0.15,
    CLUTCH_INFERRED: 0.15,
    EXTREME_DEFUSE: 0.15,
    PLAYER_ACTIVATION: 0.1,
    CARRY_DROP: 0.1,
    DUEL_REVERSAL: 0.1,
  };
  return event.totalImpactScore + (event.isTurningPoint ? 2 : 0) + (typePriority[event.type] ?? 0);
}

function enrichEconomyLinks(events: MomentumEvent[]): MomentumEvent[] {
  return events.map((event) => {
    if (!event.economyLink) return event;
    return {
      ...event,
      economyLink: {
        ...event.economyLink,
        momentumDelta: event.postEventMomentumDelta,
        explanation: `${event.economyLink.explanation} Se asocia con un cambio posterior de momentum de ${event.postEventMomentumDelta >= 0 ? "+" : ""}${event.postEventMomentumDelta.toFixed(1)}.`,
      },
    };
  });
}

function buildDataQuality(input: AdvancedMomentumInput): AdvancedMomentumResult["dataQuality"] {
  const totalRounds = Math.max(input.rounds.length, 1);
  const killCoverage = input.rounds.filter((round) => round.kills.length > 0).length / totalRounds;
  const economyCoverage =
    input.rounds.filter((round) => round.teamALoadout > 0 && round.teamBLoadout > 0).length /
    totalRounds;
  const completeRoster = input.players.filter((player) =>
    [input.teamAId, input.teamBId].includes(player.teamId),
  ).length >= 10;
  const validKillTimestamps = input.rounds.every((round) =>
    round.kills.every((kill) => Number.isFinite(kill.timeMs) && kill.timeMs >= 0),
  );
  const hasKills = killCoverage > 0;
  const hasEconomy = economyCoverage > 0;
  const hasPlantDefuse = input.rounds.some(
    (round) =>
      Boolean(round.bombPlanter) &&
      Boolean(round.bombDefuser) &&
      (round.plantRoundTime ?? 0) > 0 &&
      (round.defuseRoundTime ?? 0) > (round.plantRoundTime ?? 0),
  );
  const availableSignals = [
    "Secuencia de rondas desde roundResults",
    hasKills ? "Kills con timestamps" : "",
    hasEconomy ? "Economía por equipo y ronda" : "",
    "Lado inferido por teamId y roundNum",
    hasPlantDefuse ? "Plant/defuse con timestamps positivos" : "",
  ].filter(Boolean);
  const unavailableSignals = [
    "winningTeamRole no se usa porque contiene placeholder.",
    "No hay snapshot completo de HP/vivos para clutches exactos.",
    "Retakes exactos no se afirman sin heurística espacial adicional.",
    hasPlantDefuse ? "" : "Defuse extremo no se calcula sin plant/defuse positivos.",
    completeRoster ? "" : "Roster incompleto para inferir situaciones de vivos con fiabilidad.",
    validKillTimestamps ? "" : "Hay timestamps de kills inválidos.",
  ].filter(Boolean);
  const overallConfidence: MomentumConfidence =
    killCoverage >= 0.8 && economyCoverage >= 0.8 && completeRoster && validKillTimestamps
      ? "high"
      : (killCoverage >= 0.4 || economyCoverage >= 0.4) && validKillTimestamps
        ? "medium"
        : "low";
  return {
    availableSignals,
    unavailableSignals,
    overallConfidence,
  };
}

export function buildMomentumNarrative(result: AdvancedMomentumResult): string {
  const turning = result.mainTurningPoint;
  if (turning) {
    const nextText =
      Math.abs(turning.postEventMomentumDelta) >= 0.1
        ? ` El momentum posterior cambió ${turning.postEventMomentumDelta >= 0 ? "+" : ""}${turning.postEventMomentumDelta.toFixed(1)}.`
        : "";
    return `${turning.title}: ${turning.description}${nextText}`;
  }
  const structural = result.sideSwitchImpact ?? result.structuralChanges[0];
  if (structural) {
    return structural.interpretation ?? structural.description;
  }
  if (result.events.length > 0) {
    return "Se detectaron jugadas destacadas, pero ninguna produjo un cambio sostenido de dominio suficiente para marcarla como punto de inflexión.";
  }
  return "No hay señales suficientes para construir una historia de momentum más allá de la curva de rondas.";
}

export function analyzeAdvancedMomentum(input: AdvancedMomentumInput): AdvancedMomentumResult {
  const playerImpacts =
    input.playerImpacts ?? calculateMatchPlayerImpacts(input.rounds, input.players);
  const analysisInput = { ...input, playerImpacts };
  const drafts = [
    ...detectInferredClutchEvents(analysisInput),
    ...detectExtremeDefuseEvents(analysisInput),
    ...detectEconomicSwingEvents(analysisInput),
    ...detectMultikillEvents(analysisInput),
    ...detectStreakAndComebackEvents(analysisInput),
    ...detectFirstBloodSwingEvents(analysisInput),
    ...detectSideSwitchDominance(analysisInput),
    ...detectObjectiveControlEvents(analysisInput),
    ...detectPlayerActivationEvents(analysisInput),
    ...detectCarryDropEvents(analysisInput),
    ...detectDuelReversalEvents(analysisInput),
  ];

  const roundsByNumber = new Map(input.rounds.map((round) => [round.roundNumber, round]));
  const eventMap = new Map<string, MomentumEvent>();
  for (const draft of drafts) {
    const round = roundsByNumber.get(draft.roundNumber);
    if (!round) continue;
    const event = evaluatePostEventImpact(draft, analysisInput, round);
    const existing = eventMap.get(event.id);
    if (!existing || eventPriority(event) > eventPriority(existing)) {
      eventMap.set(event.id, event);
    }
  }

  const events = enrichEconomyLinks([...eventMap.values()]).sort(
    (a, b) => eventPriority(b) - eventPriority(a),
  );
  const mainTurningPoint = events.find((event) => event.isTurningPoint);
  const biggestEconomicSwing = events.find((event) =>
    ["ECO_WIN", "SEMIECO_WIN_VS_FULL", "ECONOMIC_SWING"].includes(event.type),
  );
  const mostEpicPlay = events
    .filter((event) =>
      ["CLUTCH_INFERRED", "ACE", "EXTREME_DEFUSE", "MULTIKILL"].includes(event.type),
    )
    .sort(
      (a, b) =>
        b.spectacularityScore - a.spectacularityScore ||
        b.objectiveScore - a.objectiveScore ||
        b.totalImpactScore - a.totalImpactScore,
    )[0];
  const unexpectedPlayerActivation = events.find((event) => event.type === "PLAYER_ACTIVATION");
  const carryDropEvent = events.find((event) => event.type === "CARRY_DROP");
  const sideSwitchImpact = events.find((event) => event.type === "SIDE_SWITCH_DOMINANCE");
  const structuralChanges = events.filter((event) =>
    ["SIDE_SWITCH_DOMINANCE", "FIRST_BLOOD_SWING", "STREAK_BREAKER", "COMEBACK_SIGNAL", "DUEL_REVERSAL"].includes(event.type),
  );

  const partialResult: AdvancedMomentumResult = {
    existingMomentum: input.existingMomentum,
    rounds: input.rounds,
    playerImpacts,
    events,
    mainTurningPoint,
    biggestEconomicSwing,
    mostEpicPlay,
    unexpectedPlayerActivation,
    carryDropEvent,
    sideSwitchImpact,
    structuralChanges,
    narrativeSummary: "",
    dataQuality: buildDataQuality(input),
  };

  return {
    ...partialResult,
    narrativeSummary: buildMomentumNarrative(partialResult),
  };
}
