// Barrel re-export — domain-scoped hooks live in useContentQueries / usePlayerQueries / useHeatmapQueries
export {
  useAgentes,
  useArmas,
  useCompetitiveTiers,
  useMapasGeo,
} from "./useContentQueries";

export {
  usePlayerDashboard,
  useSearchPlayers,
  useMatchById,
} from "./usePlayerQueries";

export {
  useHeatmapEvents,
  useHeatmapAgentStats,
  useHeatmapFilterOptions,
} from "./useHeatmapQueries";
