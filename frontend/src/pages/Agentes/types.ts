import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";

export type AgentSortKey = "name" | "picks" | "winRate" | "role";

export type EnrichedAgent = Agente & {
  globalStats?: RegionAgentStats;
  personalStats?: PersonalAgentStats | null;
  comparisonMetrics: AgentComparisonMetric[];
};

export type PersonalAgentStats = {
  picks: number;
  wins: number;
  usagePct: number;
  winRate: number;
  avg_kd?: number;
  avg_acs?: number;
  avg_adr?: number;
  avg_headshot_pct?: number;
  avg_fk_rate?: number;
  avg_survival_rate?: number;
  avg_clutch_win_rate?: number;
};

export type AgentComparisonMetric = {
  key: keyof RegionAgentStats;
  label: string;
  globalLabel: string;
  personalLabel: string;
  diffLabel: string;
};

export type AgentFilterSummary = {
  total: number;
  shown: number;
  activeLabels: string[];
};

export type AgentSelectOption = {
  value: string;
  label: string;
};

export type RoleSummaryItem = Role & {
  agents: number;
  picks: number;
  wins: number;
  usagePct: number;
  winRate: number;
};

export type TopAgentSummary = {
  key: string;
  name: string;
  roleName: string;
  picks: number;
  usagePct: number;
  winRate: number;
  displayIcon?: string | null;
};
