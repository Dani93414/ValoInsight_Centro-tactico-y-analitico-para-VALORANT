import { useMemo } from "react";
import type { AnalyticsMatch } from "../types/dashboard";

export interface TacticalStats {
  openingDuelWinPct: number;
  clutchWinRate: number;
  survivalRate: number;
  multikillRate: number;
  hsAvg: number;
  tradeEff: number;
  multi2k: number;
  multi3k: number;
  multi4k: number;
  multi5k: number;
}

export interface RadarDatum {
  metric: string;
  value: number;
  real: string;
}

export interface MultikillDatum {
  label: string;
  value: number;
  color: string;
}

const EMPTY_STATS: TacticalStats = {
  openingDuelWinPct: 0,
  clutchWinRate: 0,
  survivalRate: 0,
  multikillRate: 0,
  hsAvg: 0,
  tradeEff: 0,
  multi2k: 0,
  multi3k: 0,
  multi4k: 0,
  multi5k: 0,
};

export function useTacticalStats(filteredAnalyticsList: AnalyticsMatch[]) {
  const globalTacticalStats = useMemo<TacticalStats>(() => {
    const list = filteredAnalyticsList;
    const m = list.length;
    if (m === 0) return EMPTY_STATS;

    let odWinSum = 0;
    let clutchOps = 0;
    let clutchesWon = 0;
    let survSum = 0;
    let mkSum = 0;
    let hsSum = 0;
    let tradeKills = 0;
    let m2 = 0;
    let m3 = 0;
    let m4 = 0;
    let m5 = 0;

    for (const a of list) {
      const ov = a.overview ?? {};
      odWinSum += ov.opening_duel_win_pct ?? 0;
      clutchOps += ov.clutch_opportunities ?? 0;
      clutchesWon += ov.clutches_won ?? 0;
      survSum += ov.survival_rate ?? 0;
      mkSum += ov.multikill_rate ?? 0;
      hsSum += ov.headshot_pct ?? 0;
      tradeKills += ov.trade_kills ?? 0;
      m2 += ov.multi_2k ?? 0;
      m3 += ov.multi_3k ?? 0;
      m4 += ov.multi_4k ?? 0;
      m5 += ov.multi_5k ?? 0;
    }

    const tradePerMatch = tradeKills / m;
    return {
      openingDuelWinPct: odWinSum / m,
      clutchWinRate: clutchOps > 0 ? (clutchesWon * 100) / clutchOps : 0,
      survivalRate: survSum / m,
      multikillRate: mkSum / m,
      hsAvg: hsSum / m,
      tradeEff: tradePerMatch > 0 ? Math.min(tradePerMatch * 20, 100) : 0,
      multi2k: m2,
      multi3k: m3,
      multi4k: m4,
      multi5k: m5,
    };
  }, [filteredAnalyticsList]);

  const globalRadarData = useMemo<RadarDatum[]>(() => {
    const s = globalTacticalStats;
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    return [
      {
        metric: "Duelos iniciales",
        value: clamp(s.openingDuelWinPct),
        real: `${s.openingDuelWinPct.toFixed(1)}%`,
      },
      {
        metric: "Clutches",
        value: clamp(s.clutchWinRate),
        real: `${s.clutchWinRate.toFixed(1)}%`,
      },
      {
        metric: "Trade Kills",
        value: clamp(s.tradeEff),
        real: `${s.tradeEff.toFixed(1)}%`,
      },
      {
        metric: "Supervivencia",
        value: clamp(s.survivalRate),
        real: `${s.survivalRate.toFixed(1)}%`,
      },
      {
        metric: "Multikills",
        value: clamp(s.multikillRate),
        real: `${s.multikillRate.toFixed(1)}%`,
      },
      {
        metric: "Headshot",
        value: clamp(s.hsAvg * 2.5),
        real: `${s.hsAvg.toFixed(1)}%`,
      },
    ];
  }, [globalTacticalStats]);

  const globalMultikillData = useMemo<MultikillDatum[]>(() => {
    const s = globalTacticalStats;
    const data = [
      { label: "2K", value: s.multi2k, color: "#64a0ff" },
      { label: "3K", value: s.multi3k, color: "#a78bfa" },
      { label: "4K", value: s.multi4k, color: "#f59e0b" },
      { label: "5K (Ace)", value: s.multi5k, color: "#ff4655" },
    ];
    return data.filter((d) => d.value > 0);
  }, [globalTacticalStats]);

  return { globalTacticalStats, globalRadarData, globalMultikillData };
}
