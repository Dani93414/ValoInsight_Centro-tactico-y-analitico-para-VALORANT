import { formatNumber, formatPercent } from "../../../utils/formatters";
import type { AgentCompareMetric, EnrichedAgent } from "../types";

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
): AgentCompareMetric[] {
  return compareMetricConfigs.map((config) => {
    const firstValue = getMetricValue(first, config.key);
    const secondValue = getMetricValue(second, config.key);
    return {
      key: String(config.key),
      label: config.label,
      firstLabel: formatValue(firstValue, config.format),
      secondLabel: formatValue(secondValue, config.format),
      firstValue: typeof firstValue === "number" ? firstValue : undefined,
      secondValue: typeof secondValue === "number" ? secondValue : undefined,
    };
  });
}
