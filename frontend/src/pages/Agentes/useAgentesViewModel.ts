import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, usePlayerDashboard, useRegions } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import {
  formatNumber,
  formatPercent,
  normalizeArrayResponse,
  normalizeLabel,
  safeDivide,
} from "../../utils/formatters";
import type { Agente, Role } from "../../types/agents";
import type { AnalyticsMatch } from "../../types/dashboard";
import type { RegionAgentStats } from "../../types/globalStats";
import type {
  AgentFilterSummary,
  AgentComparisonMetric,
  AgentSelectOption,
  AgentSortKey,
  EnrichedAgent,
  PersonalAgentStats,
  RoleSummaryItem,
  TopAgentSummary,
} from "./types";

type RouteState = {
  agentName?: string;
  returnTo?: string;
  returnLabel?: string;
} | null;

type PersonalStatAccumulator = {
  picks: number;
  wins: number;
  sums: Partial<Record<PersonalAverageKey, number>>;
  counts: Partial<Record<PersonalAverageKey, number>>;
};

type PersonalAverageKey =
  | "avg_kd"
  | "avg_acs"
  | "avg_adr"
  | "avg_headshot_pct"
  | "avg_fk_rate"
  | "avg_survival_rate"
  | "avg_clutch_win_rate";

type ComparisonMetricConfig = {
  key: keyof RegionAgentStats;
  personalKey?: keyof PersonalAgentStats;
  label: string;
  format: "integer" | "number" | "percent";
};

