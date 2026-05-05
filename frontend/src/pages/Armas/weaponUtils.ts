import { normalizeLabel } from "../../utils/formatters";
import type { RegionWeaponStats } from "../../types/globalStats";
import type { Arma, DamageRange } from "../../types/weapons";
import type { EnrichedWeapon, WeaponSortKey, WeaponStatsFilter } from "./types";

export const STAT_LABELS: Record<string, string> = {
  fireRate: "Cadencia de disparo",
  magazineSize: "Capacidad del cargador",
  runSpeedMultiplier: "Velocidad de movimiento",
  equipTimeSeconds: "Tiempo de equipamiento",
  reloadTimeSeconds: "Tiempo de recarga",
  firstBulletAccuracy: "Precision del primer disparo",
  shotgunPelletCount: "Perdigones por disparo",
  wallPenetration: "Penetracion de pared",
  feature: "Caracteristica especial",
  fireMode: "Modo de disparo",
  altFireType: "Modo alternativo",
  zoomMultiplier: "Multiplicador de zoom",
  burstCount: "Disparos por rafaga",
};

export function normalizeWeaponCategory(category?: string | null) {
  const clean = category?.trim() ?? "";
  if (!clean || /^[-\u2013\u2014]+$/u.test(clean)) return "CUERPO A CUERPO";

  const lower = clean.toLowerCase();
  if (lower.includes("shield") || lower.includes("escudo")) return "Escudos";
  if (lower.includes("melee") || lower.includes("cuchillo")) {
    return "CUERPO A CUERPO";
  }
  if (lower.includes("sidearm")) return "Pistolas";
  if (lower.includes("smg")) return "Subfusiles";
  if (lower.includes("shotgun")) return "Escopetas";
  if (lower.includes("rifle")) return "Rifles";
  if (lower.includes("sniper")) return "Francotiradores";
  if (lower.includes("heavy")) return "Ametralladoras";

  if (clean.includes("::")) {
    const value = clean.split("::").pop()?.trim() ?? "";
    if (!value || /^[-\u2013\u2014]+$/u.test(value)) return "CUERPO A CUERPO";
    return value.toLowerCase().includes("melee") ? "CUERPO A CUERPO" : value;
  }

  return clean;
}

export function formatWeaponCost(value: unknown) {
  if (value === undefined || value === null || value === "" || value === "-") {
    return "Gratis";
  }
  const numeric = Number(value);
  if (!numeric || Number.isNaN(numeric)) return "Gratis";
  return `${numeric} creditos`;
}

export function getNumericCost(weapon: Arma) {
  const numeric = Number(weapon.cost);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatWeaponValue(value: unknown): string | number {
  if (typeof value === "string" && value.includes("::")) {
    return value.split("::").pop() ?? value;
  }
  if (typeof value === "number" || typeof value === "string") return value;
  return "-";
}

export function getWeaponSampleReliability(stats?: RegionWeaponStats) {
  const sample = stats?.rounds_equipped ?? stats?.kills ?? 0;
  if (sample <= 0) return "Sin muestra";
  if (sample <= 10) return "Muestra baja";
  if (sample <= 50) return "Muestra media";
  return "Muestra alta";
}

export function getWeaponProfileTags(weapon: Arma) {
  const tags = new Set<string>();
  const cost = getNumericCost(weapon);
  const category = normalizeWeaponCategory(weapon.category);
  const stats = weapon.stats;

  if (weapon.isShield || category === "Escudos") tags.add("escudo");
  if (category === "CUERPO A CUERPO") tags.add("cuerpo a cuerpo");
  if (cost > 0 && cost <= 1600) tags.add("economica");
  if (cost > 1600) tags.add("premium");
  if ((stats?.fireRate ?? 0) >= 10) tags.add("alta cadencia");
  if ((stats?.reloadTimeSeconds ?? 99) > 0 && (stats?.reloadTimeSeconds ?? 99) <= 2.3) {
    tags.add("recarga rapida");
  }
  if ((stats?.magazineSize ?? 0) >= 50) tags.add("cargador grande");
  if ((stats?.firstBulletAccuracy ?? 99) > 0 && (stats?.firstBulletAccuracy ?? 99) <= 0.3) {
    tags.add("precisa");
  }
  if (weapon.adsStats && Object.keys(weapon.adsStats).length > 0) {
    tags.add("tiene ADS");
  }
  if (String(stats?.wallPenetration ?? "").toLowerCase().includes("high")) {
    tags.add("buena penetracion");
  }

  return Array.from(tags);
}

export function buildWeaponStatsResolver(
  weaponStatsById: Record<string, RegionWeaponStats>,
) {
  const byName = new Map<string, RegionWeaponStats>();
  Object.values(weaponStatsById).forEach((stats) => {
    if (stats.weapon_name) byName.set(normalizeLabel(stats.weapon_name), stats);
  });

  return (weapon: Arma) =>
    weaponStatsById[weapon.uuid ?? ""] ??
    byName.get(normalizeLabel(weapon.displayName));
}

export function matchesWeaponStatsFilter(
  weapon: EnrichedWeapon,
  filter: WeaponStatsFilter,
) {
  const hasStats =
    (weapon.globalStats?.kills ?? 0) > 0 ||
    (weapon.globalStats?.rounds_equipped ?? 0) > 0;
  if (filter === "withStats") return hasStats;
  if (filter === "withoutStats") return !hasStats;
  if (filter === "weapons") return !weapon.isShield;
  if (filter === "shields") return Boolean(weapon.isShield);
  return true;
}

export function sortWeapons(weapons: EnrichedWeapon[], sortKey: WeaponSortKey) {
  return [...weapons].sort((a, b) => {
    if (sortKey === "cost") {
      return getNumericCost(a) - getNumericCost(b) || a.displayName.localeCompare(b.displayName);
    }
    if (sortKey === "category") {
      return (
        a.normalizedCategory.localeCompare(b.normalizedCategory) ||
        a.displayName.localeCompare(b.displayName)
      );
    }
    if (sortKey === "kills") {
      return (b.globalStats?.kills ?? 0) - (a.globalStats?.kills ?? 0);
    }
    if (sortKey === "headshot") {
      return (b.globalStats?.headshot_pct ?? 0) - (a.globalStats?.headshot_pct ?? 0);
    }
    if (sortKey === "rounds") {
      return (b.globalStats?.rounds_equipped ?? 0) - (a.globalStats?.rounds_equipped ?? 0);
    }
    if (sortKey === "fireRate") {
      return (b.stats?.fireRate ?? 0) - (a.stats?.fireRate ?? 0);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

export function getMaxHeadDamage(ranges?: DamageRange[] | null) {
  return Math.max(0, ...(ranges ?? []).map((range) => range.headDamage ?? 0));
}

