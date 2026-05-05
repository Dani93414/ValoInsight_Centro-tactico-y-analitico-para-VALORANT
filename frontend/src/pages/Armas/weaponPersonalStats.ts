import { formatNumber, formatPercent } from "../../utils/formatters";
import type { RegionWeaponStats } from "../../types/globalStats";
import type { AnalyticsMatch } from "../../types/dashboard";
import { calculateWeaponStats } from "../../components/modals/WeaponDetailModalUtils";
import type {
  PersonalWeaponStats,
  WeaponComparisonMetric,
  WeaponComparisonTone,
  WeaponPersonalComparison,
} from "./types";

function diffTone(diff: number, threshold: number, higherIsBetter = true): WeaponComparisonTone {
  if (Math.abs(diff) < threshold) return "neutral";
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;
  return isPositive ? "positive" : "improve";
}

function signedNumber(value: number, decimals = 1, suffix = "") {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)}${suffix}`;
}

export function getPersonalWeaponSampleReliability(rounds: number, kills: number) {
  const sample = rounds || kills;
  if (sample <= 0) return "Sin muestra";
  if (sample <= 10) return "Muestra baja";
  if (sample <= 50) return "Muestra media";
  return "Muestra alta";
}

export function calculatePersonalWeaponStats(
  analyticsList: AnalyticsMatch[] | undefined,
  weaponId?: string | null,
): PersonalWeaponStats | null {
  if (!analyticsList || !weaponId) return null;
  const stats = calculateWeaponStats(analyticsList, weaponId);
  if (stats.matchesUsed <= 0 && stats.rounds <= 0 && stats.kills <= 0) return null;

  return {
    matchesUsed: stats.matchesUsed,
    rounds: stats.rounds,
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    damageDealt: stats.damageDealt,
    headshotPct: stats.headshotPct,
    kd: stats.kd,
    killsPerRound: stats.killsPerRound,
    damagePerRound: stats.damagePerRound,
    sampleReliability: getPersonalWeaponSampleReliability(stats.rounds, stats.kills),
  };
}

function buildMetric(
  key: WeaponComparisonMetric["key"],
  label: string,
  globalValue: number | undefined,
  personalValue: number | undefined,
  options: {
    format: "number" | "percent";
    decimals?: number;
    threshold: number;
    suffix?: string;
    feedbackPositive: string;
    feedbackImprove: string;
    feedbackNeutral: string;
  },
): WeaponComparisonMetric | null {
  if (personalValue === undefined || Number.isNaN(personalValue)) return null;
  if (globalValue === undefined || Number.isNaN(globalValue)) {
    return {
      key,
      label,
      globalLabel: "Sin referencia",
      personalLabel:
        options.format === "percent"
          ? formatPercent(personalValue, options.decimals ?? 1)
          : formatNumber(personalValue, options.decimals ?? 1),
      diffLabel: "Sin referencia global",
      tone: "neutral",
      feedback: "Hay datos personales, pero no existe referencia global suficiente para comparar.",
    };
  }

  const diff = personalValue - globalValue;
  const tone = diffTone(diff, options.threshold);
  const formatValue = (value: number) =>
    options.format === "percent"
      ? formatPercent(value, options.decimals ?? 1)
      : formatNumber(value, options.decimals ?? 2);

  return {
    key,
    label,
    globalLabel: formatValue(globalValue),
    personalLabel: formatValue(personalValue),
    diffLabel:
      options.format === "percent"
        ? signedNumber(diff, options.decimals ?? 1, " pts")
        : signedNumber(diff, options.decimals ?? 2, options.suffix ?? ""),
    tone,
    feedback:
      tone === "positive"
        ? options.feedbackPositive
        : tone === "improve"
          ? options.feedbackImprove
          : options.feedbackNeutral,
  };
}

export function buildWeaponComparisonFeedback(metrics: WeaponComparisonMetric[], sample: string) {
  if (sample === "Muestra baja") {
    return "La muestra personal es baja; interpreta estos datos con cautela.";
  }

  const positive = metrics.filter((metric) => metric.tone === "positive").length;
  const improve = metrics.filter((metric) => metric.tone === "improve").length;

  if (positive >= 2 && positive > improve) {
    return "Tu rendimiento con esta arma está por encima de varias referencias globales.";
  }
  if (improve >= 2 && improve > positive) {
    return "Hay margen de mejora frente a la referencia global, especialmente en las métricas marcadas.";
  }
  return "Tu rendimiento con esta arma está alineado con la media global.";
}

export function compareWeaponStats(
  globalStats: RegionWeaponStats | undefined,
  personalStats: PersonalWeaponStats | null,
): WeaponPersonalComparison {
  if (!personalStats) {
    return {
      hasSession: true,
      isLoading: false,
      isError: false,
      hasPersonalUsage: false,
      hasGlobalReference: Boolean(globalStats),
      sampleReliability: "Sin muestra",
      summary: "Aún no tienes uso registrado con esta arma.",
      metrics: [],
    };
  }

  const globalRounds = globalStats?.rounds_equipped;
  const globalKills = globalStats?.kills;
  const globalDeaths = globalStats?.deaths;
  const globalDamage = globalStats?.damage_dealt;
  const globalKillsPerRound =
    globalRounds && globalRounds > 0 && globalKills !== undefined
      ? globalKills / globalRounds
      : undefined;
  const globalDamagePerRound =
    globalRounds && globalRounds > 0 && globalDamage !== undefined
      ? globalDamage / globalRounds
      : undefined;
  const globalKd =
    globalDeaths && globalDeaths > 0 && globalKills !== undefined
      ? globalKills / globalDeaths
      : undefined;

  const metrics = [
    buildMetric("kills", "Kills", globalKills, personalStats.kills, {
      format: "number",
      decimals: 0,
      threshold: 1,
      feedbackPositive: "Tienes más kills registradas que la referencia global disponible.",
      feedbackImprove: "Tu volumen de kills está por debajo de la referencia global.",
      feedbackNeutral: "Tu volumen de kills está cerca de la referencia global.",
    }),
    buildMetric("headshot", "Headshot", globalStats?.headshot_pct, personalStats.headshotPct, {
      format: "percent",
      decimals: 1,
      threshold: 5,
      feedbackPositive: "Tu precisión con esta arma está por encima de la media global.",
      feedbackImprove: "Tienes menor headshot que la media global; prioriza disparos más controlados.",
      feedbackNeutral: "Tu precisión está alineada con la media global.",
    }),
    buildMetric("rounds", "Rondas equipada", globalRounds, personalStats.rounds, {
      format: "number",
      decimals: 0,
      threshold: 5,
      feedbackPositive: "Usas esta arma más que la referencia disponible.",
      feedbackImprove: "Usas esta arma menos que la media; la muestra todavía puede ser baja.",
      feedbackNeutral: "Tu volumen de uso está cerca de la referencia global.",
    }),
    buildMetric("damagePerRound", "Daño / ronda", globalDamagePerRound, personalStats.damagePerRound, {
      format: "number",
      decimals: 1,
      threshold: 5,
      feedbackPositive: "Tu daño por ronda supera la referencia global.",
      feedbackImprove: "Tu daño por ronda está por debajo de la referencia global.",
      feedbackNeutral: "Tu daño por ronda está alineado con la referencia global.",
    }),
    buildMetric("kd", "KD", globalKd, personalStats.kd, {
      format: "number",
      decimals: 2,
      threshold: 0.1,
      feedbackPositive: "Tu KD supera la referencia global.",
      feedbackImprove: "Tu KD está por debajo de la referencia global.",
      feedbackNeutral: "Tu KD está alineado con la referencia global.",
    }),
    buildMetric("killsPerRound", "Kills / ronda", globalKillsPerRound, personalStats.killsPerRound, {
      format: "number",
      decimals: 2,
      threshold: 0.05,
      feedbackPositive: "Generas más impacto por ronda que la referencia global.",
      feedbackImprove: "Generas menos kills por ronda que la referencia global.",
      feedbackNeutral: "Tu impacto por ronda está cerca de la referencia global.",
    }),
  ].filter((metric): metric is WeaponComparisonMetric => Boolean(metric));

  return {
    hasSession: true,
    isLoading: false,
    isError: false,
    hasPersonalUsage: true,
    hasGlobalReference: Boolean(globalStats),
    sampleReliability: personalStats.sampleReliability,
    summary: buildWeaponComparisonFeedback(metrics, personalStats.sampleReliability),
    metrics,
  };
}

