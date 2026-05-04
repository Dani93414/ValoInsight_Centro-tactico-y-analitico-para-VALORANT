import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAgentes, useRegions } from "../../api/hooks";
import { normalizeArrayResponse, normalizeLabel, safeDivide } from "../../utils/formatters";
import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";
import type {
  AgentSortKey,
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
    .filter((role) => role.picks > 0)
    .reduce<RoleSummaryItem | null>(
      (best, role) => (!best || role.winRate > best.winRate ? role : best),
      null,
    );

  return summary.map((role) => ({
    ...role,
    isMostUsed: role.displayName === mostUsed?.displayName && role.picks > 0,
    isBestWinRate:
      role.displayName === bestWinRate?.displayName && role.picks > 0,
  }));
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

  const filteredAgents = useMemo(() => {
    const normalizedSearch = normalizeLabel(search);
    const filtered = agents.filter((agent) => {
      const matchesRole = !activeRole || agent.role.displayName === activeRole;
      const matchesSearch = normalizeLabel(agent.displayName).includes(normalizedSearch);
      return matchesRole && matchesSearch && matchesStatsFilter(agent, statsFilter);
    });
    return sortAgents(filtered, sortKey);
  }, [activeRole, agents, search, sortKey, statsFilter]);

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
  };
}

