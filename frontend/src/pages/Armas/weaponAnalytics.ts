import { formatNumber, formatPercent } from "../../utils/formatters";
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
import { hasSufficientWeaponSample } from "./weaponUtils";

function getWeaponKey(weapon: Arma) {
  return weapon.uuid ?? weapon.displayName;
}

export function gearToWeapon(item: GearContent): Arma {
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

export function buildOverview(weapons: EnrichedWeapon[]): WeaponOverviewStats {
  const categories = new Set(weapons.map((weapon) => weapon.normalizedCategory));
  const totalKills = weapons.reduce(
    (total, weapon) => total + (weapon.globalStats?.kills ?? 0),
    0,
  );
  const topKillsWeapon = weapons
    .filter((weapon) => (weapon.globalStats?.kills ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0))[0];
  const bestHeadshotWeapon = weapons
    .filter((weapon) => hasSufficientWeaponSample(weapon.globalStats))
    .sort(
      (a, b) =>
        (b.globalStats?.headshot_pct ?? 0) -
        (a.globalStats?.headshot_pct ?? 0),
    )[0];

  return {
    totalWeapons: weapons.filter((weapon) => !weapon.isShield).length,
    totalShields: weapons.filter((weapon) => weapon.isShield).length,
    categories: categories.size,
    topKillsWeapon: topKillsWeapon?.displayName ?? "Sin datos",
    bestHeadshotWeapon: bestHeadshotWeapon?.displayName ?? "Sin datos",
    totalKills,
  };
}

export function buildRanking(weapons: EnrichedWeapon[]): WeaponRankingItem[] {
  return weapons
    .filter(
      (weapon) =>
        (weapon.globalStats?.kills ?? 0) > 0 ||
        (weapon.globalStats?.rounds_equipped ?? 0) > 0,
    )
    .map((weapon) => ({
      id: getWeaponKey(weapon),
      name: weapon.displayName,
      kills: weapon.globalStats?.kills ?? 0,
      rounds: weapon.globalStats?.rounds_equipped ?? 0,
      headshotPct: weapon.globalStats?.headshot_pct ?? 0,
      image: weapon.displayIcon,
      hasSufficientHeadshotSample: hasSufficientWeaponSample(weapon.globalStats),
    }));
}

export function buildInsights(weapons: EnrichedWeapon[]): WeaponInsightItem[] {
  const totalKills = weapons.reduce(
    (total, weapon) => total + (weapon.globalStats?.kills ?? 0),
    0,
  );
  const mostUsed = weapons
    .filter((weapon) => (weapon.globalStats?.kills ?? 0) > 0)
    .sort((a, b) => (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0))[0];
  const bestHs = weapons
    .filter((weapon) => hasSufficientWeaponSample(weapon.globalStats))
    .sort(
      (a, b) =>
        (b.globalStats?.headshot_pct ?? 0) -
        (a.globalStats?.headshot_pct ?? 0),
    )[0];
  const mostEquipped = weapons
    .filter(
      (weapon) =>
        !weapon.isShield && (weapon.globalStats?.rounds_equipped ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (b.globalStats?.rounds_equipped ?? 0) -
        (a.globalStats?.rounds_equipped ?? 0),
    )[0];
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
      label: "Arma más usada",
      value: mostUsed?.displayName ?? "Sin datos suficientes",
      hint: mostUsed
        ? `${formatNumber(mostUsed.globalStats?.kills)} kills globales`
        : "Aún no hay kills registradas.",
    },
    {
      label: "Mejor HS%",
      value: bestHs?.displayName ?? "Sin muestra suficiente",
      hint: bestHs
        ? `${formatPercent(bestHs.globalStats?.headshot_pct)} HS global`
        : "Necesita al menos 10 rondas o kills.",
    },
    {
      label: "Más equipada",
      value: mostEquipped?.displayName ?? "Sin datos suficientes",
      hint: mostEquipped
        ? `${formatNumber(mostEquipped.globalStats?.rounds_equipped)} rondas equipada`
        : "Sin rondas registradas.",
    },
    {
      label: "Categoría dominante",
      value:
        dominantCategory && dominantCategory[1] > 0
          ? dominantCategory[0]
          : "Sin datos suficientes",
      hint:
        dominantCategory && dominantCategory[1] > 0
          ? `${formatNumber(dominantCategory[1])} kills`
          : "Sin kills por categoría.",
    },
    {
      label: "Kills totales",
      value: formatNumber(totalKills),
      hint: totalKills > 0 ? "Muestra global acumulada" : "Sin muestra global",
    },
  ];
}

export function buildFilterSummary(
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
    withStats: "Con estadísticas",
    withoutStats: "Sin estadísticas",
    weapons: "Solo armas",
    shields: "Solo escudos",
  };
  const costLabels: Record<string, string> = {
    Todos: "Todos",
    Gratis: "Gratis",
    Economicas: "Económicas",
    Premium: "Premium",
  };
  const sortLabels: Record<WeaponSortKey, string> = {
    name: "Orden por nombre",
    cost: "Orden por coste",
    category: "Orden por categoría",
    kills: "Orden por kills",
    headshot: "Orden por headshot",
    rounds: "Orden por rondas",
    fireRate: "Orden por cadencia",
  };
  const activeFilters: WeaponFilterSummary["activeFilters"] = [
    search.trim() ? { key: "search", label: `Búsqueda: ${search.trim()}` } : null,
    category !== "Todas" ? { key: "category", label: `Categoría: ${category}` } : null,
    cost !== "Todos" ? { key: "cost", label: `Coste: ${costLabels[cost] ?? cost}` } : null,
    statsFilter !== "all" ? { key: "stats", label: statsLabels[statsFilter] } : null,
    sortKey !== "name" ? { key: "sort", label: sortLabels[sortKey] } : null,
  ].filter((filter): filter is WeaponFilterSummary["activeFilters"][number] =>
    Boolean(filter),
  );

  return { total: weapons.length, shown: filteredWeapons.length, activeFilters };
}
