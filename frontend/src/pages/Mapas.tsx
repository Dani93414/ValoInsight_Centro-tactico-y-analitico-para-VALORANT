import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAgentes, useGlobalMapStats, useMapas, usePlayerDashboard, useRegions } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import type { AnalyticsMatch } from "../types/dashboard";
import type { MapContent } from "../types/content";
import type {
  GlobalAgentStatsOption,
  RegionAgentStats,
  RegionMapCompositionStats,
  RegionMapStats,
  RegionWeaponStats,
} from "../types/globalStats";
import {
  formatCompactNumber,
  formatNumber,
  formatPercent,
  hideBrokenImage,
  normalizeText,
} from "./contentFormatters";
import {
  bayesianAdjustedRate,
  calculatePersonalMapStats,
  calculateRoundTypeShares,
  classifyValorantMapMode,
  inferSiteCount,
  regionMapStatsToComputed,
  translateValorantCoordinatesToMapPosition,
  type ComputedMapStats,
  type MapModeGroupKey,
} from "./Mapas/mapUtils";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
} from "./contentPageUtils";
import "./ContentPages.css";

const ALL = "all";
const COMPETITIVE = "competitive";

const MODE_OPTIONS = [
  { value: COMPETITIVE, label: "Competitivo" },
  { value: "skirmish", label: "Escaramuza" },
  { value: "tdm", label: "Team Deathmatch" },
  { value: "training", label: "Entrenamiento" },
] as const;

