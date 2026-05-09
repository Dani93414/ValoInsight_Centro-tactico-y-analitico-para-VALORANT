import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";

export type AgentSortKey = "name" | "picks" | "winRate" | "role" | "score";

export type AgentTier = "S" | "A" | "B" | "C" | "D";

export type AgentProfileMetric = {
  key: "impact" | "precision" | "survival" | "clutch" | "entry" | "consistency";
  label: string;
  value: number;
};

export type AgentCompareMetric = {
  key: string;
  label: string;
  firstLabel: string;
  secondLabel: string;
  firstValue?: number;
  secondValue?: number;
  firstNormalizedLabel?: string;
  secondNormalizedLabel?: string;
  firstNormalizedValue?: number;
  secondNormalizedValue?: number;
};

export type EnrichedAgent = Agente & {
  globalStats?: RegionAgentStats;
  personalStats?: PersonalAgentStats | null;
  comparisonMetrics: AgentComparisonMetric[];
  profileMetrics: AgentProfileMetric[];
  score: number;
  tier: AgentTier;
  confidence: number;
  lowSample: boolean;
};

export type PersonalAgentStats = {
  picks: number;
  wins: number;
  losses: number;
  rounds?: number;
  kills: number;
  deaths: number;
  assists: number;
  usagePct: number;
  winRate: number;
  avg_kd?: number;
  avg_kda?: number;
  avg_acs?: number;
  avg_adr?: number;
  avg_headshot_pct?: number;
  avg_fk_rate?: number;
  avg_fd_rate?: number;
  avg_survival_rate?: number;
  avg_clutch_win_rate?: number;
  deaths_per_round?: number;
  assist_rate?: number;
  kast_pct?: number;
  trade_rate?: number;
  opening_duel_win_pct?: number;
};

export type AgentComparisonMetric = {
  key: keyof RegionAgentStats;
  label: string;
  globalLabel: string;
  personalLabel: string;
  diffLabel: string;
  normalizedDiffLabel?: string;
  diff?: number;
  normalizedDiff?: number;
  globalNormalizedLabel?: string;
  personalNormalizedLabel?: string;
  globalNormalizedValue?: number;
  personalNormalizedValue?: number;
};

export type AgentFilterSummary = {
  total: number;
  shown: number;
  activeLabels: string[];
};

export type AgentSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  helper?: string;
};

export type AgentFilterAvailability = {
  map: boolean;
  rank: boolean;
  act: boolean;
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
