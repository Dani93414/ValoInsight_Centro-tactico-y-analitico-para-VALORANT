import { useQuery } from "@tanstack/react-query";
import type { GlobalAgentStatsFilters } from "../types/globalStats";
import { getGlobalAgentStats, getRegions } from "./globalStats";

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
    enabled: Boolean(filters.region),
    placeholderData: (previousData) => previousData,
    staleTime: 1000 * 60 * 10,
  });
}