const comparisonMetricConfigs: ComparisonMetricConfig[] = [
  { key: "win_rate", personalKey: "winRate", label: "Win rate", format: "percent" },
  { key: "pick_rate", personalKey: "usagePct", label: "Pick rate", format: "percent" },
  { key: "avg_kd", label: "KD medio", format: "number" },
  { key: "avg_acs", label: "ACS medio", format: "number" },
  { key: "avg_adr", label: "ADR medio", format: "number" },
  { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
  { key: "avg_fk_rate", label: "FK rate", format: "percent" },
  { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
  { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
];

function getAgentKey(agent: Pick<Agente, "uuid" | "id" | "displayName">): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

function buildAgentStatsResolver(agentStatsById: Record<string, RegionAgentStats>) {
  const agentStatsByName = new Map<string, RegionAgentStats>();
  Object.values(agentStatsById).forEach((stats) => {
    if (stats.agent_name) {
      agentStatsByName.set(normalizeLabel(stats.agent_name), stats);
    }
  });

  return (agent: Agente) =>
    agentStatsById[agent.uuid ?? agent.id ?? ""] ??
    agentStatsByName.get(normalizeLabel(agent.displayName));
}

function sortAgents(agents: EnrichedAgent[], sortKey: AgentSortKey): EnrichedAgent[] {
  return [...agents].sort((a, b) => {
    if (sortKey === "picks") {
      return (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
    }
    if (sortKey === "winRate") {
      return (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0);
    }
    if (sortKey === "role") {
      const roleCompare = a.role.displayName.localeCompare(b.role.displayName);
      return roleCompare || a.displayName.localeCompare(b.displayName);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function buildRoleSummary(agents: EnrichedAgent[], roles: Role[]): RoleSummaryItem[] {
  const totalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );

  return roles.map((role) => {
    const roleAgents = agents.filter(
      (agent) => agent.role.displayName === role.displayName,
    );
    const picks = roleAgents.reduce(
      (total, agent) => total + (agent.globalStats?.picks ?? 0),
      0,
    );
    const wins = roleAgents.reduce(
      (total, agent) => total + (agent.globalStats?.wins ?? 0),
      0,
    );

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
  const backendRegions = (regions ?? [])
    .map((region) => region.region?.toLowerCase())
    .filter((region): region is string => Boolean(region));

  return Array.from(new Set(["eu", ...backendRegions])).map((region) => ({
    value: region,
    label: region.toUpperCase(),
  }));
}

function buildPersonalStatsByAgent(
  analyticsList: AnalyticsMatch[] | undefined,
  agents: Agente[],
): Map<string, PersonalAgentStats> {
  const statSeeds = new Map<string, PersonalStatAccumulator>();
  const keyByMatchValue = new Map<string, string>();

  agents.forEach((agent) => {
    const agentKey = getAgentKey(agent);
    [agent.uuid, agent.id, agent.displayName].forEach((value) => {
      if (value) keyByMatchValue.set(normalizeLabel(value), agentKey);
    });
  });

  (analyticsList ?? []).forEach((match) => {
    const agentKey =
      keyByMatchValue.get(normalizeLabel(match.agent_id)) ??
      keyByMatchValue.get(normalizeLabel(match.agent_name));
    if (!agentKey) return;

    const current =
      statSeeds.get(agentKey) ?? { picks: 0, wins: 0, sums: {}, counts: {} };
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

  const totalPicks = Array.from(statSeeds.values()).reduce(
    (total, stats) => total + stats.picks,
    0,
  );
  const result = new Map<string, PersonalAgentStats>();
  statSeeds.forEach((stats, agentKey) => {
    const averages = Object.fromEntries(
      (Object.keys(stats.sums) as PersonalAverageKey[])
        .map((key) => {
          const count = stats.counts[key] ?? 0;
          return [key, count > 0 ? safeDivide(stats.sums[key] ?? 0, count) : undefined];
        })
        .filter((entry): entry is [PersonalAverageKey, number] => typeof entry[1] === "number"),
    ) as Partial<Pick<PersonalAgentStats, PersonalAverageKey>>;

    result.set(agentKey, {
      picks: stats.picks,
      wins: stats.wins,
      ...averages,
      usagePct: safeDivide(stats.picks * 100, totalPicks),
      winRate: safeDivide(stats.wins * 100, stats.picks),
    });
  });

  return result;
}

function getPersonalMetricValue(
  personalStats: PersonalAgentStats | null | undefined,
  config: ComparisonMetricConfig,
) {
  if (!personalStats) return undefined;
  const personalKey = config.personalKey ?? config.key;
  const value = personalStats[personalKey as keyof PersonalAgentStats];
  return typeof value === "number" ? value : undefined;
}

function getGlobalMetricValue(
  globalStats: RegionAgentStats | undefined,
  key: keyof RegionAgentStats,
) {
  const value = globalStats?.[key];
  return typeof value === "number" ? value : undefined;
}

function formatComparisonValue(
  value: number | undefined,
  format: ComparisonMetricConfig["format"],
) {
  if (value === undefined || Number.isNaN(value)) return "-";
  if (format === "percent") return formatPercent(value);
  if (format === "integer") return formatNumber(value, 0);
  return formatNumber(value, 2);
}

function formatDiff(
  globalValue: number | undefined,
  personalValue: number | undefined,
  format: ComparisonMetricConfig["format"],
) {
  if (globalValue === undefined || personalValue === undefined) return "-";
  const diff = personalValue - globalValue;
  const sign = diff > 0 ? "+" : "";
  if (format === "percent") return `${sign}${formatPercent(diff)}`;
  if (format === "integer") return `${sign}${formatNumber(diff, 0)}`;
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

      return {
        key: config.key,
        label: config.label,
        globalLabel: formatComparisonValue(globalValue, config.format),
        personalLabel: formatComparisonValue(personalValue, config.format),
        diffLabel: formatDiff(globalValue, personalValue, config.format),
      };
    })
    .filter((metric): metric is AgentComparisonMetric => Boolean(metric));
}

function buildTopAgents(agents: EnrichedAgent[]): TopAgentSummary[] {
  const totalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );

  return [...agents]
    .filter((agent) => (agent.globalStats?.picks ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0))
    .slice(0, 3)
    .map((agent) => ({
      key: getAgentKey(agent),
      name: agent.displayName,
      roleName: agent.role.displayName,
      picks: agent.globalStats?.picks ?? 0,
      usagePct: safeDivide((agent.globalStats?.picks ?? 0) * 100, totalPicks),
      winRate: agent.globalStats?.win_rate ?? 0,
      displayIcon: agent.displayIcon,
    }));
}

function buildFilterSummary(
  agents: EnrichedAgent[],
  filteredAgents: EnrichedAgent[],
  activeRole: string | null,
  search: string,
  sortKey: AgentSortKey,
  selectedRegion: string,
  mapFilter: string,
  rankFilter: string,
  actFilter: string,
): AgentFilterSummary {
  const sortLabels: Record<AgentSortKey, string> = {
    name: "Orden por nombre",
    picks: "Orden por picks",
    winRate: "Orden por win rate",
    role: "Orden por rol",
  };
  const activeLabels = [
    selectedRegion ? `Región: ${selectedRegion.toUpperCase()}` : null,
    search.trim() ? `Búsqueda: ${search.trim()}` : null,
    activeRole ? `Rol: ${activeRole}` : null,
    mapFilter !== "all" ? `Mapa: ${mapFilter}` : null,
    rankFilter !== "all" ? `Rango: ${rankFilter}` : null,
    actFilter !== "all" ? `Acto: ${actFilter}` : null,
    sortKey !== "name" ? sortLabels[sortKey] : null,
  ].filter((label): label is string => Boolean(label));

  return {
    total: agents.length,
    shown: filteredAgents.length,
    activeLabels,
  };
}

export function useAgentesViewModel() {
  const auth = useAuth();
  const { data: rawAgentes, isLoading: agentesLoading, isError, error } = useAgentes();
  const { data: regions } = useRegions();
  const personalDashboardQuery = usePlayerDashboard(auth.user?.puuid, undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as RouteState) ?? null;
  const consumedRouteAgentNameRef = useRef<string | null>(null);
  const personalRegionAppliedRef = useRef(false);
  const regionTouchedRef = useRef(false);

  const [selectedAgent, setSelectedAgent] = useState<EnrichedAgent | null>(null);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<AgentSortKey>("name");
  const [selectedRegion, setSelectedRegionState] = useState("eu");
  const [mapFilter, setMapFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [actFilter, setActFilter] = useState("all");

  const setSelectedRegion = (value: string) => {
    regionTouchedRef.current = true;
    setSelectedRegionState(value.toLowerCase());
  };

  useEffect(() => {
    const playerRegion = personalDashboardQuery.data?.player?.region?.toLowerCase();
    if (
      !auth.isLoggedIn ||
      !playerRegion ||
      personalRegionAppliedRef.current ||
      regionTouchedRef.current
    ) {
      return;
    }
    personalRegionAppliedRef.current = true;
    const frame = requestAnimationFrame(() => {
      setSelectedRegionState(playerRegion);
    });
    return () => cancelAnimationFrame(frame);
  }, [auth.isLoggedIn, personalDashboardQuery.data?.player?.region]);

  const agentStatsById = useMemo(
    () =>
      regions?.find(
        (region) => region.region.toLowerCase() === selectedRegion.toLowerCase(),
      )?.agentStats ?? {},
    [regions, selectedRegion],
  );

  const resolveStats = useMemo(
    () => buildAgentStatsResolver(agentStatsById),
    [agentStatsById],
  );

  const agents = useMemo<EnrichedAgent[]>(() => {
    const baseAgents = normalizeArrayResponse<Agente>(rawAgentes);
    const personalStatsByAgent = buildPersonalStatsByAgent(
      personalDashboardQuery.data?.analyticsList,
      baseAgents,
    );

    return baseAgents
      .map((agent) => ({
        ...agent,
        globalStats: resolveStats(agent),
        personalStats: personalStatsByAgent.get(getAgentKey(agent)) ?? null,
      }))
      .map((agent) => ({
        ...agent,
        comparisonMetrics: buildComparisonMetrics(
          agent.globalStats,
          agent.personalStats,
        ),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [personalDashboardQuery.data?.analyticsList, rawAgentes, resolveStats]);

  const roles = useMemo(
    () => Array.from(new Map(agents.map((agent) => [agent.role.displayName, agent.role])).values()),
    [agents],
  );

  const roleSummary = useMemo(
    () => buildRoleSummary(agents, roles),
    [agents, roles],
  );

  const topAgents = useMemo(() => buildTopAgents(agents), [agents]);

  const regionOptions = useMemo(() => buildRegionOptions(regions), [regions]);
  // TODO: conectar estos selects a datos backend cuando existan filtros globales
  // por mapa, rango y acto para estadísticas agregadas de agentes.
  const mapOptions = useMemo<AgentSelectOption[]>(
    () => [{ value: "all", label: "Todos" }],
    [],
  );
  const rankOptions = useMemo<AgentSelectOption[]>(
    () => [{ value: "all", label: "Todos" }],
    [],
  );
  const actOptions = useMemo<AgentSelectOption[]>(
    () => [{ value: "all", label: "Todos" }],
    [],
  );

  const filteredAgents = useMemo(() => {
    const normalizedSearch = normalizeLabel(search);
    const filtered = agents.filter((agent) => {
      const matchesRole = !activeRole || agent.role.displayName === activeRole;
      const matchesSearch = normalizeLabel(agent.displayName).includes(normalizedSearch);
      return matchesRole && matchesSearch;
    });
    return sortAgents(filtered, sortKey);
  }, [activeRole, agents, search, sortKey]);

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
    [
      activeRole,
      actFilter,
      agents,
      filteredAgents,
      mapFilter,
      rankFilter,
      search,
      selectedRegion,
      sortKey,
    ],
  );

  const resetFilters = () => {
    setSearch("");
    setActiveRole(null);
    setSortKey("name");
    regionTouchedRef.current = false;
    setSelectedRegionState(
      personalDashboardQuery.data?.player?.region?.toLowerCase() ?? "eu",
    );
    setMapFilter("all");
    setRankFilter("all");
    setActFilter("all");
  };

  useEffect(() => {
    const routeAgentName = routeState?.agentName?.trim() || null;
    if (
      !routeAgentName ||
      consumedRouteAgentNameRef.current === routeAgentName ||
      agents.length === 0 ||
      selectedAgent
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const match = agents.find(
        (agent) => normalizeLabel(agent.displayName) === normalizeLabel(routeAgentName),
      );
      if (match) {
        setSelectedAgent(match);
        setIsRoleOpen(false);
      }
      consumedRouteAgentNameRef.current = routeAgentName;
    });

    return () => cancelAnimationFrame(frame);
  }, [agents, routeState?.agentName, selectedAgent]);

  const selectAgent = (agent: EnrichedAgent) => {
    const isActive = getAgentKey(selectedAgent ?? agent) === getAgentKey(agent) && selectedAgent;
    setSelectedAgent(isActive ? null : agent);
    setIsRoleOpen(false);
  };

  const closeDetail = () => {
    setSelectedAgent(null);
    setIsRoleOpen(false);
  };

  return {
    activeRole,
    actFilter,
    actOptions,
    agents,
    error,
    filteredAgents,
    filterSummary,
    hasSession: auth.isLoggedIn,
    isError,
    isLoading: agentesLoading,
    isRoleOpen,
    mapFilter,
    mapOptions,
    navigate,
    rankFilter,
    rankOptions,
    regionOptions,
    returnLabel: routeState?.returnLabel ?? "Volver",
    returnTo: routeState?.returnTo ?? null,
    roleSummary,
    roles,
    search,
    selectedAgent,
    selectedRegion,
    sortKey,
    topAgents,
    closeDetail,
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
  };
}
