import { useQuery } from "@tanstack/react-query";
import type { GlobalAgentStatsFilters, GlobalMapStatsFilters } from "../types/globalStats";
import { getGlobalAgentStats, getGlobalMapStats, getRegions } from "./globalStats";

const GLOBAL_STATS_STALE = 0;

export function useRegions() {
  return useQuery({
    queryKey: ["global-stats", "regions"],
    queryFn: getRegions,
    staleTime: GLOBAL_STATS_STALE,
    refetchOnMount: "always",
  });
}

export function useGlobalAgentStats(filters: GlobalAgentStatsFilters) {
  return useQuery({
    queryKey: [
      "global-stats",
      "agent-stats",
      filters.region ?? "",
      filters.rank ?? "all",
      filters.map ?? "all",
      filters.act ?? "all",
    ],
    queryFn: () => getGlobalAgentStats(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}

export function useGlobalMapStats(filters: GlobalMapStatsFilters) {
  return useQuery({
    queryKey: [
      "global-stats",
      "map-stats",
      filters.region ?? "",
      filters.rank ?? "all",
      filters.map ?? "all",
      filters.act ?? "all",
      filters.agent ?? "all",
    ],
    queryFn: () => getGlobalMapStats(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
