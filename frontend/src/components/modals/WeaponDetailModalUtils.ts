import { formatDate } from "../../utils/formatters";
import type { AnalyticsMatch } from "../../types/dashboard";

export type WeaponTimelinePoint = {
  label: string;
  shortLabel: string;
  kills: number;
  deaths: number;
  hsPct: number;
  won: boolean;
};

export type WeaponShotDatum = {
  label: string;
  value: number;
  color: string;
};

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getWeaponEntry(
  match: AnalyticsMatch,
  weaponId: string,
): Record<string, unknown> | null {
  const rows = match.overview?.weapon_stats;
  if (!Array.isArray(rows)) {
    if (rows && typeof rows === "object") {
      const item = (rows as Record<string, Record<string, unknown>>)[weaponId];
      return item && typeof item === "object" ? item : null;
    }
    return null;
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const key = String(item.weapon_id ?? item.key ?? "").trim();
    if (key && key === weaponId) return item;
  }

  return null;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator * 100) / denominator;
}

export function getWeaponModalSampleReliability(rounds: number, kills: number) {
  const sample = rounds || kills;
  if (sample <= 0) return "Sin muestra";
  if (sample <= 10) return "Muestra baja";
  if (sample <= 50) return "Muestra media";
  return "Muestra alta";
}

export function buildWeaponTimeline(
  timeline: Array<WeaponTimelinePoint & { timestamp: number }>,
) {
  return timeline
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)
    .reverse()
    .map((point, index) => ({
      ...point,
      shortLabel: `P${index + 1}`,
    }));
}

export function buildShotDistribution(
  headshots: number,
  bodyshots: number,
  legshots: number,
): WeaponShotDatum[] {
  return [
    { label: "Cabeza", value: headshots, color: "#ff4655" },
    { label: "Cuerpo", value: bodyshots, color: "#ff9d4d" },
    { label: "Piernas", value: legshots, color: "#64a0ff" },
  ];
}

export function calculateWeaponStats(
  analyticsList: AnalyticsMatch[],
  weaponId: string,
) {
  let matchesUsed = 0;
  let wins = 0;
  let rounds = 0;
  let totalRoundsPlayed = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let damageDealt = 0;
  let damageReceived = 0;
  let survivalRounds = 0;
  let loadoutValueTotal = 0;
  let headshots = 0;
  let bodyshots = 0;
  let legshots = 0;

  const timeline: Array<WeaponTimelinePoint & { timestamp: number }> = [];

  for (const match of analyticsList) {
    totalRoundsPlayed += toNumber(match.overview?.rounds);
    const weaponEntry = getWeaponEntry(match, weaponId);
    if (!weaponEntry) continue;

    const roundsUsed = toNumber(weaponEntry.rounds);
    const killsUsed = toNumber(weaponEntry.kills);
    const deathsUsed = toNumber(weaponEntry.deaths);
    const assistsUsed = toNumber(weaponEntry.assists);
    const hasUsage =
      roundsUsed > 0 || killsUsed > 0 || deathsUsed > 0 || assistsUsed > 0;
    if (!hasUsage) continue;

    const headshotsUsed = toNumber(weaponEntry.headshots);
    const bodyshotsUsed = toNumber(weaponEntry.bodyshots);
    const legshotsUsed = toNumber(weaponEntry.legshots);
    const totalShots = headshotsUsed + bodyshotsUsed + legshotsUsed;

    matchesUsed += 1;
    wins += toNumber(weaponEntry.wins);
    rounds += roundsUsed;
    kills += killsUsed;
    deaths += deathsUsed;
    assists += assistsUsed;
    damageDealt += toNumber(weaponEntry.damage_dealt);
    damageReceived += toNumber(weaponEntry.damage_received);
    survivalRounds += toNumber(weaponEntry.survival_rounds);
    loadoutValueTotal += toNumber(weaponEntry.loadout_value_total);
    headshots += headshotsUsed;
    bodyshots += bodyshotsUsed;
    legshots += legshotsUsed;

    const timestamp = toNumber(match.game_start_millis);
    timeline.push({
      timestamp,
      label: formatDate(timestamp),
      shortLabel: "",
      kills: killsUsed,
      deaths: deathsUsed,
      hsPct: pct(headshotsUsed, totalShots),
      won: Boolean(match.won_match),
    });
  }

  const totalShots = headshots + bodyshots + legshots;

  return {
    matchesUsed,
    wins,
    rounds,
    kills,
    deaths,
    assists,
    damageDealt,
    damageReceived,
    survivalRounds,
    loadoutValueTotal,
    headshotPct: pct(headshots, totalShots),
    kd: kills / Math.max(deaths, 1),
    kda: (kills + assists) / Math.max(deaths, 1),
    killsPerRound: kills / Math.max(rounds, 1),
    damagePerRound: damageDealt / Math.max(rounds, 1),
    damageReceivedPerRound: damageReceived / Math.max(rounds, 1),
    survivalRate: pct(survivalRounds, rounds),
    averageLoadoutValue: loadoutValueTotal / Math.max(rounds, 1),
    winRate: pct(wins, rounds),
    pickRatePerRound: pct(rounds, totalRoundsPlayed),
    sampleReliability: getWeaponModalSampleReliability(rounds, kills),
    shotData: buildShotDistribution(headshots, bodyshots, legshots),
    recentTimeline: buildWeaponTimeline(timeline),
  };
}
