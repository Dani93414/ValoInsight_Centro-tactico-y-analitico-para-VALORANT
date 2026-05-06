import type { RegionAgentStats } from "../../../types/globalStats";
import type { AgentTier, EnrichedAgent } from "../types";

export const clamp = (value: number, min = 0, max = 100) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const safeNumber = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const safeDivide = (num: number, den: number) => (den ? num / den : 0);

export function normalizeRange(value: number | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || max <= min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
}

function pctToUnit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 1 ? value / 100 : value;
}

function pctl(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function robustPercentileRank(
  value: number | undefined,
  values: Array<number | undefined>,
  lowerPercentile = 0.05,
  upperPercentile = 0.95,
) {
  const numericValues = values
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .sort((a, b) => a - b);

  if (typeof value !== "number" || !Number.isFinite(value) || numericValues.length === 0) return 0.5;
  if (numericValues.length === 1) return 0.5;

  const low = pctl(numericValues, lowerPercentile);
  const high = pctl(numericValues, upperPercentile);
  if (high <= low) return 0.5;

  const winsorizedValue = Math.min(high, Math.max(low, value));
  return Math.min(1, Math.max(0, (winsorizedValue - low) / (high - low)));
}

export function adjustedWinRate(winRate: number | undefined, matches: number, minMatches = 100) {
  const asUnit = pctToUnit(winRate);
  if (asUnit === undefined) return 0.5;
  const confidence = Math.min(1, matches / minMatches);
  return 0.5 + (asUnit - 0.5) * confidence;
}

export function confidenceFactor(stats?: Pick<RegionAgentStats, "pick_rate" | "picks" | "matches">) {
  const pickRatePct = safeNumber(stats?.pick_rate);
  const matches = safeNumber(stats?.matches ?? stats?.picks);
  const pickConfidence = Math.min(1, Math.log1p(pickRatePct) / Math.log1p(10));
  const sampleConfidence = Math.min(1, Math.sqrt(matches / 100));
  return 0.65 * sampleConfidence + 0.35 * pickConfidence;
}

export function getScoreConfidence(stats?: RegionAgentStats) {
  return clamp(confidenceFactor(stats) * 100);
}

export type ScoreMetricKey =
  | "winRate"
  | "ACS"
  | "ADR"
  | "KDA"
  | "firstKillRate"
  | "tradeRate"
  | "KAST"
  | "assistRate"
  | "survivalRate"
  | "clutchRate";

type ScoreMetric = {
  key: ScoreMetricKey;
  higherIsBetter?: boolean;
  read: (stats: RegionAgentStats | undefined) => number | undefined;
};

const scoreMetrics: Record<ScoreMetricKey, ScoreMetric> = {
  winRate: {
    key: "winRate",
    read: (stats) => adjustedWinRate(stats?.win_rate, safeNumber(stats?.matches ?? stats?.picks)),
  },
  ACS: { key: "ACS", read: (stats) => stats?.avg_acs },
  ADR: { key: "ADR", read: (stats) => stats?.avg_adr },
  KDA: {
    key: "KDA",
    read: (stats) => {
      if (!stats) return undefined;
      if (typeof stats.avg_kda === "number" && Number.isFinite(stats.avg_kda)) return stats.avg_kda;
      if (!stats.totals) return undefined;
      return safeDivide(
        safeNumber(stats.totals.kills) + safeNumber(stats.totals.assists),
        Math.max(safeNumber(stats.totals.deaths), 1),
      );
    },
  },
  firstKillRate: { key: "firstKillRate", read: (stats) => stats?.avg_fk_rate },
  tradeRate: { key: "tradeRate", read: (stats) => stats?.trade_rate },
  KAST: { key: "KAST", read: (stats) => stats?.kast_pct },
  assistRate: { key: "assistRate", read: (stats) => stats?.assist_rate },
  survivalRate: { key: "survivalRate", read: (stats) => stats?.avg_survival_rate },
  clutchRate: { key: "clutchRate", read: (stats) => stats?.avg_clutch_win_rate },
};

const roleWeights: Record<string, Partial<Record<ScoreMetricKey, number>>> = {
  duelist: {
    winRate: 0.11,
    ACS: 0.19,
    ADR: 0.15,
    KDA: 0.11,
    firstKillRate: 0.19,
    tradeRate: 0.11,
    KAST: 0.08,
    assistRate: 0.04,
    survivalRate: 0.04,
  },
  initiator: {
    winRate: 0.15,
    assistRate: 0.2,
    tradeRate: 0.18,
    KAST: 0.18,
    ADR: 0.1,
    ACS: 0.08,
    firstKillRate: 0.05,
    survivalRate: 0.05,
    KDA: 0.03,
  },
  controller: {
    winRate: 0.21,
    survivalRate: 0.18,
    KAST: 0.16,
    tradeRate: 0.11,
    assistRate: 0.08,
    ADR: 0.05,
    KDA: 0.04,
    ACS: 0.04,
  },
  sentinel: {
    winRate: 0.16,
    survivalRate: 0.19,
    clutchRate: 0.17,
    KDA: 0.14,
    KAST: 0.14,
    tradeRate: 0.07,
    ADR: 0.05,
    ACS: 0.02,
  },
};

function normalizeRole(role?: string) {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized.includes("duel")) return "duelist";
  if (normalized.includes("inicia") || normalized.includes("initiator")) return "initiator";
  if (normalized.includes("control")) return "controller";
  if (normalized.includes("cent") || normalized.includes("sentinel")) return "sentinel";
  return "unknown";
}

