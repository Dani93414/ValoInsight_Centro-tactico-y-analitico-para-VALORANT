import { apiUrl } from "./config";
import type {
  GlobalAgentStatsFilters,
  GlobalAgentStatsPayload,
  RegionStats,
} from "../types/globalStats";

export async function getRegions(): Promise<RegionStats[]> {
  const res = await fetch(apiUrl("/regions/"), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Error regiones");
  return res.json();
}

export async function getGlobalAgentStats(
  filters: GlobalAgentStatsFilters,
): Promise<GlobalAgentStatsPayload> {
  const params = new URLSearchParams();
  if (filters.region) params.set("region", filters.region.toUpperCase());
  if (filters.rank && filters.rank !== "all") params.set("rank", filters.rank);
  if (filters.map && filters.map !== "all") params.set("map", filters.map);
  if (filters.act && filters.act !== "all") params.set("act", filters.act);
  if (filters.role && filters.role !== "all") params.set("role", filters.role);

  const query = params.toString();
  const res = await fetch(apiUrl(`/regions/agent-stats${query ? `?${query}` : ""}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Error estadisticas globales de agentes");
  return res.json();
}
