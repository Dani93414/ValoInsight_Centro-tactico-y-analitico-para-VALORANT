import { apiUrl } from "./config.ts";

export type UserPlayer = {
  id: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  displayName: string;
  accountLevel?: number | null;
  lastMatchStartMillis?: number | null;
  lastMatchDurationMillis?: number | null;
  lastCompetitiveTier?: number | null;
  lastCompetitiveTierImage?: string | null;
  sharedMatches?: number;
};

async function userRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T | null> {
  const response = await fetch(apiUrl(path), {
    ...options,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error("No se pudo cargar la actividad del usuario");
  return (await response.json()) as T;
}

export async function getFavorites(): Promise<UserPlayer[]> {
  return (await userRequest<UserPlayer[]>("/users/me/favorites")) ?? [];
}

export async function addFavorite(puuid: string): Promise<void> {
  await userRequest(`/users/me/favorites/${encodeURIComponent(puuid)}`, {
    method: "POST",
  });
}

export async function removeFavorite(puuid: string): Promise<void> {
  await userRequest(`/users/me/favorites/${encodeURIComponent(puuid)}`, {
    method: "DELETE",
  });
}

export async function getRecentPlayers(): Promise<UserPlayer[]> {
  return (await userRequest<UserPlayer[]>("/users/me/recent")) ?? [];
}

export async function addRecentPlayer(puuid: string): Promise<void> {
  await userRequest(`/users/me/recent/${encodeURIComponent(puuid)}`, {
    method: "POST",
  });
}

export async function getFrequentPlayers(): Promise<UserPlayer[]> {
  return (await userRequest<UserPlayer[]>("/users/me/frequent")) ?? [];
}
