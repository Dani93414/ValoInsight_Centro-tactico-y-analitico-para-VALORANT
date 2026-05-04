import type { Agente, Role } from "../../types/agents";
import type { RegionAgentStats } from "../../types/globalStats";

export type AgentSortKey = "name" | "picks" | "winRate" | "role" | "releaseDate";

export type AgentStatsFilter =
  | "all"
  | "withStats"
  | "withoutStats"
  | "base"
  | "added";

export type EnrichedAgent = Agente & {
  globalStats?: RegionAgentStats;
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

