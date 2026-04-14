import { useMemo } from "react";
import type { MatchCard, SideFilter } from "../types/dashboard";
import { SHOT_CHART_COLORS } from "../constants/dashboard";

export interface DerivedSummary {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  score: number;
  hsTotal: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  winRate: number;
  kd: number;
  kda: number;
  acs: number;
  killsPerMatch: number;
  avgDeathsPerMatch: number;
  avgAssistsPerMatch: number;
  avgRoundsPerMatch: number;
  killsPerRound: number;
  globalHeadshotPct: number;
}

export interface DashboardMetrics {
  globalWinRate: number;
  globalKd: number;
  globalAcs: number;
  globalHeadshotPct: number;
  kdaOverall: number;
  avgDeathsPerMatch: number;
  avgAssistsPerMatch: number;
  avgRoundsPerMatch: number;
  killsPerRound: number;
  killsPerMatch: number;
}

export interface ShotChartEntry {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export function useDashboardStats(
  filteredMatches: MatchCard[],
  side: SideFilter,
) {
  const derivedSummary = useMemo<DerivedSummary>(() => {
    const useSide = side === "attack" || side === "defense";
    const matches = filteredMatches.length;

    if (useSide) {
      const kills = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.kills ?? 0),
        0,
      );
      const deaths = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.deaths ?? 0),
        0,
      );
      const assists = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.assists ?? 0),
        0,
      );
      const rounds = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.rounds ?? 0),
        0,
      );
      const wins = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.wins ?? 0),
        0,
      );
      const score = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.score ?? 0),
        0,
      );
      const headshots = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.headshots ?? 0),
        0,
      );
      const bodyshots = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.bodyshots ?? 0),
        0,
      );
      const legshots = filteredMatches.reduce(
        (s, m) => s + (m.sides?.[side]?.legshots ?? 0),
        0,
      );
      const totalShots = headshots + bodyshots + legshots;

      const winRate = rounds ? (wins / rounds) * 100 : 0;
      const kd = deaths ? kills / deaths : kills;
      const kda = deaths ? (kills + assists) / deaths : kills + assists;
      const acs = rounds ? score / rounds : 0;
      const killsPerMatch = matches ? kills / matches : 0;
      const avgDeathsPerMatch = matches ? deaths / matches : 0;
      const avgAssistsPerMatch = matches ? assists / matches : 0;
      const avgRoundsPerMatch = matches ? rounds / matches : 0;
      const killsPerRound = rounds ? kills / rounds : 0;
      const globalHeadshotPct = totalShots ? (headshots / totalShots) * 100 : 0;

      return {
        matches,
        wins,
        kills,
        deaths,
        assists,
        rounds,
        score,
        hsTotal: globalHeadshotPct,
        headshots,
        bodyshots,
        legshots,
        winRate,
        kd,
        kda,
        acs,
        killsPerMatch,
        avgDeathsPerMatch,
        avgAssistsPerMatch,
        avgRoundsPerMatch,
        killsPerRound,
        globalHeadshotPct,
      };
    }

    const wins = filteredMatches.filter((m) => m.result === "Victoria").length;
    const kills = filteredMatches.reduce((sum, m) => sum + (m.kills ?? 0), 0);
    const deaths = filteredMatches.reduce((sum, m) => sum + (m.deaths ?? 0), 0);
    const assists = filteredMatches.reduce(
      (sum, m) => sum + (m.assists ?? 0),
      0,
    );
    const rounds = filteredMatches.reduce((sum, m) => sum + (m.rounds ?? 0), 0);
    const score = filteredMatches.reduce((sum, m) => sum + (m.score ?? 0), 0);
    const headshots = filteredMatches.reduce(
      (sum, m) => sum + (m.headshots ?? 0),
      0,
    );
    const bodyshots = filteredMatches.reduce(
      (sum, m) => sum + (m.bodyshots ?? 0),
      0,
    );
    const legshots = filteredMatches.reduce(
      (sum, m) => sum + (m.legshots ?? 0),
      0,
    );

    const winRate = matches ? (wins / matches) * 100 : 0;
    const kd = deaths ? kills / deaths : kills;
    const kda = deaths ? (kills + assists) / deaths : kills + assists;
    const acs = rounds ? score / rounds : 0;
    const killsPerMatch = matches ? kills / matches : 0;
    const avgDeathsPerMatch = matches ? deaths / matches : 0;
    const avgAssistsPerMatch = matches ? assists / matches : 0;
    const avgRoundsPerMatch = matches ? rounds / matches : 0;
    const killsPerRound = rounds ? kills / rounds : 0;
    const totalShots = headshots + bodyshots + legshots;
    const globalHeadshotPct = totalShots ? (headshots / totalShots) * 100 : 0;

    return {
      matches,
      wins,
      kills,
      deaths,
      assists,
      rounds,
      score,
      hsTotal: globalHeadshotPct,
      headshots,
      bodyshots,
      legshots,
      winRate,
      kd,
      kda,
      acs,
      killsPerMatch,
      avgDeathsPerMatch,
      avgAssistsPerMatch,
      avgRoundsPerMatch,
      killsPerRound,
      globalHeadshotPct,
    };
  }, [filteredMatches, side]);

  const metrics = useMemo<DashboardMetrics>(
    () => ({
      globalWinRate: derivedSummary.winRate,
      globalKd: derivedSummary.kd,
      globalAcs: derivedSummary.acs,
      globalHeadshotPct: derivedSummary.globalHeadshotPct,
      kdaOverall: derivedSummary.kda,
      avgDeathsPerMatch: derivedSummary.avgDeathsPerMatch,
      avgAssistsPerMatch: derivedSummary.avgAssistsPerMatch,
      avgRoundsPerMatch: derivedSummary.avgRoundsPerMatch,
      killsPerRound: derivedSummary.killsPerRound,
      killsPerMatch: derivedSummary.killsPerMatch,
    }),
    [derivedSummary],
  );

  const filteredShotChart = useMemo<ShotChartEntry[]>(() => {
    const totalShots =
      derivedSummary.headshots +
      derivedSummary.bodyshots +
      derivedSummary.legshots;

    if (!totalShots) return [];

    return [
      {
        name: "Headshots",
        value: derivedSummary.headshots,
        percentage: (derivedSummary.headshots / totalShots) * 100,
        color: SHOT_CHART_COLORS.headshots,
      },
      {
        name: "Bodyshots",
        value: derivedSummary.bodyshots,
        percentage: (derivedSummary.bodyshots / totalShots) * 100,
        color: SHOT_CHART_COLORS.bodyshots,
      },
      {
        name: "Legshots",
        value: derivedSummary.legshots,
        percentage: (derivedSummary.legshots / totalShots) * 100,
        color: SHOT_CHART_COLORS.legshots,
      },
    ].filter((item) => item.value > 0);
  }, [derivedSummary]);

  return { derivedSummary, metrics, filteredShotChart };
}
