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
  AgentComparisonMetric,
  AgentComparisonMetricKey,
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

type PersonalAccumulator = {
  picks: number;
  wins: number;
  kdTotal: number;
  kdCount: number;
  acsTotal: number;
  acsCount: number;
  adrTotal: number;
  adrCount: number;
  hsTotal: number;
  hsCount: number;
  fkTotal: number;
  fkCount: number;
  survivalTotal: number;
  survivalCount: number;
  clutchTotal: number;
  clutchCount: number;
};

const comparisonDefinitions: Array<{
  key: AgentComparisonMetricKey;
  label: string;
  format: "number" | "percent";
}> = [
  { key: "picks", label: "Picks / uso", format: "number" },
  { key: "wins", label: "Victorias", format: "number" },
  { key: "win_rate", label: "Win rate", format: "percent" },
  { key: "pick_rate", label: "Pick rate", format: "percent" },
  { key: "avg_kd", label: "KD medio", format: "number" },
  { key: "avg_acs", label: "ACS medio", format: "number" },
  { key: "avg_adr", label: "ADR medio", format: "number" },
  { key: "avg_headshot_pct", label: "Headshot", format: "percent" },
  { key: "avg_fk_rate", label: "FK rate", format: "percent" },
  { key: "avg_survival_rate", label: "Supervivencia", format: "percent" },
  { key: "avg_clutch_win_rate", label: "Clutch WR", format: "percent" },
];

