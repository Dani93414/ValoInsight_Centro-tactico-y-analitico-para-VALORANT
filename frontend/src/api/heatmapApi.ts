import { apiUrl } from "./config.ts";

// ── Heatmap events ───────────────────────────────────────────────
export type HeatmapFilters = {
  map_id: string;
  event_type?: string;
  agent_id?: string;
  side?: string;
  season_id?: string;
  round_phase?: string;
  match_ids?: string;
  debug?: boolean;
};

export type HeatmapEventRecord = {
  x: number;
  y: number;
  weight: number;
  event_type: string;
  round_num?: number;
  round_phase?: string;
  side?: string;
  match_id?: string;
};

export type HeatmapTransformMeta = {
  xMultiplier: number;
  xScalarToAdd: number;
  yMultiplier: number;
  yScalarToAdd: number;
  axis_swap?: {
    x_from: string;
    y_from: string;
  };
  origin?: string;
  invert_y?: boolean;
};

export type HeatmapDebugMeta = {
  map_id: string;
  transform: HeatmapTransformMeta;
  fracture_bridge_reference?: {
    callout: string;
    game_x: number;
    game_y: number;
    normalized_x: number;
    normalized_y: number;
    expected_approx: {
      x: number;
      y: number;
    };
    delta: {
      x: number;
      y: number;
    };
  };
};

export type HeatmapMeta = {
  total_matches_queried?: number;
  total_matches_with_events?: number;
  total_rounds_with_events?: number;
  total_events?: number;
  map_id?: string;
  map_name?: string;
  transform?: HeatmapTransformMeta;
  debug?: HeatmapDebugMeta;
};

export type HeatmapEventsResponse = {
  events: HeatmapEventRecord[];
  meta: HeatmapMeta;
};

export type HeatmapFilterOptionsFilters = {
  map_id?: string;
  event_type?: string;
  agent_id?: string;
  side?: string;
  season_id?: string;
  round_phase?: string;
};

const EMPTY_HEATMAP_FILTER_OPTIONS = {
  maps: [],
  acts: [],
  agents: [],
  eventTypes: [],
  sides: [],
  phases: [],
};

export async function getHeatmapEvents(
  playerId: string,
  filters: HeatmapFilters,
): Promise<HeatmapEventsResponse> {
  const params = new URLSearchParams();
  params.set("map_id", filters.map_id);
  if (filters.event_type) params.set("event_type", filters.event_type);
  if (filters.agent_id) params.set("agent_id", filters.agent_id);
  if (filters.side) params.set("side", filters.side);
  if (filters.season_id) params.set("season_id", filters.season_id);
  if (filters.round_phase) params.set("round_phase", filters.round_phase);
  if (filters.match_ids) params.set("match_ids", filters.match_ids);
  if (filters.debug) params.set("debug", "true");

  const url = apiUrl(
    `/analytics/heatmap/${encodeURIComponent(playerId)}?${params.toString()}`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error heatmap events");
  return (await res.json()) as HeatmapEventsResponse;
}

export async function getHeatmapFilterOptions(
  playerId: string,
  filters?: HeatmapFilterOptionsFilters,
) {
  const params = new URLSearchParams();
  if (filters?.map_id) params.set("map_id", filters.map_id);
  if (filters?.event_type) params.set("event_type", filters.event_type);
  if (filters?.agent_id) params.set("agent_id", filters.agent_id);
  if (filters?.side) params.set("side", filters.side);
  if (filters?.season_id) params.set("season_id", filters.season_id);
  if (filters?.round_phase) params.set("round_phase", filters.round_phase);

  const qs = params.toString();
  const url = apiUrl(
    `/analytics/heatmap/${encodeURIComponent(playerId)}/filter-options${qs ? `?${qs}` : ""}`,
  );
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        "Heatmap filter options request failed, using fallback options",
        { status: res.status },
      );
      return { ...EMPTY_HEATMAP_FILTER_OPTIONS };
    }

    const data = await res.json();
    return data ?? { ...EMPTY_HEATMAP_FILTER_OPTIONS };
  } catch {
    return { ...EMPTY_HEATMAP_FILTER_OPTIONS };
  }
}

// ── Heatmap agent stats ──────────────────────────────────────────
export type HeatmapAgentStatsFilters = {
  map_id: string;
  season_id?: string;
};

export async function getHeatmapAgentStats(
  playerId: string,
  filters: HeatmapAgentStatsFilters,
) {
  const params = new URLSearchParams();
  params.set("map_id", filters.map_id);
  if (filters.season_id) params.set("season_id", filters.season_id);

  const url = apiUrl(
    `/analytics/heatmap/${encodeURIComponent(playerId)}/agent-stats?${params.toString()}`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error heatmap agent stats");
  return res.json();
}
