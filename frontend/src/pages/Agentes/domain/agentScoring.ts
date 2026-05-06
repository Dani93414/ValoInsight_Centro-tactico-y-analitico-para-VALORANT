import type { RegionAgentStats } from "../../../types/globalStats";
import type { AgentTier } from "../types";

export const clamp = (value: number, min = 0, max = 100) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

function safeNumber(value: number | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeRange(value: number | undefined, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || max <= min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
}

function normalizeAcs(value: number | undefined) {
  // ACS scale: 150 is playable, 220 good, 280+ elite, so the useful range starts above 120.
  return normalizeRange(value, 120, 300);
}

function normalizeKd(value: number | undefined) {
  // KD scale: 0.75 is weak, 1.0 normal, 1.2 good, 1.5 excellent.
  return normalizeRange(value, 0.75, 1.5);
}

export function getScoreConfidence(picks: number | undefined) {
  const sample = safeNumber(picks);
  return clamp(Math.min(1, Math.log10(sample + 1) / Math.log10(1000)) * 100);
}

export function calculateAgentScore(stats?: RegionAgentStats, totalPicks = 0) {
  const confidence = getScoreConfidence(stats?.picks);
  const pickRate =
    typeof stats?.pick_rate === "number" && Number.isFinite(stats.pick_rate)
      ? stats.pick_rate
      : totalPicks > 0
        ? ((stats?.picks ?? 0) / totalPicks) * 100
        : 0;
  const score =
    clamp(safeNumber(stats?.win_rate)) * 0.35 +
    clamp(pickRate) * 0.2 +
    normalizeAcs(stats?.avg_acs) * 0.15 +
    normalizeKd(stats?.avg_kd) * 0.15 +
    confidence * 0.15;

  return clamp(score);
}

export function getAgentTier(score: number, lowSample: boolean): AgentTier {
  if (lowSample) return score >= 50 ? "C" : "D";
  if (score >= 72) return "S";
  if (score >= 62) return "A";
  if (score >= 50) return "B";
  if (score >= 38) return "C";
  return "D";
}

export function isLowSample(picks: number | undefined) {
  return safeNumber(picks) < 25;
}
