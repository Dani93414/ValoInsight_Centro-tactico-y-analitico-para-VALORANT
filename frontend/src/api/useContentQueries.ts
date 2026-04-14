import { useQuery } from "@tanstack/react-query";
import {
  getAgentes,
  getArmas,
  getCompetitiveTiers,
  getMapasGeo,
} from "./content";

// Content changes only on Riot patches (~every 2 weeks)
const CONTENT_STALE = 1000 * 60 * 60 * 24; // 24 h

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

export function useCompetitiveTiers() {
  return useQuery({
    queryKey: ["content", "competitive-tiers"],
    queryFn: getCompetitiveTiers,
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
