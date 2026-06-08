import { classifyTeamEconomy } from "./economyDecision";

export type PlayerImpactCategory =
  | "combat"
  | "opening"
  | "trade"
  | "clutch"
  | "objective"
  | "economy"
  | "survival"
  | "damage"
  | "utility"
  | "mistake"
  | "context";

export type PlayerImpactMilestone = {
  type: string;
  label: string;
  value: number;
  category: PlayerImpactCategory;
  polarity: "positive" | "negative";
  priority: number;
  metadata?: Record<string, unknown>;
};

export type PlayerRoundImpactBreakdown = {
  playerId: string;
  playerName?: string;
  agentName?: string;
  agentIcon?: string | null;
  teamId?: string;
  totalImpact: number;
  positiveImpact: number;
  negativeImpact: number;
  milestones: PlayerImpactMilestone[];
  kills: number;
  damage: number;
};

export type PlayerImpactPlayer = {
  id: string;
  teamId: string;
  playerName?: string;
  agentName?: string;
  agentIcon?: string | null;
};

export type PlayerImpactKill = {
  killerId: string;
  victimId: string;
  timeMs: number;
  assistants?: string[];
};

export type PlayerImpactRoundStat = {
  playerId: string;
  kills: number;
  assists: number;
  deaths: number;
  damage?: number;
  firstKill?: boolean;
  firstDeath?: boolean;
};

export type PlayerImpactRoundInput = {
  roundNumber: number;
  winnerTeamId: string;
  teamAId: string;
  teamBId: string;
  teamAScore: number;
  teamBScore: number;
  teamALoadout?: number;
  teamBLoadout?: number;
  bombPlanter?: string;
  bombDefuser?: string;
  plantRoundTime?: number;
  defuseRoundTime?: number;
  kills: PlayerImpactKill[];
  playerRounds: PlayerImpactRoundStat[];
};

export type RoundPlayerImpactResult = {
  roundNumber: number;
  players: PlayerRoundImpactBreakdown[];
  teamImpacts: Record<string, number>;
  mvp?: PlayerRoundImpactBreakdown;
  winningTeamInfluencer?: PlayerRoundImpactBreakdown;
  losingTeamInfluencer?: PlayerRoundImpactBreakdown;
  isCritical: boolean;
  hasExtremeEvent: boolean;
};

export const PLAYER_IMPACT_WEIGHTS = {
  kill: 0.25,
  assist: 0.12,
  firstBlood: 0.45,
  firstDeath: -0.35,
  firstDeathTradedCompensation: 0.2,
  immediateTrade: 0.4,
  usefulTrade: 0.2,
  doubleKill: 0.25,
  tripleKill: 0.65,
  quadKill: 1,
  ace: 1.5,
  rapidDouble: 0.2,
  rapidTriple: 0.35,
  clutch1v1: 0.75,
  clutch1v2: 1.2,
  clutch1v3: 1.75,
  clutch1v4: 2.35,
  clutch1v5: 3,
  plant: 0.25,
  plantWin: 0.15,
  plantSurvival: 0.1,
  defuse: 0.45,
  defuseWin: 0.2,
  defuseUnderOneSecond: 0.35,
  defuseUnderPointTwoSeconds: 0.7,
  surviveWin: 0.1,
  noImpactDeath: -0.1,
  ecoKill: 0.15,
  semiEcoKill: 0.1,
  criticalAction: 0.15,
  sideSwitchAction: 0.1,
} as const;

// Caps keep additive milestones readable without allowing ordinary rounds to explode.
export const PLAYER_ROUND_POSITIVE_CAP = 3;
export const PLAYER_ROUND_CRITICAL_POSITIVE_CAP = 4;
export const PLAYER_ROUND_NEGATIVE_CAP = -1;
export const PLAYER_DAMAGE_IMPACT_CAP = 0.6;
export const PLAYER_UTILITY_IMPACT_CAP = 0.6;
export const PLAYER_CONTEXT_IMPACT_CAP = 0.5;
export const ROUND_MVP_MIN_IMPACT = 1;

const SPIKE_FUSE_MS = 45_000;
const IMMEDIATE_TRADE_MS = 3_000;
const USEFUL_TRADE_MS = 7_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function isCriticalRound(round: PlayerImpactRoundInput) {
  const teamAScoreBefore =
    round.teamAScore - (round.winnerTeamId === round.teamAId ? 1 : 0);
  const teamBScoreBefore =
    round.teamBScore - (round.winnerTeamId === round.teamBId ? 1 : 0);
  return (
    round.roundNumber !== 13 &&
    (round.roundNumber >= 25 ||
      Math.max(teamAScoreBefore, teamBScoreBefore) >= 12)
  );
}