function metricValue(stats: RegionAgentStats | undefined, metricKey: ScoreMetricKey) {
  return scoreMetrics[metricKey].read(stats);
}

export function getRoleNormalizedMetric(
  stats: RegionAgentStats | undefined,
  metricKey: ScoreMetricKey,
  roleStats: RegionAgentStats[],
) {
  const metric = scoreMetrics[metricKey];
  const rank = robustPercentileRank(
    metric.read(stats),
    roleStats.map((item) => metric.read(item)),
  );
  return metric.higherIsBetter === false ? 1 - rank : rank;
}

export function calculateAgentScores(agents: EnrichedAgent[]) {
  const statsByRole = new Map<string, RegionAgentStats[]>();
  agents.forEach((agent) => {
    if (!agent.globalStats) return;
    const role = normalizeRole(agent.role.displayName || agent.globalStats.role);
    statsByRole.set(role, [...(statsByRole.get(role) ?? []), agent.globalStats]);
  });

  return new Map(
    agents.map((agent) => {
      const stats = agent.globalStats;
      const role = normalizeRole(agent.role.displayName || stats?.role);
      const weights = roleWeights[role] ?? roleWeights.duelist;
      const roleStats = statsByRole.get(role) ?? [];
      const availableWeights = Object.entries(weights).filter(([key]) => {
        const value = metricValue(stats, key as ScoreMetricKey);
        return typeof value === "number" && Number.isFinite(value);
      }) as Array<[ScoreMetricKey, number]>;
      const weightTotal = availableWeights.reduce((total, [, weight]) => total + weight, 0);
      const rawRoleScore =
        weightTotal > 0
          ? availableWeights.reduce(
              (total, [key, weight]) =>
                total + getRoleNormalizedMetric(stats, key, roleStats) * (weight / weightTotal),
              0,
            )
          : 0.5;
      const confidence = confidenceFactor(stats);
      const confidenceAdjustedScore = rawRoleScore * confidence + 0.5 * (1 - confidence);
      return [agent.uuid ?? agent.id ?? agent.displayName, clamp(confidenceAdjustedScore * 100)];
    }),
  );
}

export function getAgentTier(score: number, lowSample: boolean): AgentTier {
  if (lowSample) return score >= 50 ? "C" : "D";
  if (score >= 75) return "S";
  if (score >= 65) return "A";
  if (score >= 52) return "B";
  if (score >= 40) return "C";
  return "D";
}

export function isLowSample(stats?: RegionAgentStats) {
  return safeNumber(stats?.matches ?? stats?.picks) < 25;
}
