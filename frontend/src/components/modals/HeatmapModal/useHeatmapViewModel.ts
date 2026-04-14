import { useEffect, useMemo, useState } from "react";
import {
  useHeatmapEvents,
  useHeatmapFilterOptions,
  useMapasGeo,
} from "../../../api/hooks";
import type { HeatmapEvent } from "../HeatmapCanvas";
import type { HeatmapMeta } from "../../../api/stats";

export type { HeatmapEvent, HeatmapMeta };

export interface MapGeo {
  uuid: string;
  displayName: string;
  displayIcon?: string | null;
}

export type ViewMode = "attack-defense" | "combined" | "plants-defuses";
export type SideFilter = "" | "attack" | "defense";

export type FilterOption = {
  id: string;
  event_count: number;
  label?: string;
};

export type HeatmapFilterOptionsPayload = {
  maps?: FilterOption[];
  acts?: FilterOption[];
  agents?: FilterOption[];
  eventTypes?: FilterOption[];
  sides?: FilterOption[];
  phases?: FilterOption[];
};

export const VIEW_MODE_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: "attack-defense", label: "Ataque y Defensa" },
  { key: "combined", label: "Combinado" },
  { key: "plants-defuses", label: "Plants y Defuses" },
];

export const EVENT_TYPES = [
  { key: "kill", label: "Kills" },
  { key: "kill_enemy_position", label: "Kill (posicion enemigo)" },
  { key: "death", label: "Muertes" },
  { key: "first_blood", label: "First Blood" },
] as const;

export const ROUND_PHASES = [
  { key: "", label: "Todas" },
  { key: "early", label: "Early round" },
  { key: "mid", label: "Mid round" },
  { key: "post_plant", label: "Post-plant" },
  { key: "late", label: "Late round" },
] as const;

export const SIDE_OPTIONS: Array<{ key: SideFilter; label: string }> = [
  { key: "", label: "Ambos" },
  { key: "attack", label: "Ataque" },
  { key: "defense", label: "Defensa" },
];

export const AGENT_ALL = "__all_agents__";
export const FIXED_RADIUS_PX = 5;
export const FIXED_OPACITY = 0.75;

function areSetsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function toSortedCsv(values: Iterable<string>): string | undefined {
  const uniqueValues = [...new Set(values)]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en"));

  return uniqueValues.length > 0 ? uniqueValues.join(",") : undefined;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function useHeatmapViewModel(props: {
  playerId: string;
  agentNameMap: Record<string, string>;
  actOptions: Array<{ id: string; label: string }>;
  initialFilters?: {
    mapName?: string;
    agentId?: string;
    seasonIds?: string[];
    side?: "" | "attack" | "defense";
  };
}) {
  const { playerId, agentNameMap, actOptions, initialFilters } = props;

  const { data: mapsGeoRaw } = useMapasGeo();
  const mapsGeo = useMemo<MapGeo[]>(() => {
    return Array.isArray(mapsGeoRaw) ? (mapsGeoRaw as MapGeo[]) : [];
  }, [mapsGeoRaw]);

  const [selectedMapId, setSelectedMapId] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(["kill", "death"]),
  );
  const [selectedAgent, setSelectedAgent] = useState(AGENT_ALL);
  const [selectedSide, setSelectedSide] = useState<SideFilter>("");
  const [selectedPhase, setSelectedPhase] = useState("");
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [showSetupStep, setShowSetupStep] = useState(true);
  const [pendingMapDefaults, setPendingMapDefaults] = useState(true);
  const [initialDefaultsApplied, setInitialDefaultsApplied] = useState(false);
  const [radiusPx, setRadiusPx] = useState(FIXED_RADIUS_PX);
  const [legendExpanded, setLegendExpanded] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const heatmapDebugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    const queryValue = new URLSearchParams(window.location.search).get(
      "heatmapDebug",
    );
    return queryValue === "1" || queryValue === "true";
  }, []);

  const seasonFilter = useMemo(() => {
    if (selectedActs.size === 0) return undefined;
    return toSortedCsv(selectedActs);
  }, [selectedActs]);

  const filterOptionsFilters = useMemo(
    () => ({
      map_id: selectedMapId || undefined,
      agent_id:
        selectedAgent && selectedAgent !== AGENT_ALL
          ? selectedAgent
          : undefined,
    }),
    [selectedMapId, selectedAgent],
  );

  const {
    data: filterOptionsRaw,
    isError: filterOptionsError,
    isLoading: filterOptionsLoading,
  } = useHeatmapFilterOptions(playerId, filterOptionsFilters);
  const filterOptions =
    (filterOptionsRaw as HeatmapFilterOptionsPayload | undefined) ?? {};

  const mapNameById = useMemo(
    () =>
      new Map(mapsGeo.map((mapItem) => [mapItem.uuid, mapItem.displayName])),
    [mapsGeo],
  );

  const mapImageById = useMemo(() => {
    return new Map(
      mapsGeo.map((mapItem) => [
        mapItem.uuid,
        mapItem.displayIcon?.trim() ||
          `/content/maps/${mapItem.uuid}/displayIcon.png`,
      ]),
    );
  }, [mapsGeo]);

  const availableMaps = useMemo(() => {
    const apiMaps = filterOptions.maps ?? [];
    if (apiMaps.length > 0) {
      return apiMaps
        .map((item) => ({
          uuid: item.id,
          displayName: mapNameById.get(item.id) ?? item.label ?? item.id,
          eventCount: item.event_count,
        }))
        .sort(
          (a, b) =>
            b.eventCount - a.eventCount ||
            a.displayName.localeCompare(b.displayName, "es"),
        );
    }

    return mapsGeo
      .map((item) => ({
        uuid: item.uuid,
        displayName: item.displayName,
        eventCount: 0,
      }))
      .sort(
        (a, b) =>
          b.eventCount - a.eventCount ||
          a.displayName.localeCompare(b.displayName, "es"),
      );
  }, [filterOptions.maps, mapNameById, mapsGeo]);

  const availableMapIdSet = useMemo(
    () => new Set(availableMaps.map((mapItem) => mapItem.uuid)),
    [availableMaps],
  );

  const preferredInitialMapId = useMemo(() => {
    const mapName = initialFilters?.mapName?.trim();
    if (!mapName) return "";
    const target = normalizeText(mapName);
    const found = availableMaps.find(
      (mapItem) => normalizeText(mapItem.displayName) === target,
    );
    return found?.uuid ?? "";
  }, [initialFilters?.mapName, availableMaps]);

  const actLabelById = useMemo(
    () => new Map(actOptions.map((act) => [act.id, act.label])),
    [actOptions],
  );

  const availableActs = useMemo(() => {
    const apiActs = filterOptions.acts ?? [];
    if (apiActs.length > 0) {
      return apiActs
        .map((item) => ({
          id: item.id,
          label: actLabelById.get(item.id) ?? item.label ?? item.id,
          eventCount: item.event_count,
        }))
        .sort(
          (a, b) =>
            b.eventCount - a.eventCount || a.label.localeCompare(b.label, "es"),
        );
    }

    return actOptions
      .map((item) => ({
        id: item.id,
        label: item.label,
        eventCount: 0,
      }))
      .sort(
        (a, b) =>
          b.eventCount - a.eventCount || a.label.localeCompare(b.label, "es"),
      );
  }, [filterOptions.acts, actLabelById, actOptions]);

  const availableActIdSet = useMemo(
    () => new Set(availableActs.map((actItem) => actItem.id)),
    [availableActs],
  );

  const availableActCountById = useMemo(
    () =>
      new Map(availableActs.map((actItem) => [actItem.id, actItem.eventCount])),
    [availableActs],
  );

  const preferredActWithMatchesId = useMemo(() => {
    for (const actOption of actOptions) {
      const count = availableActCountById.get(actOption.id) ?? 0;
      if (availableActIdSet.has(actOption.id) && count > 0) {
        return actOption.id;
      }
    }

    for (const actItem of availableActs) {
      if (actItem.eventCount > 0) return actItem.id;
    }

    return availableActs[0]?.id ?? "";
  }, [actOptions, availableActCountById, availableActIdSet, availableActs]);

  const availableAgents = useMemo(() => {
    const apiAgents = filterOptions.agents ?? [];
    if (apiAgents.length > 0) {
      return apiAgents
        .map((item) => ({
          id: item.id,
          name: agentNameMap[item.id] ?? item.id,
          eventCount: item.event_count,
        }))
        .sort(
          (a, b) =>
            b.eventCount - a.eventCount || a.name.localeCompare(b.name, "es"),
        );
    }

    return Object.entries(agentNameMap)
      .map((item) => ({
        id: item[0],
        name: item[1] || item[0],
        eventCount: 0,
      }))
      .sort(
        (a, b) =>
          b.eventCount - a.eventCount || a.name.localeCompare(b.name, "es"),
      );
  }, [agentNameMap, filterOptions.agents]);

  const availableAgentIdSet = useMemo(
    () => new Set(availableAgents.map((agent) => agent.id)),
    [availableAgents],
  );

  const availableEventTypeIdSet = useMemo(
    () => new Set((filterOptions.eventTypes ?? []).map((item) => item.id)),
    [filterOptions.eventTypes],
  );

  const visibleEventTypes = useMemo(() => {
    const apiEventTypes = filterOptions.eventTypes ?? [];
    if (apiEventTypes.length === 0) return [...EVENT_TYPES];
    return EVENT_TYPES.filter((eventType) =>
      availableEventTypeIdSet.has(eventType.key),
    );
  }, [availableEventTypeIdSet, filterOptions.eventTypes]);

  const visibleEventTypeIdSet = useMemo<Set<string>>(
    () => new Set(visibleEventTypes.map((eventType) => eventType.key)),
    [visibleEventTypes],
  );

  const availableSideIdSet = useMemo(
    () => new Set((filterOptions.sides ?? []).map((item) => item.id)),
    [filterOptions.sides],
  );

  const visibleSides = useMemo(() => {
    const apiSides = filterOptions.sides ?? [];
    if (apiSides.length === 0) return [...SIDE_OPTIONS];
    return SIDE_OPTIONS.filter((sideOption) =>
      availableSideIdSet.has(sideOption.key),
    );
  }, [availableSideIdSet, filterOptions.sides]);

  const visibleSideIdSet = useMemo<Set<string>>(
    () => new Set(visibleSides.map((sideOption) => sideOption.key)),
    [visibleSides],
  );

  const availablePhaseIdSet = useMemo(
    () => new Set((filterOptions.phases ?? []).map((item) => item.id)),
    [filterOptions.phases],
  );

  const visiblePhases = useMemo(() => {
    const apiPhases = filterOptions.phases ?? [];
    if (apiPhases.length === 0) return [...ROUND_PHASES];
    return ROUND_PHASES.filter((phaseOption) =>
      availablePhaseIdSet.has(phaseOption.key),
    );
  }, [availablePhaseIdSet, filterOptions.phases]);

  const isPlantDefuseContext = useMemo(
    () =>
      viewMode === "plants-defuses" ||
      selectedEvents.has("plant") ||
      selectedEvents.has("defuse"),
    [viewMode, selectedEvents],
  );

  const selectablePhases = useMemo(
    () =>
      isPlantDefuseContext
        ? visiblePhases.filter(
            (phaseOption) => phaseOption.key !== "post_plant",
          )
        : visiblePhases,
    [isPlantDefuseContext, visiblePhases],
  );

  const visiblePhaseIdSet = useMemo<Set<string>>(
    () => new Set(selectablePhases.map((phaseOption) => phaseOption.key)),
    [selectablePhases],
  );

  // ── Effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (availableMaps.length === 0) {
        if (selectedMapId) setSelectedMapId("");
        return;
      }

      if (!selectedMapId || !availableMapIdSet.has(selectedMapId)) {
        const fallbackMapId =
          !initialDefaultsApplied && preferredInitialMapId
            ? preferredInitialMapId
            : availableMaps[0].uuid;
        setSelectedMapId(fallbackMapId);
        setPendingMapDefaults(true);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [
    availableMaps,
    availableMapIdSet,
    selectedMapId,
    initialDefaultsApplied,
    preferredInitialMapId,
  ]);

  useEffect(() => {
    if (!pendingMapDefaults || !selectedMapId || !filterOptionsRaw) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const isInitialPass = !initialDefaultsApplied;
      setSelectedAgent(AGENT_ALL);

      if (availableActs.length > 0) {
        setSelectedActs(new Set(availableActs.map((act) => act.id)));
      } else {
        setSelectedActs(new Set());
      }

      if (isInitialPass) {
        const preferredSide = initialFilters?.side ?? "";
        if (preferredSide === "attack" || preferredSide === "defense") {
          setSelectedSide(preferredSide);
        }
        setInitialDefaultsApplied(true);
      }

      setPendingMapDefaults(false);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    pendingMapDefaults,
    selectedMapId,
    filterOptionsRaw,
    availableAgents,
    availableActs,
    initialDefaultsApplied,
    initialFilters?.side,
  ]);

  useEffect(() => {
    if (pendingMapDefaults) return;

    const frame = requestAnimationFrame(() => {
      if (
        selectedAgent !== AGENT_ALL &&
        !availableAgentIdSet.has(selectedAgent)
      ) {
        setSelectedAgent(availableAgents[0]?.id ?? AGENT_ALL);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [pendingMapDefaults, selectedAgent, availableAgentIdSet, availableAgents]);

  useEffect(() => {
    if (pendingMapDefaults) return;

    const frame = requestAnimationFrame(() => {
      if (availableActs.length === 0) {
        if (selectedActs.size > 0) setSelectedActs(new Set());
        return;
      }

      setSelectedActs((previous) => {
        if (previous.size === 0) {
          return preferredActWithMatchesId
            ? new Set([preferredActWithMatchesId])
            : previous;
        }

        const next = new Set(
          [...previous].filter((actId) => availableActIdSet.has(actId)),
        );

        if (next.size === 0) {
          return preferredActWithMatchesId
            ? new Set([preferredActWithMatchesId])
            : previous;
        }

        return areSetsEqual(previous, next) ? previous : next;
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    pendingMapDefaults,
    availableActs,
    availableActIdSet,
    preferredActWithMatchesId,
    selectedActs.size,
  ]);

  useEffect(() => {
    if (viewMode === "plants-defuses") return;

    const frame = requestAnimationFrame(() => {
      const fallbackEventId = visibleEventTypes[0]?.key;
      setSelectedEvents((previous) => {
        const next = new Set(
          [...previous].filter((eventId) => visibleEventTypeIdSet.has(eventId)),
        );

        if (next.size === 0 && fallbackEventId) {
          next.add(fallbackEventId);
        }

        return areSetsEqual(previous, next) ? previous : next;
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [viewMode, visibleEventTypes, visibleEventTypeIdSet]);

  useEffect(() => {
    if (viewMode === "attack-defense") return;

    const frame = requestAnimationFrame(() => {
      if (isPlantDefuseContext) {
        if (selectedSide !== "") setSelectedSide("");
        return;
      }

      if (visibleSides.length === 0) {
        if (selectedSide !== "") setSelectedSide("");
        return;
      }

      if (!visibleSideIdSet.has(selectedSide)) {
        const fallbackSide = (visibleSides.find((item) => item.key === "")
          ?.key ?? visibleSides[0].key) as SideFilter;
        setSelectedSide(fallbackSide);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [
    viewMode,
    isPlantDefuseContext,
    visibleSides,
    visibleSideIdSet,
    selectedSide,
  ]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (selectablePhases.length === 0) {
        if (selectedPhase) setSelectedPhase("");
        return;
      }

      if (!visiblePhaseIdSet.has(selectedPhase)) {
        const fallbackPhase =
          selectablePhases.find((item) => item.key === "")?.key ??
          selectablePhases[0].key;
        setSelectedPhase(fallbackPhase);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [selectablePhases, visiblePhaseIdSet, selectedPhase]);

  // ── Query construction ───────────────────────────────────────────────

  const selectedEventTypeStr = useMemo(() => {
    if (viewMode === "plants-defuses") return "plant";
    return selectedEvents.size > 0 ? toSortedCsv(selectedEvents) : undefined;
  }, [viewMode, selectedEvents]);

  const heatmapReady = !showSetupStep && !!selectedMapId;

  const mainFilters = useMemo(() => {
    if (!heatmapReady) return null;

    const selectedAgentId =
      selectedAgent && selectedAgent !== AGENT_ALL ? selectedAgent : undefined;
    const debugFlag = heatmapDebugEnabled ? { debug: true } : {};

    if (viewMode === "attack-defense") {
      return {
        map_id: selectedMapId,
        event_type: toSortedCsv(selectedEvents),
        agent_id: selectedAgentId,
        side: "attack",
        round_phase: selectedPhase || undefined,
        season_id: seasonFilter,
        ...debugFlag,
      };
    }

    return {
      map_id: selectedMapId,
      event_type: selectedEventTypeStr,
      agent_id: selectedAgentId,
      side: isPlantDefuseContext ? undefined : selectedSide || undefined,
      round_phase: selectedPhase || undefined,
      season_id: seasonFilter,
      ...debugFlag,
    };
  }, [
    selectedMapId,
    heatmapReady,
    selectedEvents,
    selectedEventTypeStr,
    selectedAgent,
    selectedSide,
    selectedPhase,
    seasonFilter,
    isPlantDefuseContext,
    viewMode,
    heatmapDebugEnabled,
  ]);

  const secondaryFilters = useMemo(() => {
    if (!heatmapReady) return null;

    const selectedAgentId =
      selectedAgent && selectedAgent !== AGENT_ALL ? selectedAgent : undefined;
    const debugFlag = heatmapDebugEnabled ? { debug: true } : {};

    if (viewMode === "attack-defense") {
      return {
        map_id: selectedMapId,
        event_type: toSortedCsv(selectedEvents),
        agent_id: selectedAgentId,
        side: "defense",
        round_phase: selectedPhase || undefined,
        season_id: seasonFilter,
        ...debugFlag,
      };
    }

    if (viewMode === "plants-defuses") {
      return {
        map_id: selectedMapId,
        event_type: "defuse",
        agent_id: selectedAgentId,
        side: undefined,
        round_phase: selectedPhase || undefined,
        season_id: seasonFilter,
        ...debugFlag,
      };
    }

    return null;
  }, [
    selectedMapId,
    heatmapReady,
    selectedEvents,
    selectedAgent,
    selectedPhase,
    seasonFilter,
    viewMode,
    heatmapDebugEnabled,
  ]);

  // ── Data fetching ────────────────────────────────────────────────────

  const {
    data: mainData,
    isLoading: mainLoading,
    isFetching: mainFetching,
  } = useHeatmapEvents(playerId, mainFilters);

  const {
    data: secondaryData,
    isLoading: secondaryLoading,
    isFetching: secondaryFetching,
  } = useHeatmapEvents(playerId, secondaryFilters);

  // ── Derived values ───────────────────────────────────────────────────

  const mainMetaMapId =
    typeof mainData?.meta?.map_id === "string" ? mainData.meta.map_id : "";
  const secondaryMetaMapId =
    typeof secondaryData?.meta?.map_id === "string"
      ? secondaryData.meta.map_id
      : "";

  const isMainPayloadCurrentMap =
    !!selectedMapId && mainMetaMapId === selectedMapId;
  const isSecondaryPayloadCurrentMap =
    !!selectedMapId && secondaryMetaMapId === selectedMapId;

  const mainEvents: HeatmapEvent[] = isMainPayloadCurrentMap
    ? (mainData?.events ?? [])
    : [];
  const mainMeta: HeatmapMeta = isMainPayloadCurrentMap
    ? (mainData?.meta ?? {})
    : {};
  const secondaryEvents: HeatmapEvent[] = isSecondaryPayloadCurrentMap
    ? (secondaryData?.events ?? [])
    : [];
  const secondaryMeta: HeatmapMeta = isSecondaryPayloadCurrentMap
    ? (secondaryData?.meta ?? {})
    : {};

  const fractureDebugReference = mainMeta.debug?.fracture_bridge_reference;

  const mapImageUrl = selectedMapId
    ? (mapImageById.get(selectedMapId) ??
      `/content/maps/${selectedMapId}/displayIcon.png`)
    : "";

  // ── Handlers ─────────────────────────────────────────────────────────

  const toggleEvent = (eventId: string) => {
    if (!visibleEventTypeIdSet.has(eventId)) return;

    setSelectedEvents((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) {
        if (next.size === 1) return previous;
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!heatmapDebugEnabled || !heatmapReady) return;

    console.debug("[Heatmap filters]", {
      map_id: selectedMapId,
      viewMode,
      selected_event_type: toSortedCsv(selectedEvents) ?? "",
      selected_side: selectedSide,
      selected_round_phase: selectedPhase,
      selected_agent: selectedAgent,
      selected_acts: toSortedCsv(selectedActs) ?? "",
      main_event_count: mainEvents.length,
      secondary_event_count: secondaryEvents.length,
    });
  }, [
    heatmapDebugEnabled,
    heatmapReady,
    selectedMapId,
    viewMode,
    selectedEvents,
    selectedSide,
    selectedPhase,
    selectedAgent,
    selectedActs,
    mainEvents.length,
    secondaryEvents.length,
  ]);

  const toggleAct = (actId: string) => {
    if (!availableActIdSet.has(actId)) return;

    setSelectedActs((previous) => {
      const next = new Set(previous);
      if (next.has(actId)) {
        if (next.size === 1) return previous;
        next.delete(actId);
      } else {
        next.add(actId);
      }
      return next;
    });
  };

  const selectAllActs = () => {
    if (availableActs.length === 0) {
      setSelectedActs(new Set());
      return;
    }
    setSelectedActs(new Set(availableActs.map((act) => act.id)));
  };

  const deselectAllActs = () => {
    if (preferredActWithMatchesId) {
      setSelectedActs(new Set([preferredActWithMatchesId]));
      return;
    }
    setSelectedActs(new Set());
  };

  const handleMapChange = (nextMapId: string) => {
    setSelectedMapId(nextMapId);
    setSelectedAgent(AGENT_ALL);
    setSelectedActs(new Set());
    setPendingMapDefaults(true);
  };

  // ── Presentation values ──────────────────────────────────────────────

  const needsSecondary =
    viewMode === "attack-defense" || viewMode === "plants-defuses";
  const isLoading = mainLoading || (needsSecondary && secondaryLoading);
  const isFetching = mainFetching || (needsSecondary && secondaryFetching);
  const hasMainPayload = isMainPayloadCurrentMap;
  const hasSecondaryPayload = !needsSecondary || isSecondaryPayloadCurrentMap;
  const showBlockingLoader =
    !!selectedMapId &&
    (isLoading || isFetching) &&
    !(hasMainPayload && hasSecondaryPayload);
  const canvasesClass = needsSecondary
    ? "heatmap-canvases heatmap-canvases-compare"
    : "heatmap-canvases heatmap-canvases-single";

  const leftCanvasLabel = viewMode === "attack-defense" ? "ATAQUE" : "PLANTS";
  const rightCanvasLabel =
    viewMode === "attack-defense" ? "DEFENSA" : "DEFUSES";

  const legendRows = [
    {
      key: "events-main",
      label: needsSecondary ? "Eventos (izquierda)" : "Eventos",
      value: mainMeta.total_events ?? 0,
    },
    {
      key: "matches-with-events-main",
      label: needsSecondary
        ? "Partidas con eventos (izquierda)"
        : "Partidas con eventos",
      value: mainMeta.total_matches_with_events ?? 0,
    },
    {
      key: "rounds-main",
      label: needsSecondary
        ? "Rondas con eventos (izquierda)"
        : "Rondas con eventos",
      value: mainMeta.total_rounds_with_events ?? 0,
    },
    {
      key: "matches-total-main",
      label: needsSecondary
        ? "Partidas analizadas (izquierda)"
        : "Partidas analizadas",
      value: mainMeta.total_matches_queried ?? 0,
    },
    ...(needsSecondary
      ? [
          {
            key: "events-secondary",
            label: "Eventos (derecha)",
            value: secondaryMeta.total_events ?? 0,
          },
          {
            key: "matches-with-events-secondary",
            label: "Partidas con eventos (derecha)",
            value: secondaryMeta.total_matches_with_events ?? 0,
          },
        ]
      : []),
    {
      key: "fetching-state",
      label: "Estado",
      value: isFetching ? "Actualizando..." : "Estable",
    },
  ];

  return {
    // State
    selectedMapId,
    selectedEvents,
    selectedAgent,
    selectedSide,
    selectedPhase,
    selectedActs,
    viewMode,
    showSetupStep,
    radiusPx,
    legendExpanded,

    // Setters used in JSX
    setSelectedAgent,
    setSelectedSide,
    setSelectedPhase,
    setShowSetupStep,
    setViewMode,
    setRadiusPx,
    setLegendExpanded,

    // Computed
    filterOptionsError,
    filterOptionsLoading,
    availableMaps,
    availableAgents,
    availableActs,
    visibleEventTypes,
    visibleSides,
    isPlantDefuseContext,
    selectablePhases,
    heatmapDebugEnabled,
    mainEvents,
    mainMeta,
    secondaryEvents,
    secondaryMeta,
    fractureDebugReference,
    mapImageUrl,
    needsSecondary,
    showBlockingLoader,
    canvasesClass,
    leftCanvasLabel,
    rightCanvasLabel,
    legendRows,

    // Handlers
    toggleEvent,
    toggleAct,
    selectAllActs,
    deselectAllActs,
    handleMapChange,
  };
}
