import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";

export type AgentSortKey = "name" | "picks" | "winRate" | "role";

export type AgentScopedFilter = "all" | string;

export type EnrichedAgent = Agente & {
  globalStats?: RegionAgentStats;
  personalStats?: PersonalAgentStats | null;
};

export type PersonalAgentStats = {
  picks: number;
  wins: number;
  usagePct: number;
  winRate: number;
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
  winRate: number;
  displayIcon?: string | null;
};

export type AgentComparisonInsight = {
  key: string;
  agentName: string;
  roleName: string;
  globalPicks: number;
  globalUsagePct: number;
  globalWinRate: number;
  personalPicks?: number;
  personalUsagePct?: number;
  personalWinRate?: number;
};

export type AgentsInsightsModel = {
  hasSession: boolean;
  isLoadingPersonal: boolean;
  hasPersonalData: boolean;
  rows: AgentComparisonInsight[];
};
