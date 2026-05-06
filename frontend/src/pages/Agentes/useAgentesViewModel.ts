import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, usePlayerDashboard, useRegions } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import type { Agente, Role } from "../../types/agents";
import type { AnalyticsMatch, MatchCard } from "../../types/dashboard";
import type { RegionAgentStats } from "../../types/globalStats";
import {
  formatNumber,
  formatPercent,
  normalizeArrayResponse,
  normalizeLabel,
  safeDivide,
} from "../../utils/formatters";
import { getRankNameFromTier } from "../../utils/rankUtils";
import { buildAgentCompareMetrics } from "./domain/agentComparisons";
import {
  agentHasPersonalMatch,
  makeOptions,
  type PersonalAgentMatch,
} from "./domain/agentFilters";
import { buildAgentLookup, getAgentKey } from "./domain/agentKeys";
import { buildAgentProfileMetrics } from "./domain/agentProfile";
import {
  calculateAgentScore,
  getAgentTier,
  getScoreConfidence,
  isLowSample,
} from "./domain/agentScoring";
import type {
  AgentComparisonMetric,
  AgentFilterSummary,
  AgentSelectOption,
  AgentSortKey,
  EnrichedAgent,
  PersonalAgentStats,
  RoleSummaryItem,
} from "./types";

type RouteState = {
  agentName?: string;
  returnTo?: string;
  returnLabel?: string;
} | null;

type PersonalAverageKey =
  | "avg_kd"
  | "avg_acs"
  | "avg_adr"
  | "avg_headshot_pct"
  | "avg_fk_rate"
  | "avg_survival_rate"
  | "avg_clutch_win_rate";

type PersonalStatAccumulator = {
  picks: number;
  wins: number;
  sums: Partial<Record<PersonalAverageKey, number>>;
  counts: Partial<Record<PersonalAverageKey, number>>;
};

type ComparisonMetricConfig = {
  key: keyof RegionAgentStats;
  personalKey?: keyof PersonalAgentStats;
  label: string;
  format: "number" | "percent";
};

