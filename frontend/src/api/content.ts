import { apiUrl } from "./config.ts";
import type {
  ActContent,
  BuddyContent,
  BundleContent,
  CeremonyContent,
  CompetitiveTierContent,
  ContentSummary,
  ContentTierContent,
  ContractContent,
  CurrencyContent,
  EventContent,
  FlexContent,
  GameModeContent,
  GearContent,
  LeaderboardContent,
  LeaderboardRankDistributionItem,
  LevelBorderContent,
  MapGroups,
  PlayerCardContent,
  PlayerTitleContent,
  SkinContent,
  SprayContent,
  ThemeContent,
  VersionInfo,
} from "../types/content";

async function getJson<T>(path: string, errorMessage: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(errorMessage);
  return res.json();
}

export async function getAgentes() {
  return getJson("/content/agentes", "Error agentes");
}

export async function getArmas() {
  return getJson("/content/armas", "Error armas");
}

export async function getContentSummary(): Promise<ContentSummary> {
  return getJson("/content/resumen", "Error resumen contenido");
}

export async function getMapas(): Promise<MapGroups> {
  const res = await fetch(apiUrl("/content/mapas"));
  if (!res.ok) throw new Error("Error mapas");
  return res.json();
}

export async function getMapasGeo() {
  const res = await fetch(apiUrl("/content/mapas-geo"));
  if (!res.ok) throw new Error("Error mapas geo");
  return res.json();
}

export async function getActos(): Promise<ActContent[]> {
  return getJson("/content/actos", "Error actos");
}

export async function getLeaderboard(
  actId: string,
  region = "eu",
  platform = "pc",
  limit = 100,
  page = 1,
  search = "",
  gameName = "",
  tagLine = "",
): Promise<LeaderboardContent> {
  const params = new URLSearchParams({ region, platform, limit: String(limit), page: String(page) });
  if (search.trim()) params.set("search", search.trim());
  if (gameName.trim()) params.set("game_name", gameName.trim());
  if (tagLine.trim()) params.set("tag_line", tagLine.trim());
  return getJson(
    `/leaderboards/${encodeURIComponent(actId)}?${params.toString()}`,
    "Error leaderboard",
  );
}

export async function getLeaderboardRegions(): Promise<string[]> {
  return getJson("/leaderboards/meta/regions", "Error regiones leaderboard");
}

export async function getRankDistribution(actIds: string[]): Promise<LeaderboardRankDistributionItem[]> {
  const params = new URLSearchParams({ act_ids: actIds.join(",") });
  return getJson(
    `/leaderboards/meta/rank-distribution?${params.toString()}`,
    "Error distribucion de rangos",
  );
}

export async function getEvents(): Promise<EventContent[]> {
  return getJson("/content/events", "Error eventos");
}

export async function getGameModes(): Promise<GameModeContent[]> {
  return getJson("/content/gamemodes", "Error modos de juego");
}

export async function getGear(): Promise<GearContent[]> {
  return getJson("/content/gear", "Error gear");
}

export async function getSkins(): Promise<SkinContent[]> {
  return getJson("/content/skins", "Error skins");
}

export async function getBuddies(): Promise<BuddyContent[]> {
  return getJson("/content/buddies", "Error buddies");
}

export async function getBundles(): Promise<BundleContent[]> {
  return getJson("/content/bundles", "Error bundles");
}

export async function getFlex(): Promise<FlexContent[]> {
  return getJson("/content/flex", "Error flex");
}

export async function getLevelBorders(): Promise<LevelBorderContent[]> {
  return getJson("/content/levelborders", "Error bordes de nivel");
}

export async function getPlayerCards(): Promise<PlayerCardContent[]> {
  return getJson("/content/playercards", "Error tarjetas");
}

export async function getPlayerTitles(): Promise<PlayerTitleContent[]> {
  return getJson("/content/playertitles", "Error titulos");
}

export async function getSprays(): Promise<SprayContent[]> {
  return getJson("/content/sprays", "Error sprays");
}

export async function getThemes(): Promise<ThemeContent[]> {
  return getJson("/content/themes", "Error themes");
}

export async function getVersion(): Promise<VersionInfo> {
  return getJson("/content/version", "Error version");
}

export async function getCompetitiveTiers(): Promise<
  CompetitiveTierContent[]
> {
  return getJson("/content/competitive-tiers", "Error competitive tiers");
}

export async function getContentTiers(): Promise<ContentTierContent[]> {
  return getJson("/content/content-tiers", "Error content tiers");
}

export async function getCurrencies(): Promise<CurrencyContent[]> {
  return getJson("/content/currencies", "Error currencies");
}

export async function getCeremonies(): Promise<CeremonyContent[]> {
  return getJson("/content/ceremonies", "Error ceremonies");
}

export async function getContracts(): Promise<ContractContent[]> {
  return getJson("/content/contracts", "Error contracts");
}
