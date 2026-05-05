import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArmas, useGear, usePlayerDashboard, useRegions } from "../../api/hooks";
import { useAuth } from "../../context/AuthContext";
import { normalizeArrayResponse, normalizeLabel } from "../../utils/formatters";
import type { GearContent } from "../../types/content";
import type { Arma } from "../../types/weapons";
import type {
  EnrichedWeapon,
  WeaponSortKey,
  WeaponStatsFilter,
} from "./types";
import {
  buildFilterSummary,
  buildInsights,
  buildOverview,
  buildRanking,
  gearToWeapon,
} from "./weaponAnalytics";
import {
  calculatePersonalWeaponStats,
  compareWeaponStats,
} from "./weaponPersonalStats";
import {
  buildWeaponStatsResolver,
  getNumericCost,
  getWeaponProfileTags,
  getWeaponSampleReliability,
  matchesWeaponStatsFilter,
  normalizeWeaponCategory,
  sortWeapons,
} from "./weaponUtils";

type RouteState = {
  weaponName?: string;
  returnTo?: string;
  returnLabel?: string;
} | null;

function getWeaponKey(weapon: Arma) {
  return weapon.uuid ?? weapon.displayName;
}

export function useArmasViewModel() {
  const auth = useAuth();
  const {
    data: rawArmas,
    isLoading: weaponsLoading,
    isError: weaponsError,
    error: weaponsErrorValue,
  } = useArmas();
  const {
    data: rawGear,
    isLoading: gearLoading,
    isError: gearError,
    error: gearErrorValue,
  } = useGear();
  const { data: regions } = useRegions();
  const personalDashboardQuery = usePlayerDashboard(
    auth.user?.puuid,
    undefined,
  );
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = (location.state as RouteState) ?? null;
  const consumedRouteWeaponNameRef = useRef<string | null>(null);

  const [selectedWeapon, setSelectedWeapon] = useState<EnrichedWeapon | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [activeCost, setActiveCost] = useState("Todos");
  const [statsFilter, setStatsFilter] = useState<WeaponStatsFilter>("all");
  const [sortKey, setSortKey] = useState<WeaponSortKey>("name");

  const weaponStatsById = useMemo(
    () => regions?.[0]?.weaponStats ?? {},
    [regions],
  );
  const resolveStats = useMemo(
    () => buildWeaponStatsResolver(weaponStatsById),
    [weaponStatsById],
  );

  const weapons = useMemo<EnrichedWeapon[]>(() => {
    const contentWeapons = normalizeArrayResponse<Arma>(rawArmas);
    const shields = normalizeArrayResponse<GearContent>(rawGear)
      .filter((item) => item.displayName)
      .map(gearToWeapon);

    return [...contentWeapons, ...shields]
      .map((weapon) => {
        const globalStats = resolveStats(weapon);
        return {
          ...weapon,
          globalStats,
          normalizedCategory: normalizeWeaponCategory(weapon.category),
          profileTags: getWeaponProfileTags(weapon),
          sampleReliability: getWeaponSampleReliability(globalStats),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rawArmas, rawGear, resolveStats]);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(weapons.map((weapon) => weapon.normalizedCategory)))],
    [weapons],
  );

  const filteredWeapons = useMemo(() => {
    const normalizedSearch = normalizeLabel(search);
    const filtered = weapons.filter((weapon) => {
      const matchesSearch = normalizeLabel(weapon.displayName).includes(normalizedSearch);
      const matchesCategory =
        activeCategory === "Todas" || weapon.normalizedCategory === activeCategory;
      const numericCost = getNumericCost(weapon);
      const matchesCost =
        activeCost === "Todos" ||
        (activeCost === "Gratis" && numericCost === 0) ||
        (activeCost === "Economicas" && numericCost > 0 && numericCost <= 1600) ||
        (activeCost === "Premium" && numericCost > 1600);
      return (
        matchesSearch &&
        matchesCategory &&
        matchesCost &&
        matchesWeaponStatsFilter(weapon, statsFilter)
      );
    });
    return sortWeapons(filtered, sortKey);
  }, [activeCategory, activeCost, search, sortKey, statsFilter, weapons]);

  const weaponsByCategory = useMemo(() => {
    return filteredWeapons.reduce<Record<string, EnrichedWeapon[]>>((acc, weapon) => {
      if (!acc[weapon.normalizedCategory]) acc[weapon.normalizedCategory] = [];
      acc[weapon.normalizedCategory].push(weapon);
      return acc;
    }, {});
  }, [filteredWeapons]);

  const overviewStats = useMemo(() => buildOverview(weapons), [weapons]);
  const ranking = useMemo(() => buildRanking(weapons), [weapons]);
  const insights = useMemo(() => buildInsights(weapons), [weapons]);
  const filterSummary = useMemo(
    () =>
      buildFilterSummary(
        weapons,
        filteredWeapons,
        search,
        activeCategory,
        activeCost,
        statsFilter,
        sortKey,
      ),
    [activeCategory, activeCost, filteredWeapons, search, sortKey, statsFilter, weapons],
  );

  const personalComparison = useMemo(() => {
    if (!auth.isLoggedIn) return null;
    if (personalDashboardQuery.isLoading) {
      return {
        hasSession: true,
        isLoading: true,
        isError: false,
        hasPersonalUsage: false,
        hasGlobalReference: Boolean(selectedWeapon?.globalStats),
        sampleReliability: "Cargando",
        summary: "Cargando tus estadísticas personales...",
        metrics: [],
      };
    }
    if (personalDashboardQuery.isError) {
      return {
        hasSession: true,
        isLoading: false,
        isError: true,
        hasPersonalUsage: false,
        hasGlobalReference: Boolean(selectedWeapon?.globalStats),
        sampleReliability: "Sin datos",
        summary: "No se pudieron cargar tus estadísticas personales.",
        metrics: [],
      };
    }
    if (!selectedWeapon) return null;

    const personalStats = calculatePersonalWeaponStats(
      personalDashboardQuery.data?.analyticsList,
      selectedWeapon.uuid,
    );
    return compareWeaponStats(selectedWeapon.globalStats, personalStats);
  }, [
    auth.isLoggedIn,
    personalDashboardQuery.data?.analyticsList,
    personalDashboardQuery.isError,
    personalDashboardQuery.isLoading,
    selectedWeapon,
  ]);

  useEffect(() => {
    const routeWeaponName = routeState?.weaponName?.trim() || null;
    if (
      !routeWeaponName ||
      consumedRouteWeaponNameRef.current === routeWeaponName ||
      weapons.length === 0 ||
      selectedWeapon
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const match = weapons.find(
        (weapon) => normalizeLabel(weapon.displayName) === normalizeLabel(routeWeaponName),
      );
      if (match) setSelectedWeapon(match);
      consumedRouteWeaponNameRef.current = routeWeaponName;
    });

    return () => cancelAnimationFrame(frame);
  }, [routeState?.weaponName, selectedWeapon, weapons]);

  useEffect(() => {
    if (!selectedWeapon) return;
    const selectedKey = getWeaponKey(selectedWeapon);
    const stillVisible = filteredWeapons.some(
      (weapon) => getWeaponKey(weapon) === selectedKey,
    );
    if (stillVisible) return;
    const frame = requestAnimationFrame(() => setSelectedWeapon(null));
    return () => cancelAnimationFrame(frame);
  }, [filteredWeapons, selectedWeapon]);

  const selectWeapon = (weapon: EnrichedWeapon) => {
    const active =
      selectedWeapon && getWeaponKey(selectedWeapon) === getWeaponKey(weapon);
    setSelectedWeapon(active ? null : weapon);
  };

  const resetFilters = () => {
    setSearch("");
    setActiveCategory("Todas");
    setActiveCost("Todos");
    setStatsFilter("all");
    setSortKey("name");
  };

  const clearFilter = (key: "search" | "category" | "cost" | "stats" | "sort") => {
    if (key === "search") setSearch("");
    if (key === "category") setActiveCategory("Todas");
    if (key === "cost") setActiveCost("Todos");
    if (key === "stats") setStatsFilter("all");
    if (key === "sort") setSortKey("name");
  };

  return {
    activeCategory,
    activeCost,
    categories,
    error: weaponsErrorValue ?? gearErrorValue,
    filterSummary,
    filteredWeapons,
    insights,
    isError: weaponsError || gearError,
    isLoading: weaponsLoading || gearLoading,
    navigate,
    overviewStats,
    personalComparison,
    ranking,
    returnLabel: routeState?.returnLabel ?? "Volver",
    returnTo: routeState?.returnTo ?? null,
    search,
    selectedWeapon,
    sortKey,
    statsFilter,
    weapons,
    weaponsByCategory,
    resetFilters,
    clearFilter,
    selectWeapon,
    setActiveCategory,
    setActiveCost,
    setSearch,
    setSelectedWeapon,
    setSortKey,
    setStatsFilter,
  };
}
