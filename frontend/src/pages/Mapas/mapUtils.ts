import type { AnalyticsMatch } from "../../types/dashboard";
import type { MapContent } from "../../types/content";
import type { RegionMapStats } from "../../types/globalStats";
import { normalizeLabel, safeDivide } from "../../utils/formatters";
export { translateValorantCoordinatesToMapPosition } from "./mapCallouts";

export type MapModeGroupKey = "core" | "skirmish" | "tdm" | "training";

export type MapModeGroup = {
  key: MapModeGroupKey;
  label: string;
  sortOrder: number;
};

export const MAP_MODE_GROUPS: MapModeGroup[] = [
  { key: "core", label: "Competitivo", sortOrder: 0 },
  { key: "skirmish", label: "Escaramuza", sortOrder: 1 },
  { key: "tdm", label: "Team Deathmatch", sortOrder: 2 },
  { key: "training", label: "Entrenamiento", sortOrder: 3 },
];

const TDM_NAMES = new Set(["district", "kasbah", "piazza", "drift", "glitch"]);
const SKIRMISH_TERMS = ["escaramuza", "basic training", "poveglia"];
const TRAINING_TERMS = ["entrenamiento", "campo de tiro", "practice", "tutorial", "range"];

export function classifyValorantMapMode(map: Partial<MapContent>): MapModeGroup {
  const fields = [
    map.displayName,
    map.name,
    map.mapUrl,
    map.assetPath,
    map.coordinates,
    map.tacticalDescription,
    map.narrativeDescription,
  ];
  const haystack = normalizeLabel(fields.filter(Boolean).join(" "));
  const displayName = normalizeLabel(map.displayName);

  if (TRAINING_TERMS.some((term) => haystack.includes(term))) {
    return MAP_MODE_GROUPS[3];
  }
  if (TDM_NAMES.has(displayName) || haystack.includes("hurm")) {
    return MAP_MODE_GROUPS[2];
  }
  if (SKIRMISH_TERMS.some((term) => haystack.includes(term))) {
    return MAP_MODE_GROUPS[1];
  }
  return MAP_MODE_GROUPS[0];
}

export function bayesianAdjustedRate(
  rawRate: number | undefined,
  sample: number | undefined,
  priorRate: number | undefined,
  priorWeight: number,
) {
  if (rawRate === undefined || priorRate === undefined) return rawRate;
  const safeSample = Math.max(0, sample ?? 0);
  return ((safeSample * rawRate) + (priorWeight * priorRate)) / (safeSample + priorWeight);
}

export type ComputedMapStats = {
  matches: number;
  playerMatches: number;
  wins: number;
  losses: number;
  rounds: number;
  playerRounds: number;
  roundsWon: number;
  roundsLost: number;
  roundDiff: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  score: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  firstKills: number;
  firstDeaths: number;
  clutchesWon: number;
  clutchOpportunities: number;
  survivalRounds: number;
  roundsWithKast: number;
  plants: number;
  defuses: number;
  winRate?: number;
  teamRoundWinRate?: number;
  attackWinRate?: number;
  defenseWinRate?: number;
  killsPerRound?: number;
  deathsPerRound?: number;
  adr?: number;
  kd?: number;
  acs?: number;
  kastPct?: number;
  survivalRate?: number;
  clutchRate?: number;
  headshotPct?: number;
  adjustedWinRate?: number;
};

function emptyComputedMapStats(): ComputedMapStats {
  return {
    matches: 0,
    playerMatches: 0,
    wins: 0,
    losses: 0,
    rounds: 0,
    playerRounds: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundDiff: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    score: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
    firstKills: 0,
    firstDeaths: 0,
    clutchesWon: 0,
    clutchOpportunities: 0,
    survivalRounds: 0,
    roundsWithKast: 0,
    plants: 0,
    defuses: 0,
  };
}

