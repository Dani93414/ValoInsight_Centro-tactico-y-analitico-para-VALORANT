import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArmas, useGear, useRegions } from "../../api/hooks";
import { normalizeArrayResponse, normalizeLabel, formatNumber, formatPercent } from "../../utils/formatters";
import type { GearContent } from "../../types/content";
import type { Arma } from "../../types/weapons";
import type {
  EnrichedWeapon,
  WeaponFilterSummary,
  WeaponInsightItem,
  WeaponOverviewStats,
  WeaponRankingItem,
  WeaponSortKey,
  WeaponStatsFilter,
} from "./types";
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

function gearToWeapon(item: GearContent): Arma {
  return {
    uuid: item.uuid,
    displayName: item.displayName,
    displayIcon: item.displayIcon || item.shopImage || null,
    category: "Escudos",
    cost: item.cost,
    description: item.description,
    isShield: true,
    stats: null,
    adsStats: null,
    damageRanges: null,
  };
}

function buildOverview(weapons: EnrichedWeapon[]): WeaponOverviewStats {
  const categories = new Set(weapons.map((weapon) => weapon.normalizedCategory));
  const totalKills = weapons.reduce(
    (total, weapon) => total + (weapon.globalStats?.kills ?? 0),
    0,
  );
  const topKillsWeapon = weapons
    .filter((weapon) => (weapon.globalStats?.kills ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0))[0];
  const bestHeadshotWeapon = weapons
    .filter((weapon) => (weapon.globalStats?.rounds_equipped ?? weapon.globalStats?.kills ?? 0) >= 10)
    .sort((a, b) => (b.globalStats?.headshot_pct ?? 0) - (a.globalStats?.headshot_pct ?? 0))[0];

  return {
    totalWeapons: weapons.filter((weapon) => !weapon.isShield).length,
    totalShields: weapons.filter((weapon) => weapon.isShield).length,
    categories: categories.size,
    topKillsWeapon: topKillsWeapon?.displayName ?? "Sin datos",
    bestHeadshotWeapon: bestHeadshotWeapon?.displayName ?? "Sin datos",
    totalKills,
  };
}

function buildRanking(weapons: EnrichedWeapon[]): WeaponRankingItem[] {
  return weapons
    .filter((weapon) => (weapon.globalStats?.kills ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0))
    .slice(0, 6)
    .map((weapon) => ({
      id: getWeaponKey(weapon),
      name: weapon.displayName,
      kills: weapon.globalStats?.kills ?? 0,
      rounds: weapon.globalStats?.rounds_equipped ?? 0,
      headshotPct: weapon.globalStats?.headshot_pct ?? 0,
      image: weapon.displayIcon,
    }));
}

function buildInsights(weapons: EnrichedWeapon[]): WeaponInsightItem[] {
  const totalKills = weapons.reduce(
    (total, weapon) => total + (weapon.globalStats?.kills ?? 0),
    0,
  );
  const mostUsed = weapons
    .filter((weapon) => (weapon.globalStats?.kills ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0))[0];
  const bestHs = weapons
    .filter((weapon) => (weapon.globalStats?.rounds_equipped ?? weapon.globalStats?.kills ?? 0) >= 10)
    .sort((a, b) => (b.globalStats?.headshot_pct ?? 0) - (a.globalStats?.headshot_pct ?? 0))[0];
  const mostEquipped = weapons
    .filter((weapon) => (weapon.globalStats?.rounds_equipped ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.rounds_equipped ?? 0) - (a.globalStats?.rounds_equipped ?? 0))[0];
  const categoryTotals = new Map<string, number>();
  weapons.forEach((weapon) => {
    categoryTotals.set(
      weapon.normalizedCategory,
      (categoryTotals.get(weapon.normalizedCategory) ?? 0) +
        (weapon.globalStats?.kills ?? 0),
    );
  });
  const dominantCategory = Array.from(categoryTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return [
    {
      label: "Arma mas usada",
      value: mostUsed?.displayName ?? "Sin datos suficientes",
      hint: mostUsed ? `${formatNumber(mostUsed.globalStats?.kills)} kills globales` : "Aun no hay kills registradas.",
    },
    {
      label: "Mejor HS%",
      value: bestHs?.displayName ?? "Sin muestra suficiente",
      hint: bestHs ? `${formatPercent(bestHs.globalStats?.headshot_pct)} HS global` : "Necesita al menos 10 rondas o kills.",
    },
    {
      label: "Mas equipada",
      value: mostEquipped?.displayName ?? "Sin datos suficientes",
      hint: mostEquipped ? `${formatNumber(mostEquipped.globalStats?.rounds_equipped)} rondas equipada` : "Sin rondas registradas.",
    },
    {
      label: "Categoria dominante",
      value: dominantCategory && dominantCategory[1] > 0 ? dominantCategory[0] : "Sin datos suficientes",
      hint: dominantCategory && dominantCategory[1] > 0 ? `${formatNumber(dominantCategory[1])} kills` : "Sin kills por categoria.",
    },
    {
      label: "Kills totales",
      value: formatNumber(totalKills),
      hint: totalKills > 0 ? "Muestra global acumulada" : "Sin muestra global",
    },
  ];
}

function buildFilterSummary(
  weapons: EnrichedWeapon[],
  filteredWeapons: EnrichedWeapon[],
  search: string,
  category: string,
  cost: string,
  statsFilter: WeaponStatsFilter,
  sortKey: WeaponSortKey,
): WeaponFilterSummary {
  const statsLabels: Record<WeaponStatsFilter, string> = {
    all: "Todo el arsenal",
    withStats: "Con estadisticas",
    withoutStats: "Sin estadisticas",
    weapons: "Solo armas",
    shields: "Solo escudos",
  };
  const sortLabels: Record<WeaponSortKey, string> = {
    name: "Orden por nombre",
    cost: "Orden por coste",
    category: "Orden por categoria",
    kills: "Orden por kills",
    headshot: "Orden por headshot",
    rounds: "Orden por rondas",
    fireRate: "Orden por cadencia",
  };
  const activeLabels = [
    search.trim() ? `Busqueda: ${search.trim()}` : null,
    category !== "Todas" ? `Categoria: ${category}` : null,
    cost !== "Todos" ? `Coste: ${cost}` : null,
    statsFilter !== "all" ? statsLabels[statsFilter] : null,
    sortKey !== "name" ? sortLabels[sortKey] : null,
  ].filter((label): label is string => Boolean(label));

  return { total: weapons.length, shown: filteredWeapons.length, activeLabels };
}

export function useArmasViewModel() {
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
    selectWeapon,
    setActiveCategory,
    setActiveCost,
    setSearch,
    setSelectedWeapon,
    setSortKey,
    setStatsFilter,
  };
}