const SORT_OPTIONS = [
  { value: "name", label: "Nombre" },
  { value: "matches", label: "Partidas" },
  { value: "winRate", label: "Winrate" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

type MapEntry = MapContent & {
  groupKey: MapModeGroupKey;
  groupLabel: string;
  groupOrder: number;
  globalStats?: RegionMapStats;
  computedGlobalStats?: ComputedMapStats | null;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ComparisonMetric = {
  key: string;
  label: string;
  globalLabel: string;
  personalLabel: string;
  diffLabel: string;
  globalNormalizedLabel?: string;
  personalNormalizedLabel?: string;
  normalizedDiffLabel?: string;
  diff?: number;
  normalizedDiff?: number;
  higherIsBetter: boolean;
};

type WeaponMapRow = {
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

type CompositionMapRow = {
  key: string;
  agents: string[];
  matches: number;
  wins: number;
  roundsWon: number;
  roundsLost: number;
  winRate?: number;
  score?: number;
  sampleConfidence?: number;
};

type AgentMapRow = {
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

type MapPanelKey =
  | "comparison"
  | "callouts"
  | "roundTypes"
  | "agents"
  | "weapons"
  | "compositions";

function optionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function toSelectOptions(options: GlobalAgentStatsOption[] | undefined, fallback: string): SelectOption[] {
  if (!options || options.length === 0) {
    return [{ value: ALL, label: fallback, disabled: true }];
  }
  return [
    { value: ALL, label: "Todos" },
    ...options.map((option) => ({
      value: option.value,
      label: option.count ? `${option.label} (${option.count})` : option.label,
    })),
  ];
}

function getMapStatsKey(map: MapContent) {
  return map.uuid ?? map.displayName;
}

function isAvailableNumber(value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asCoordinateValue(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : undefined;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalized(value: number | undefined, baseline: number, spread: number) {
  if (!isAvailableNumber(value) || spread <= 0) return 0.5;
  return clamp(0.5 + ((value as number) - baseline) / spread);
}

function formatMaybePercent(value?: number) {
  return isAvailableNumber(value) ? formatPercent(value, 1) : "Sin datos";
}

function formatMaybeNumber(value?: number, digits = 0) {
  return isAvailableNumber(value) ? formatNumber(value, digits) : "Sin datos";
}

function sumRegionMapStats(
  regions: Array<{ totalRounds?: number; mapStats?: Record<string, RegionMapStats> }> | undefined,
  selectedRegion: string,
) {
  type AggregatedRegionMapStats = RegionMapStats & {
    roundsWon?: number;
    kastRateWeight?: number;
    kastRateWeightedSum?: number;
    survivalRateWeight?: number;
    survivalRateWeightedSum?: number;
    clutchRateWeight?: number;
    clutchRateWeightedSum?: number;
  };
  const byId: Record<string, AggregatedRegionMapStats> = {};
  let totalMatches = 0;
  let totalRounds = 0;
  for (const region of regions ?? []) {
    const regionName = String((region as { region?: string }).region ?? "").toLowerCase();
    if (selectedRegion && selectedRegion !== regionName) continue;
    totalRounds += Number(region.totalRounds ?? 0);
    for (const [mapId, stats] of Object.entries(region.mapStats ?? {})) {
      const acc = byId[mapId] ?? {
        map_name: stats.map_name,
        matches: 0,
        total_rounds: 0,
        sides: { attack: {}, defense: {} },
        averages: {},
      };
      const rounds = Number(stats.total_rounds ?? 0);
      const attack = stats.sides?.attack;
      const defense = stats.sides?.defense;
      acc.map_name = acc.map_name ?? stats.map_name;
      acc.matches = Number(acc.matches ?? 0) + Number(stats.matches ?? 0);
      acc.total_rounds = Number(acc.total_rounds ?? 0) + rounds;
      acc.roundsWon = Number(acc.roundsWon ?? 0) + Number(attack?.wins ?? 0) + Number(defense?.wins ?? 0);
      acc.rounds_with_kast = Number(acc.rounds_with_kast ?? 0) + Number(stats.rounds_with_kast ?? 0);
      acc.survival_rounds = Number(acc.survival_rounds ?? 0) + Number(stats.survival_rounds ?? 0);
      acc.clutch_opportunities = Number(acc.clutch_opportunities ?? 0) + Number(stats.clutch_opportunities ?? 0);
      acc.clutches_won = Number(acc.clutches_won ?? 0) + Number(stats.clutches_won ?? 0);
      const kastRate = stats.kast_pct ?? stats.averages?.kast_pct;
      if (isAvailableNumber(kastRate) && rounds > 0) {
        acc.kastRateWeight = Number(acc.kastRateWeight ?? 0) + rounds;
        acc.kastRateWeightedSum = Number(acc.kastRateWeightedSum ?? 0) + (kastRate as number) * rounds;
      }
      const survivalRate = stats.survival_rate ?? stats.averages?.survival_rate;
      if (isAvailableNumber(survivalRate) && rounds > 0) {
        acc.survivalRateWeight = Number(acc.survivalRateWeight ?? 0) + rounds;
        acc.survivalRateWeightedSum = Number(acc.survivalRateWeightedSum ?? 0) + (survivalRate as number) * rounds;
      }
      const clutchRate = stats.clutch_win_rate ?? stats.averages?.clutch_win_rate;
      const clutchWeight = Number(stats.clutch_opportunities ?? 0) || Number(stats.matches ?? 0);
      if (isAvailableNumber(clutchRate) && clutchWeight > 0) {
        acc.clutchRateWeight = Number(acc.clutchRateWeight ?? 0) + clutchWeight;
        acc.clutchRateWeightedSum = Number(acc.clutchRateWeightedSum ?? 0) + (clutchRate as number) * clutchWeight;
      }
      for (const sideName of ["attack", "defense"] as const) {
        const target = acc.sides?.[sideName] ?? {};
        const source = stats.sides?.[sideName] ?? {};
        target.rounds = Number(target.rounds ?? 0) + Number(source.rounds ?? 0);
        target.wins = Number(target.wins ?? 0) + Number(source.wins ?? 0);
        target.kills = Number(target.kills ?? 0) + Number(source.kills ?? 0);
        target.deaths = Number(target.deaths ?? 0) + Number(source.deaths ?? 0);
        target.win_rate = target.rounds ? ((target.wins ?? 0) * 100) / target.rounds : undefined;
        acc.sides = { ...acc.sides, [sideName]: target };
      }
      byId[mapId] = acc;
    }
  }

  Object.values(byId).forEach((stats) => {
    const rounds = Number(stats.total_rounds ?? 0);
    const kills = Number(stats.sides?.attack?.kills ?? 0) + Number(stats.sides?.defense?.kills ?? 0);
    const deaths = Number(stats.sides?.attack?.deaths ?? 0) + Number(stats.sides?.defense?.deaths ?? 0);
    const adr = stats.averages?.adr;
    const acs = stats.averages?.acs;
    const roundsWithKast = Number(stats.rounds_with_kast ?? 0);
    const survivalRounds = Number(stats.survival_rounds ?? 0);
    const clutchOpportunities = Number(stats.clutch_opportunities ?? 0);
    const clutchesWon = Number(stats.clutches_won ?? 0);
    const kastPct = rounds > 0 && roundsWithKast > 0
      ? (roundsWithKast * 100) / rounds
      : stats.kastRateWeight
        ? Number(stats.kastRateWeightedSum ?? 0) / stats.kastRateWeight
        : stats.kast_pct;
    const survivalRate = rounds > 0 && survivalRounds > 0
      ? (survivalRounds * 100) / rounds
      : stats.survivalRateWeight
        ? Number(stats.survivalRateWeightedSum ?? 0) / stats.survivalRateWeight
        : stats.survival_rate;
    const clutchWinRate = clutchOpportunities > 0
      ? (clutchesWon * 100) / clutchOpportunities
      : stats.clutchRateWeight
        ? Number(stats.clutchRateWeightedSum ?? 0) / stats.clutchRateWeight
        : stats.clutch_win_rate;
    stats.kast_pct = kastPct;
    stats.survival_rate = survivalRate;
    stats.clutch_win_rate = clutchWinRate;
    stats.averages = {
      ...stats.averages,
      kd_ratio: deaths > 0 ? kills / deaths : stats.averages?.kd_ratio,
      adr,
      acs,
      kast_pct: kastPct,
      survival_rate: survivalRate,
      clutch_win_rate: clutchWinRate,
    };
    stats.avg_rounds_per_match = stats.matches ? rounds / Math.max(stats.matches * 10, 1) : 0;
    totalMatches += Number(stats.matches ?? 0);
  });

  const mapWinRates = Object.values(byId)
    .map((stats) => {
      const rounds = Number(stats.total_rounds ?? 0);
      return rounds > 0 ? (Number(stats.roundsWon ?? 0) * 100) / rounds : undefined;
    })
    .filter((value): value is number => isAvailableNumber(value));
  const priorWinRate = mapWinRates.length
    ? mapWinRates.reduce((total, value) => total + value, 0) / mapWinRates.length
    : 50;

  return { mapStatsById: byId, totalMatches, totalRounds, priorWinRate };
}

function buildRegionOptions(regions: Array<{ region?: string }> | undefined): SelectOption[] {
  const values = Array.from(
    new Set((regions ?? []).map((region) => region.region?.toLowerCase()).filter(Boolean) as string[]),
  );
  return [
    { value: "", label: "Todas" },
    ...values.map((value) => ({ value, label: value.toUpperCase() })),
  ];
}

function buildComparisonMetrics(
  globalStats: ComputedMapStats | null | undefined,
  personalStats: ComputedMapStats | null | undefined,
): ComparisonMetric[] {
  const configs = [
    { key: "rounds", label: "Rondas", format: "number" as const, noDiff: true, noNormalize: true },
    { key: "roundDiff", label: "Diferencial rondas", format: "number" as const, sampleKey: "rounds" },
    { key: "winRate", label: "Winrate", format: "percent" as const, sampleKey: "matches" },
    { key: "attackWinRate", label: "Attack WR", format: "percent" as const, sampleKey: "rounds" },
    { key: "defenseWinRate", label: "Defense WR", format: "percent" as const, sampleKey: "rounds" },
    { key: "killsPerRound", label: "Kills / ronda", format: "number" as const, sampleKey: "rounds" },
    { key: "deathsPerRound", label: "Muertes / ronda", format: "number" as const, lowerIsBetter: true },
    { key: "adr", label: "ADR", format: "number" as const, sampleKey: "rounds" },
    { key: "kd", label: "K/D", format: "number" as const, sampleKey: "rounds" },
    { key: "acs", label: "ACS", format: "number" as const, sampleKey: "rounds" },
    { key: "kastPct", label: "KAST", format: "percent" as const, sampleKey: "rounds" },
    { key: "survivalRate", label: "Supervivencia", format: "percent" as const, sampleKey: "rounds" },
    { key: "clutchRate", label: "Clutch rate", format: "percent" as const, sampleKey: "clutchOpportunities" },
  ];

  return configs
    .map<ComparisonMetric | null>((config) => {
      const globalValue = globalStats?.[config.key as keyof ComputedMapStats] as number | undefined;
      const personalValue = personalStats?.[config.key as keyof ComputedMapStats] as number | undefined;
      if (!isAvailableNumber(globalValue) && !isAvailableNumber(personalValue)) return null;
      const formatValue = (value?: number) =>
        config.format === "percent" ? formatMaybePercent(value) : formatMaybeNumber(value, config.key === "matches" || config.key === "rounds" ? 0 : 2);
      const diff = isAvailableNumber(globalValue) && isAvailableNumber(personalValue)
        ? (personalValue as number) - (globalValue as number)
        : undefined;
      const sampleKey = (config.sampleKey ?? "rounds") as keyof ComputedMapStats;
      const globalSample = Number(globalStats?.[sampleKey] ?? 0);
      const personalSample = Number(personalStats?.[sampleKey] ?? 0);
      const prior = isAvailableNumber(globalValue) ? globalValue : personalValue;
      const priorWeight = config.format === "percent" ? 50 : 80;
      const globalNormalized = config.noNormalize
        ? undefined
        : bayesianAdjustedRate(globalValue, globalSample, prior, priorWeight);
      const personalNormalized = config.noNormalize
        ? undefined
        : bayesianAdjustedRate(personalValue, personalSample, prior, priorWeight);
      const normalizedDiff = isAvailableNumber(globalNormalized) && isAvailableNumber(personalNormalized)
        ? (personalNormalized as number) - (globalNormalized as number)
        : undefined;
      return {
        key: config.key,
        label: config.label,
        globalLabel: formatValue(globalValue),
        personalLabel: formatValue(personalValue),
        diffLabel: config.noDiff || diff === undefined
          ? "-"
          : `${diff > 0 ? "+" : ""}${config.format === "percent" ? formatNumber(diff, 1) + " pts" : formatNumber(diff, 2)}`,
        globalNormalizedLabel: config.noNormalize ? "-" : formatValue(globalNormalized),
        personalNormalizedLabel: config.noNormalize ? "-" : formatValue(personalNormalized),
        normalizedDiffLabel: normalizedDiff === undefined
          ? "-"
          : `${normalizedDiff > 0 ? "+" : ""}${config.format === "percent" ? formatNumber(normalizedDiff, 1) + " pts" : formatNumber(normalizedDiff, 2)}`,
        ...(diff !== undefined ? { diff } : {}),
        ...(normalizedDiff !== undefined ? { normalizedDiff } : {}),
        higherIsBetter: !config.lowerIsBetter,
      };
    })
    .filter((metric): metric is ComparisonMetric => Boolean(metric));
}

function buildComparisonSummary(personalStats: ComputedMapStats | null | undefined, metrics: ComparisonMetric[]) {
  if (!personalStats) return "Sin datos personales para estos filtros. Se muestra la referencia global disponible.";
  if (personalStats.matches <= 3) return "Baja muestra: el winrate personal se muestra con ajuste bayesiano para no sobrerreaccionar.";
  const positive = metrics.filter((metric) => metric.diffLabel.startsWith("+")).length;
  if (positive >= 3) return "Tu rendimiento personal destaca frente a varias referencias globales.";
  return "Tu rendimiento queda comparado contra la referencia competitiva global disponible.";
}

function getMetricTone(metric: ComparisonMetric, field: "diff" | "normalizedDiff") {
  const value = metric[field];
  if (!isAvailableNumber(value) || Math.abs(value ?? 0) < 0.0001) return "neutral";
  const positive = metric.higherIsBetter ? (value ?? 0) > 0 : (value ?? 0) < 0;
  return positive ? "positive" : "negative";
}

function matchBelongsToMap(match: AnalyticsMatch, map: MapContent | null | undefined) {
  if (!map) return false;
  const mapName = normalizeText(map.displayName);
  const matchMapName = normalizeText(match.map_name);
  return Boolean((map.uuid && match.map_id === map.uuid) ||
    (matchMapName && (matchMapName.includes(mapName) || mapName.includes(matchMapName))));
}

function matchPassesFilters(match: AnalyticsMatch, filters: { act?: string; rank?: string; agent?: string }) {
  if (filters.act && filters.act !== ALL && match.season_id !== filters.act) return false;
  if (filters.rank && filters.rank !== ALL && String(match.competitive_tier ?? "") !== filters.rank) return false;
  if (filters.agent && filters.agent !== ALL && match.agent_id !== filters.agent) return false;
  return true;
}

function buildBestWeaponsForMap(
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
      // Weapon score blends round WR shrinkage, combat output, use rate and sample confidence.
      const score = adjustedWinRate * 0.35 + combatScore * 0.35 + useRate * 0.2 + sampleConfidence * 100 * 0.1;
      return {
        ...row,
        killsPerRound,
        hsPct: shots > 0 ? (row.headshots * 100) / shots : undefined,
        winRate,
        score,
        sampleConfidence,
      };
    })
    .filter((row) => row.kills > 0 || row.rounds > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.rounds - a.rounds)
    .slice(0, 5);
}

function buildBestWeaponsFromGlobal(weaponStats: Record<string, RegionWeaponStats> | undefined): WeaponMapRow[] {
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
        winRate: stats.win_rate,
      };
    })
    .filter((row) => row.kills > 0 || row.rounds > 0);
  const priorWr = rows.length
    ? rows.reduce((sum, row) => sum + (row.winRate ?? 50), 0) / rows.length
    : 50;
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
        score: adjustedWinRate * 0.35 + combatScore * 0.35 + useRate * 0.2 + sampleConfidence * 100 * 0.1,
        sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.rounds - a.rounds)
    .slice(0, 5);
}

function buildBestCompositionsForMap(
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
        winRate,
        // Composition score favors adjusted WR, then repeated usage and sample confidence.
        score: adjustedWinRate * 0.65 + playRate * 0.2 + sampleConfidence * 100 * 0.15,
        sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.matches - a.matches)
    .slice(0, 5);
}