function finalizeComputedStats(stats: ComputedMapStats, priorRate?: number): ComputedMapStats {
  const shots = stats.headshots + stats.bodyshots + stats.legshots;
  const performanceRounds = stats.playerRounds || stats.rounds;
  const winRateSample = stats.playerMatches || stats.matches;
  stats.losses = Math.max(0, winRateSample - stats.wins);
  stats.roundDiff = stats.roundsWon - stats.roundsLost;
  stats.winRate = winRateSample > 0 ? safeDivide(stats.wins * 100, winRateSample) : stats.winRate;
  stats.killsPerRound = performanceRounds > 0 ? safeDivide(stats.kills, performanceRounds) : undefined;
  stats.deathsPerRound = performanceRounds > 0 ? safeDivide(stats.deaths, performanceRounds) : undefined;
  stats.adr = performanceRounds > 0 ? safeDivide(stats.damageDealt, performanceRounds) : undefined;
  stats.acs = performanceRounds > 0 ? safeDivide(stats.score, performanceRounds) : undefined;
  stats.kd = stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills > 0 ? stats.kills : undefined;
  stats.headshotPct = shots > 0 ? safeDivide(stats.headshots * 100, shots) : undefined;
  stats.survivalRate = performanceRounds > 0
    ? safeDivide(stats.survivalRounds * 100, performanceRounds)
    : stats.survivalRate;
  stats.kastPct = performanceRounds > 0
    ? safeDivide(stats.roundsWithKast * 100, performanceRounds)
    : stats.kastPct;
  stats.clutchRate = stats.clutchOpportunities > 0
    ? safeDivide(stats.clutchesWon * 100, stats.clutchOpportunities)
    : undefined;
  stats.adjustedWinRate = bayesianAdjustedRate(stats.winRate, winRateSample, priorRate, 12);
  return stats;
}

export function regionMapStatsToComputed(
  stats: RegionMapStats | undefined,
  priorRate?: number,
): ComputedMapStats | null {
  if (!stats) return null;
  const attack = stats.sides?.attack;
  const defense = stats.sides?.defense;
  const rounds = Number(stats.map_rounds ?? stats.total_rounds ?? 0);
  const playerRounds = Number(stats.player_rounds ?? stats.total_rounds ?? rounds);
  const roundsWon = Number(stats.team_round_wins ?? attack?.wins ?? 0);
  const roundsLost = Number(stats.team_round_losses ?? Math.max(0, rounds - roundsWon));
  const matches = Number(stats.matches ?? 0);
  const playerMatches = Number(stats.player_matches ?? stats.matches ?? 0);
  return finalizeComputedStats({
    ...emptyComputedMapStats(),
    matches,
    playerMatches,
    rounds,
    playerRounds,
    roundsWon,
    roundsLost,
    roundDiff: roundsWon - roundsLost,
    kills: Number(attack?.kills ?? 0) + Number(defense?.kills ?? 0),
    deaths: Number(attack?.deaths ?? 0) + Number(defense?.deaths ?? 0),
    assists: Number(stats.assists ?? stats.totals?.assists ?? 0),
    clutchesWon: Number(stats.clutches_won ?? 0),
    clutchOpportunities: Number(stats.clutch_opportunities ?? 0),
    survivalRounds: Number(stats.survival_rounds ?? 0),
    roundsWithKast: Number(stats.rounds_with_kast ?? 0),
    damageDealt: Number(stats.averages?.adr ?? 0) * playerRounds,
    score: Number(stats.averages?.acs ?? 0) * playerRounds,
    wins: Number(stats.wins ?? 0),
    winRate: stats.player_win_rate ?? stats.win_rate,
    teamRoundWinRate: stats.team_round_win_rate,
    attackWinRate: attack?.win_rate,
    defenseWinRate: defense?.win_rate,
    adr: stats.averages?.adr,
    acs: stats.averages?.acs,
    kd: stats.averages?.kd_ratio,
    killsPerRound: stats.averages?.kills_per_round,
    deathsPerRound: stats.averages?.deaths_per_round,
    kastPct: stats.kast_pct ?? stats.averages?.kast_pct,
    survivalRate: stats.survival_rate ?? stats.averages?.survival_rate,
    clutchRate: Number(stats.clutch_opportunities ?? 0) > 0
      ? stats.clutch_win_rate ?? stats.averages?.clutch_win_rate
      : undefined,
    headshotPct: stats.averages?.headshot_pct,
  }, priorRate);
}

