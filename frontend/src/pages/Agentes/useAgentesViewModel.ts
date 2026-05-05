import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, useRegions } from "../../api/hooks";
import {
  formatNumber,
  formatPercent,
  getSampleReliabilityLabel,
  normalizeArrayResponse,
  normalizeLabel,
  safeDivide,
} from "../../utils/formatters";
import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";
import type {
  AgentSortKey,
  AgentFilterSummary,
  AgentInsightItem,
  AgentsOverviewStats,
  AgentStatsFilter,
  EnrichedAgent,
  RoleSummaryItem,
} from "./types";

type RouteState = {
  agentName?: string;
  returnTo?: string;
  returnLabel?: string;
} | null;

function getAgentKey(agent: Agente): string {
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
    if (sortKey === "releaseDate") {
      const bTime = b.releaseDate ? Date.parse(b.releaseDate) : 0;
      const aTime = a.releaseDate ? Date.parse(a.releaseDate) : 0;
      return bTime - aTime || a.displayName.localeCompare(b.displayName);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function matchesStatsFilter(agent: EnrichedAgent, filter: AgentStatsFilter): boolean {
  const hasStats = (agent.globalStats?.picks ?? 0) > 0;
  if (filter === "withStats") return hasStats;
  if (filter === "withoutStats") return !hasStats;
  if (filter === "base") return Boolean(agent.isBaseContent);
  if (filter === "added") return !agent.isBaseContent;
  return true;
}

function buildRoleSummary(agents: EnrichedAgent[], roles: Role[]): RoleSummaryItem[] {
  const totalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );

  const summary = roles.map((role) => {
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
      isMostUsed: false,
      isBestWinRate: false,
    };
  });

  const mostUsed = summary.reduce<RoleSummaryItem | null>(
    (best, role) => (!best || role.picks > best.picks ? role : best),
    null,
  );
  const bestWinRate = summary
    .filter((role) => role.picks >= 4)
    .reduce<RoleSummaryItem | null>(
      (best, role) => (!best || role.winRate > best.winRate ? role : best),
      null,
    );

  return summary.map((role) => ({
    ...role,
    isMostUsed: role.displayName === mostUsed?.displayName && role.picks > 0,
    isBestWinRate:
      role.displayName === bestWinRate?.displayName && role.picks >= 4,
  }));
}

function buildOverviewStats(
  agents: EnrichedAgent[],
  roleSummary: RoleSummaryItem[],
): AgentsOverviewStats {
  const totalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );
  const agentsWithStats = agents.filter(
    (agent) => (agent.globalStats?.picks ?? 0) > 0,
  ).length;
  const mostUsedRole =
    roleSummary.find((role) => role.isMostUsed)?.displayName ?? "Sin datos";
  const bestWinRateRole =
    roleSummary.find((role) => role.isBestWinRate)?.displayName ?? "Sin datos";

  return {
    totalAgents: agents.length,
    agentsWithStats,
    mostUsedRole,
    bestWinRateRole,
    totalPicks,
  };
}

