import { formatNumber, formatPercent } from "../../utils/formatters";
import type { RegionWeaponStats } from "../../types/globalStats";
import type { EnrichedWeapon, WeaponCompareMetric } from "./types";
import { getWeaponMetricValue } from "./weaponMetricNormalization";

type MetricConfig = {
  key:
    | "cost"
    | "rounds_equipped"
    | "kills"
    | "kills_per_round"
    | "kd_ratio"
    | "adr"
    | "headshot_pct"
    | "win_rate"
    | "survival_rate"
    | "damage_received_per_round"
    | "fireRate"
    | "magazineSize"
    | "reloadTimeSeconds"
    | "firstBulletAccuracy";
  label: string;
  format: "number" | "percent" | "credits";
  shieldsOnly?: boolean;
  weaponsOnly?: boolean;
};

const metrics: MetricConfig[] = [
  { key: "cost", label: "Coste", format: "credits" },
  { key: "rounds_equipped", label: "Rondas", format: "number" },
  { key: "kills", label: "Kills", format: "number", weaponsOnly: true },
  { key: "kills_per_round", label: "Kills / ronda", format: "number", weaponsOnly: true },
  { key: "kd_ratio", label: "KD", format: "number", weaponsOnly: true },
  { key: "adr", label: "Daño / ronda", format: "number", weaponsOnly: true },
  { key: "headshot_pct", label: "Headshot %", format: "percent", weaponsOnly: true },
  { key: "win_rate", label: "WR", format: "percent" },
  { key: "survival_rate", label: "Supervivencia", format: "percent", shieldsOnly: true },
  { key: "damage_received_per_round", label: "Daño recibido / ronda", format: "number", shieldsOnly: true },
  { key: "fireRate", label: "Cadencia", format: "number", weaponsOnly: true },
  { key: "magazineSize", label: "Cargador", format: "number", weaponsOnly: true },
  { key: "reloadTimeSeconds", label: "Recarga", format: "number", weaponsOnly: true },
  { key: "firstBulletAccuracy", label: "Precision primer disparo", format: "number", weaponsOnly: true },
];

function numberValue(weapon: EnrichedWeapon, key: MetricConfig["key"]) {
  if (key === "cost") return Number(weapon.cost) || 0;
  if (key in (weapon.stats ?? {})) {
    const value = weapon.stats?.[key as keyof NonNullable<EnrichedWeapon["stats"]>];
    return typeof value === "number" ? value : undefined;
  }
  return getWeaponMetricValue(weapon.globalStats as RegionWeaponStats | undefined, key as never);
}

function formatValue(value: number | undefined, format: MetricConfig["format"]) {
  if (value === undefined || Number.isNaN(value)) return "-";
  if (format === "percent") return formatPercent(value);
  if (format === "credits") return value > 0 ? `${formatNumber(value, 0)} cr` : "Gratis";
  return formatNumber(value, value % 1 === 0 ? 0 : 2);
}

export function buildWeaponCompareMetrics(
  first: EnrichedWeapon,
  second: EnrichedWeapon,
): WeaponCompareMetric[] {
  const bothShields = Boolean(first.isShield && second.isShield);
  const anyShield = Boolean(first.isShield || second.isShield);
  return metrics
    .filter((metric) => {
      if (metric.shieldsOnly) return bothShields;
      if (metric.weaponsOnly) return !anyShield;
      return true;
    })
    .map((metric) => {
      const firstValue = numberValue(first, metric.key);
      const secondValue = numberValue(second, metric.key);
      return {
        key: metric.key,
        label: metric.label,
        firstLabel: formatValue(firstValue, metric.format),
        secondLabel: formatValue(secondValue, metric.format),
        firstValue,
        secondValue,
      };
    });
}
