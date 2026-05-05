import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";

export type AgentSortKey = "name" | "picks" | "winRate" | "role" | "releaseDate";

export type AgentStatsFilter =
  | "all"
  | "withStats"
  | "withoutStats"
  | "base"
  | "added";

export type AgentComparisonMetricKey = keyof Pick<
  RegionAgentStats,
  | "picks"
  | "wins"
  | "win_rate"
  | "pick_rate"
  | "avg_kd"
  | "avg_acs"
  | "avg_adr"
  | "avg_headshot_pct"
  | "avg_fk_rate"
  | "avg_survival_rate"
  | "avg_clutch_win_rate"
>;

export type AgentComparisonMetric = {
  key: AgentComparisonMetricKey;
  label: string;
  format: "number" | "percent";
  globalValue?: number;
  personalValue?: number;
  delta?: number;
};

export type EnrichedAgent = Agente & {
  globalStats?: RegionAgentStats;
  personalStats?: RegionAgentStats;
  comparisonMetrics: AgentComparisonMetric[];
};

export type AgentsOverviewStats = {
  totalAgents: number;
  agentsWithStats: number;
  mostUsedRole: string;
  bestWinRateRole: string;
  totalPicks: number;
};

export type AgentInsightItem = {
  agent: EnrichedAgent;
  rank: number;
};

export type AgentFilterSummary = {
  total: number;
  shown: number;
  activeLabels: string[];
};

export type RoleSummaryItem = Role & {
  agents: number;
  picks: number;
  wins: number;
  usagePct: number;
  winRate: number;
  isMostUsed: boolean;
  isBestWinRate: boolean;
};
