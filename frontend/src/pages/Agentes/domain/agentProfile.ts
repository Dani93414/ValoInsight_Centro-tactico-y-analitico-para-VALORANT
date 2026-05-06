import type { RegionAgentStats } from "../../../types/globalStats";
import type { AgentProfileMetric, EnrichedAgent } from "../types";
import { clamp, getRoleNormalizedMetric, normalizeRange } from "./agentScoring";

const safe = (value: number | undefined, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

function metricSource(
  agent:
    | EnrichedAgent
    | { globalStats?: RegionAgentStats; confidence?: number },
) {
  return agent.globalStats ?? {};
}

export function normalizePercentLike(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clamp(value <= 1 ? value * 100 : value);
}

export function getRoleEntryBaseline(roleName?: string) {
  const normalized = (roleName ?? "").trim().toLowerCase();
  if (normalized.includes("duel")) return 85;
  if (normalized.includes("inicia") || normalized.includes("initiator"))
    return 65;
  if (normalized.includes("cent") || normalized.includes("sentinel")) return 45;
  if (normalized.includes("control")) return 45;
  return 55;
}

export function buildAgentProfileMetrics(
  agent:
    | EnrichedAgent
    | { globalStats?: RegionAgentStats; confidence?: number },
  roleStats: RegionAgentStats[] = [],
): AgentProfileMetric[] {
  const stats = metricSource(agent);
  const roleName = "role" in agent ? agent.role?.displayName : undefined;
  const pickRate = normalizePercentLike(stats.pick_rate) ?? 0;
  const hs = normalizePercentLike(stats.avg_headshot_pct);
  const survival = getRoleNormalizedMetric(stats, "survivalRate", roleStats) * 100;
  const clutch = normalizePercentLike(stats.avg_clutch_win_rate);
  const fkRate = normalizePercentLike(stats.avg_fk_rate);
  const acs = normalizeRange(stats.avg_acs, 120, 300);
  const adr = normalizeRange(stats.avg_adr, 80, 180);
  const kd = normalizeRange(stats.avg_kd, 0.75, 1.5);
  const roleEntryBaseline = getRoleEntryBaseline(roleName);

  // Common Valorant bands: 120-300 ACS, 80-180 ADR and 0.75-1.5 KD keep normal values meaningful.
  const impact = acs * 0.45 + adr * 0.35 + kd * 0.2;
  const entry =
    fkRate === undefined
      ? impact * 0.55 + roleEntryBaseline * 0.45
      : normalizeRange(fkRate, 5, 28) * 0.65 +
        impact * 0.25 +
        roleEntryBaseline * 0.1;
  const consistency = safe(agent.confidence) * 0.7 + pickRate * 0.3;

  return [
    { key: "impact", label: "Impacto", value: clamp(impact) },
    { key: "precision", label: "Precisión", value: normalizeRange(hs, 10, 35) },
    { key: "survival", label: "Supervivencia", value: clamp(survival) },
    { key: "clutch", label: "Clutch", value: clamp(clutch ?? 45) },
    { key: "entry", label: "Entry", value: clamp(entry) },
    { key: "consistency", label: "Consistencia", value: clamp(consistency) },
  ];
}
