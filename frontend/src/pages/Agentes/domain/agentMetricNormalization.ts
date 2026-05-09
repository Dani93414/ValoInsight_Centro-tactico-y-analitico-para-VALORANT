import type { RegionAgentStats } from "../../../types/globalStats";
import type { PersonalAgentStats } from "../types";
import { clamp } from "./agentScoring";

type NormalizableMetricKey =
  | "win_rate"
  | "avg_acs"
  | "avg_adr"
  | "avg_kd"
  | "avg_kda"
  | "avg_headshot_pct"
  | "avg_fk_rate"
  | "trade_rate"
  | "kast_pct"
  | "assist_rate"
  | "avg_survival_rate"
  | "avg_clutch_win_rate"
  | "kills_per_round"
  | "deaths_per_round"
  | "assists_per_round"
  | "wins_per_match"
  | "losses_per_match";

export type NormalizationMetricKey = keyof RegionAgentStats | NormalizableMetricKey;

type CohortEntry = {
  rawValue: number;
  sampleSize: number;
};

const priorWeightByMetric: Record<NormalizableMetricKey, number> = {
  avg_kd: 120,
  avg_kda: 120,
  avg_acs: 120,
  avg_adr: 120,
  avg_fk_rate: 120,
  trade_rate: 120,
  kast_pct: 120,
  assist_rate: 120,
  avg_survival_rate: 120,
  avg_clutch_win_rate: 120,
  win_rate: 10,
  avg_headshot_pct: 200,
  kills_per_round: 120,
  deaths_per_round: 120,
  assists_per_round: 120,
  wins_per_match: 10,
  losses_per_match: 10,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRegionMetricValue(stats: RegionAgentStats | undefined, metricKey: NormalizationMetricKey) {
  if (metricKey === "kills_per_round") {
    const rounds = getRoundsFromRegionStats(stats);
    const kills = stats?.totals?.kills;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(kills)
      ? kills / rounds
      : undefined;
  }
  if (metricKey === "deaths_per_round") {
    const rounds = getRoundsFromRegionStats(stats);
    const deaths = stats?.totals?.deaths;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(deaths)
      ? deaths / rounds
      : undefined;
  }
  if (metricKey === "assists_per_round") {
    const rounds = getRoundsFromRegionStats(stats);
    const assists = stats?.totals?.assists;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(assists)
      ? assists / rounds
      : undefined;
  }
  if (metricKey === "wins_per_match") {
    const matches = getMatchSampleFromRegionStats(stats);
    const wins = stats?.wins;
    return isFiniteNumber(matches) && matches > 0 && isFiniteNumber(wins)
      ? wins / matches
      : undefined;
  }
  if (metricKey === "losses_per_match") {
    const matches = getMatchSampleFromRegionStats(stats);
    const wins = stats?.wins;
    return isFiniteNumber(matches) && matches > 0 && isFiniteNumber(wins)
      ? (matches - wins) / matches
      : undefined;
  }
  const value = stats?.[metricKey];
  return isFiniteNumber(value) ? value : undefined;
}

function getRoundsFromRegionStats(stats: RegionAgentStats | undefined) {
  if (isFiniteNumber(stats?.rounds) && stats.rounds > 0) return stats.rounds;
  if (isFiniteNumber(stats?.totals?.rounds) && stats.totals.rounds > 0) return stats.totals.rounds;
  return undefined;
}

function getImpactsFromRegionStats(stats: RegionAgentStats | undefined) {
  const impacts =
    (isFiniteNumber(stats?.totals?.headshots) ? stats.totals.headshots : 0) +
    (isFiniteNumber(stats?.totals?.bodyshots) ? stats.totals.bodyshots : 0) +
    (isFiniteNumber(stats?.totals?.legshots) ? stats.totals.legshots : 0);
  return impacts > 0 ? impacts : undefined;
}

function getMatchSampleFromRegionStats(stats: RegionAgentStats | undefined) {
  const matches = stats?.matches;
  if (isFiniteNumber(matches) && matches > 0) return matches;
  const picks = stats?.picks;
  return isFiniteNumber(picks) && picks > 0 ? picks : undefined;
}

function getSampleSizeFromRegionStats(
  stats: RegionAgentStats | undefined,
  metricKey: NormalizationMetricKey,
) {
  if (metricKey === "wins_per_match" || metricKey === "losses_per_match") {
    return getMatchSampleFromRegionStats(stats);
  }
  if (
    metricKey === "kills_per_round" ||
    metricKey === "deaths_per_round" ||
    metricKey === "assists_per_round"
  ) {
    return getRoundsFromRegionStats(stats) ?? getMatchSampleFromRegionStats(stats);
  }
  if (metricKey === "win_rate") return getMatchSampleFromRegionStats(stats);
  if (metricKey === "avg_headshot_pct") {
    return getImpactsFromRegionStats(stats) ?? getRoundsFromRegionStats(stats) ?? getMatchSampleFromRegionStats(stats);
  }
  if (metricKey === "avg_clutch_win_rate") {
    const clutchOpportunities = stats?.totals?.clutch_opportunities;
    return isFiniteNumber(clutchOpportunities) && clutchOpportunities > 0
      ? clutchOpportunities
      : getMatchSampleFromRegionStats(stats);
  }
  if (metricKey === "trade_rate") {
    const tradeOpportunities = stats?.totals?.trade_opportunities;
    return isFiniteNumber(tradeOpportunities) && tradeOpportunities > 0
      ? tradeOpportunities
      : getRoundsFromRegionStats(stats) ?? getMatchSampleFromRegionStats(stats);
  }
  return getRoundsFromRegionStats(stats) ?? getMatchSampleFromRegionStats(stats);
}

function getSampleSizeFromPersonalStats(
  stats: PersonalAgentStats | null | undefined,
  metricKey: NormalizationMetricKey,
) {
  if (
    metricKey === "kills_per_round" ||
    metricKey === "deaths_per_round" ||
    metricKey === "assists_per_round"
  ) {
    return isFiniteNumber(stats?.rounds) && stats.rounds > 0 ? stats.rounds : undefined;
  }
  if (metricKey === "wins_per_match" || metricKey === "losses_per_match") {
    return isFiniteNumber(stats?.picks) && stats.picks > 0 ? stats.picks : undefined;
  }
  if (metricKey !== "win_rate" && isFiniteNumber(stats?.rounds) && stats.rounds > 0) {
    return stats.rounds;
  }
  return isFiniteNumber(stats?.picks) && stats.picks > 0 ? stats.picks : undefined;
}

function percentileRank(value: number, values: number[]) {
  if (!isFiniteNumber(value) || values.length < 2) return undefined;
  const less = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return ((less + equal * 0.5) / values.length) * 100;
}

export function formatNormalizedMetricValue(
  value: number | undefined,
  format: "number" | "percent",
) {
  if (!isFiniteNumber(value)) return undefined;
  if (format === "percent") return `${clamp(value, 0, 100).toFixed(1)}%`;
  return value.toFixed(2);
}

export function buildAgentMetricCohort(
  metricKey: NormalizationMetricKey,
  primaryCohort: RegionAgentStats[],
  fallbackCohort: RegionAgentStats[],
) {
  const toEntries = (source: RegionAgentStats[]) =>
    source
    .map((stats): CohortEntry | null => {
      const rawValue = getRegionMetricValue(stats, metricKey);
      const sampleSize = getSampleSizeFromRegionStats(stats, metricKey);
      if (rawValue === undefined || sampleSize === undefined || sampleSize <= 0) return null;
      return { rawValue, sampleSize };
    })
    .filter((item): item is CohortEntry => item !== null);

  const primaryEntries = toEntries(primaryCohort);
  if (primaryEntries.length >= 2) return primaryEntries;
  const fallbackEntries = toEntries(fallbackCohort);
  return fallbackEntries.length >= 2 ? fallbackEntries : undefined;
}

export function normalizeAgentMetricWithShrinkage(
  rawValue: number | undefined,
  sampleSize: number | undefined,
  metricKey: NormalizationMetricKey,
  cohortEntries: CohortEntry[] | undefined,
) {
  if (!isFiniteNumber(rawValue) || !isFiniteNumber(sampleSize) || sampleSize <= 0 || !cohortEntries || cohortEntries.length < 2) {
    return undefined;
  }

  const priorWeight = priorWeightByMetric[metricKey as NormalizableMetricKey];
  if (!isFiniteNumber(priorWeight)) return undefined;

  const cohortMean =
    cohortEntries.reduce((acc, entry) => acc + entry.rawValue, 0) / cohortEntries.length;
  if (!isFiniteNumber(cohortMean)) return undefined;

  const adjustedValue =
    (rawValue * sampleSize + cohortMean * priorWeight) / (sampleSize + priorWeight);

  const adjustedCohort = cohortEntries
    .map((entry) => (entry.rawValue * entry.sampleSize + cohortMean * priorWeight) / (entry.sampleSize + priorWeight))
    .filter((value): value is number => isFiniteNumber(value));

  return percentileRank(adjustedValue, adjustedCohort) === undefined ? undefined : adjustedValue;
}

export function buildPersonalComparableStats(
  personalStats: PersonalAgentStats | null | undefined,
  globalStats: RegionAgentStats | undefined,
): RegionAgentStats | undefined {
  if (!personalStats) return undefined;

  return {
    role: globalStats?.role,
    matches: personalStats.picks,
    picks: personalStats.picks,
    rounds: personalStats.rounds,
    wins: personalStats.wins,
    totals: {
      kills: personalStats.kills,
      deaths: personalStats.deaths,
      assists: personalStats.assists,
      rounds: personalStats.rounds,
    },
    win_rate: personalStats.winRate,
    avg_kd: personalStats.avg_kd,
    avg_kda: personalStats.avg_kda,
    avg_acs: personalStats.avg_acs,
    avg_adr: personalStats.avg_adr,
    avg_headshot_pct: personalStats.avg_headshot_pct,
    avg_fk_rate: personalStats.avg_fk_rate,
    trade_rate: personalStats.trade_rate,
    kast_pct: personalStats.kast_pct,
    assist_rate: personalStats.assist_rate,
    avg_survival_rate: personalStats.avg_survival_rate,
    avg_clutch_win_rate: personalStats.avg_clutch_win_rate,
  };
}

export function getNormalizedRegionMetricValue(
  stats: RegionAgentStats | undefined,
  metricKey: NormalizationMetricKey,
  roleStats: RegionAgentStats[],
  globalStats: RegionAgentStats[] = [],
) {
  const rawValue = getRegionMetricValue(stats, metricKey);
  const sampleSize = getSampleSizeFromRegionStats(stats, metricKey);
  const cohort = buildAgentMetricCohort(metricKey, roleStats, globalStats);
  return normalizeAgentMetricWithShrinkage(rawValue, sampleSize, metricKey, cohort);
}

export function getNormalizedPersonalMetricValue(
  personalStats: PersonalAgentStats | null | undefined,
  globalStats: RegionAgentStats | undefined,
  metricKey: NormalizationMetricKey,
  roleStats: RegionAgentStats[],
  globalCohort: RegionAgentStats[] = [],
) {
  const personalComparable = buildPersonalComparableStats(personalStats, globalStats);
  const rawValue = getRegionMetricValue(personalComparable, metricKey);
  const sampleSize = getSampleSizeFromPersonalStats(personalStats, metricKey);
  const cohort = buildAgentMetricCohort(metricKey, roleStats, globalCohort);
  return normalizeAgentMetricWithShrinkage(rawValue, sampleSize, metricKey, cohort);
}
