import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, usePlayerDashboard, useRegions } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import {
  normalizeArrayResponse,
  normalizeLabel,
  safeDivide,
} from "../../utils/formatters";
import type { Agente, Role } from "../../types/agents";
import type { AnalyticsMatch } from "../../types/dashboard";
import type { RegionAgentStats } from "../../types/globalStats";
import type {
  AgentFilterSummary,
  AgentSelectOption,
  AgentSortKey,
  AgentsInsightsModel,
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
  const statSeeds = new Map<string, { picks: number; wins: number }>();
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

    const current = statSeeds.get(agentKey) ?? { picks: 0, wins: 0 };
    current.picks += 1;
    current.wins += match.won_match ? 1 : 0;
    statSeeds.set(agentKey, current);
  });

  const totalPicks = Array.from(statSeeds.values()).reduce(
    (total, stats) => total + stats.picks,
    0,
  );
  const result = new Map<string, PersonalAgentStats>();
  statSeeds.forEach((stats, agentKey) => {
    result.set(agentKey, {
      ...stats,
      usagePct: safeDivide(stats.picks * 100, totalPicks),
      winRate: safeDivide(stats.wins * 100, stats.picks),
    });
  });

  return result;
}

function buildInsightsModel(
  agents: EnrichedAgent[],
  hasSession: boolean,
  isLoadingPersonal: boolean,
): AgentsInsightsModel {
  const totalGlobalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );
  const rows = [...agents]
    .filter((agent) => (agent.globalStats?.picks ?? 0) > 0 || (agent.personalStats?.picks ?? 0) > 0)
    .sort((a, b) => {
      const personalDiff = (b.personalStats?.picks ?? 0) - (a.personalStats?.picks ?? 0);
      const globalDiff = (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
      return hasSession && personalDiff ? personalDiff : globalDiff;
    })
    .slice(0, 4)
    .map((agent) => ({
      key: getAgentKey(agent),
      agentName: agent.displayName,
      roleName: agent.role.displayName,
      globalPicks: agent.globalStats?.picks ?? 0,
      globalUsagePct: safeDivide((agent.globalStats?.picks ?? 0) * 100, totalGlobalPicks),
      globalWinRate: agent.globalStats?.win_rate ?? 0,
      personalPicks: agent.personalStats?.picks,
      personalUsagePct: agent.personalStats?.usagePct,
      personalWinRate: agent.personalStats?.winRate,
    }));

  return {
    hasSession,
    isLoadingPersonal,
    hasPersonalData: agents.some((agent) => (agent.personalStats?.picks ?? 0) > 0),
    rows,
  };
}

function buildTopAgents(agents: EnrichedAgent[]): TopAgentSummary[] {
  return [...agents]
    .filter((agent) => (agent.globalStats?.picks ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0))
    .slice(0, 3)
    .map((agent) => ({
      key: getAgentKey(agent),
      name: agent.displayName,
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

  const insights = useMemo(
    () =>
      buildInsightsModel(
        agents,
        auth.isLoggedIn,
        personalDashboardQuery.isLoading,
      ),
    [agents, auth.isLoggedIn, personalDashboardQuery.isLoading],
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
    insights,
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
