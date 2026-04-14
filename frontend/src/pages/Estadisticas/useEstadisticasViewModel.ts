import { useEffect, useMemo, useState } from "react";
import { usePlayerDashboard, useCompetitiveTiers } from "../../api/hooks";
import { useScrollReveal } from "../../hooks/useScrollReveal";
import { useTacticalStats } from "../../hooks/useTacticalStats";
import { useDashboardStats } from "../../hooks/useDashboardStats";
import { useRankDisplay } from "../../hooks/useRankDisplay";

import type {
  MatchCard,
  DashboardMetric,
  DashboardPayload,
  CompetitiveTierAsset,
  PartySizeFilter,
  DashboardFilters,
} from "../../types/dashboard";
import { normalizeLabel } from "../../utils/formatters";
import {
  getRankNameFromTier,
  normalizeCompetitiveTierIconPath,
} from "../../utils/rankUtils";
import {
  ACT_FILTER_ALL,
  ACT_FILTER_CURRENT,
  AGENT_FILTER_ALL,
  MAP_FILTER_ALL,
  QUEUE_FILTER_ALL,
  QUEUE_FILTER_COMPETITIVE,
  INFO_ICON_TRIGGER_SELECTOR,
  QUEUE_LABELS,
  PARTY_SIZE_MAP,
} from "../../constants/dashboard";

// ── Constants ──────────────────────────────────────────────────────────
export const MATCHES_PER_PAGE = 8;
export const HISTORY_LOAD_STEP = 12;

