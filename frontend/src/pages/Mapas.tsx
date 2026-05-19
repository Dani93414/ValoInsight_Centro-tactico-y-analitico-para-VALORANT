import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAgentes, useGlobalMapStats, useMapas, usePlayerDashboard, useRegions } from "../api/hooks";
import { useAuth } from "../context/AuthContext";
import type { MapContent } from "../types/content";
import type {
  GlobalAgentStatsOption,
  RegionMapStats,
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
  buildBestCompositionsForMap,
  buildBestCompositionsFromGlobal,
  buildBestWeaponsForMap,
  buildBestWeaponsFromGlobal,
  getBestAgents,
} from "./Mapas/mapRankings";
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

function formatMaybePercent(value?: number) {
  return isAvailableNumber(value) ? formatPercent(value, 1) : "Sin datos";
}

function formatMaybeNumber(value?: number, digits = 0) {
  return isAvailableNumber(value) ? formatNumber(value, digits) : "Sin datos";
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
    { key: "rounds", label: "Rondas mapa", format: "number" as const, noDiff: true, noNormalize: true },
    { key: "playerRounds", label: "Player-rounds", format: "number" as const, noDiff: true, noNormalize: true },
    { key: "roundDiff", label: "Diferencial rondas", format: "number" as const, sampleKey: "rounds" },
    { key: "winRate", label: "Winrate jugadores", format: "percent" as const, sampleKey: "playerMatches" },
    { key: "teamRoundWinRate", label: "WR rondas equipo", format: "percent" as const, sampleKey: "rounds" },
    { key: "attackWinRate", label: "Attack WR", format: "percent" as const, sampleKey: "rounds" },
    { key: "defenseWinRate", label: "Defense WR", format: "percent" as const, sampleKey: "rounds" },
    { key: "killsPerRound", label: "Kills / player-round", format: "number" as const, sampleKey: "playerRounds" },
    { key: "deathsPerRound", label: "Muertes / player-round", format: "number" as const, lowerIsBetter: true, sampleKey: "playerRounds" },
    { key: "adr", label: "ADR", format: "number" as const, sampleKey: "playerRounds" },
    { key: "kd", label: "K/D", format: "number" as const, sampleKey: "playerRounds" },
    { key: "acs", label: "ACS", format: "number" as const, sampleKey: "playerRounds" },
    { key: "kastPct", label: "KAST", format: "percent" as const, sampleKey: "playerRounds" },
    { key: "survivalRate", label: "Supervivencia", format: "percent" as const, sampleKey: "playerRounds" },
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
  const imageCandidates = [map.displayIcon].filter(Boolean) as string[];
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
        {positionedCallouts.length === 0 && (map.callouts?.length ?? 0) === 0 && (
          <div className="mapas-map-notice">Sin callouts posicionables para este mapa.</div>
        )}
      </div>
    </div>
  );
}

function StatGrid({ stats, totalMatches }: { stats: ComputedMapStats | null | undefined; totalMatches: number }) {
  const playRate = stats?.matches && totalMatches > 0 ? (stats.matches * 100) / totalMatches : undefined;
  const performanceRounds = stats?.playerRounds || stats?.rounds || 0;
  const assistsPerRound = performanceRounds ? stats!.assists / performanceRounds : undefined;
  const kda = stats?.deaths ? (stats.kills + stats.assists) / stats.deaths : undefined;
  const items = [
    ["Partidas", formatMaybeNumber(stats?.matches)],
    ["Player-partidas", formatMaybeNumber(stats?.playerMatches)],
    ["Rondas mapa", formatMaybeNumber(stats?.rounds)],
    ["Player-rounds", formatMaybeNumber(stats?.playerRounds)],
    ["Rondas equipo ganadas", formatMaybeNumber(stats?.roundsWon)],
    ["Rondas equipo perdidas", formatMaybeNumber(stats?.roundsLost)],
    ["Diferencial", isAvailableNumber(stats?.roundDiff) ? `${(stats?.roundDiff ?? 0) > 0 ? "+" : ""}${formatNumber(stats?.roundDiff ?? 0, 0)}` : "Sin datos"],
    ["Winrate jugadores", formatMaybePercent(stats?.winRate)],
    ["WR rondas equipo", formatMaybePercent(stats?.teamRoundWinRate)],
    ["Attack WR", formatMaybePercent(stats?.attackWinRate)],
    ["Defense WR", formatMaybePercent(stats?.defenseWinRate)],
    ["Kills / player-round", formatMaybeNumber(stats?.killsPerRound, 2)],
    ["Muertes / player-round", formatMaybeNumber(stats?.deathsPerRound, 2)],
    ["Asist. / player-round", formatMaybeNumber(assistsPerRound, 2)],
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

  const globalMapStatsById = useMemo(
    () => globalMapStatsQuery.data?.mapStats ?? {},
    [globalMapStatsQuery.data?.mapStats],
  );
  const globalMapStatsValues = useMemo(() => Object.values(globalMapStatsById), [globalMapStatsById]);
  const globalPriorWinRate = useMemo(
    () => globalMapStatsValues.length
      ? globalMapStatsValues.reduce((sum, stats) => sum + Number(stats.player_win_rate ?? stats.win_rate ?? 0), 0) / globalMapStatsValues.length
      : 50,
    [globalMapStatsValues],
  );
  const globalTotalMatches = globalMapStatsQuery.data?.sampleSize?.matches ?? 0;
  const globalTotalRounds = useMemo(
    () => globalMapStatsValues.reduce((sum, stats) => sum + Number(stats.map_rounds ?? stats.total_rounds ?? 0), 0),
    [globalMapStatsValues],
  );

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
    ["Partidas globales", formatCompactNumber(globalTotalMatches)],
    ["Rondas mapa", formatCompactNumber(globalTotalRounds)],
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
