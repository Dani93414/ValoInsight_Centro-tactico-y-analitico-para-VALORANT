import { useQuery } from "@tanstack/react-query";
import {
  getPlayerDashboard,
  getMatchById,
  searchPlayers,
  type DashboardFilters,
} from "./playerApi";

// Player dashboard data can tolerate a few minutes of staleness
const DASHBOARD_STALE = 1000 * 60 * 5; // 5 min
// Match detail is immutable once played
const MATCH_STALE = Infinity;
// Search results are short-lived
const SEARCH_STALE = 1000 * 30; // 30 s

export function usePlayerDashboard(
  playerId: string | undefined,
  filters?: DashboardFilters,
) {
  return useQuery({
    queryKey: ["player", "dashboard", playerId, filters],
    queryFn: () => getPlayerDashboard(playerId!, filters),
    enabled: !!playerId,
    staleTime: DASHBOARD_STALE,
  });
}

export function useSearchPlayers(
  gameName: string,
  tagLine: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["players", "search", gameName, tagLine],
    queryFn: () => searchPlayers(gameName, tagLine),
    enabled,
    staleTime: SEARCH_STALE,
  });
}

export function useMatchById(matchId: string | null) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatchById(matchId!),
    enabled: !!matchId,
    staleTime: MATCH_STALE,
  });
}
