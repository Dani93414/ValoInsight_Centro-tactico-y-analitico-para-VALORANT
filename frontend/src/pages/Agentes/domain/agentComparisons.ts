import { formatNumber, formatPercent, normalizeLabel } from "../../../utils/formatters";
import type { RegionAgentStats } from "../../../types/globalStats";
import type { AgentCompareMetric, EnrichedAgent } from "../types";
import { formatNormalizedMetricValue, getNormalizedRegionMetricValue } from "./agentMetricNormalization";

type MetricConfig = {
  key: keyof NonNullable<EnrichedAgent["globalStats"]> | "score" | "tier";
  label: string;
  format: "number" | "percent" | "text";
};

export const compareMetricConfigs: MetricConfig[] = [
  { key: "win_rate", label: "Win Rate", format: "percent" },
  { key: "pick_rate", label: "Pick Rate", format: "percent" },
  { key: "score", label: "Score", format: "number" },
  { key: "tier", label: "Tier", format: "text" },
  { key: "avg_kd", label: "KD medio", format: "number" },
  { key: "avg_kda", label: "KDA medio", format: "number" },
  { key: "avg_acs", label: "ACS medio", format: "number" },
  { key: "avg_adr", label: "ADR medio", format: "number" },
  { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
  { key: "avg_fk_rate", label: "FK Rate", format: "percent" },
  { key: "kast_pct", label: "KAST", format: "percent" },
  { key: "trade_rate", label: "Trade rate", format: "percent" },
  { key: "assist_rate", label: "Assist rate", format: "percent" },
  { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
  { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
];

function getMetricValue(agent: EnrichedAgent, key: MetricConfig["key"]) {
  if (key === "score") return agent.score;
  if (key === "tier") return agent.tier;
  const value = agent.globalStats?.[key];
  return typeof value === "number" ? value : undefined;
}

function formatValue(value: number | string | undefined, format: MetricConfig["format"]) {
  if (typeof value === "string") return value;
  if (value === undefined) return "-";
  if (format === "percent") return formatPercent(value);
  return formatNumber(value, format === "number" ? 1 : 0);
}

export function buildAgentCompareMetrics(
  first: EnrichedAgent,
  second: EnrichedAgent,
  statsByRole: Map<string, RegionAgentStats[]> = new Map(),
  globalStats: RegionAgentStats[] = [],
): AgentCompareMetric[] {
  const firstRoleStats = statsByRole.get(normalizeLabel(first.role.displayName)) ?? [];
  const secondRoleStats = statsByRole.get(normalizeLabel(second.role.displayName)) ?? [];

  return compareMetricConfigs.map((config) => {
    const firstValue = getMetricValue(first, config.key);
    const secondValue = getMetricValue(second, config.key);
    const firstNormalizedValue =
      config.key === "score" || config.key === "tier"
        ? undefined
        : getNormalizedRegionMetricValue(first.globalStats, config.key, firstRoleStats, globalStats);
    const secondNormalizedValue =
      config.key === "score" || config.key === "tier"
        ? undefined
        : getNormalizedRegionMetricValue(second.globalStats, config.key, secondRoleStats, globalStats);
    return {
      key: String(config.key),
      label: config.label,
      firstLabel: formatValue(firstValue, config.format),
      secondLabel: formatValue(secondValue, config.format),
      firstValue: typeof firstValue === "number" ? firstValue : undefined,
      secondValue: typeof secondValue === "number" ? secondValue : undefined,
      firstNormalizedLabel: formatNormalizedMetricValue(firstNormalizedValue, config.format === "text" ? "number" : config.format),
      secondNormalizedLabel: formatNormalizedMetricValue(secondNormalizedValue, config.format === "text" ? "number" : config.format),
      firstNormalizedValue,
      secondNormalizedValue,
    };
  });
}
