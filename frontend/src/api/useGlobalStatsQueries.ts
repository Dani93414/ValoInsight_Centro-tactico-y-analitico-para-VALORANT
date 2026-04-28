import { useQuery } from "@tanstack/react-query";
import { getRegions } from "./globalStats";

const GLOBAL_STATS_STALE = 1000 * 60 * 60;

export function useRegions() {
  return useQuery({
    queryKey: ["global-stats", "regions"],
    queryFn: getRegions,
    staleTime: GLOBAL_STATS_STALE,
  });
}