function buildInsights(
  agents: EnrichedAgent[],
  roleSummary: RoleSummaryItem[],
): AgentInsightItem[] {
  const totalPicks = agents.reduce(
    (total, agent) => total + (agent.globalStats?.picks ?? 0),
    0,
  );
  const mostUsedAgent = agents
    .filter((agent) => (agent.globalStats?.picks ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0))[0];
  const bestWinRateAgent = agents
    .filter((agent) => (agent.globalStats?.picks ?? 0) >= 4)
    .sort((a, b) => {
      const winRateDiff = (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0);
      return winRateDiff || (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
    })[0];
  const dominantRole = roleSummary.find((role) => role.isMostUsed);

  return [
    {
      label: "Agente mas usado",
      value: mostUsedAgent?.displayName ?? "Sin datos suficientes",
      hint: mostUsedAgent
        ? `${formatNumber(mostUsedAgent.globalStats?.picks)} picks globales`
        : "Aun no hay picks registrados.",
    },
    {
      label: "Mejor win rate",
      value: bestWinRateAgent?.displayName ?? "Sin muestra suficiente",
      hint: bestWinRateAgent
        ? `${formatPercent(bestWinRateAgent.globalStats?.win_rate)} WR · ${getSampleReliabilityLabel(bestWinRateAgent.globalStats?.picks)}`
        : "Necesita al menos 4 picks.",
    },
    {
      label: "Rol dominante",
      value: dominantRole?.displayName ?? "Sin datos suficientes",
      hint: dominantRole
        ? `${formatPercent(dominantRole.usagePct)} del uso global`
        : "Sin reparto de roles todavia.",
    },
    {
      label: "Picks totales",
      value: formatNumber(totalPicks),
      hint: totalPicks > 0 ? "Muestra global acumulada" : "Sin muestra global",
    },
  ];
}

function buildFilterSummary(
  agents: EnrichedAgent[],
  filteredAgents: EnrichedAgent[],
  activeRole: string | null,
  search: string,
  statsFilter: AgentStatsFilter,
  sortKey: AgentSortKey,
): AgentFilterSummary {
  const statsFilterLabels: Record<AgentStatsFilter, string> = {
    all: "Todos los agentes",
    withStats: "Con estadisticas",
    withoutStats: "Sin estadisticas",
    base: "Contenido base",
    added: "Contenido anadido",
  };
  const sortLabels: Record<AgentSortKey, string> = {
    name: "Orden por nombre",
    picks: "Orden por picks",
    winRate: "Orden por win rate",
    role: "Orden por rol",
    releaseDate: "Orden por fecha",
  };
  const activeLabels = [
    search.trim() ? `Busqueda: ${search.trim()}` : null,
    activeRole ? `Rol: ${activeRole}` : null,
    statsFilter !== "all" ? statsFilterLabels[statsFilter] : null,
    sortKey !== "name" ? sortLabels[sortKey] : null,
  ].filter((label): label is string => Boolean(label));

  return {
    total: agents.length,
    shown: filteredAgents.length,
    activeLabels,
  };
}

export function useAgentesViewModel() {
  const { data: rawAgentes, isLoading: agentesLoading, isError, error } = useAgentes();
  const { data: regions } = useRegions();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as RouteState) ?? null;
  const consumedRouteAgentNameRef = useRef<string | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<EnrichedAgent | null>(null);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statsFilter, setStatsFilter] = useState<AgentStatsFilter>("all");
  const [sortKey, setSortKey] = useState<AgentSortKey>("name");

  const agentStatsById = useMemo(
    () => regions?.[0]?.agentStats ?? {},
    [regions],
  );

  const resolveStats = useMemo(
    () => buildAgentStatsResolver(agentStatsById),
    [agentStatsById],
  );

  const agents = useMemo<EnrichedAgent[]>(() => {
    return normalizeArrayResponse<Agente>(rawAgentes)
      .map((agent) => ({ ...agent, globalStats: resolveStats(agent) }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rawAgentes, resolveStats]);

  const roles = useMemo(
    () => Array.from(new Map(agents.map((agent) => [agent.role.displayName, agent.role])).values()),
    [agents],
  );

  const roleSummary = useMemo(
    () => buildRoleSummary(agents, roles),
    [agents, roles],
  );

  const overviewStats = useMemo(
    () => buildOverviewStats(agents, roleSummary),
    [agents, roleSummary],
  );

  const insights = useMemo(
    () => buildInsights(agents, roleSummary),
    [agents, roleSummary],
  );

  const filteredAgents = useMemo(() => {
    const normalizedSearch = normalizeLabel(search);
    const filtered = agents.filter((agent) => {
      const matchesRole = !activeRole || agent.role.displayName === activeRole;
      const matchesSearch = normalizeLabel(agent.displayName).includes(normalizedSearch);
      return matchesRole && matchesSearch && matchesStatsFilter(agent, statsFilter);
    });
    return sortAgents(filtered, sortKey);
  }, [activeRole, agents, search, sortKey, statsFilter]);

  const filterSummary = useMemo(
    () =>
      buildFilterSummary(
        agents,
        filteredAgents,
        activeRole,
        search,
        statsFilter,
        sortKey,
      ),
    [activeRole, agents, filteredAgents, search, sortKey, statsFilter],
  );

  const resetFilters = () => {
    setSearch("");
    setActiveRole(null);
    setStatsFilter("all");
    setSortKey("name");
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
    agents,
    error,
    filteredAgents,
    isError,
    isLoading: agentesLoading,
    isRoleOpen,
    navigate,
    overviewStats,
    insights,
    filterSummary,
    returnLabel: routeState?.returnLabel ?? "Volver",
    returnTo: routeState?.returnTo ?? null,
    roleSummary,
    roles,
    search,
    selectedAgent,
    sortKey,
    statsFilter,
    closeDetail,
    selectAgent,
    setActiveRole,
    setIsRoleOpen,
    setSearch,
    setSortKey,
    setStatsFilter,
    resetFilters,
  };
}
