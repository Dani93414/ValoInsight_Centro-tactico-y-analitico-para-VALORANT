import { apiUrl } from "./config.ts";

type PlayerSummary = {
  puuid: string;
  gameName?: string;
  tagLine?: string;
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
    displayName: p.tagLine ? `${p.gameName ?? "Unknown"}#${p.tagLine}` : (p.gameName ?? "Unknown"),
  }));
}

export async function getPlayerStats(playerId: string) {
  const res = await fetch(apiUrl(`/players/${encodeURIComponent(playerId)}/stats`));
  if (!res.ok) throw new Error("Error player stats");
  return res.json();
}

export async function getPlayerDashboard(playerId: string, limit = 500) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  const res = await fetch(
    apiUrl(`/players/${encodeURIComponent(playerId)}/dashboard?${params.toString()}`)
  );
  if (!res.ok) throw new Error("Error player dashboard");
  return res.json();
}

export async function getMatchesByPlayer(playerId: string, limit = 1000) {
  const res = await fetch(
    apiUrl(`/matches/player/${encodeURIComponent(playerId)}?limit=${encodeURIComponent(String(limit))}`)
  );

  if (!res.ok) throw new Error("Error player matches");
  return res.json();
}

export async function getMatchById(matchId: string) {
  const res = await fetch(apiUrl(`/matches/${encodeURIComponent(matchId)}`));

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Error match detail");
  return res.json();
}
