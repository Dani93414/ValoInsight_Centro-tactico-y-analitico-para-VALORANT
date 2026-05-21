import type { AnalyticsMatch } from "../../types/dashboard";
import type { MapContent } from "../../types/content";
import type { RegionAgentStats, RegionMapAgentStats, RegionMapCompositionStats, RegionMapWeaponStats, RegionWeaponStats } from "../../types/globalStats";
import { normalizeLabel } from "../../utils/formatters";
import { bayesianAdjustedRate } from "./mapUtils";

export type WeaponMapRow = {
  key: string;
  name: string;
  kills: number;
  rounds: number;
  wins: number;
  hsPct?: number;
  killsPerRound?: number;
  winRate?: number;
  score?: number;
  sampleConfidence?: number;
};

export type CompositionMapRow = {
  key: string;
  agents: string[];
  matches: number;
  wins: number;
  roundsWon: number;
  roundsLost: number;
  hasRoundBreakdown?: boolean;
  winRate?: number;
  score?: number;
  sampleConfidence?: number;
};

export type AgentMapRow = {
  agentId: string;
  name: string;
  matches: number;
  rounds: number;
  winRate: number;
  pickRate?: number;
  kd?: number;
  adr?: number;
  acs?: number;
  score: number;
  sampleConfidence: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalized(value: number | undefined, baseline: number, spread: number) {
  if (!isFiniteNumber(value) || spread <= 0) return 0.5;
  return clamp(0.5 + (value - baseline) / spread);
}

function matchBelongsToMap(match: AnalyticsMatch, map: MapContent | null | undefined) {
  if (!map) return false;
  const mapName = normalizeLabel(map.displayName);
  const matchMapName = normalizeLabel(match.map_name);
  return Boolean(
    (map.uuid && match.map_id === map.uuid) ||
      (matchMapName && (matchMapName.includes(mapName) || mapName.includes(matchMapName))),
  );
}

function matchPassesFilters(match: AnalyticsMatch, filters: { act?: string; rank?: string; agent?: string }) {
  if (filters.act && filters.act !== "all" && match.season_id !== filters.act) return false;
  if (filters.rank && filters.rank !== "all" && String(match.competitive_tier ?? "") !== filters.rank) return false;
  if (filters.agent && filters.agent !== "all" && match.agent_id !== filters.agent) return false;
  return true;
}

export function buildBestWeaponsForMap(
  analyticsList: AnalyticsMatch[] | undefined,
  map: MapContent | null,
  filters: { act?: string; rank?: string; agent?: string },
): WeaponMapRow[] {
  if (!analyticsList || !map) return [];
  const rows = new Map<string, WeaponMapRow & { headshots: number; bodyshots: number; legshots: number }>();
  analyticsList.forEach((match) => {
    if (!matchBelongsToMap(match, map) || !matchPassesFilters(match, filters)) return;
    const weaponStats = match.overview?.weapon_stats;
    const entries = Array.isArray(weaponStats)
      ? weaponStats.map((value, index) => [String((value as { weaponId?: string }).weaponId ?? index), value] as const)
      : Object.entries(weaponStats ?? {});
    entries.forEach(([weaponId, raw]) => {
      const item = raw as Record<string, unknown>;
      if (item.is_armor) return;
      const row = rows.get(weaponId) ?? {
        key: weaponId,
        name: String(item.weapon_name ?? item.weaponName ?? weaponId),
        kills: 0,
        rounds: 0,
        wins: 0,
        headshots: 0,
        bodyshots: 0,
        legshots: 0,
      };
      row.kills += Number(item.kills ?? 0);
      row.rounds += Number(item.rounds ?? item.rounds_equipped ?? 0);
      row.wins += Number(item.wins ?? 0);
      row.headshots += Number(item.headshots ?? 0);
      row.bodyshots += Number(item.bodyshots ?? 0);
      row.legshots += Number(item.legshots ?? 0);
      rows.set(weaponId, row);
    });
  });

  const rawRows = Array.from(rows.values());
  const priorWr = rawRows.length
    ? rawRows.reduce((sum, row) => sum + (row.rounds > 0 ? (row.wins * 100) / row.rounds : 50), 0) / rawRows.length
    : 50;
  const maxRounds = Math.max(...rawRows.map((row) => row.rounds), 1);
  return rawRows
    .map((row) => {
      const shots = row.headshots + row.bodyshots + row.legshots;
      const killsPerRound = row.rounds > 0 ? row.kills / row.rounds : undefined;
      const winRate = row.rounds > 0 ? (row.wins * 100) / row.rounds : undefined;
      const adjustedWinRate = bayesianAdjustedRate(winRate, row.rounds, priorWr, 70) ?? priorWr;
      const combatScore = (
        normalized(killsPerRound, 0.7, 1.4) * 0.65 +
        normalized(shots > 0 ? (row.headshots * 100) / shots : undefined, 22, 40) * 0.35
      ) * 100;
      const useRate = clamp(row.rounds / maxRounds) * 100;
      const sampleConfidence = clamp(row.rounds / 80);
      return {
        ...row,
        killsPerRound,
        hsPct: shots > 0 ? (row.headshots * 100) / shots : undefined,
        winRate,
        score: adjustedWinRate * 0.35 + combatScore * 0.35 + useRate * 0.2 + sampleConfidence * 100 * 0.1,
        sampleConfidence,
      };
    })
    .filter((row) => row.kills > 0 || row.rounds > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.rounds - a.rounds)
    .slice(0, 5);
}

export function buildBestWeaponsFromGlobal(weaponStats: Record<string, RegionWeaponStats | RegionMapWeaponStats> | undefined): WeaponMapRow[] {
  const rows = Object.entries(weaponStats ?? {})
    .filter(([, stats]) => !stats.is_armor)
    .map(([weaponId, stats]) => {
      const killsPerRound = stats.kills_per_round ??
        (stats.rounds_equipped ? Number(stats.kills ?? 0) / Math.max(stats.rounds_equipped, 1) : undefined);
      return {
        key: weaponId,
        name: stats.weapon_name ?? weaponId,
        kills: Number(stats.kills ?? 0),
        rounds: Number(stats.rounds_equipped ?? 0),
        wins: Number(stats.wins ?? 0),
        hsPct: stats.headshot_pct,
        killsPerRound,
        winRate: stats.win_rate ?? stats.round_win_rate,
        score: stats.score,
        sampleConfidence: stats.sample_confidence,
      };
    })
    .filter((row) => row.kills > 0 || row.rounds > 0);
  const priorWr = rows.length ? rows.reduce((sum, row) => sum + (row.winRate ?? 50), 0) / rows.length : 50;
  const maxRounds = Math.max(...rows.map((row) => row.rounds), 1);
  return rows
    .map((row) => {
      const adjustedWinRate = bayesianAdjustedRate(row.winRate, row.rounds, priorWr, 70) ?? priorWr;
      const combatScore = (
        normalized(row.killsPerRound, 0.7, 1.4) * 0.65 +
        normalized(row.hsPct, 22, 40) * 0.35
      ) * 100;
      const useRate = clamp(row.rounds / maxRounds) * 100;
      const sampleConfidence = clamp(row.rounds / 80);
      return {
        ...row,
        score: row.score ?? adjustedWinRate * 0.35 + combatScore * 0.35 + useRate * 0.2 + sampleConfidence * 100 * 0.1,
        sampleConfidence: row.sampleConfidence ?? sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.rounds - a.rounds)
    .slice(0, 5);
}

export function buildBestCompositionsForMap(
  analyticsList: AnalyticsMatch[] | undefined,
  map: MapContent | null,
  filters: { act?: string; rank?: string; agent?: string },
  agentNameById: Map<string, string>,
): CompositionMapRow[] {
  if (!analyticsList || !map) return [];
  const rows = new Map<string, CompositionMapRow>();
  analyticsList.forEach((match) => {
    if (!matchBelongsToMap(match, map) || !matchPassesFilters(match, filters)) return;
    const agentsById = new Map<string, string>();
    (match.team_agents ?? []).forEach((agent) => {
      const id = String(agent.agent_id ?? "").trim();
      if (!id || id === "UNKNOWN") return;
      agentsById.set(id, String(agent.agent_name || id));
    });
    if (agentsById.size !== 5) return;
    const key = Array.from(agentsById.keys()).sort().join("|");
    const row = rows.get(key) ?? {
      key,
      agents: Array.from(agentsById.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, name]) => agentNameById.get(id) ?? name),
      matches: 0,
      wins: 0,
      roundsWon: 0,
      roundsLost: 0,
    };
    row.matches += 1;
    row.wins += match.won_match ? 1 : 0;
    row.roundsWon += Number(match.overview?.wins ?? 0);
    row.roundsLost += Number(match.overview?.losses ?? 0);
    rows.set(key, row);
  });

  const rawRows = Array.from(rows.values());
  const prior = rawRows.length
    ? rawRows.reduce((sum, row) => sum + (row.matches > 0 ? (row.wins * 100) / row.matches : 0), 0) / rawRows.length
    : 50;
  const maxMatches = Math.max(...rawRows.map((row) => row.matches), 1);
  return rawRows
    .map((row) => {
      const winRate = row.matches > 0 ? (row.wins * 100) / row.matches : undefined;
      const adjustedWinRate = bayesianAdjustedRate(winRate, row.matches, prior, 15) ?? prior;
      const playRate = clamp(row.matches / maxMatches) * 100;
      const sampleConfidence = clamp(row.matches / 15);
      return {
        ...row,
        hasRoundBreakdown: true,
        winRate,
        score: adjustedWinRate * 0.65 + playRate * 0.2 + sampleConfidence * 100 * 0.15,
        sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.matches - a.matches)
    .slice(0, 5);
}

export function buildBestCompositionsFromGlobal(rows: RegionMapCompositionStats[] | Record<string, RegionMapCompositionStats> | undefined): CompositionMapRow[] {
  const source = Array.isArray(rows) ? rows : Object.values(rows ?? {});
  const prior = source.length ? source.reduce((sum, row) => sum + Number(row.win_rate ?? 0), 0) / source.length : 50;
  const maxMatches = Math.max(...source.map((row) => Number(row.matches ?? 0)), 1);
  return source
    .map((row) => {
      const matches = Number(row.matches ?? 0);
      const hasRoundBreakdown = row.rounds_won !== undefined || row.rounds_lost !== undefined;
      const adjustedWinRate = bayesianAdjustedRate(row.win_rate, matches, prior, 15) ?? prior;
      const playRate = clamp(matches / maxMatches) * 100;
      const sampleConfidence = clamp(matches / 15);
      return {
        key: row.key ?? (row.agent_ids ?? row.agent_names ?? row.agents ?? []).join("|"),
        agents: row.agents ?? row.agent_names ?? row.agent_ids ?? [],
        matches,
        wins: Number(row.wins ?? 0),
        roundsWon: Number(row.rounds_won ?? row.wins ?? 0),
        roundsLost: Number(row.rounds_lost ?? row.losses ?? 0),
        hasRoundBreakdown,
        winRate: row.win_rate,
        score: row.score ?? adjustedWinRate * 0.65 + playRate * 0.2 + sampleConfidence * 100 * 0.15,
        sampleConfidence: row.sample_confidence ?? sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.matches - a.matches)
    .slice(0, 5);
}

export function getBestAgents(agentStats: Record<string, RegionAgentStats | RegionMapAgentStats> | undefined): AgentMapRow[] {
  const rows = Object.entries(agentStats ?? {}).map(([agentId, stats]) => {
    const raw = stats.win_rate ?? 0;
    const matches = stats.matches ?? stats.matches_played ?? stats.picks ?? 0;
    const rounds = stats.rounds ?? stats.rounds_played ?? stats.totals?.rounds ?? 0;
    const adjustedWinRate = stats.adjusted_win_rate ?? bayesianAdjustedRate(raw, matches, 50, 15) ?? raw;
    const normalizedPerformance = (
      normalized(stats.avg_kd ?? stats.kd, 1, 1.4) * 0.35 +
      normalized(stats.avg_adr ?? stats.adr, 140, 120) * 0.35 +
      normalized(stats.avg_acs ?? stats.acs, 210, 180) * 0.2 +
      normalized(stats.avg_kda ?? stats.kda, 1.4, 1.6) * 0.1
    ) * 100;
    const normalizedPickRate = normalized(stats.pick_rate, 10, 25) * 100;
    const sampleConfidence = stats.sample_confidence ?? clamp(Math.max(matches / 15, rounds / 250));
    const score = stats.score ?? adjustedWinRate * 0.45 + normalizedPerformance * 0.35 + normalizedPickRate * 0.15 + sampleConfidence * 100 * 0.05;
    return {
      agentId,
      name: stats.agent_name ?? "Unknown",
      matches,
      rounds,
      winRate: raw,
      pickRate: stats.pick_rate,
      kd: stats.avg_kd ?? stats.kd,
      adr: stats.avg_adr ?? stats.adr,
      acs: stats.avg_acs ?? stats.acs,
      score,
      sampleConfidence,
    };
  });
  return rows.sort((a, b) => b.score - a.score || b.matches - a.matches).slice(0, 5);
}