export function calculatePersonalMapStats(
  analyticsList: AnalyticsMatch[] | undefined,
  map: MapContent | null | undefined,
  filters: { act?: string; rank?: string; agent?: string },
  priorRate?: number,
): ComputedMapStats | null {
  if (!analyticsList || !map) return null;
  const mapId = map.uuid ?? "";
  const mapName = normalizeLabel(map.displayName);
  const stats = emptyComputedMapStats();
  const sideTotals = {
    attack: { rounds: 0, wins: 0 },
    defense: { rounds: 0, wins: 0 },
  };

  analyticsList.forEach((match) => {
    const matchMapName = normalizeLabel(match.map_name);
    const sameMap =
      (mapId && match.map_id === mapId) ||
      (Boolean(matchMapName) && (matchMapName.includes(mapName) || mapName.includes(matchMapName)));
    if (!sameMap) return;
    if (filters.act && filters.act !== "all" && match.season_id !== filters.act) return;
    if (filters.rank && filters.rank !== "all" && String(match.competitive_tier ?? "") !== filters.rank) return;
    if (filters.agent && filters.agent !== "all" && match.agent_id !== filters.agent) return;

    const overview = match.overview ?? {};
    const attack = match.sides?.attack;
    const defense = match.sides?.defense;
    const rounds = Number(overview.rounds ?? match.player_totals_from_match?.rounds_played ?? 0);
    const wins = Number(overview.wins ?? 0);

    stats.matches += 1;
    stats.playerMatches += 1;
    stats.wins += match.won_match ? 1 : 0;
    stats.rounds += rounds;
    stats.playerRounds += rounds;
    stats.roundsWon += wins;
    stats.kills += Number(overview.kills ?? match.player_totals_from_match?.kills ?? 0);
    stats.deaths += Number(overview.deaths ?? match.player_totals_from_match?.deaths ?? 0);
    stats.assists += Number(overview.assists ?? match.player_totals_from_match?.assists ?? 0);
    const overviewRecord = overview as Record<string, unknown>;
    const sideDamageDealt = Number(attack?.damage_dealt ?? 0) + Number(defense?.damage_dealt ?? 0);
    const overviewDamageDealt = Number(
      overviewRecord.damage_dealt ??
      overviewRecord.damageDealt ??
      (typeof overview.adr === "number" && rounds > 0 ? overview.adr * rounds : undefined) ??
      sideDamageDealt,
    );
    stats.damageDealt += Number.isFinite(overviewDamageDealt) ? overviewDamageDealt : 0;
    stats.score += Number(match.player_totals_from_match?.score ?? 0);
    stats.headshots += Number(overview.headshots ?? 0);
    stats.bodyshots += Number(overview.bodyshots ?? 0);
    stats.legshots += Number(overview.legshots ?? 0);
    stats.firstKills += Number(overview.first_kills ?? 0);
    stats.firstDeaths += Number(overview.first_deaths ?? 0);
    stats.clutchesWon += Number(overview.clutches_won ?? 0);
    stats.clutchOpportunities += Number(overview.clutch_opportunities ?? 0);
    stats.survivalRounds += Number(overview.survival_rounds ?? 0);
    stats.roundsWithKast += Number(overview.rounds_with_kast ?? 0);
    stats.kastPct = Number(overview.kast_pct ?? overview.kast ?? stats.kastPct ?? 0) || stats.kastPct;
    stats.plants += Number(overview.plants ?? 0);
    stats.defuses += Number(overview.defuses ?? 0);
    if (attack?.rounds) {
      sideTotals.attack.rounds += Number(attack.rounds);
      sideTotals.attack.wins += Number(attack.wins ?? 0);
    }
    if (defense?.rounds) {
      sideTotals.defense.rounds += Number(defense.rounds);
      sideTotals.defense.wins += Number(defense.wins ?? 0);
    }
  });

  if (stats.matches === 0 && stats.rounds === 0) return null;
  stats.roundsLost = Math.max(0, stats.rounds - stats.roundsWon);
  stats.attackWinRate = sideTotals.attack.rounds > 0
    ? safeDivide(sideTotals.attack.wins * 100, sideTotals.attack.rounds)
    : undefined;
  stats.defenseWinRate = sideTotals.defense.rounds > 0
    ? safeDivide(sideTotals.defense.wins * 100, sideTotals.defense.rounds)
    : undefined;
  stats.teamRoundWinRate = stats.rounds > 0
    ? safeDivide(stats.roundsWon * 100, stats.rounds)
    : undefined;
  return finalizeComputedStats(stats, priorRate);
}