const comparisonMetricConfigs: ComparisonMetricConfig[] = [
  { key: "win_rate", personalKey: "winRate", label: "Win Rate", format: "percent" },
  { key: "pick_rate", personalKey: "usagePct", label: "Pick Rate", format: "percent" },
  { key: "avg_kd", label: "KD medio", format: "number" },
  { key: "avg_acs", label: "ACS medio", format: "number" },
  { key: "avg_adr", label: "ADR medio", format: "number" },
  { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
  { key: "avg_fk_rate", label: "FK Rate", format: "percent" },
  { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
  { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
];

function buildAgentStatsResolver(agentStatsById: Record<string, RegionAgentStats>) {
  const agentStatsByName = new Map<string, RegionAgentStats>();
  Object.values(agentStatsById).forEach((stats) => {
    if (stats.agent_name) agentStatsByName.set(normalizeLabel(stats.agent_name), stats);
  });

  return (agent: Agente) =>
    agentStatsById[agent.uuid ?? agent.id ?? ""] ??
    agentStatsByName.get(normalizeLabel(agent.displayName));
}

function sortAgents(agents: EnrichedAgent[], sortKey: AgentSortKey): EnrichedAgent[] {
  return [...agents].sort((a, b) => {
    if (sortKey === "score") return b.score - a.score;
    if (sortKey === "picks") return (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
    if (sortKey === "winRate") return (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0);
    if (sortKey === "role") {
      const roleCompare = a.role.displayName.localeCompare(b.role.displayName);
      return roleCompare || a.displayName.localeCompare(b.displayName);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function buildRoleSummary(agents: EnrichedAgent[], roles: Role[]): RoleSummaryItem[] {
  const totalPicks = agents.reduce((total, agent) => total + (agent.globalStats?.picks ?? 0), 0);

  return roles.map((role) => {
    const roleAgents = agents.filter((agent) => agent.role.displayName === role.displayName);
    const picks = roleAgents.reduce((total, agent) => total + (agent.globalStats?.picks ?? 0), 0);
    const wins = roleAgents.reduce((total, agent) => total + (agent.globalStats?.wins ?? 0), 0);

    return {
      ...role,
      agents: roleAgents.length,
      picks,
      wins,
      usagePct: safeDivide(picks * 100, totalPicks),
      winRate: safeDivide(wins * 100, picks),
    };
  });
}

function buildRegionOptions(regions: { region: string }[] | undefined): AgentSelectOption[] {
  return (regions ?? [])
    .map((region) => region.region?.toLowerCase())
    .filter((region): region is string => Boolean(region))
    .map((region) => ({ value: region, label: region.toUpperCase() }));
}

function averageEntries(accumulator: PersonalStatAccumulator) {
  return Object.fromEntries(
    (Object.keys(accumulator.sums) as PersonalAverageKey[])
      .map((key) => {
        const count = accumulator.counts[key] ?? 0;
        return [key, count > 0 ? safeDivide(accumulator.sums[key] ?? 0, count) : undefined];
      })
      .filter((entry): entry is [PersonalAverageKey, number] => typeof entry[1] === "number"),
  ) as Partial<Pick<PersonalAgentStats, PersonalAverageKey>>;
}

function buildPersonalStatsByAgent(
  analyticsList: AnalyticsMatch[] | undefined,
  agents: Agente[],
): Map<string, PersonalAgentStats> {
  const statSeeds = new Map<string, PersonalStatAccumulator>();
  const keyByMatchValue = buildAgentLookup(agents);

  (analyticsList ?? []).forEach((match) => {
    const agentKey =
      keyByMatchValue.get(normalizeLabel(match.agent_id)) ??
      keyByMatchValue.get(normalizeLabel(match.agent_name));
    if (!agentKey) return;

    const current = statSeeds.get(agentKey) ?? { picks: 0, wins: 0, sums: {}, counts: {} };
    const overview = match.overview ?? {};
    const averageValues: Partial<Record<PersonalAverageKey, number | undefined>> = {
      avg_kd: overview.kd_ratio,
      avg_acs: overview.acs,
      avg_adr: overview.adr,
      avg_headshot_pct: overview.headshot_pct,
      avg_fk_rate: overview.opening_duel_win_pct,
      avg_survival_rate: overview.survival_rate,
      avg_clutch_win_rate: overview.clutch_win_rate,
    };

    current.picks += 1;
    current.wins += match.won_match ? 1 : 0;
    Object.entries(averageValues).forEach(([key, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      const metricKey = key as PersonalAverageKey;
      current.sums[metricKey] = (current.sums[metricKey] ?? 0) + value;
      current.counts[metricKey] = (current.counts[metricKey] ?? 0) + 1;
    });
    statSeeds.set(agentKey, current);
  });

  const totalPicks = Array.from(statSeeds.values()).reduce((total, stats) => total + stats.picks, 0);
  const result = new Map<string, PersonalAgentStats>();
  statSeeds.forEach((stats, agentKey) => {
    result.set(agentKey, {
      picks: stats.picks,
      wins: stats.wins,
      ...averageEntries(stats),
      usagePct: safeDivide(stats.picks * 100, totalPicks),
      winRate: safeDivide(stats.wins * 100, stats.picks),
    });
  });

  return result;
}

function getPersonalMetricValue(personalStats: PersonalAgentStats | null | undefined, config: ComparisonMetricConfig) {
  if (!personalStats) return undefined;
  const personalKey = config.personalKey ?? config.key;
  const value = personalStats[personalKey as keyof PersonalAgentStats];
  return typeof value === "number" ? value : undefined;
}

function getGlobalMetricValue(globalStats: RegionAgentStats | undefined, key: keyof RegionAgentStats) {
  const value = globalStats?.[key];
  return typeof value === "number" ? value : undefined;
}

function formatComparisonValue(value: number | undefined, format: ComparisonMetricConfig["format"]) {
  if (value === undefined || Number.isNaN(value)) return "-";
  if (format === "percent") return formatPercent(value);
  return formatNumber(value, 2);
}

function formatDiff(globalValue: number | undefined, personalValue: number | undefined, format: ComparisonMetricConfig["format"]) {
  if (globalValue === undefined || personalValue === undefined) return "-";
  const diff = personalValue - globalValue;
  const sign = diff > 0 ? "+" : "";
  if (format === "percent") return `${sign}${formatPercent(diff)}`;
  return `${sign}${formatNumber(diff, 2)}`;
}

function buildComparisonMetrics(
  globalStats: RegionAgentStats | undefined,
  personalStats: PersonalAgentStats | null | undefined,
): AgentComparisonMetric[] {
  return comparisonMetricConfigs
    .map((config) => {
      const globalValue = getGlobalMetricValue(globalStats, config.key);
      const personalValue = getPersonalMetricValue(personalStats, config);
      if (globalValue === undefined && personalValue === undefined) return null;
      const diff = globalValue === undefined || personalValue === undefined ? undefined : personalValue - globalValue;
      return {
        key: config.key,
        label: config.label,
        globalLabel: formatComparisonValue(globalValue, config.format),
        personalLabel: formatComparisonValue(personalValue, config.format),
        diffLabel: formatDiff(globalValue, personalValue, config.format),
        ...(diff !== undefined ? { diff } : {}),
      };
    })
    .filter((metric): metric is AgentComparisonMetric => metric !== null);
}

function buildPersonalAgentMatches(matches: MatchCard[] | undefined, agents: Agente[]): PersonalAgentMatch[] {
  const keyByMatchValue = buildAgentLookup(agents);

  return (matches ?? []).reduce<PersonalAgentMatch[]>((result, match) => {
    const agentKey =
      keyByMatchValue.get(normalizeLabel(match.agentId)) ??
      keyByMatchValue.get(normalizeLabel(match.agent));
    if (!agentKey) return result;

    result.push({
        agentKey,
        map: match.map,
        rank:
          typeof match.competitiveTier === "number" && match.competitiveTier >= 3
            ? getRankNameFromTier(match.competitiveTier)
            : undefined,
        actId: match.seasonId,
        actLabel: match.seasonId,
    });
    return result;
  }, []);
}

function buildFilterSummary(
  agents: EnrichedAgent[],
  filteredAgents: EnrichedAgent[],
  activeRole: string,
  search: string,
  sortKey: AgentSortKey,
  selectedRegion: string,
  mapFilter: string,
  rankFilter: string,
  actFilter: string,
): AgentFilterSummary {
  const sortLabels: Record<AgentSortKey, string> = {
    name: "Orden por nombre",
    picks: "Orden por pick rate",
    winRate: "Orden por win rate",
    role: "Orden por rol",
    score: "Orden por score",
  };
  const activeLabels = [
    selectedRegion ? `Región: ${selectedRegion.toUpperCase()}` : null,
    search.trim() ? `Búsqueda: ${search.trim()}` : null,
    activeRole !== "all" ? `Rol: ${activeRole}` : null,
    mapFilter !== "all" ? `Mapa: ${mapFilter}` : null,
    rankFilter !== "all" ? `Rango: ${rankFilter}` : null,
    actFilter !== "all" ? `Acto: ${actFilter}` : null,
    sortKey !== "name" ? sortLabels[sortKey] : null,
  ].filter((label): label is string => Boolean(label));

  return { total: agents.length, shown: filteredAgents.length, activeLabels };
}

export function useAgentesViewModel() {
  const auth = useAuth();
  const { data: rawAgentes, isLoading: agentesLoading, isError, error } = useAgentes();
  const { data: regions, isLoading: regionsLoading } = useRegions();
  const personalDashboardQuery = usePlayerDashboard(auth.user?.puuid, undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as RouteState) ?? null;
  const consumedRouteAgentNameRef = useRef<string | null>(null);
  const regionTouchedRef = useRef(false);

  const [selectedAgent, setSelectedAgent] = useState<EnrichedAgent | null>(null);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [activeRole, setActiveRole] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<AgentSortKey>("score");
  const [selectedRegion, setSelectedRegionState] = useState("");
  const [mapFilter, setMapFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [actFilter, setActFilter] = useState("all");
  const [compareAgents, setCompareAgents] = useState<EnrichedAgent[]>([]);

  const baseAgents = useMemo(() => normalizeArrayResponse<Agente>(rawAgentes), [rawAgentes]);
  const regionOptions = useMemo(() => buildRegionOptions(regions), [regions]);

  useEffect(() => {
    if (regionTouchedRef.current || regionOptions.length === 0) return;
    const playerRegion = personalDashboardQuery.data?.player?.region?.toLowerCase();
    const preferred = auth.isLoggedIn ? playerRegion : undefined;
    const nextRegion =
      regionOptions.find((option) => option.value === preferred)?.value ??
      regionOptions[0]?.value ??
      "";
    if (nextRegion && selectedRegion !== nextRegion) {
      const frame = requestAnimationFrame(() => setSelectedRegionState(nextRegion));
      return () => cancelAnimationFrame(frame);
    }
  }, [auth.isLoggedIn, personalDashboardQuery.data?.player?.region, regionOptions, selectedRegion]);

  const setSelectedRegion = (value: string) => {
    regionTouchedRef.current = true;
    setSelectedRegionState(value.toLowerCase());
  };

  const selectedRegionStats = useMemo(
    () => regions?.find((region) => region.region.toLowerCase() === selectedRegion.toLowerCase()),
    [regions, selectedRegion],
  );

  const resolveStats = useMemo(
    () => buildAgentStatsResolver(selectedRegionStats?.agentStats ?? {}),
    [selectedRegionStats?.agentStats],
  );

  const personalMatchCards = useMemo(
    () =>
      Object.values(personalDashboardQuery.data?.actSections ?? {}).flatMap(
        (section) => section.matches ?? [],
      ),
    [personalDashboardQuery.data?.actSections],
  );

  const personalAgentMatches = useMemo(
    () => buildPersonalAgentMatches(personalMatchCards, baseAgents),
    [baseAgents, personalMatchCards],
  );

  const agents = useMemo<EnrichedAgent[]>(() => {
    const personalStatsByAgent = buildPersonalStatsByAgent(
      personalDashboardQuery.data?.analyticsList,
      baseAgents,
    );
    const totalGlobalPicks = Object.values(selectedRegionStats?.agentStats ?? {}).reduce(
      (total, stats) => total + (stats.picks ?? 0),
      0,
    );

    return baseAgents
      .map((agent) => {
        const globalStats = resolveStats(agent);
        const confidence = getScoreConfidence(globalStats?.picks);
        const score = calculateAgentScore(globalStats, totalGlobalPicks);
        const lowSample = isLowSample(globalStats?.picks);
        const enriched: EnrichedAgent = {
          ...agent,
          globalStats,
          personalStats: personalStatsByAgent.get(getAgentKey(agent)) ?? null,
          comparisonMetrics: [],
          profileMetrics: [],
          score,
          tier: getAgentTier(score, lowSample),
          confidence,
          lowSample,
        };
        enriched.comparisonMetrics = buildComparisonMetrics(enriched.globalStats, enriched.personalStats);
        enriched.profileMetrics = buildAgentProfileMetrics(enriched);
        return enriched;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [baseAgents, personalDashboardQuery.data?.analyticsList, resolveStats, selectedRegionStats?.agentStats]);

  const roles = useMemo(
    () => Array.from(new Map(agents.map((agent) => [agent.role.displayName, agent.role])).values()),
    [agents],
  );

  const roleOptions = useMemo<AgentSelectOption[]>(
    () => [{ value: "all", label: "Todos" }, ...roles.map((role) => ({ value: role.displayName, label: role.displayName }))],
    [roles],
  );

  const roleSummary = useMemo(() => buildRoleSummary(agents, roles), [agents, roles]);

  const mapOptions = useMemo(
    () => makeOptions(personalAgentMatches.map((match) => match.map), "No disponible"),
    [personalAgentMatches],
  );
  const rankOptions = useMemo(
    () => makeOptions(personalAgentMatches.map((match) => match.rank), "No disponible"),
    [personalAgentMatches],
  );
  const actOptions = useMemo(() => {
    const actLabelById = new Map(
      (personalDashboardQuery.data?.actOptions ?? []).map((act) => [act.id, act.label]),
    );
    const uniqueIds = Array.from(
      new Set(personalAgentMatches.map((match) => match.actId).filter((id): id is string => Boolean(id))),
    );
    if (uniqueIds.length === 0) return [{ value: "all", label: "No disponible", disabled: true }];
    return [
      { value: "all", label: "Todos" },
      ...uniqueIds.map((id) => ({ value: id, label: actLabelById.get(id) ?? id })),
    ];
  }, [personalAgentMatches, personalDashboardQuery.data?.actOptions]);

  const filterAvailability = {
    map: mapOptions.length > 1,
    rank: rankOptions.length > 1,
    act: actOptions.length > 1,
  };

  useEffect(() => {
    if (
      (filterAvailability.map || mapFilter === "all") &&
      (filterAvailability.rank || rankFilter === "all") &&
      (filterAvailability.act || actFilter === "all")
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (!filterAvailability.map && mapFilter !== "all") setMapFilter("all");
      if (!filterAvailability.rank && rankFilter !== "all") setRankFilter("all");
      if (!filterAvailability.act && actFilter !== "all") setActFilter("all");
    });
    return () => cancelAnimationFrame(frame);
  }, [actFilter, filterAvailability.act, filterAvailability.map, filterAvailability.rank, mapFilter, rankFilter]);

  const filteredAgents = useMemo(() => {
    const normalizedSearch = normalizeLabel(search);
    const filtered = agents.filter((agent) => {
      const matchesRole = activeRole === "all" || agent.role.displayName === activeRole;
      const matchesSearch = normalizeLabel(agent.displayName).includes(normalizedSearch);
      const matchesPersonalFilters = agentHasPersonalMatch(agent, personalAgentMatches, {
        map: mapFilter,
        rank: rankFilter,
        act: actFilter,
      });
      return matchesRole && matchesSearch && matchesPersonalFilters;
    });
    return sortAgents(filtered, sortKey);
  }, [activeRole, actFilter, agents, mapFilter, personalAgentMatches, rankFilter, search, sortKey]);

  const filterSummary = useMemo(
    () =>
      buildFilterSummary(
        agents,
        filteredAgents,
        activeRole,
        search,
        sortKey,
        selectedRegion,
        mapFilter,
        rankFilter,
        actFilter,
      ),
    [activeRole, actFilter, agents, filteredAgents, mapFilter, rankFilter, search, selectedRegion, sortKey],
  );

  const resetFilters = () => {
    setSearch("");
    setActiveRole("all");
    setSortKey("score");
    setMapFilter("all");
    setRankFilter("all");
    setActFilter("all");
    regionTouchedRef.current = false;
    const playerRegion = personalDashboardQuery.data?.player?.region?.toLowerCase();
    setSelectedRegionState(
      regionOptions.find((option) => option.value === playerRegion)?.value ??
        regionOptions[0]?.value ??
        "",
    );
  };

  useEffect(() => {
    const routeAgentName = routeState?.agentName?.trim() || null;
    if (!routeAgentName || consumedRouteAgentNameRef.current === routeAgentName || agents.length === 0 || selectedAgent) return;

    const frame = requestAnimationFrame(() => {
      const match = agents.find((agent) => normalizeLabel(agent.displayName) === normalizeLabel(routeAgentName));
      if (match) {
        setSelectedAgent(match);
        setIsRoleOpen(false);
      }
      consumedRouteAgentNameRef.current = routeAgentName;
    });

    return () => cancelAnimationFrame(frame);
  }, [agents, routeState?.agentName, selectedAgent]);

  const selectAgent = (agent: EnrichedAgent) => {
    const isActive = selectedAgent && getAgentKey(selectedAgent) === getAgentKey(agent);
    setSelectedAgent(isActive ? null : agent);
    setIsRoleOpen(false);
  };

  const closeDetail = () => {
    setSelectedAgent(null);
    setIsRoleOpen(false);
  };

  const toggleCompareAgent = (agent: EnrichedAgent) => {
    setCompareAgents((current) => {
      const exists = current.some((item) => getAgentKey(item) === getAgentKey(agent));
      if (exists) return current.filter((item) => getAgentKey(item) !== getAgentKey(agent));
      return [...current.slice(-1), agent];
    });
  };

  const removeCompareAgent = (agent: EnrichedAgent) => {
    setCompareAgents((current) => current.filter((item) => getAgentKey(item) !== getAgentKey(agent)));
  };

  const clearCompareAgents = () => setCompareAgents([]);

  const compareMetrics = useMemo(
    () =>
      compareAgents.length === 2
        ? buildAgentCompareMetrics(compareAgents[0], compareAgents[1])
        : [],
    [compareAgents],
  );

  return {
    activeRole,
    actFilter,
    actOptions,
    agents,
    compareAgents,
    compareMetrics,
    error,
    filteredAgents,
    filterAvailability,
    filterSummary,
    hasSession: auth.isLoggedIn,
    isError,
    isLoading: agentesLoading || (regionsLoading && !selectedRegion),
    isRoleOpen,
    mapFilter,
    mapOptions,
    navigate,
    rankFilter,
    rankOptions,
    regionOptions,
    returnLabel: routeState?.returnLabel ?? "Volver",
    returnTo: routeState?.returnTo ?? null,
    roleOptions,
    roleSummary,
    roles,
    search,
    selectedAgent,
    selectedRegion,
    sortKey,
    closeDetail,
    clearCompareAgents,
    removeCompareAgent,
    resetFilters,
    selectAgent,
    setActiveRole,
    setActFilter,
    setIsRoleOpen,
    setMapFilter,
    setRankFilter,
    setSearch,
    setSelectedRegion,
    setSortKey,
    toggleCompareAgent,
  };
}
