import type { RegionWeaponStats } from "../../types/globalStats";

export type WeaponNormalizationKey =
  | "rounds_equipped"
  | "kills"
  | "kills_per_round"
  | "kd_ratio"
  | "adr"
  | "headshot_pct"
  | "win_rate"
  | "pick_rate_per_round"
  | "deaths"
  | "survival_rate"
  | "damage_received_per_round"
  | "average_loadout_value";

type CohortEntry = {
  rawValue: number;
  sampleSize: number;
};

const priorWeightByMetric: Record<WeaponNormalizationKey, number> = {
  rounds_equipped: 30,
  kills: 30,
  kills_per_round: 120,
  kd_ratio: 120,
  adr: 120,
  headshot_pct: 200,
  win_rate: 30,
  pick_rate_per_round: 120,
  deaths: 30,
  survival_rate: 120,
  damage_received_per_round: 120,
  average_loadout_value: 120,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getWeaponMetricValue(
  stats: RegionWeaponStats | undefined,
  key: WeaponNormalizationKey,
) {
  const rounds = stats?.rounds_equipped;
  if (key === "rounds_equipped") return isFiniteNumber(rounds) ? rounds : undefined;
  if (key === "kills_per_round") {
    const kills = stats?.kills;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(kills) ? kills / rounds : undefined;
  }
  if (key === "kd_ratio") {
    if (isFiniteNumber(stats?.kd_ratio)) return stats.kd_ratio;
    const kills = stats?.kills;
    const deaths = stats?.deaths;
    return isFiniteNumber(kills) && isFiniteNumber(deaths) ? kills / Math.max(deaths, 1) : undefined;
  }
  if (key === "adr") {
    if (isFiniteNumber(stats?.adr)) return stats.adr;
    const damage = stats?.damage_dealt;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(damage) ? damage / rounds : undefined;
  }
  if (key === "damage_received_per_round") {
    if (isFiniteNumber(stats?.damage_received_per_round)) return stats.damage_received_per_round;
    const received = stats?.damage_received;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(received) ? received / rounds : undefined;
  }
  if (key === "pick_rate_per_round") {
    const value = (stats as RegionWeaponStats & { pick_rate_per_round?: number })?.pick_rate_per_round;
    return isFiniteNumber(value) ? value : undefined;
  }
  if (key === "average_loadout_value") {
    if (isFiniteNumber(stats?.average_loadout_value)) return stats.average_loadout_value;
    const loadout = stats?.loadout_value_total;
    return isFiniteNumber(rounds) && rounds > 0 && isFiniteNumber(loadout) ? loadout / rounds : undefined;
  }
  const value = stats?.[key];
  return isFiniteNumber(value) ? value : undefined;
}

function getSampleSize(stats: RegionWeaponStats | undefined, key: WeaponNormalizationKey) {
  if (!stats) return undefined;
  if (key === "headshot_pct") {
    const shots = (stats.headshots ?? 0) + 0;
    return shots > 0 ? shots : stats.rounds_equipped;
  }
  return stats.rounds_equipped ?? stats.kills;
}

function percentileRank(value: number, values: number[]) {
  if (!isFiniteNumber(value) || values.length < 2) return undefined;
  const less = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return ((less + equal * 0.5) / values.length) * 100;
}

export function buildWeaponMetricCohort(
  key: WeaponNormalizationKey,
  cohort: RegionWeaponStats[],
) {
  const entries = cohort
    .map((stats): CohortEntry | null => {
      const rawValue = getWeaponMetricValue(stats, key);
      const sampleSize = getSampleSize(stats, key);
      if (!isFiniteNumber(rawValue) || !isFiniteNumber(sampleSize) || sampleSize <= 0) return null;
      return { rawValue, sampleSize };
    })
    .filter((item): item is CohortEntry => item !== null);
  return entries.length >= 2 ? entries : undefined;
}

export function normalizeWeaponMetricWithShrinkage(
  rawValue: number | undefined,
  sampleSize: number | undefined,
  key: WeaponNormalizationKey,
  cohortEntries: CohortEntry[] | undefined,
) {
  if (!isFiniteNumber(rawValue) || !isFiniteNumber(sampleSize) || sampleSize <= 0 || !cohortEntries) {
    return undefined;
  }
  const priorWeight = priorWeightByMetric[key];
  const cohortMean = cohortEntries.reduce((acc, entry) => acc + entry.rawValue, 0) / cohortEntries.length;
  const adjustedValue = (rawValue * sampleSize + cohortMean * priorWeight) / (sampleSize + priorWeight);
  const adjustedCohort = cohortEntries.map(
    (entry) => (entry.rawValue * entry.sampleSize + cohortMean * priorWeight) / (entry.sampleSize + priorWeight),
  );
  return percentileRank(adjustedValue, adjustedCohort) === undefined ? undefined : adjustedValue;
}

export function getNormalizedWeaponMetricValue(
  stats: RegionWeaponStats | undefined,
  key: WeaponNormalizationKey,
  cohort: RegionWeaponStats[],
) {
  const rawValue = getWeaponMetricValue(stats, key);
  const sampleSize = getSampleSize(stats, key);
  return normalizeWeaponMetricWithShrinkage(rawValue, sampleSize, key, buildWeaponMetricCohort(key, cohort));
}

export function formatNormalizedWeaponMetricValue(
  value: number | undefined,
  format: "number" | "percent",
) {
  if (!isFiniteNumber(value)) return undefined;
  if (format === "percent") return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
  return value.toFixed(2);
}