function getAgentKey(agent: Agente): string {
  return agent.uuid ?? agent.id ?? agent.displayName;
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function addAverage(
  accumulator: PersonalAccumulator,
  totalKey: keyof PersonalAccumulator,
  countKey: keyof PersonalAccumulator,
  value: number | undefined,
) {
  if (value === undefined) return;
  accumulator[totalKey] = Number(accumulator[totalKey]) + value;
  accumulator[countKey] = Number(accumulator[countKey]) + 1;
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
    if (sortKey === "picks") return (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
    if (sortKey === "winRate") return (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0);
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

function buildPersonalAgentStats(matches?: AnalyticsMatch[]): Record<string, RegionAgentStats> {
  const byAgent = new Map<string, PersonalAccumulator>();

  for (const match of matches ?? []) {
    const rawName = match.agent_name || match.agent_id;
    if (!rawName) continue;
    const key = normalizeLabel(rawName);
    const current = byAgent.get(key) ?? {
      picks: 0,
      wins: 0,
      kdTotal: 0,
      kdCount: 0,
      acsTotal: 0,
      acsCount: 0,
      adrTotal: 0,
      adrCount: 0,
      hsTotal: 0,
      hsCount: 0,
      fkTotal: 0,
      fkCount: 0,
      survivalTotal: 0,
      survivalCount: 0,
      clutchTotal: 0,
      clutchCount: 0,
    };

    current.picks += 1;
    if (match.won_match) current.wins += 1;

    const overview = match.overview;
    const kd = toFiniteNumber(overview?.kd_ratio);
    const acs = toFiniteNumber(overview?.acs);
    const adr = toFiniteNumber(overview?.adr);
    const hs = toFiniteNumber(overview?.headshot_pct);
    const fkRate = toFiniteNumber(overview?.opening_duel_win_pct);
    const survival = toFiniteNumber(overview?.survival_rate);
    const clutch = toFiniteNumber(overview?.clutch_win_rate);

    addAverage(current, "kdTotal", "kdCount", kd);
    addAverage(current, "acsTotal", "acsCount", acs);
    addAverage(current, "adrTotal", "adrCount", adr);
    addAverage(current, "hsTotal", "hsCount", hs);
    addAverage(current, "fkTotal", "fkCount", fkRate);
    addAverage(current, "survivalTotal", "survivalCount", survival);
    addAverage(current, "clutchTotal", "clutchCount", clutch);

    byAgent.set(key, current);
  }

  return Object.fromEntries(
    Array.from(byAgent.entries()).map(([key, value]) => [
      key,
      {
        agent_name: key,
        picks: value.picks,
        wins: value.wins,
        win_rate: safeDivide(value.wins * 100, value.picks),
        pick_rate: undefined,
        avg_kd: safeDivide(value.kdTotal, value.kdCount),
        avg_acs: safeDivide(value.acsTotal, value.acsCount),
        avg_adr: safeDivide(value.adrTotal, value.adrCount),
        avg_headshot_pct: safeDivide(value.hsTotal, value.hsCount),
        avg_fk_rate: safeDivide(value.fkTotal, value.fkCount),
        avg_survival_rate: safeDivide(value.survivalTotal, value.survivalCount),
        avg_clutch_win_rate: safeDivide(value.clutchTotal, value.clutchCount),
      },
    ]),
  );
}

function getComparableValue(stats: RegionAgentStats | undefined, key: AgentComparisonMetricKey) {
  return toFiniteNumber(stats?.[key]);
}

function buildComparisonMetrics(
  globalStats?: RegionAgentStats,
  personalStats?: RegionAgentStats,
): AgentComparisonMetric[] {
  return comparisonDefinitions
    .map((definition) => {
      const globalValue = getComparableValue(globalStats, definition.key);
      const personalValue = getComparableValue(personalStats, definition.key);
      return {
        ...definition,
        globalValue,
        personalValue,
        delta:
          globalValue !== undefined && personalValue !== undefined
            ? personalValue - globalValue
            : undefined,
      };
    })
    .filter((metric) => metric.globalValue !== undefined || metric.personalValue !== undefined);
}

function buildRoleSummary(agents: EnrichedAgent[], roles: Role[]): RoleSummaryItem[] {
  const totalPicks = agents.reduce((total, agent) => total + (agent.globalStats?.picks ?? 0), 0);
  const summary = roles.map((role) => {
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
      isMostUsed: false,
      isBestWinRate: false,
    };
  });
  const mostUsed = summary.reduce<RoleSummaryItem | null>((best, role) => (!best || role.picks > best.picks ? role : best), null);
  const bestWinRate = summary
    .filter((role) => role.picks >= 4)
    .reduce<RoleSummaryItem | null>((best, role) => (!best || role.winRate > best.winRate ? role : best), null);
  return summary.map((role) => ({
    ...role,
    isMostUsed: role.displayName === mostUsed?.displayName && role.picks > 0,
    isBestWinRate: role.displayName === bestWinRate?.displayName && role.picks >= 4,
  }));
}

function buildOverviewStats(agents: EnrichedAgent[], roleSummary: RoleSummaryItem[]): AgentsOverviewStats {
  const totalPicks = agents.reduce((total, agent) => total + (agent.globalStats?.picks ?? 0), 0);
  const agentsWithStats = agents.filter((agent) => (agent.globalStats?.picks ?? 0) > 0).length;
  return {
    totalAgents: agents.length,
    agentsWithStats,
    mostUsedRole: roleSummary.find((role) => role.isMostUsed)?.displayName ?? "Sin datos",
    bestWinRateRole: roleSummary.find((role) => role.isBestWinRate)?.displayName ?? "Sin datos",
    totalPicks,
  };
}

function buildInsights(agents: EnrichedAgent[]): AgentInsightItem[] {
  return agents
    .filter((agent) => (agent.globalStats?.picks ?? 0) > 0)
    .sort((a, b) => {
      const picksDiff = (b.globalStats?.picks ?? 0) - (a.globalStats?.picks ?? 0);
      return picksDiff || (b.globalStats?.win_rate ?? 0) - (a.globalStats?.win_rate ?? 0);
    })
    .slice(0, 3)
    .map((agent, index) => ({ agent, rank: index + 1 }));
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
    withStats: "Con estadísticas",
    withoutStats: "Sin estadísticas",
    base: "Contenido base",
    added: "Contenido añadido",
  };
  const sortLabels: Record<AgentSortKey, string> = {
    name: "Orden por nombre",
    picks: "Orden por picks",
    winRate: "Orden por win rate",
    role: "Orden por rol",
    releaseDate: "Orden por fecha",
  };
  const activeLabels = [
    search.trim() ? `Búsqueda: ${search.trim()}` : null,
    activeRole ? `Rol: ${activeRole}` : null,
    statsFilter !== "all" ? statsFilterLabels[statsFilter] : null,
    sortKey !== "name" ? sortLabels[sortKey] : null,
  ].filter((label): label is string => Boolean(label));
  return { total: agents.length, shown: filteredAgents.length, activeLabels };
}

export function useAgentesViewModel() {
  const auth = useAuth();
  const { data: rawAgentes, isLoading: agentesLoading, isError, error } = useAgentes();
  const { data: regions } = useRegions();
  const playerDashboard = usePlayerDashboard(auth.user?.puuid, undefined);
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

  const agentStatsById = useMemo(() => regions?.[0]?.agentStats ?? {}, [regions]);
  const resolveStats = useMemo(() => buildAgentStatsResolver(agentStatsById), [agentStatsById]);
  const personalStatsByAgent = useMemo(
    () => buildPersonalAgentStats(playerDashboard.data?.analyticsList),
    [playerDashboard.data?.analyticsList],
  );

  const agents = useMemo<EnrichedAgent[]>(() => {
    return normalizeArrayResponse<Agente>(rawAgentes)
      .map((agent) => {
        const globalStats = resolveStats(agent);
        const personalStats = personalStatsByAgent[normalizeLabel(agent.displayName)];
        return {
          ...agent,
          globalStats,
          personalStats,
          comparisonMetrics: buildComparisonMetrics(globalStats, personalStats),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [personalStatsByAgent, rawAgentes, resolveStats]);

  const roles = useMemo(
    () => Array.from(new Map(agents.map((agent) => [agent.role.displayName, agent.role])).values()),
    [agents],
  );
  const roleSummary = useMemo(() => buildRoleSummary(agents, roles), [agents, roles]);
  const overviewStats = useMemo(() => buildOverviewStats(agents, roleSummary), [agents, roleSummary]);
  const insights = useMemo(() => buildInsights(agents), [agents]);

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
    () => buildFilterSummary(agents, filteredAgents, activeRole, search, statsFilter, sortKey),
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
    isLoggedIn: auth.isLoggedIn,
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
