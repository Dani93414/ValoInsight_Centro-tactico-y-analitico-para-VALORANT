import { formatNumber, formatPercent } from "../../utils/formatters";
import type { RegionWeaponStats } from "../../types/globalStats";
import type { AnalyticsMatch } from "../../types/dashboard";
import { calculateWeaponStats } from "../../components/modals/WeaponDetailModalUtils";
import type {
  PersonalWeaponStats,
  WeaponComparisonMetric,
  WeaponComparisonTone,
  WeaponPersonalComparison,
} from "./types";
import {
  formatNormalizedWeaponMetricValue,
  getNormalizedWeaponMetricValue,
  getWeaponMetricValue,
  type WeaponNormalizationKey,
} from "./weaponMetricNormalization";

function diffTone(diff: number, threshold: number, higherIsBetter = true): WeaponComparisonTone {
  if (Math.abs(diff) < threshold) return "neutral";
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  return isPositive ? "positive" : "improve";
}

function signedNumber(value: number, decimals = 1, suffix = "") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)}${suffix}`;
}

export function getPersonalWeaponSampleReliability(rounds: number, kills: number) {
  const sample = rounds || kills;
  if (sample <= 0) return "Sin muestra";
  if (sample <= 10) return "Baja muestra";
  return "Muestra estable";
}

export function calculatePersonalWeaponStats(
  analyticsList: AnalyticsMatch[] | undefined,
  weaponId?: string | null,
): PersonalWeaponStats | null {
  if (!analyticsList || !weaponId) return null;
  const stats = calculateWeaponStats(analyticsList, weaponId);
  if (stats.matchesUsed <= 0 && stats.rounds <= 0 && stats.kills <= 0) return null;

  return {
    matchesUsed: stats.matchesUsed,
    wins: stats.wins,
    rounds: stats.rounds,
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    damageDealt: stats.damageDealt,
    damageReceived: stats.damageReceived,
    survivalRounds: stats.survivalRounds,
    loadoutValueTotal: stats.loadoutValueTotal,
    headshotPct: stats.headshotPct,
    winRate: stats.winRate,
    survivalRate: stats.survivalRate,
    kd: stats.kd,
    killsPerRound: stats.killsPerRound,
    damagePerRound: stats.damagePerRound,
    damageReceivedPerRound: stats.damageReceivedPerRound,
    averageLoadoutValue: stats.averageLoadoutValue,
    pickRatePerRound: stats.pickRatePerRound,
    sampleReliability: getPersonalWeaponSampleReliability(stats.rounds, stats.kills),
  };
}

function buildPersonalComparableStats(
  stats: PersonalWeaponStats | null,
  globalStats: RegionWeaponStats | undefined,
): RegionWeaponStats | undefined {
  if (!stats) return undefined;
  return {
    weapon_name: globalStats?.weapon_name,
    is_armor: globalStats?.is_armor,
    rounds_equipped: stats.rounds,
    wins: stats.wins,
    win_rate: stats.winRate,
    kills: stats.kills,
    deaths: stats.deaths,
    damage_dealt: stats.damageDealt,
    damage_received: stats.damageReceived,
    survival_rounds: stats.survivalRounds,
    survival_rate: stats.survivalRate,
    loadout_value_total: stats.loadoutValueTotal,
    average_loadout_value: stats.averageLoadoutValue,
    headshot_pct: stats.headshotPct,
    kd_ratio: stats.kd,
    kills_per_round: stats.killsPerRound,
    adr: stats.damagePerRound,
    pick_rate_per_round: stats.pickRatePerRound,
    damage_received_per_round: stats.damageReceivedPerRound,
  };
}

function buildMetric(
  key: WeaponComparisonMetric["key"],
  label: string,
  metricKey: WeaponNormalizationKey,
  globalStats: RegionWeaponStats | undefined,
  personalComparable: RegionWeaponStats | undefined,
  cohort: RegionWeaponStats[],
  options: {
    format: "number" | "percent";
    decimals?: number;
    threshold: number;
    higherIsBetter?: boolean;
    disableNormalization?: boolean;
    disableDiff?: boolean;
  },
): WeaponComparisonMetric | null {
  const personalValue = getWeaponMetricValue(personalComparable, metricKey);
  if (personalValue === undefined) return null;
  const globalValue = getWeaponMetricValue(globalStats, metricKey);
  const formatValue = (value: number | undefined) =>
    value === undefined
      ? "Sin referencia"
      : options.format === "percent"
        ? formatPercent(value, options.decimals ?? 1)
        : formatNumber(value, options.decimals ?? 2);

  const globalNormalizedValue = options.disableNormalization
    ? undefined
    : getNormalizedWeaponMetricValue(globalStats, metricKey, cohort);
  const personalNormalizedValue = options.disableNormalization
    ? undefined
    : getNormalizedWeaponMetricValue(personalComparable, metricKey, cohort);
  const diff =
    options.disableDiff || globalValue === undefined ? undefined : personalValue - globalValue;
  const normalizedDiff =
    globalNormalizedValue === undefined || personalNormalizedValue === undefined
      ? undefined
      : personalNormalizedValue - globalNormalizedValue;
  const tone = diff === undefined ? "neutral" : diffTone(diff, options.threshold, options.higherIsBetter ?? true);

  return {
    key,
    label,
    globalLabel: formatValue(globalValue),
    personalLabel: formatValue(personalValue),
    diffLabel:
      options.disableDiff
        ? "-"
        : diff === undefined
        ? "Sin referencia"
        : options.format === "percent"
          ? signedNumber(diff, options.decimals ?? 1, " pts")
          : signedNumber(diff, options.decimals ?? 2),
    globalNormalizedLabel: formatNormalizedWeaponMetricValue(globalNormalizedValue, options.format),
    personalNormalizedLabel: formatNormalizedWeaponMetricValue(personalNormalizedValue, options.format),
    normalizedDiffLabel:
      normalizedDiff === undefined
        ? undefined
        : options.format === "percent"
          ? signedNumber(normalizedDiff, options.decimals ?? 1, " pts")
          : signedNumber(normalizedDiff, options.decimals ?? 2),
    diff,
    normalizedDiff,
    tone,
    feedback: "",
  };
}

export function buildWeaponComparisonFeedback(metrics: WeaponComparisonMetric[], sample: string) {
  if (sample === "Baja muestra") {
    return "Baja muestra: la comparación usa ajuste bayesiano para evitar lecturas agresivas.";
  }
  const positive = metrics.filter((metric) => metric.tone === "positive").length;
  const improve = metrics.filter((metric) => metric.tone === "improve").length;
  if (positive >= 2 && positive > improve) return "Tu rendimiento esta por encima de varias referencias globales.";
  if (improve >= 2 && improve > positive) return "Hay margen de mejora frente a la referencia global.";
  return "Tu rendimiento esta alineado con la referencia global.";
}

export function compareWeaponStats(
  globalStats: RegionWeaponStats | undefined,
  personalStats: PersonalWeaponStats | null,
  cohort: RegionWeaponStats[] = [],
  isShield = false,
  totalRoundsReference?: number,
): WeaponPersonalComparison {
  if (!personalStats) {
    return {
      hasSession: true,
      isLoading: false,
      isError: false,
      hasPersonalUsage: false,
      hasGlobalReference: Boolean(globalStats),
      sampleReliability: "Sin muestra",
      summary: "Aun no tienes uso registrado con esta arma.",
      metrics: [],
    };
  }

  const personalComparable = buildPersonalComparableStats(personalStats, globalStats);
  const globalComparable: RegionWeaponStats | undefined =
    globalStats && totalRoundsReference && totalRoundsReference > 0
      ? {
          ...globalStats,
          pick_rate_per_round: ((globalStats.rounds_equipped ?? 0) * 100) / totalRoundsReference,
        }
      : globalStats;
  const comparableCohort =
    totalRoundsReference && totalRoundsReference > 0
      ? cohort.map((entry) => ({
          ...entry,
          pick_rate_per_round: ((entry.rounds_equipped ?? 0) * 100) / totalRoundsReference,
        }))
      : cohort;

  const offensiveMetrics = [
    buildMetric("rounds", "Rondas equipada", "rounds_equipped", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 0,
      threshold: 5,
      disableNormalization: true,
      disableDiff: true,
    }),
    buildMetric("kills", "Kills", "kills", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 0,
      threshold: 1,
      disableNormalization: true,
      disableDiff: true,
    }),
    buildMetric("killsPerRound", "Kills / ronda", "kills_per_round", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 2,
      threshold: 0.05,
    }),
    buildMetric("kd", "KD", "kd_ratio", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 2,
      threshold: 0.1,
    }),
    buildMetric("damagePerRound", "Daño / ronda", "adr", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 1,
      threshold: 5,
    }),
    buildMetric("headshot", "Headshot %", "headshot_pct", globalComparable, personalComparable, comparableCohort, {
      format: "percent",
      decimals: 1,
      threshold: 5,
    }),
    buildMetric("winRate", "Win rate", "win_rate", globalComparable, personalComparable, comparableCohort, {
      format: "percent",
      decimals: 1,
      threshold: 5,
    }),
    buildMetric("pickRatePerRound", "Pick rate %", "pick_rate_per_round", globalComparable, personalComparable, comparableCohort, {
      format: "percent",
      decimals: 1,
      threshold: 3,
    }),
  ];

  const shieldMetrics = [
    buildMetric("rounds", "Rondas equipado", "rounds_equipped", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 0,
      threshold: 5,
      disableNormalization: true,
      disableDiff: true,
    }),
    buildMetric("winRate", "Win rate", "win_rate", globalComparable, personalComparable, comparableCohort, {
      format: "percent",
      decimals: 1,
      threshold: 5,
    }),
    buildMetric("deaths", "Deaths", "deaths", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 0,
      threshold: 1,
      higherIsBetter: false,
    }),
    buildMetric("survivalRate", "Supervivencia", "survival_rate", globalComparable, personalComparable, comparableCohort, {
      format: "percent",
      decimals: 1,
      threshold: 5,
    }),
    buildMetric("damageReceivedPerRound", "Daño recibido / ronda", "damage_received_per_round", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 1,
      threshold: 5,
      higherIsBetter: false,
    }),
    buildMetric("averageLoadoutValue", "Loadout value medio", "average_loadout_value", globalComparable, personalComparable, comparableCohort, {
      format: "number",
      decimals: 0,
      threshold: 100,
    }),
  ];

  const metrics = (isShield ? shieldMetrics : offensiveMetrics).filter(
    (metric): metric is WeaponComparisonMetric => Boolean(metric),
  );

  return {
    hasSession: true,
    isLoading: false,
    isError: false,
    hasPersonalUsage: true,
    hasGlobalReference: Boolean(globalStats),
    sampleReliability: personalStats.sampleReliability,
    summary: buildWeaponComparisonFeedback(metrics, personalStats.sampleReliability),
    metrics,
  };
}