function buildBestCompositionsFromGlobal(rows: RegionMapCompositionStats[] | undefined): CompositionMapRow[] {
  const source = rows ?? [];
  const prior = source.length
    ? source.reduce((sum, row) => sum + Number(row.win_rate ?? 0), 0) / source.length
    : 50;
  const maxMatches = Math.max(...source.map((row) => Number(row.matches ?? 0)), 1);
  return source
    .map((row) => {
      const matches = Number(row.matches ?? 0);
      const adjustedWinRate = bayesianAdjustedRate(row.win_rate, matches, prior, 15) ?? prior;
      const playRate = clamp(matches / maxMatches) * 100;
      const sampleConfidence = clamp(matches / 15);
      return {
        key: row.key,
        agents: row.agents,
        matches,
        wins: Number(row.wins ?? 0),
        roundsWon: Number(row.rounds_won ?? 0),
        roundsLost: Number(row.rounds_lost ?? 0),
        winRate: row.win_rate,
        score: adjustedWinRate * 0.65 + playRate * 0.2 + sampleConfidence * 100 * 0.15,
        sampleConfidence,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.matches - a.matches)
    .slice(0, 5);
}

function getBestAgents(agentStats: Record<string, RegionAgentStats> | undefined): AgentMapRow[] {
  const rows = Object.entries(agentStats ?? {}).map(([agentId, stats]) => {
    const raw = stats.win_rate ?? 0;
    const matches = stats.matches ?? stats.picks ?? 0;
    const rounds = stats.rounds ?? stats.totals?.rounds ?? 0;
    const adjustedWinRate = bayesianAdjustedRate(raw, matches, 50, 15) ?? raw;
    const normalizedPerformance = (
      normalized(stats.avg_kd, 1, 1.4) * 0.35 +
      normalized(stats.avg_adr, 140, 120) * 0.35 +
      normalized(stats.avg_acs, 210, 180) * 0.2 +
      normalized(stats.avg_kda, 1.4, 1.6) * 0.1
    ) * 100;
    const normalizedPickRate = normalized(stats.pick_rate, 10, 25) * 100;
    const sampleConfidence = clamp(Math.max(matches / 15, rounds / 250));
    // Agent score shrinks WR and balances performance, pick rate and reliability.
    const score = adjustedWinRate * 0.45 + normalizedPerformance * 0.35 + normalizedPickRate * 0.15 + sampleConfidence * 100 * 0.05;
    return {
      agentId,
      name: stats.agent_name ?? "Unknown",
      matches,
      rounds,
      winRate: raw,
      pickRate: stats.pick_rate,
      kd: stats.avg_kd,
      adr: stats.avg_adr,
      acs: stats.avg_acs,
      score,
      sampleConfidence,
    };
  });
  return rows.sort((a, b) => b.score - a.score || b.matches - a.matches).slice(0, 5);
}

function buildRoundCeremonySharesFromGlobal(stats: RegionMapStats | undefined) {
  const ceremonyLabels: Record<string, string> = {
    CeremonyAce: "Ace",
    CeremonyClutch: "Clutch",
    CeremonyDefault: "Normal",
    CeremonyFlawless: "Impecable",
    CeremonyTeamAce: "Team Ace",
    CeremonyThrifty: "Thrifty",
  };
  const entries = Object.entries(stats?.round_ceremonies ?? {})
    .map(([key, value]) => ({ key, wins: Number(value ?? 0) }))
    .filter((item) => item.wins > 0);
  const totalWinsWithRoundCeremony = entries.reduce((sum, item) => sum + item.wins, 0);
  if (totalWinsWithRoundCeremony <= 0) return [];
  return entries
    .map((item) => ({
      key: item.key,
      label: ceremonyLabels[item.key] ?? item.key.replace(/^Ceremony/, ""),
      wins: item.wins,
      percent: (item.wins * 100) / totalWinsWithRoundCeremony,
    }))
    .sort((a, b) => b.percent - a.percent);
}

function CalloutMap({ map }: { map: MapEntry }) {
  const imageCandidates = [map.displayIcon, map.listViewIcon, map.splash].filter(Boolean) as string[];
  const [imageIndex, setImageIndex] = useState(0);
  const image = imageCandidates[imageIndex];
  const transformAvailable = [map.xMultiplier, map.xScalarToAdd, map.yMultiplier, map.yScalarToAdd].every((value) => toFiniteNumber(value) !== undefined);
  const positionedCallouts = (map.callouts ?? [])
    .map((callout) => {
      const rawLocation = (callout.location ?? {}) as Record<string, unknown>;
      const position = translateValorantCoordinatesToMapPosition({
        gameX: callout.location?.x ?? asCoordinateValue(rawLocation.X) ?? asCoordinateValue(rawLocation.gameX) ?? asCoordinateValue(rawLocation.game_x),
        gameY: callout.location?.y ?? asCoordinateValue(rawLocation.Y) ?? asCoordinateValue(rawLocation.gameY) ?? asCoordinateValue(rawLocation.game_y),
        xMultiplier: map.xMultiplier,
        xScalarToAdd: map.xScalarToAdd,
        yMultiplier: map.yMultiplier,
        yScalarToAdd: map.yScalarToAdd,
      });
      return { callout, position };
    })
    .filter((item): item is { callout: NonNullable<MapEntry["callouts"]>[number]; position: { xPercent: number; yPercent: number } } =>
      Boolean(
        item.position &&
        item.position.xPercent >= 0 &&
        item.position.xPercent <= 100 &&
        item.position.yPercent >= 0 &&
        item.position.yPercent <= 100,
      ),
    );

  if (!image) {
    return <div className="mapas-empty-panel">Sin minimapa tactico compatible con coordenadas para este mapa.</div>;
  }

  return (
    <div className="mapas-callout-map-shell">
      <div className="mapas-callout-map">
        <img
          src={image}
          alt={`Mapa tactico de ${map.displayName}`}
          onError={(event) => {
            const nextIndex = imageIndex + 1;
            if (nextIndex < imageCandidates.length) {
              setImageIndex(nextIndex);
              return;
            }
            hideBrokenImage(event);
          }}
        />
        {positionedCallouts.map(({ callout, position }) => {
          const label = `${callout.superRegionName ? `${callout.superRegionName}: ` : ""}${callout.regionName ?? "Callout"}`;
          return (
            <span
              key={`${callout.superRegionName ?? ""}-${callout.regionName ?? ""}-${callout.location?.x ?? ""}-${callout.location?.y ?? ""}`}
              className="mapas-callout-marker"
              style={{ left: `${position.xPercent}%`, top: `${position.yPercent}%` }}
              title={label}
              aria-label={label}
            >
              <span className="mapas-callout-dot" aria-hidden="true" />
              <span className="mapas-callout-label">
                {callout.regionName ?? callout.superRegionName ?? "Callout"}
              </span>
            </span>
          );
        })}
        {(!transformAvailable || positionedCallouts.length === 0) && (map.callouts?.length ?? 0) > 0 && (
          <div className="mapas-map-notice">Sin coordenadas transformables para pintar callouts reales.</div>
        )}
        {image !== map.displayIcon && positionedCallouts.length > 0 && (
          <div className="mapas-map-notice">Imagen alternativa: las coordenadas se han calculado con los datos oficiales del minimapa.</div>
        )}
        {positionedCallouts.length === 0 && (map.callouts?.length ?? 0) === 0 && (
          <div className="mapas-map-notice">Sin callouts posicionables para este mapa.</div>
        )}
      </div>
    </div>
  );
}

function StatGrid({ stats, totalMatches }: { stats: ComputedMapStats | null | undefined; totalMatches: number }) {
  const playRate = stats?.matches && totalMatches > 0 ? (stats.matches * 100) / totalMatches : undefined;
  const assistsPerRound = stats?.rounds ? stats.assists / stats.rounds : undefined;
  const kda = stats?.deaths ? (stats.kills + stats.assists) / stats.deaths : undefined;
  const items = [
    ["Partidas", formatMaybeNumber(stats?.matches)],
    ["Rondas", formatMaybeNumber(stats?.rounds)],
    ["Rondas ganadas", formatMaybeNumber(stats?.roundsWon)],
    ["Rondas perdidas", formatMaybeNumber(stats?.roundsLost)],
    ["Diferencial", isAvailableNumber(stats?.roundDiff) ? `${(stats?.roundDiff ?? 0) > 0 ? "+" : ""}${formatNumber(stats?.roundDiff ?? 0, 0)}` : "Sin datos"],
    ["Winrate", formatMaybePercent(stats?.winRate)],
    ["Attack WR", formatMaybePercent(stats?.attackWinRate)],
    ["Defense WR", formatMaybePercent(stats?.defenseWinRate)],
    ["Kills / ronda", formatMaybeNumber(stats?.killsPerRound, 2)],
    ["Muertes / ronda", formatMaybeNumber(stats?.deathsPerRound, 2)],
    ["Asist. / ronda", formatMaybeNumber(assistsPerRound, 2)],
    ["ADR", formatMaybeNumber(stats?.adr, 1)],
    ["K/D", formatMaybeNumber(stats?.kd, 2)],
    ["KDA", formatMaybeNumber(kda, 2)],
    ["ACS", formatMaybeNumber(stats?.acs, 1)],
    ["KAST", formatMaybePercent(stats?.kastPct)],
    ["Supervivencia", formatMaybePercent(stats?.survivalRate)],
    ["Clutch rate", formatMaybePercent(stats?.clutchRate)],
    ["Play rate", formatMaybePercent(playRate)],
  ];
  return (
    <div className="content-kv-grid content-kv-grid--compact mapas-stat-grid">
      {items.map(([label, value]) => (
        <div className="content-kv" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function DetailAccordion({
  panelKey,
  title,
  openPanels,
  togglePanel,
  children,
}: {
  panelKey: MapPanelKey;
  title: string;
  openPanels: Record<MapPanelKey, boolean>;
  togglePanel: (key: MapPanelKey) => void;
  children: ReactNode;
}) {
  const open = openPanels[panelKey];
  const contentId = `mapas-panel-${panelKey}`;
  return (
    <section className="mapas-panel mapas-panel--accordion">
      <button
        className="mapas-panel-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => togglePanel(panelKey)}
      >
        <span>{title}</span>
      </button>
      {open && (
        <div id={contentId} className="mapas-panel-body">
          {children}
        </div>
      )}
    </section>
  );
}

export default function Mapas() {
  const auth = useAuth();
  const query = useMapas();
  const agentsQuery = useAgentes();
  const { data: regions } = useRegions();
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>(COMPETITIVE);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [rankFilter, setRankFilter] = useState(ALL);
  const [actFilter, setActFilter] = useState(ALL);
  const [agentFilter, setAgentFilter] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [selected, setSelected] = useState<MapEntry | null>(null);
  const [openPanels, setOpenPanels] = useState<Record<MapPanelKey, boolean>>({
    comparison: true,
    callouts: true,
    roundTypes: false,
    agents: false,
    weapons: false,
    compositions: false,
  });
  const regionTouchedRef = useRef(false);

  const personalDashboardQuery = usePlayerDashboard(
    auth.user?.puuid,
    { queue_id: COMPETITIVE, page_size: 250 },
  );
  const globalMapStatsQuery = useGlobalMapStats({
    region: selectedRegion,
    rank: rankFilter,
    act: actFilter,
    agent: agentFilter,
  });

  const regionOptions = useMemo(() => buildRegionOptions(regions), [regions]);
  const actOptions = useMemo(
    () => toSelectOptions(globalMapStatsQuery.data?.options?.acts, "Sin actos disponibles"),
    [globalMapStatsQuery.data?.options?.acts],
  );
  const rankOptions = useMemo(
    () => toSelectOptions(globalMapStatsQuery.data?.options?.ranks, "Sin rangos disponibles"),
    [globalMapStatsQuery.data?.options?.ranks],
  );
  const agentNameById = useMemo(() => {
    const byId = new Map<string, string>();
    const raw = agentsQuery.data as Record<string, unknown[]> | undefined;
    Object.values(raw ?? {}).flat().forEach((item) => {
      if (!item || typeof item !== "object") return;
      const record = item as { uuid?: string | null; displayName?: string | null };
      if (record.uuid && record.displayName) byId.set(record.uuid, record.displayName);
    });
    return byId;
  }, [agentsQuery.data]);
  const agentOptions = useMemo(
    () => {
      const options = toSelectOptions(globalMapStatsQuery.data?.options?.agents, "Sin agentes disponibles");
      return options.map((option) => ({
        ...option,
        label: option.value !== ALL && agentNameById.has(option.value)
          ? `${agentNameById.get(option.value)}${option.label.match(/\(\d+\)$/)?.[0] ? ` ${option.label.match(/\(\d+\)$/)?.[0]}` : ""}`
          : option.label,
      }));
    },
    [agentNameById, globalMapStatsQuery.data?.options?.agents],
  );

  useEffect(() => {
    if (agentFilter === ALL) return;
    if (agentOptions.some((option) => option.value === agentFilter && !option.disabled)) return;
    const frame = requestAnimationFrame(() => setAgentFilter(ALL));
    return () => cancelAnimationFrame(frame);
  }, [agentFilter, agentOptions]);

  useEffect(() => {
    if (actFilter === ALL) return;
    if (actOptions.some((option) => option.value === actFilter && !option.disabled)) return;
    const frame = requestAnimationFrame(() => setActFilter(ALL));
    return () => cancelAnimationFrame(frame);
  }, [actFilter, actOptions]);

  useEffect(() => {
    if (rankFilter === ALL) return;
    if (rankOptions.some((option) => option.value === rankFilter && !option.disabled)) return;
    const frame = requestAnimationFrame(() => setRankFilter(ALL));
    return () => cancelAnimationFrame(frame);
  }, [rankFilter, rankOptions]);

  useEffect(() => {
    if (regionTouchedRef.current || selectedRegion || regionOptions.length <= 1) return;
    const playerRegion = personalDashboardQuery.data?.player?.region?.toLowerCase();
    const preferred = regionOptions.find((option) => option.value === playerRegion)?.value;
    if (!preferred) return;
    const frame = requestAnimationFrame(() => setSelectedRegion(preferred));
    return () => cancelAnimationFrame(frame);
  }, [personalDashboardQuery.data?.player?.region, regionOptions, selectedRegion]);

  const fallbackAggregated = useMemo(
    () => sumRegionMapStats(regions as Array<{ region?: string; totalRounds?: number; mapStats?: Record<string, RegionMapStats> }> | undefined, selectedRegion),
    [regions, selectedRegion],
  );
  const globalMapStatsById = globalMapStatsQuery.data?.mapStats ?? fallbackAggregated.mapStatsById;
  const globalMapStatsValues = Object.values(globalMapStatsById);
  const globalPriorWinRate = globalMapStatsValues.length
    ? globalMapStatsValues.reduce((sum, stats) => sum + Number(stats.win_rate ?? 0), 0) / globalMapStatsValues.length
    : fallbackAggregated.priorWinRate;
  const globalTotalMatches = globalMapStatsQuery.data?.sampleSize?.matches ?? fallbackAggregated.totalMatches;
  const globalTotalRounds = globalMapStatsValues.reduce((sum, stats) => sum + Number(stats.total_rounds ?? 0), 0) || fallbackAggregated.totalRounds;

  const maps = useMemo<MapEntry[]>(() => {
    const data = query.data ?? {};
    const flat = Object.entries(data).flatMap(([backendGroupKey, items]) =>
      (items ?? []).map((item) => {
        const group = classifyValorantMapMode({ ...item, name: item.name ?? backendGroupKey });
        const globalStats = globalMapStatsById[getMapStatsKey(item)] ??
          Object.values(globalMapStatsById).find((stats) => normalizeText(stats.map_name) === normalizeText(item.displayName));
        return {
          ...item,
          groupKey: group.key,
          groupLabel: group.label,
          groupOrder: group.sortOrder,
          globalStats,
          computedGlobalStats: regionMapStatsToComputed(globalStats, globalPriorWinRate),
        };
      }),
    );
    return flat.sort((a, b) => a.groupOrder - b.groupOrder || a.displayName.localeCompare(b.displayName));
  }, [globalMapStatsById, globalPriorWinRate, query.data]);

  const personalStatsByMapKey = useMemo(() => {
    const byKey = new Map<string, ComputedMapStats>();
    for (const map of maps) {
      const stats = calculatePersonalMapStats(
        personalDashboardQuery.data?.analyticsList,
        map,
        { act: actFilter, rank: rankFilter, agent: agentFilter },
        globalPriorWinRate,
      );
      if (stats) byKey.set(getMapStatsKey(map), stats);
    }
    return byKey;
  }, [actFilter, agentFilter, globalPriorWinRate, maps, personalDashboardQuery.data?.analyticsList, rankFilter]);

  useEffect(() => {
    if (!selected) return;
    const fresh = maps.find((map) => getMapStatsKey(map) === getMapStatsKey(selected));
    const hasGlobal = Boolean(fresh?.computedGlobalStats?.matches || fresh?.computedGlobalStats?.rounds);
    const hasPersonal = fresh ? personalStatsByMapKey.has(getMapStatsKey(fresh)) : false;
    if (!fresh || (!hasGlobal && !hasPersonal)) {
      const frame = requestAnimationFrame(() => setSelected(null));
      return () => cancelAnimationFrame(frame);
    }
    if (fresh !== selected) {
      const frame = requestAnimationFrame(() => setSelected(fresh));
      return () => cancelAnimationFrame(frame);
    }
  }, [maps, personalStatsByMapKey, selected]);

  const selectedStats = selected?.computedGlobalStats;
  const personalStats = useMemo(
    () => calculatePersonalMapStats(
      personalDashboardQuery.data?.analyticsList,
      selected,
      { act: actFilter, rank: rankFilter, agent: agentFilter },
      globalPriorWinRate,
    ),
    [actFilter, agentFilter, globalPriorWinRate, personalDashboardQuery.data?.analyticsList, rankFilter, selected],
  );
  const comparisonMetrics = useMemo(
    () => buildComparisonMetrics(selectedStats, personalStats),
    [personalStats, selectedStats],
  );
  const roundTypeShares = useMemo(
    () => {
      const globalShares = buildRoundCeremonySharesFromGlobal(selected?.globalStats);
      if (globalShares.length > 0) return globalShares;
      return calculateRoundTypeShares(personalDashboardQuery.data?.analyticsList, selected, { act: actFilter, rank: rankFilter, agent: agentFilter });
    },
    [actFilter, agentFilter, personalDashboardQuery.data?.analyticsList, rankFilter, selected],
  );
  const selectedGlobalMapKey = selected
    ? (globalMapStatsById[getMapStatsKey(selected)]
      ? getMapStatsKey(selected)
      : Object.entries(globalMapStatsById).find(([, stats]) => normalizeText(stats.map_name) === normalizeText(selected.displayName))?.[0])
    : undefined;
  const bestAgents = useMemo(
    () => getBestAgents(selectedGlobalMapKey ? globalMapStatsQuery.data?.agentStatsByMap?.[selectedGlobalMapKey] : undefined)
      .filter((agent) => agentFilter === ALL || agent.agentId === agentFilter),
    [agentFilter, globalMapStatsQuery.data?.agentStatsByMap, selectedGlobalMapKey],
  );
  const bestWeapons = useMemo(
    () => {
      const globalRows = buildBestWeaponsFromGlobal(
        selectedGlobalMapKey ? globalMapStatsQuery.data?.weaponStatsByMap?.[selectedGlobalMapKey] : undefined,
      );
      if (globalRows.length > 0) return globalRows;
      return buildBestWeaponsForMap(personalDashboardQuery.data?.analyticsList, selected, { act: actFilter, rank: rankFilter, agent: agentFilter });
    },
    [actFilter, agentFilter, globalMapStatsQuery.data?.weaponStatsByMap, personalDashboardQuery.data?.analyticsList, rankFilter, selected, selectedGlobalMapKey],
  );
  const bestCompositions = useMemo(
    () => {
      const globalRows = buildBestCompositionsFromGlobal(
        selectedGlobalMapKey ? globalMapStatsQuery.data?.compositionsByMap?.[selectedGlobalMapKey] : undefined,
      );
      if (globalRows.length > 0) return globalRows;
      return buildBestCompositionsForMap(
      personalDashboardQuery.data?.analyticsList,
      selected,
      { act: actFilter, rank: rankFilter, agent: agentFilter },
      agentNameById,
      );
    },
    [actFilter, agentFilter, agentNameById, globalMapStatsQuery.data?.compositionsByMap, personalDashboardQuery.data?.analyticsList, rankFilter, selected, selectedGlobalMapKey],
  );

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const filteredMaps = maps.filter((map) => {
      const matchesSearch = normalizeText(map.displayName).includes(normalizedSearch);
      const matchesMode =
        (modeFilter === COMPETITIVE && map.groupKey === "core") ||
        map.groupKey === modeFilter;
      const hasGlobal = Boolean(map.computedGlobalStats?.matches || map.computedGlobalStats?.rounds);
      const hasPersonal = personalStatsByMapKey.has(getMapStatsKey(map));
      return matchesSearch && matchesMode && (hasGlobal || hasPersonal);
    });
    return [...filteredMaps].sort((a, b) => {
      if (sortKey === "name") return a.displayName.localeCompare(b.displayName);
      if (sortKey === "matches") return (b.computedGlobalStats?.matches ?? 0) - (a.computedGlobalStats?.matches ?? 0) || a.displayName.localeCompare(b.displayName);
      if (sortKey === "winRate") return (b.computedGlobalStats?.adjustedWinRate ?? 0) - (a.computedGlobalStats?.adjustedWinRate ?? 0) || a.displayName.localeCompare(b.displayName);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [maps, modeFilter, personalStatsByMapKey, search, sortKey]);

  const availableModeOptions = useMemo(() => {
    const groupsWithData = new Set(
      maps
        .filter((map) => Boolean(map.computedGlobalStats?.matches || map.computedGlobalStats?.rounds) || personalStatsByMapKey.has(getMapStatsKey(map)))
        .map((map) => map.groupKey),
    );
    return MODE_OPTIONS.filter((option) => {
      if (option.value === COMPETITIVE) return groupsWithData.has("core");
      return groupsWithData.has(option.value as MapModeGroupKey);
    });
  }, [maps, personalStatsByMapKey]);

  useEffect(() => {
    if (availableModeOptions.some((option) => option.value === modeFilter)) return;
    const nextMode = availableModeOptions[0]?.value ?? COMPETITIVE;
    const frame = requestAnimationFrame(() => setModeFilter(nextMode));
    return () => cancelAnimationFrame(frame);
  }, [availableModeOptions, modeFilter]);

  const kpis = [
    ["Mapas", formatNumber(filtered.length, 0)],
    ["Muestra global", formatCompactNumber(globalTotalMatches)],
    ["Rondas comp.", formatCompactNumber(globalTotalRounds)],
    ["Region", selectedRegion ? selectedRegion.toUpperCase() : "Todas"],
  ];

  const selectedSites = inferSiteCount(selected);
  const activeModeLabel = optionLabel(MODE_OPTIONS, modeFilter);
  const showPersonalComparison = auth.isLoggedIn;
  const togglePanel = (key: MapPanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  if (query.isLoading) {
    return <ContentLoading title="Cargando mapas" />;
  }

  return (
    <ContentShell
      title="Mapas"
      subtitle="Mapas por modo, estadisticas competitivas globales y comparativa personal con ajuste bayesiano cuando hay muestra baja."
    >
      {query.isError && (
        <ContentError
          message="No se pudieron cargar los mapas."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && maps.length === 0 && (
        <ContentEmpty message="No hay mapas disponibles." />
      )}

      {!query.isError && maps.length > 0 && (
        <>
          <div className="mapas-kpi-row">
            {kpis.map(([label, value]) => (
              <div className="mapas-kpi" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="content-toolbar content-toolbar--skins mapas-toolbar">
            <label className="content-select-label content-select-label--premium content-filter-field--search">
              Buscar
              <span className="mapas-search-line">
                <input
                  className="content-search content-search--premium"
                  type="search"
                  placeholder="Nombre del mapa"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <span className="content-result-count">{filtered.length} mapas</span>
              </span>
            </label>
            <label className="content-select-label content-select-label--premium">
              Modo
              <select className="content-select content-select--premium" value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
                {availableModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="content-select-label content-select-label--premium">
              Region
              <select
                className="content-select content-select--premium"
                value={selectedRegion}
                onChange={(event) => {
                  regionTouchedRef.current = true;
                  setSelectedRegion(event.target.value);
                }}
              >
                {regionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="content-select-label content-select-label--premium">
              Acto
              <select className="content-select content-select--premium" value={actFilter} onChange={(event) => setActFilter(event.target.value)}>
                {actOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
              </select>
            </label>
            <label className="content-select-label content-select-label--premium">
              Rango
              <select className="content-select content-select--premium" value={rankFilter} onChange={(event) => setRankFilter(event.target.value)}>
                {rankOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
              </select>
            </label>
            <label className="content-select-label content-select-label--premium">
              Agente
              <select className="content-select content-select--premium" value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)}>
                {agentOptions.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
              </select>
            </label>
            <label className="content-select-label content-select-label--premium">
              Orden
              <select className="content-select content-select--premium" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {selected && (
            <article className="content-detail mapas-detail" id="mapas-detail">
              <button
                className="content-detail-close"
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                <span className="content-detail-close-icon" aria-hidden="true" />
              </button>

              <div className="mapas-detail-head">
                <div>
                  <h2 className="content-detail-title">{selected.displayName}</h2>
                  <div className="content-badge-row">
                    <span className="content-badge">Número de sites: {selectedSites ? `${selectedSites}` : "Sin datos"}</span>
                    <span className="content-badge">{selectedStats?.matches ? `${formatCompactNumber(selectedStats.matches)} partidas globales` : "Sin datos globales"}</span>
                    {showPersonalComparison && (
                      <span className="content-badge">{personalStats?.matches ? `${formatCompactNumber(personalStats.matches)} partidas personales` : "Sin datos personales"}</span>
                    )}
                  </div>
                </div>
                {(selected.splash || selected.listViewIconTall) && (
                  <img
                    className="mapas-detail-splash"
                    src={selected.splash || selected.listViewIconTall || ""}
                    alt={selected.displayName}
                    onError={hideBrokenImage}
                  />
                )}
              </div>

              <DetailAccordion
                panelKey="comparison"
                title={showPersonalComparison ? "Global vs personal" : "Resumen competitivo global"}
                openPanels={openPanels}
                togglePanel={togglePanel}
              >
                {!showPersonalComparison ? (
                  <StatGrid stats={selectedStats} totalMatches={globalTotalMatches} />
                ) : (
                  <>
                <p className="mapas-panel-helper">{buildComparisonSummary(personalStats, comparisonMetrics)}</p>
                {comparisonMetrics.length === 0 ? (
                  <div className="mapas-empty-panel">Sin datos personales o globales comparables para este mapa.</div>
                ) : (
                  <div className="mapas-comparison-table weapon-personal-comparison-table" role="table" aria-label="Comparativa global contra personal">
                    <div role="row" className="mapas-comparison-row weapon-personal-comparison-row weapon-personal-comparison-row--head">
                      <span role="columnheader">Métrica</span>
                      <span role="columnheader">Global</span>
                      <span role="columnheader">Tu</span>
                      <span role="columnheader">Diferencia</span>
                      <span role="columnheader">Global norm.</span>
                      <span role="columnheader">Tu norm.</span>
                      <span role="columnheader">Diferencia norm.</span>
                    </div>
                    {comparisonMetrics.map((metric) => (
                      <div role="row" key={metric.key} className="mapas-comparison-row weapon-personal-comparison-row">
                        <span role="cell">{metric.label}</span>
                        <strong role="cell">{metric.globalLabel}</strong>
                        <strong role="cell">{metric.personalLabel}</strong>
                        <em role="cell" className={`metric-diff metric-diff-${getMetricTone(metric, "diff")}`}>{metric.diffLabel}</em>
                        <strong role="cell">{metric.globalNormalizedLabel ?? "-"}</strong>
                        <strong role="cell">{metric.personalNormalizedLabel ?? "-"}</strong>
                        <em role="cell" className={`metric-diff metric-diff-${getMetricTone(metric, "normalizedDiff")}`}>{metric.normalizedDiffLabel ?? "-"}</em>
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}
              </DetailAccordion>

              <DetailAccordion panelKey="callouts" title="Callouts en mapa" openPanels={openPanels} togglePanel={togglePanel}>
                <CalloutMap key={getMapStatsKey(selected)} map={selected} />
              </DetailAccordion>

              <DetailAccordion panelKey="roundTypes" title="Tipos de rondas ganadas" openPanels={openPanels} togglePanel={togglePanel}>
                <p className="mapas-panel-helper">Porcentajes calculados solo con roundCeremony sobre rondas ganadas del mapa.</p>
                {roundTypeShares.length === 0 ? (
                  <div className="mapas-empty-panel">Sin datos de ceremonias de ronda.</div>
                ) : (
                  <div className="mapas-mini-list">
                    {roundTypeShares.map((item) => (
                      <div className="mapas-mini-row" key={item.key}>
                        <span>{item.label}</span>
                        <strong>{formatPercent(item.percent, 1)}</strong>
                        <small>{formatNumber(item.wins, 0)} rondas</small>
                      </div>
                    ))}
                  </div>
                )}
              </DetailAccordion>

              <DetailAccordion panelKey="agents" title="Mejores agentes" openPanels={openPanels} togglePanel={togglePanel}>
                {bestAgents.length === 0 ? (
                  <div className="mapas-empty-panel">Sin datos de agentes para este mapa con los filtros actuales.</div>
                ) : (
                  <div className="mapas-mini-list">
                    {bestAgents.map((agent) => (
                      <div className="mapas-mini-row" key={agent.agentId}>
                        <span>{agent.name}</span>
                        <strong>{formatPercent(agent.score, 1)} score</strong>
                        <small>{formatPercent(agent.winRate, 1)} WR - {formatNumber(agent.matches, 0)} partidas - {formatNumber(agent.rounds, 0)} rondas - pick {formatMaybePercent(agent.pickRate)} - {agent.sampleConfidence < 0.6 ? "baja muestra" : "muestra estable"}</small>
                      </div>
                    ))}
                  </div>
                )}
              </DetailAccordion>

              <DetailAccordion panelKey="weapons" title="Mejores armas" openPanels={openPanels} togglePanel={togglePanel}>
                {bestWeapons.length === 0 ? (
                  <div className="mapas-empty-panel">Sin datos personales de armas por mapa. El agregado global aun no separa armas por mapa.</div>
                ) : (
                  <div className="mapas-mini-list">
                    {bestWeapons.map((weapon) => (
                      <div className="mapas-mini-row" key={weapon.key}>
                        <span>{weapon.name}</span>
                        <strong>{formatMaybeNumber(weapon.score, 1)} score</strong>
                        <small>{formatMaybePercent(weapon.winRate)} WR - {formatNumber(weapon.kills, 0)} kills - {formatNumber(weapon.rounds, 0)} rondas - {formatNumber(weapon.killsPerRound, 2)} K/R - HS {formatMaybePercent(weapon.hsPct)} - {(weapon.sampleConfidence ?? 0) < 0.6 ? "baja muestra" : "muestra estable"}</small>
                      </div>
                    ))}
                  </div>
                )}
              </DetailAccordion>

              <DetailAccordion panelKey="compositions" title="Mejores composiciones" openPanels={openPanels} togglePanel={togglePanel}>
                {bestCompositions.length === 0 ? (
                  <div className="mapas-empty-panel">
                    Sin composiciones exactas de 5 agentes para este mapa con los filtros actuales.
                  </div>
                ) : (
                  <div className="mapas-mini-list">
                    {bestCompositions.map((composition) => (
                      <div className="mapas-mini-row" key={composition.key}>
                        <span>{composition.agents.join(" / ")}</span>
                        <strong>{formatMaybeNumber(composition.score, 1)} score</strong>
                        <small>
                          {formatMaybePercent(composition.winRate)} WR - {formatNumber(composition.matches, 0)} partidas - {formatNumber(composition.roundsWon, 0)}-{formatNumber(composition.roundsLost, 0)} rondas - {(composition.sampleConfidence ?? 0) < 0.6 ? "baja muestra" : "muestra estable"}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </DetailAccordion>
            </article>
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay mapas con ese filtro." />
          ) : (
            <ContentSection title={activeModeLabel}>
              <div className="content-grid mapas-grid">
                      {filtered.map((map) => {
                        const active = selected?.displayName === map.displayName;
                        const stats = map.computedGlobalStats ?? personalStatsByMapKey.get(getMapStatsKey(map));
                        return (
                          <button
                            key={`${map.groupKey}-${map.uuid ?? map.displayName}`}
                            className={`content-card mapas-card ${active ? "active" : ""}`}
                            type="button"
                            aria-expanded={active}
                            aria-controls={active ? "mapas-detail" : undefined}
                            onClick={() => setSelected(active ? null : map)}
                          >
                            {(map.displayIcon || map.splash) && (
                              <span className="content-card-image-wrap mapas-card-image-wrap">
                                <img
                                  className="content-card-image"
                                  src={map.displayIcon || map.splash || ""}
                                  alt={map.displayName}
                                  loading="lazy"
                                  onError={hideBrokenImage}
                                />
                              </span>
                            )}
                            <h2 className="content-card-title">{map.displayName}</h2>
                            <p className="content-card-meta">
                              {stats?.matches ? `${formatCompactNumber(stats.matches)} partidas${map.computedGlobalStats ? "" : " personales"}` : "Sin estadisticas"}
                            </p>
                            <p className="content-card-meta">
                              WR ajustado {formatMaybePercent(stats?.adjustedWinRate)}
                            </p>
                          </button>
                        );
                      })}
              </div>
            </ContentSection>
          )}
        </>
      )}
    </ContentShell>
  );
}
