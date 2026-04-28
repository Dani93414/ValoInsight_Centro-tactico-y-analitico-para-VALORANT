import { useQuery } from "@tanstack/react-query";
import {
  getActos,
  getAgentes,
  getArmas,
  getBuddies,
  getCeremonies,
  getCompetitiveTiers,
  getContentSummary,
  getContentTiers,
  getContracts,
  getCurrencies,
  getEvents,
  getFlex,
  getGameModes,
  getGear,
  getLeaderboard,
  getLevelBorders,
  getMapas,
  getMapasGeo,
  getPlayerCards,
  getPlayerTitles,
  getSkins,
  getSprays,
  getVersion,
} from "./content";

const CONTENT_STALE = 1000 * 60 * 60 * 24;

export function useAgentes() {
  return useQuery({
    queryKey: ["content", "agentes"],
    queryFn: getAgentes,
    staleTime: CONTENT_STALE,
  });
}

export function useArmas() {
  return useQuery({
    queryKey: ["content", "armas"],
    queryFn: getArmas,
    staleTime: CONTENT_STALE,
  });
}

export function useContentSummary() {
  return useQuery({
    queryKey: ["content", "summary"],
    queryFn: getContentSummary,
    staleTime: CONTENT_STALE,
  });
}

export function useMapas() {
  return useQuery({
    queryKey: ["content", "mapas"],
    queryFn: getMapas,
    staleTime: CONTENT_STALE,
  });
}

export function useMapasGeo() {
  return useQuery({
    queryKey: ["content", "mapas-geo"],
    queryFn: getMapasGeo,
    staleTime: CONTENT_STALE,
  });
}

export function useActos() {
  return useQuery({
    queryKey: ["content", "actos"],
    queryFn: getActos,
    staleTime: CONTENT_STALE,
  });
}

export function useLeaderboard(actId?: string | null, region = "eu") {
  return useQuery({
    queryKey: ["leaderboard", actId, region],
    queryFn: () => getLeaderboard(actId!, region),
    enabled: Boolean(actId),
    staleTime: CONTENT_STALE,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["content", "events"],
    queryFn: getEvents,
    staleTime: CONTENT_STALE,
  });
}

export function useGameModes() {
  return useQuery({
    queryKey: ["content", "gamemodes"],
    queryFn: getGameModes,
    staleTime: CONTENT_STALE,
  });
}

export function useGear() {
  return useQuery({
    queryKey: ["content", "gear"],
    queryFn: getGear,
    staleTime: CONTENT_STALE,
  });
}

export function useSkins() {
  return useQuery({
    queryKey: ["content", "skins"],
    queryFn: getSkins,
    staleTime: CONTENT_STALE,
  });
}

export function useBuddies() {
  return useQuery({
    queryKey: ["content", "buddies"],
    queryFn: getBuddies,
    staleTime: CONTENT_STALE,
  });
}

export function useFlex() {
  return useQuery({
    queryKey: ["content", "flex"],
    queryFn: getFlex,
    staleTime: CONTENT_STALE,
  });
}

export function useLevelBorders() {
  return useQuery({
    queryKey: ["content", "levelborders"],
    queryFn: getLevelBorders,
    staleTime: CONTENT_STALE,
  });
}

export function usePlayerCards() {
  return useQuery({
    queryKey: ["content", "playercards"],
    queryFn: getPlayerCards,
    staleTime: CONTENT_STALE,
  });
}

export function usePlayerTitles() {
  return useQuery({
    queryKey: ["content", "playertitles"],
    queryFn: getPlayerTitles,
    staleTime: CONTENT_STALE,
  });
}

export function useSprays() {
  return useQuery({
    queryKey: ["content", "sprays"],
    queryFn: getSprays,
    staleTime: CONTENT_STALE,
  });
}

export function useVersion() {
  return useQuery({
    queryKey: ["content", "version"],
    queryFn: getVersion,
    staleTime: CONTENT_STALE,
  });
}

export function useCompetitiveTiers() {
  return useQuery({
    queryKey: ["content", "competitive-tiers"],
    queryFn: getCompetitiveTiers,
    staleTime: CONTENT_STALE,
  });
}

export function useContentTiers() {
  return useQuery({
    queryKey: ["content", "content-tiers"],
    queryFn: getContentTiers,
    staleTime: CONTENT_STALE,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["content", "currencies"],
    queryFn: getCurrencies,
    staleTime: CONTENT_STALE,
  });
}

export function useCeremonies() {
  return useQuery({
    queryKey: ["content", "ceremonies"],
    queryFn: getCeremonies,
    staleTime: CONTENT_STALE,
  });
}

export function useContracts() {
  return useQuery({
    queryKey: ["content", "contracts"],
    queryFn: getContracts,
    staleTime: CONTENT_STALE,
  });
}