function addMilestone(
  milestones: PlayerImpactMilestone[],
  milestone: Omit<PlayerImpactMilestone, "polarity">,
) {
  if (!Number.isFinite(milestone.value) || milestone.value === 0) return;
  milestones.push({
    ...milestone,
    polarity: milestone.value > 0 ? "positive" : "negative",
  });
}

function damageImpact(damage: number) {
  if (damage >= 250) return 0.45;
  if (damage >= 150) return 0.3;
  if (damage >= 100) return 0.15;
  if (damage >= 50) return 0.08;
  return 0;
}

function clutchBonus(enemies: number) {
  if (enemies >= 5) return PLAYER_IMPACT_WEIGHTS.clutch1v5;
  if (enemies === 4) return PLAYER_IMPACT_WEIGHTS.clutch1v4;
  if (enemies === 3) return PLAYER_IMPACT_WEIGHTS.clutch1v3;
  if (enemies === 2) return PLAYER_IMPACT_WEIGHTS.clutch1v2;
  return PLAYER_IMPACT_WEIGHTS.clutch1v1;
}

function detectWonClutches(
  round: PlayerImpactRoundInput,
  players: PlayerImpactPlayer[],
) {
  const teamByPlayer = new Map(players.map((player) => [player.id, player.teamId]));
  const aliveByTeam = new Map<string, Set<string>>();
  for (const player of players) {
    const alive = aliveByTeam.get(player.teamId) ?? new Set<string>();
    alive.add(player.id);
    aliveByTeam.set(player.teamId, alive);
  }

  const clutches = new Map<string, number>();
  for (const kill of [...round.kills].sort((a, b) => a.timeMs - b.timeMs)) {
    const killerTeam = teamByPlayer.get(kill.killerId);
    const victimTeam = teamByPlayer.get(kill.victimId);
    if (!killerTeam || !victimTeam || killerTeam === victimTeam) continue;
    const killerAlive = aliveByTeam.get(killerTeam);
    const victimAlive = aliveByTeam.get(victimTeam);
    const teammatesAlive = Math.max(0, (killerAlive?.size ?? 0) - 1);
    const enemiesAlive = victimAlive?.size ?? 0;
    if (
      killerTeam === round.winnerTeamId &&
      teammatesAlive === 0 &&
      enemiesAlive >= 1
    ) {
      clutches.set(
        kill.killerId,
        Math.max(clutches.get(kill.killerId) ?? 0, enemiesAlive),
      );
    }
    victimAlive?.delete(kill.victimId);
  }
  return clutches;
}

function milestoneTieScore(breakdown: PlayerRoundImpactBreakdown) {
  const has = (type: string) =>
    breakdown.milestones.some((milestone) => milestone.type === type);
  const multikill =
    has("ace") ? 4 : has("quad_kill") ? 3 : has("triple_kill") ? 2 : has("double_kill") ? 1 : 0;
  return (
    (breakdown.milestones.some((milestone) => milestone.type.startsWith("clutch_")) ? 1_000_000 : 0) +
    multikill * 100_000 +
    (has("first_blood") ? 10_000 : 0) +
    (has("defuse") || has("plant") ? 1_000 : 0) +
    breakdown.damage +
    breakdown.negativeImpact * 100
  );
}

function selectInfluencer(breakdowns: PlayerRoundImpactBreakdown[]) {
  return [...breakdowns].sort(
    (a, b) =>
      b.totalImpact - a.totalImpact ||
      milestoneTieScore(b) - milestoneTieScore(a),
  )[0];
}