// ── Hook ───────────────────────────────────────────────────────────────
export function useEstadisticasViewModel(playerId: string | undefined) {
  // ── Data fetching ────────────────────────────────────────────────────
  const { data: dashboardRaw, isLoading: loading } =
    usePlayerDashboard(playerId);
  const dashboard = (dashboardRaw as DashboardPayload) ?? null;

  const { data: tiersRaw } = useCompetitiveTiers();

  // ── State ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<DashboardFilters>({
    actId: ACT_FILTER_CURRENT,
    agentId: AGENT_FILTER_ALL,
    map: MAP_FILTER_ALL,
    side: "all",
    partySize: "all",
    queueId: QUEUE_FILTER_COMPETITIVE,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [agentsModalOpen, setAgentsModalOpen] = useState(false);
  const [weaponsModalOpen, setWeaponsModalOpen] = useState(false);
  const [historyVisibleCount, setHistoryVisibleCount] =
    useState(MATCHES_PER_PAGE);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // ── Floating tooltip state ───────────────────────────────────────────
  const [floatingTooltip, setFloatingTooltip] = useState<{
    visible: true;
    x: number;
    y: number;
    content: string;
  } | null>(null);

  // ── Rank name → icon map ─────────────────────────────────────────────
  const rankNameIconMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!Array.isArray(tiersRaw)) return m;
    for (const t of tiersRaw as CompetitiveTierAsset[]) {
      const tier = Number(t?.tier);
      const icon = normalizeCompetitiveTierIconPath(
        t?.smallIcon ||
          t?.largeIcon ||
          t?.rankTriangleUpIcon ||
          t?.rankTriangleDownIcon,
      );
      const tierName = normalizeLabel(t?.tierName);
      const divisionName = normalizeLabel(t?.divisionName);

      if (tierName && icon && !m.has(tierName)) m.set(tierName, icon);

      if (divisionName && icon && Number.isFinite(tier) && tier >= 3) {
        const divisionLevel = ((tier - 3) % 3) + 1;
        const divisionKey = `${divisionName} ${divisionLevel}`;
        if (!m.has(divisionKey)) m.set(divisionKey, icon);
      }

      if (Number.isFinite(tier)) {
        const english = normalizeLabel(getRankNameFromTier(tier));
        if (english && icon && !m.has(english)) m.set(english, icon);
      }
    }
    return m;
  }, [tiersRaw]);

  // ── Reset history count when filters change ──────────────────────────
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHistoryVisibleCount(MATCHES_PER_PAGE);
    });
    return () => cancelAnimationFrame(frame);
  }, [filters]);

  // ── Derived data ─────────────────────────────────────────────────────
  const player = dashboard?.player;
  const actOptions = useMemo(
    () => dashboard?.actOptions ?? [],
    [dashboard?.actOptions],
  );
  const currentActId = dashboard?.currentActId ?? actOptions[0]?.id ?? null;

  const allMatches = useMemo(() => {
    if (!dashboard) return [];
    return Object.values(dashboard.actSections).flatMap(
      (section) => section.matches ?? [],
    );
  }, [dashboard]);

  const effectiveCurrentActId = useMemo(() => {
    if (currentActId && allMatches.some((m) => m.seasonId === currentActId)) {
      return currentActId;
    }
    if (actOptions.length > 0) return actOptions[0].id;
    return null;
  }, [currentActId, allMatches, actOptions]);

  const effectiveActId = useMemo(() => {
    if (filters.actId === ACT_FILTER_ALL) return null;
    if (filters.actId === ACT_FILTER_CURRENT) return effectiveCurrentActId;
    return filters.actId;
  }, [filters.actId, effectiveCurrentActId]);

  // ── Cascading filter options ─────────────────────────────────────────
  const availableFilterOptions = useMemo(() => {
    const checkAgent = (m: MatchCard) =>
      filters.agentId === AGENT_FILTER_ALL || m.agentId === filters.agentId;
    const checkMap = (m: MatchCard) =>
      filters.map === MAP_FILTER_ALL || m.map === filters.map;
    const checkQueue = (m: MatchCard) =>
      filters.queueId === QUEUE_FILTER_ALL || m.queue === filters.queueId;
    const checkParty = (m: MatchCard) =>
      filters.partySize === "all" ||
      (PARTY_SIZE_MAP[filters.partySize] ?? []).includes(m.partySize ?? 0);
    const checkAct = (m: MatchCard) =>
      !effectiveActId || m.seasonId === effectiveActId;

    const matchesForAct = allMatches.filter(
      (m) => checkAgent(m) && checkMap(m) && checkQueue(m) && checkParty(m),
    );
    const actIds = new Set(matchesForAct.map((m) => m.seasonId));

    const matchesForAgent = allMatches.filter(
      (m) => checkAct(m) && checkMap(m) && checkQueue(m) && checkParty(m),
    );
    const agentMap = new Map<string, string>();
    matchesForAgent.forEach((m) => {
      if (m.agentId && m.agent) agentMap.set(m.agentId, m.agent);
    });

    const matchesForMap = allMatches.filter(
      (m) => checkAct(m) && checkAgent(m) && checkQueue(m) && checkParty(m),
    );
    const maps = Array.from(
      new Set(matchesForMap.map((m) => m.map).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "es"));

    const matchesForQueue = allMatches.filter(
      (m) => checkAct(m) && checkAgent(m) && checkMap(m) && checkParty(m),
    );
    const queues = Array.from(
      new Set(
        matchesForQueue.map((m) => (m.queue as string) || "").filter(Boolean),
      ),
    );

    const matchesForParty = allMatches.filter(
      (m) => checkAct(m) && checkAgent(m) && checkMap(m) && checkQueue(m),
    );
    const partySizes = new Set<number>();
    matchesForParty.forEach((m) => {
      if (m.partySize) partySizes.add(m.partySize);
    });

    return { actIds, agentMap, maps, queues, partySizes };
  }, [allMatches, effectiveActId, filters]);

  const actFilterOptions = useMemo(() => {
    const result: Array<{ id: string; label: string }> = [];
    if (
      effectiveCurrentActId &&
      availableFilterOptions.actIds.has(effectiveCurrentActId)
    ) {
      const currentActLabel =
        actOptions.find((opt) => opt.id === effectiveCurrentActId)?.label ||
        "Acto actual";
      result.push({ id: ACT_FILTER_CURRENT, label: currentActLabel });
    }
    result.push({ id: ACT_FILTER_ALL, label: "Todos los actos" });
    const filtered = actOptions.filter(
      (opt) =>
        availableFilterOptions.actIds.has(opt.id) &&
        opt.id !== effectiveCurrentActId,
    );
    result.push(...filtered);
    return result;
  }, [actOptions, availableFilterOptions.actIds, effectiveCurrentActId]);

  const agentOptions = useMemo(() => {
    return [
      { id: AGENT_FILTER_ALL, label: "Todos los agentes" },
      ...Array.from(availableFilterOptions.agentMap.entries())
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    ];
  }, [availableFilterOptions.agentMap]);

  const mapOptions = useMemo(() => {
    return [
      { id: MAP_FILTER_ALL, label: "Todos los mapas" },
      ...availableFilterOptions.maps.map((m) => ({ id: m, label: m })),
    ];
  }, [availableFilterOptions.maps]);

  const queueOptions = useMemo(() => {
    return [
      { id: QUEUE_FILTER_ALL, label: "Todos los tipos" },
      ...availableFilterOptions.queues
        .map((q) => ({
          id: q,
          label:
            QUEUE_LABELS[q.toLowerCase()] ||
            q.charAt(0).toUpperCase() + q.slice(1),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    ];
  }, [availableFilterOptions.queues]);

  const partySizeOptions = useMemo(() => {
    const ps = availableFilterOptions.partySizes;
    const opts: Array<{ value: PartySizeFilter; label: string }> = [
      { value: "all", label: "Todos" },
    ];
    if (ps.has(1)) opts.push({ value: "solo", label: "Solo" });
    if (ps.has(2)) opts.push({ value: "duo", label: "Dúo" });
    if (ps.has(3)) opts.push({ value: "trio", label: "Trío" });
    if ([4, 5].some((n) => ps.has(n)))
      opts.push({ value: "team", label: "Equipo (4-5)" });
    return opts;
  }, [availableFilterOptions.partySizes]);

  // ── Auto-reset stale filters ─────────────────────────────────────────
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFilters((prev) => {
        const next = { ...prev };
        let changed = false;

        if (
          prev.actId !== ACT_FILTER_CURRENT &&
          prev.actId !== ACT_FILTER_ALL &&
          !availableFilterOptions.actIds.has(prev.actId)
        ) {
          next.actId = ACT_FILTER_CURRENT;
          changed = true;
        }
        if (
          prev.agentId !== AGENT_FILTER_ALL &&
          !availableFilterOptions.agentMap.has(prev.agentId)
        ) {
          next.agentId = AGENT_FILTER_ALL;
          changed = true;
        }
        if (
          prev.map !== MAP_FILTER_ALL &&
          !availableFilterOptions.maps.includes(prev.map)
        ) {
          next.map = MAP_FILTER_ALL;
          changed = true;
        }
        if (
          prev.queueId !== QUEUE_FILTER_ALL &&
          !availableFilterOptions.queues.includes(prev.queueId)
        ) {
          next.queueId = QUEUE_FILTER_ALL;
          changed = true;
        }
        if (prev.partySize !== "all") {
          const validSizes = PARTY_SIZE_MAP[prev.partySize] ?? [];
          if (
            !validSizes.some((s) => availableFilterOptions.partySizes.has(s))
          ) {
            next.partySize = "all";
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [availableFilterOptions]);

  // ── Filtered matches ─────────────────────────────────────────────────
  const filteredMatches = useMemo(() => {
    return allMatches.filter((match) => {
      const matchesAct = effectiveActId
        ? match.seasonId === effectiveActId
        : true;
      const matchesAgent =
        filters.agentId === AGENT_FILTER_ALL
          ? true
          : match.agentId === filters.agentId;
      const matchesMap =
        filters.map === MAP_FILTER_ALL ? true : match.map === filters.map;
      const matchesQueue =
        filters.queueId === QUEUE_FILTER_ALL
          ? true
          : match.queue === filters.queueId;
      const matchesParty =
        filters.partySize === "all"
          ? true
          : (PARTY_SIZE_MAP[filters.partySize] ?? []).includes(
              match.partySize ?? 0,
            );

      return (
        matchesAct && matchesAgent && matchesMap && matchesQueue && matchesParty
      );
    });
  }, [
    allMatches,
    effectiveActId,
    filters.agentId,
    filters.map,
    filters.queueId,
    filters.partySize,
  ]);

  const sortedFilteredMatches = useMemo(
    () =>
      [...filteredMatches].sort(
        (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
      ),
    [filteredMatches],
  );

  const filteredAnalyticsList = useMemo(() => {
    if (!dashboard) return [];
    const ids = new Set(filteredMatches.map((m) => m.id));
    return dashboard.analyticsList.filter((a) => ids.has(a.match_id ?? a.id));
  }, [filteredMatches, dashboard]);

  // ── Hooks that depend on filtered data ───────────────────────────────
  const { globalRadarData, globalMultikillData } = useTacticalStats(
    filteredAnalyticsList,
  );

  const {
    displayedRankName,
    displayedRankVisual,
    highestRankName,
    highestRankVisual,
  } = useRankDisplay(
    allMatches,
    filteredMatches,
    filters.actId,
    effectiveCurrentActId,
    rankNameIconMap,
    dashboard?.currentRank,
  );

  const { derivedSummary, metrics, filteredShotChart } = useDashboardStats(
    filteredMatches,
    filters.side,
  );

  // ── Additional computed values ───────────────────────────────────────
  const filteredPlaytimeMillis = useMemo(() => {
    return filteredMatches.reduce(
      (sum, match) => sum + (match.playtimeMillis ?? 0),
      0,
    );
  }, [filteredMatches]);

  const latestFilteredAccountLevel = useMemo(() => {
    if (!filteredMatches.length) {
      return player?.accountLevel ?? 0;
    }
    const latestMatch = filteredMatches.reduce((latest, current) => {
      if ((current.timestamp ?? 0) > (latest.timestamp ?? 0)) {
        return current;
      }
      return latest;
    }, filteredMatches[0]);
    return latestMatch.accountLevel ?? player?.accountLevel ?? 0;
  }, [filteredMatches, player?.accountLevel]);

  const mostPlayedAgents = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        matches: number;
        image?: string | null;
        displayIcon?: string | null;
      }
    >();

    filteredMatches.forEach((match) => {
      if (!match.agentId) return;
      const current = grouped.get(match.agentId);
      const media = dashboard?.agentMediaMap?.[match.agentId];

      if (current) {
        current.matches += 1;
      } else {
        grouped.set(match.agentId, {
          id: match.agentId,
          name: match.agent || media?.name || "Agente",
          matches: 1,
          image: media?.image ?? null,
          displayIcon: media?.displayIcon ?? null,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.matches - a.matches);
  }, [filteredMatches, dashboard]);

  const mostPlayedWeapons = useMemo(() => {
    if (
      dashboard?.mostPlayedWeapons &&
      dashboard.mostPlayedWeapons.length > 0
    ) {
      return dashboard.mostPlayedWeapons;
    }

    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        kills: number;
        matches: number;
        image?: string | null;
      }
    >();

    filteredMatches.forEach((match) => {
      (match.weaponStats ?? []).forEach((weapon) => {
        const hasUsage =
          (weapon.kills ?? 0) > 0 ||
          (weapon.deaths ?? 0) > 0 ||
          (weapon.kdRatio ?? 0) > 0;
        if (!hasUsage) return;

        const key = weapon.weaponId || weapon.weaponName || "unknown";
        const current = grouped.get(key);
        if (current) {
          current.kills += weapon.kills ?? 0;
          current.matches += 1;
        } else {
          grouped.set(key, {
            id: key,
            name: weapon.weaponName || "Arma desconocida",
            kills: weapon.kills ?? 0,
            matches: 1,
            image: null,
          });
        }
      });
    });

    return Array.from(grouped.values()).sort((a, b) => b.kills - a.kills);
  }, [filteredMatches, dashboard]);

  const bestMapWinrateInsight = useMemo(() => {
    const grouped = new Map<
      string,
      { map: string; matches: number; wins: number }
    >();

    filteredMatches.forEach((match) => {
      if (!match.map || match.map === "-") return;
      const current = grouped.get(match.map) ?? {
        map: match.map,
        matches: 0,
        wins: 0,
      };
      current.matches += 1;
      if (match.result === "Victoria") current.wins += 1;
      grouped.set(match.map, current);
    });

    const sorted = Array.from(grouped.values())
      .filter((item) => item.matches > 0)
      .map((item) => ({
        map: item.map,
        matches: item.matches,
        winRate: (item.wins / item.matches) * 100,
      }))
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.matches - a.matches;
      });

    return sorted[0] ?? null;
  }, [filteredMatches]);

  const bestWeaponInsight = useMemo(() => {
    const grouped = new Map<
      string,
      { name: string; matches: number; wins: number; kills: number }
    >();

    filteredMatches.forEach((match) => {
      (match.weaponStats ?? []).forEach((weapon) => {
        const hasUsage =
          (weapon.kills ?? 0) > 0 ||
          (weapon.deaths ?? 0) > 0 ||
          (weapon.kdRatio ?? 0) > 0;
        if (!hasUsage) return;

        const key = weapon.weaponId || weapon.weaponName || "unknown";
        const current = grouped.get(key) ?? {
          name: weapon.weaponName || "Arma desconocida",
          matches: 0,
          wins: 0,
          kills: 0,
        };
        current.matches += 1;
        current.kills += weapon.kills ?? 0;
        if (match.result === "Victoria") current.wins += 1;
        grouped.set(key, current);
      });
    });

    const sorted = Array.from(grouped.values())
      .map((item) => ({
        name: item.name,
        matches: item.matches,
        kills: item.kills,
        winRate: item.matches ? (item.wins / item.matches) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.matches - a.matches;
      });

    return sorted[0] ?? dashboard?.insights?.bestWeapon ?? null;
  }, [filteredMatches, dashboard]);

  const mostPlayedAgentInsight = mostPlayedAgents[0] ?? null;

  const performanceMetrics = useMemo<DashboardMetric[]>(() => {
    return [
      {
        label: "KD",
        value: metrics.globalKd,
        percent: Math.min(
          Math.max(50 + (metrics.globalKd - 1.0) * 100, 0),
          100,
        ),
        helper: "El 50% es 1.00 de KD",
        benchmark: "Kills / Muertes.",
      },
      {
        label: filters.side !== "all" ? "Win Rate (Rondas)" : "Win Rate",
        value: metrics.globalWinRate,
        percent: Math.min(metrics.globalWinRate, 100),
        helper:
          filters.side !== "all"
            ? "Porcentaje de rondas ganadas"
            : "Porcentaje de victorias",
        benchmark: "Correspondencia en el porcentaje",
      },
      {
        label: "Headshot",
        value: metrics.globalHeadshotPct,
        percent: Math.min(
          Math.max(50 + (metrics.globalHeadshotPct - 20) * (50 / 12), 0),
          100,
        ),
        helper: "El 50% es 20% de headshots",
        benchmark: "Precisión a la cabeza",
      },
      {
        label: "ACS",
        value: metrics.globalAcs,
        percent: Math.min(
          Math.max(50 + (metrics.globalAcs - 200) * 0.5, 0),
          100,
        ),
        helper: "El 50% es 200 ACS",
        benchmark: "Impacto medio por ronda",
      },
      {
        label: "Kills / partida",
        value: metrics.killsPerMatch,
        percent: Math.min(
          Math.max(50 + (metrics.killsPerMatch - 16) * 5, 0),
          100,
        ),
        helper: "El 50% es 16 kills por partida",
        benchmark: "Kills promedias en partidas",
      },
      {
        label: "KDA",
        value: metrics.kdaOverall,
        percent: Math.min(
          Math.max(50 + (metrics.kdaOverall - 1.5) * 50, 0),
          100,
        ),
        helper: "El 50% es 1.50 de KDA",
        benchmark: "Kills + Assists / Deaths",
      },
    ];
  }, [metrics, filters.side]);

  const visibleHistoryMatches = useMemo(
    () => sortedFilteredMatches.slice(0, historyVisibleCount),
    [sortedFilteredMatches, historyVisibleCount],
  );

  const canLoadMoreHistory = historyVisibleCount < sortedFilteredMatches.length;
  const canCollapseHistory = historyVisibleCount > MATCHES_PER_PAGE;

  // ── Floating tooltip helpers ─────────────────────────────────────────
  const isHoveringInfoIcon = (target: EventTarget | null) => {
    return (
      target instanceof Element &&
      Boolean(target.closest(INFO_ICON_TRIGGER_SELECTOR))
    );
  };

  const showFloatingTooltip = (
    e: { clientX: number; clientY: number },
    content: string,
  ) => {
    if (!content?.trim()) {
      setFloatingTooltip(null);
      return;
    }
    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    setFloatingTooltip({
      visible: true,
      x: clientX + 12,
      y: clientY + 12,
      content,
    });
  };

  const moveFloatingTooltip = (e: { clientX: number; clientY: number }) => {
    const clientX = e.clientX ?? 0;
    const clientY = e.clientY ?? 0;
    setFloatingTooltip((prev) =>
      prev ? { ...prev, x: clientX + 12, y: clientY + 12 } : prev,
    );
  };

  const hideFloatingTooltip = () => setFloatingTooltip(null);

  const getFloatingInfoHoverHandlers = (content: string) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement | SVGElement>) =>
      showFloatingTooltip(e, content),
    onPointerMove: (e: React.PointerEvent<HTMLElement | SVGElement>) =>
      moveFloatingTooltip(e),
    onPointerLeave: () => hideFloatingTooltip(),
  });

  // ── Dismiss tooltip on outside interactions ──────────────────────────
  useEffect(() => {
    if (!floatingTooltip) return;

    const handlePointerDown = () => setFloatingTooltip(null);
    const handlePointerMove = (e: PointerEvent) => {
      if (!isHoveringInfoIcon(e.target)) {
        setFloatingTooltip(null);
      }
    };
    const handleScroll = () => setFloatingTooltip(null);
    const handleResize = () => setFloatingTooltip(null);
    const handleWindowBlur = () => setFloatingTooltip(null);

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [floatingTooltip]);

  // ── Scroll reveal ────────────────────────────────────────────────────
  useScrollReveal([playerId, filteredMatches.length, historyExpanded]);

  // ── Return ───────────────────────────────────────────────────────────
  return {
    // loading / data
    loading,
    dashboard,
    player,

    // filters
    filters,
    setFilters,
    filtersOpen,
    setFiltersOpen,

    // filter option lists
    actFilterOptions,
    agentOptions,
    mapOptions,
    queueOptions,
    partySizeOptions,
    availableFilterOptions,
    actOptions,

    // act resolution
    effectiveActId,
    effectiveCurrentActId,

    // modal / selection state
    selectedMatchId,
    setSelectedMatchId,
    selectedAgentId,
    setSelectedAgentId,
    heatmapOpen,
    setHeatmapOpen,
    historyModalOpen,
    setHistoryModalOpen,
    agentsModalOpen,
    setAgentsModalOpen,
    weaponsModalOpen,
    setWeaponsModalOpen,

    // history pagination
    historyVisibleCount,
    setHistoryVisibleCount,
    historyExpanded,
    setHistoryExpanded,
    visibleHistoryMatches,
    canLoadMoreHistory,
    canCollapseHistory,

    // match lists
    allMatches,
    filteredMatches,
    sortedFilteredMatches,
    filteredAnalyticsList,

    // tactical stats
    globalRadarData,
    globalMultikillData,

    // rank display
    displayedRankName,
    displayedRankVisual,
    highestRankName,
    highestRankVisual,
    rankNameIconMap,

    // dashboard stats
    derivedSummary,
    metrics,
    filteredShotChart,

    // extra computed values
    filteredPlaytimeMillis,
    latestFilteredAccountLevel,
    mostPlayedAgents,
    mostPlayedWeapons,
    bestMapWinrateInsight,
    bestWeaponInsight,
    mostPlayedAgentInsight,
    performanceMetrics,

    // floating tooltip
    floatingTooltip,
    setFloatingTooltip,
    showFloatingTooltip,
    moveFloatingTooltip,
    hideFloatingTooltip,
    getFloatingInfoHoverHandlers,
    isHoveringInfoIcon,
  };
}

// ── Exported type for the return value ─────────────────────────────────
export type EstadisticasViewModel = ReturnType<typeof useEstadisticasViewModel>;
