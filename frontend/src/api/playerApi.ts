import { apiUrl } from "./config.ts";
import type {
  DashboardPayload,
  RankComparisonPayload,
} from "../types/dashboard";

type PlayerSummary = {
  puuid: string;
  gameName?: string;
  tagLine?: string;
  accountLevel?: number | null;
  lastMatchStartMillis?: number | null;
  lastMatchDurationMillis?: number | null;
  lastCompetitiveTier?: number | null;
  lastCompetitiveTierImage?: string | null;
};

export async function searchPlayers(gameName: string, tagLine: string) {
  const params = new URLSearchParams();
  if (gameName.trim()) params.set("gameName", gameName.trim());
  if (tagLine.trim()) params.set("tagLine", tagLine.trim());

  if (!params.toString()) return [];

  const res = await fetch(apiUrl(`/players/search?${params.toString()}`));
  if (!res.ok) return [];

  const players = (await res.json()) as PlayerSummary[];
  return players.map((p) => ({
    id: p.puuid,
    gameName: p.gameName ?? "Unknown",
    tagLine: p.tagLine ?? "",
    accountLevel: p.accountLevel ?? null,
    lastMatchStartMillis: p.lastMatchStartMillis ?? null,
    lastMatchDurationMillis: p.lastMatchDurationMillis ?? null,
    lastCompetitiveTier: p.lastCompetitiveTier ?? null,
    lastCompetitiveTierImage: p.lastCompetitiveTierImage ?? null,
    displayName: p.tagLine
      ? `${p.gameName ?? "Unknown"}#${p.tagLine}`
      : (p.gameName ?? "Unknown"),
  }));
}

export type DashboardFilters = {
  queue_id?: string;
  agent_id?: string;
  map_name?: string;
  season_id?: string;
  page?: number;
  page_size?: number;
};

export type RankComparisonFilters = {
  queue_id?: string;
  agent_id?: string;
  map_name?: string;
  season_id?: string;
  party_size?: "solo" | "duo" | "trio" | "team";
};

export async function getPlayerDashboard(
  playerId: string,
  filters?: DashboardFilters,
): Promise<DashboardPayload> {
  const params = new URLSearchParams();
  if (filters?.queue_id) params.set("queue_id", filters.queue_id);
  if (filters?.agent_id) params.set("agent_id", filters.agent_id);
  if (filters?.map_name) params.set("map_name", filters.map_name);
  if (filters?.season_id) params.set("season_id", filters.season_id);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.page_size) params.set("page_size", String(filters.page_size));

  const qs = params.toString();
  const url = apiUrl(
    `/players/${encodeURIComponent(playerId)}/dashboard${qs ? `?${qs}` : ""}`,
  );
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Error player dashboard");
  return (await res.json()) as DashboardPayload;
}

export async function getPlayerRankComparison(
  playerId: string,
  filters?: RankComparisonFilters,
): Promise<RankComparisonPayload> {
  const params = new URLSearchParams();
  if (filters?.queue_id) params.set("queue_id", filters.queue_id);
  if (filters?.agent_id) params.set("agent_id", filters.agent_id);
  if (filters?.map_name) params.set("map_name", filters.map_name);
  if (filters?.season_id) params.set("season_id", filters.season_id);
  if (filters?.party_size) params.set("party_size", filters.party_size);

  const qs = params.toString();
  const url = apiUrl(
    `/players/${encodeURIComponent(playerId)}/rank-comparison${qs ? `?${qs}` : ""}`,
  );
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Error player rank comparison");
  return (await res.json()) as RankComparisonPayload;
}

export async function getMatchById(matchId: string) {
  const res = await fetch(apiUrl(`/matches/${encodeURIComponent(matchId)}`));

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Error match detail");
  return res.json();
}