export function calculateRoundPlayerImpacts(
  round: PlayerImpactRoundInput,
  players: PlayerImpactPlayer[],
): RoundPlayerImpactResult {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const kills = [...round.kills].sort((a, b) => a.timeMs - b.timeMs);
  const firstKill = kills[0];
  const wonClutches = detectWonClutches(round, players);
  const deathByPlayer = new Map(kills.map((kill) => [kill.victimId, kill]));
  const killTimesByPlayer = new Map<string, number[]>();
  for (const kill of kills) {
    const times = killTimesByPlayer.get(kill.killerId) ?? [];
    times.push(kill.timeMs);
    killTimesByPlayer.set(kill.killerId, times);
  }

  const breakdowns = round.playerRounds.map((stat) => {
    const player = playersById.get(stat.playerId);
    const milestones: PlayerImpactMilestone[] = [];
    const playerKills = kills.filter((kill) => kill.killerId === stat.playerId);
    const teamId = player?.teamId;
    const wonRound = Boolean(teamId && teamId === round.winnerTeamId);
    const survived = !deathByPlayer.has(stat.playerId);

    for (const kill of playerKills) {
      addMilestone(milestones, {
        type: "kill",
        label: "Baja",
        value: PLAYER_IMPACT_WEIGHTS.kill,
        category: "combat",
        priority: 30,
        metadata: { victimId: kill.victimId, timeMs: kill.timeMs },
      });

      const victimDeath = [...kills]
        .reverse()
        .find(
          (candidate) => {
            const tradedTeammate = playersById.get(candidate.victimId);
            return (
              candidate.killerId === kill.victimId &&
              tradedTeammate?.teamId === teamId &&
              candidate.timeMs < kill.timeMs &&
              kill.timeMs - candidate.timeMs <= USEFUL_TRADE_MS
            );
          },
        );
      if (victimDeath) {
        const elapsed = kill.timeMs - victimDeath.timeMs;
        addMilestone(milestones, {
          type: elapsed <= IMMEDIATE_TRADE_MS ? "immediate_trade" : "useful_trade",
          label: elapsed <= IMMEDIATE_TRADE_MS ? "Trade inmediato" : "Trade útil",
          value:
            elapsed <= IMMEDIATE_TRADE_MS
              ? PLAYER_IMPACT_WEIGHTS.immediateTrade
              : PLAYER_IMPACT_WEIGHTS.usefulTrade,
          category: "trade",
          priority: 70,
          metadata: { elapsedMs: elapsed, teammateId: victimDeath.victimId },
        });
      }
    }

    if (stat.assists > 0) {
      addMilestone(milestones, {
        type: "assists",
        label: `${stat.assists} ${stat.assists === 1 ? "asistencia" : "asistencias"}`,
        value: Math.min(0.4, stat.assists * PLAYER_IMPACT_WEIGHTS.assist),
        category: "utility",
        priority: 42,
      });
    }

    if (firstKill?.killerId === stat.playerId) {
      addMilestone(milestones, {
        type: "first_blood",
        label: "Primera baja",
        value: PLAYER_IMPACT_WEIGHTS.firstBlood,
        category: "opening",
        priority: 80,
      });
    }
    if (firstKill?.victimId === stat.playerId) {
      addMilestone(milestones, {
        type: "first_death",
        label: "Primera muerte",
        value: PLAYER_IMPACT_WEIGHTS.firstDeath,
        category: "mistake",
        priority: 55,
      });
      const tradedByTeam = kills.find((kill) => {
        const killerTeam = playersById.get(kill.killerId)?.teamId;
        return (
          killerTeam === teamId &&
          kill.victimId === firstKill.killerId &&
          kill.timeMs > firstKill.timeMs &&
          kill.timeMs - firstKill.timeMs <= USEFUL_TRADE_MS
        );
      });
      if (tradedByTeam) {
        addMilestone(milestones, {
          type: "death_traded",
          label: "Muerte tradeada",
          value: PLAYER_IMPACT_WEIGHTS.firstDeathTradedCompensation,
          category: "context",
          priority: 60,
        });
      }
    }

    const multikillValue =
      stat.kills >= 5
        ? PLAYER_IMPACT_WEIGHTS.ace
        : stat.kills === 4
          ? PLAYER_IMPACT_WEIGHTS.quadKill
          : stat.kills === 3
            ? PLAYER_IMPACT_WEIGHTS.tripleKill
            : stat.kills === 2
              ? PLAYER_IMPACT_WEIGHTS.doubleKill
              : 0;
    if (multikillValue > 0) {
      const type =
        stat.kills >= 5
          ? "ace"
          : stat.kills === 4
            ? "quad_kill"
            : stat.kills === 3
              ? "triple_kill"
              : "double_kill";
      addMilestone(milestones, {
        type,
        label: stat.kills >= 5 ? "Ace" : `${stat.kills} bajas`,
        value: multikillValue,
        category: "combat",
        priority: 90 + stat.kills,
      });
    }

    const killTimes = killTimesByPlayer.get(stat.playerId) ?? [];
    if (killTimes.length >= 3 && killTimes[2] - killTimes[0] <= 8_000) {
      addMilestone(milestones, {
        type: "rapid_triple",
        label: "Tres bajas rápidas",
        value: PLAYER_IMPACT_WEIGHTS.rapidTriple,
        category: "combat",
        priority: 75,
      });
    } else if (killTimes.length >= 2 && killTimes[1] - killTimes[0] <= 5_000) {
      addMilestone(milestones, {
        type: "rapid_double",
        label: "Dos bajas rápidas",
        value: PLAYER_IMPACT_WEIGHTS.rapidDouble,
        category: "combat",
        priority: 65,
      });
    }

    const clutchEnemies = wonClutches.get(stat.playerId);
    if (clutchEnemies) {
      addMilestone(milestones, {
        type: `clutch_1v${clutchEnemies}`,
        label: `Clutch inferido 1v${clutchEnemies}`,
        value: clutchBonus(clutchEnemies),
        category: "clutch",
        priority: 120 + clutchEnemies,
        metadata: { enemies: clutchEnemies, inferred: true },
      });
    }

    if (round.bombPlanter === stat.playerId) {
      addMilestone(milestones, {
        type: "plant",
        label: "Plant",
        value: PLAYER_IMPACT_WEIGHTS.plant,
        category: "objective",
        priority: 70,
      });
      if (wonRound) {
        addMilestone(milestones, {
          type: "plant_win",
          label: "Plant convertido en victoria",
          value: PLAYER_IMPACT_WEIGHTS.plantWin,
          category: "objective",
          priority: 72,
        });
      }
      if (survived) {
        addMilestone(milestones, {
          type: "plant_survival",
          label: "Plant y supervivencia",
          value: PLAYER_IMPACT_WEIGHTS.plantSurvival,
          category: "objective",
          priority: 45,
        });
      }
    }

    if (round.bombDefuser === stat.playerId) {
      addMilestone(milestones, {
        type: "defuse",
        label: "Defuse",
        value: PLAYER_IMPACT_WEIGHTS.defuse,
        category: "objective",
        priority: 85,
      });
      if (wonRound) {
        addMilestone(milestones, {
          type: "defuse_win",
          label: "Defuse decisivo",
          value: PLAYER_IMPACT_WEIGHTS.defuseWin,
          category: "objective",
          priority: 88,
        });
      }
      const plantTime = round.plantRoundTime ?? 0;
      const defuseTime = round.defuseRoundTime ?? 0;
      const remainingMs = SPIKE_FUSE_MS - (defuseTime - plantTime);
      if (plantTime > 0 && defuseTime > plantTime && remainingMs >= 0 && remainingMs <= 1_000) {
        addMilestone(milestones, {
          type: remainingMs <= 200 ? "extreme_defuse" : "defuse_under_one",
          label: remainingMs <= 200 ? "Defuse extremo" : "Defuse in extremis",
          value:
            remainingMs <= 200
              ? PLAYER_IMPACT_WEIGHTS.defuseUnderPointTwoSeconds
              : PLAYER_IMPACT_WEIGHTS.defuseUnderOneSecond,
          category: "objective",
          priority: remainingMs <= 200 ? 125 : 105,
          metadata: { remainingMs },
        });
      }
    }

    const damage = Math.max(0, stat.damage ?? 0);
    const damageValue = Math.min(PLAYER_DAMAGE_IMPACT_CAP, damageImpact(damage));
    if (damageValue > 0) {
      addMilestone(milestones, {
        type: "damage",
        label: `${Math.round(damage)} de daño`,
        value: damageValue,
        category: "damage",
        priority: 40,
        metadata: { damage },
      });
    }

    if (wonRound && survived) {
      addMilestone(milestones, {
        type: "survive_win",
        label: "Supervivencia en victoria",
        value: PLAYER_IMPACT_WEIGHTS.surviveWin,
        category: "survival",
        priority: 25,
      });
    } else if (
      stat.deaths > 0 &&
      stat.kills === 0 &&
      damage < 50 &&
      stat.assists === 0 &&
      !stat.firstDeath
    ) {
      addMilestone(milestones, {
        type: "no_impact_death",
        label: "Muerte sin impacto detectable",
        value: PLAYER_IMPACT_WEIGHTS.noImpactDeath,
        category: "mistake",
        priority: 20,
      });
    }

    const ownLoadout =
      teamId === round.teamAId ? round.teamALoadout ?? 0 : round.teamBLoadout ?? 0;
    const hasEconomyData = ownLoadout > 0;
    const economy = hasEconomyData ? classifyTeamEconomy(ownLoadout) : null;
    if (stat.kills > 0 && economy && economy !== "FULL") {
      addMilestone(milestones, {
        type: economy === "ECO" ? "eco_kill" : "semi_eco_kill",
        label: `Impacto con ${economy}`,
        value:
          economy === "ECO"
            ? PLAYER_IMPACT_WEIGHTS.ecoKill
            : PLAYER_IMPACT_WEIGHTS.semiEcoKill,
        category: "economy",
        priority: 50,
      });
    }

    const hasMeaningfulAction = milestones.some(
      (milestone) =>
        milestone.value > 0 &&
        !["damage", "survive_win", "plant_survival"].includes(milestone.type),
    );
    if (hasMeaningfulAction && isCriticalRound(round)) {
      addMilestone(milestones, {
        type: "critical_action",
        label: "Acción en ronda crítica",
        value: PLAYER_IMPACT_WEIGHTS.criticalAction,
        category: "context",
        priority: 35,
      });
    } else if (hasMeaningfulAction && round.roundNumber === 13) {
      addMilestone(milestones, {
        type: "side_switch_action",
        label: "Acción tras cambio de lado",
        value: PLAYER_IMPACT_WEIGHTS.sideSwitchAction,
        category: "context",
        priority: 30,
      });
    }

    const categoryTotals = new Map<PlayerImpactCategory, number>();
    for (const milestone of milestones) {
      categoryTotals.set(
        milestone.category,
        (categoryTotals.get(milestone.category) ?? 0) + milestone.value,
      );
    }
    const cappedMilestones = milestones.map((milestone) => {
      if (milestone.category === "context") {
        const total = categoryTotals.get("context") ?? 0;
        if (total > PLAYER_CONTEXT_IMPACT_CAP) {
          return { ...milestone, value: milestone.value * (PLAYER_CONTEXT_IMPACT_CAP / total) };
        }
      }
      if (milestone.category === "utility") {
        const total = categoryTotals.get("utility") ?? 0;
        if (total > PLAYER_UTILITY_IMPACT_CAP) {
          return { ...milestone, value: milestone.value * (PLAYER_UTILITY_IMPACT_CAP / total) };
        }
      }
      return milestone;
    });
    const positiveImpact = cappedMilestones
      .filter((milestone) => milestone.value > 0)
      .reduce((sum, milestone) => sum + milestone.value, 0);
    const negativeImpact = cappedMilestones
      .filter((milestone) => milestone.value < 0)
      .reduce((sum, milestone) => sum + milestone.value, 0);
    const positiveCap = isCriticalRound(round)
      ? PLAYER_ROUND_CRITICAL_POSITIVE_CAP
      : PLAYER_ROUND_POSITIVE_CAP;
    const totalImpact =
      clamp(positiveImpact, 0, positiveCap) +
      clamp(negativeImpact, PLAYER_ROUND_NEGATIVE_CAP, 0);

    return {
      playerId: stat.playerId,
      playerName: player?.playerName,
      agentName: player?.agentName,
      agentIcon: player?.agentIcon,
      teamId,
      totalImpact: roundTwo(totalImpact),
      positiveImpact: roundTwo(Math.min(positiveImpact, positiveCap)),
      negativeImpact: roundTwo(clamp(negativeImpact, PLAYER_ROUND_NEGATIVE_CAP, 0)),
      milestones: cappedMilestones.sort((a, b) => b.priority - a.priority),
      kills: stat.kills,
      damage,
    };
  });

  const teamImpacts = breakdowns.reduce<Record<string, number>>((totals, player) => {
    if (!player.teamId) return totals;
    totals[player.teamId] = roundTwo((totals[player.teamId] ?? 0) + player.totalImpact);
    return totals;
  }, {});
  const winningPlayers = breakdowns.filter(
    (player) => player.teamId === round.winnerTeamId,
  );
  const losingPlayers = breakdowns.filter(
    (player) => player.teamId && player.teamId !== round.winnerTeamId,
  );
  const topPlayer = selectInfluencer(breakdowns);
  const mvp = topPlayer && topPlayer.totalImpact >= ROUND_MVP_MIN_IMPACT
    ? topPlayer
    : undefined;

  return {
    roundNumber: round.roundNumber,
    players: breakdowns,
    teamImpacts,
    mvp,
    winningTeamInfluencer: selectInfluencer(winningPlayers),
    losingTeamInfluencer: selectInfluencer(losingPlayers),
    isCritical: isCriticalRound(round),
    hasExtremeEvent: breakdowns.some((player) =>
      player.milestones.some(
        (milestone) =>
          milestone.type === "clutch_1v5" ||
          milestone.type === "extreme_defuse" ||
          (milestone.type === "ace" &&
            player.milestones.some((item) => item.type.startsWith("clutch_"))),
      ),
    ),
  };
}

export function calculateMatchPlayerImpacts(
  rounds: PlayerImpactRoundInput[],
  players: PlayerImpactPlayer[],
) {
  return rounds.map((round) => calculateRoundPlayerImpacts(round, players));
}