export type RoundTypeShare = {
  key: string;
  label: string;
  wins: number;
  percent: number;
};

export function calculateRoundTypeShares(
  analyticsList: AnalyticsMatch[] | undefined,
  map: MapContent | null | undefined,
  filters: { act?: string; rank?: string; agent?: string } = {},
): RoundTypeShare[] {
  if (!analyticsList || !map) return [];
  const mapName = normalizeLabel(map.displayName);
  const mapId = map.uuid ?? "";
  const totals: Record<string, { label: string; wins: number }> = {};

  analyticsList.forEach((match) => {
    const matchMapName = normalizeLabel(match.map_name);
    const sameMap = (mapId && match.map_id === mapId) ||
      (Boolean(matchMapName) && (matchMapName.includes(mapName) || mapName.includes(matchMapName)));
    if (!sameMap) return;
    if (filters.act && filters.act !== "all" && match.season_id !== filters.act) return;
    if (filters.rank && filters.rank !== "all" && String(match.competitive_tier ?? "") !== filters.rank) return;
    if (filters.agent && filters.agent !== "all" && match.agent_id !== filters.agent) return;
    const overview = (match.overview ?? {}) as Record<string, unknown>;
    const ceremonies = overview.round_ceremonies as Record<string, number> | undefined;
    const ceremonyLabels: Record<string, string> = {
      CeremonyAce: "Ace",
      CeremonyClutch: "Clutch",
      CeremonyDefault: "Normal",
      CeremonyFlawless: "Impecable",
      CeremonyTeamAce: "Team Ace",
      CeremonyThrifty: "Thrifty",
    };
    Object.entries(ceremonies ?? {}).forEach(([key, value]) => {
      const wins = typeof value === "number" && Number.isFinite(value) ? value : 0;
      if (wins <= 0) return;
      totals[key] = totals[key] ?? { label: ceremonyLabels[key] ?? key.replace(/^Ceremony/, ""), wins: 0 };
      totals[key].wins += wins;
    });
  });

  const totalWinsWithRoundCeremony = Object.values(totals).reduce((sum, item) => sum + item.wins, 0);
  if (totalWinsWithRoundCeremony <= 0) return [];
  return Object.entries(totals)
    .map(([key, item]) => ({
      key,
      label: item.label,
      wins: item.wins,
      percent: safeDivide(item.wins * 100, totalWinsWithRoundCeremony),
    }))
    .sort((a, b) => b.percent - a.percent);
}

export function inferSiteCount(map: MapContent | null | undefined) {
  const sites = new Set<string>();
  for (const callout of map?.callouts ?? []) {
    const candidates = [callout.superRegionName, callout.regionName];
    for (const candidate of candidates) {
      const normalized = String(candidate ?? "").trim().toUpperCase();
      const match = normalized.match(/\b([ABC])\b|^([ABC])\s/);
      const site = match?.[1] ?? match?.[2];
      if (site) sites.add(site);
    }
  }
  return sites.size > 0 ? sites.size : undefined;
}
