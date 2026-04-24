import { useMemo } from "react";
import type { AnalyticsMatch } from "../types/dashboard";

export interface TacticalStats {
  openingDuelWinPct: number;
  clutchWinRate: number;
  survivalRate: number;
  multikillRate: number;
  headshotPct: number;
  tradeKillRate: number;
  tradeConversionRate: number;
  totalRounds: number;
  totalDeaths: number;
  totalHeadshots: number;
  totalBodyshots: number;
  totalLegshots: number;
  openingDuelWins: number;
  openingDuelLosses: number;
  clutchOpportunities: number;
  clutchesWon: number;
  tradeKills: number;
  tradeOpportunities: number;
  missedTradeOpportunities: number;
  tradedDeaths: number;
  clutch1v1Opportunities: number;
  clutch1v1Wins: number;
  clutch1v2Opportunities: number;
  clutch1v2Wins: number;
  clutch1v3Opportunities: number;
  clutch1v3Wins: number;
  clutch1v4Opportunities: number;
  clutch1v4Wins: number;
  clutch1v5Opportunities: number;
  clutch1v5Wins: number;
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

export interface HeadshotDistributionDatum {
  label: string;
  value: number;
  color: string;
}

export interface OpeningDuelDatum {
  label: string;
  value: number;
  color: string;
}

export interface SurvivalDatum {
  label: string;
  value: number;
  color: string;
}

export interface ClutchBreakdownDatum {
  label: string;
  opportunities: number;
  won: number;
  winRate: number;
}

export interface TradeBreakdownDatum {
  label: string;
  value: number;
  color: string;
}

const EMPTY_STATS: TacticalStats = {
  openingDuelWinPct: 0,
  clutchWinRate: 0,
  survivalRate: 0,
  multikillRate: 0,
  headshotPct: 0,
  tradeKillRate: 0,
  tradeConversionRate: 0,
  totalRounds: 0,
  totalDeaths: 0,
  totalHeadshots: 0,
  totalBodyshots: 0,
  totalLegshots: 0,
  openingDuelWins: 0,
  openingDuelLosses: 0,
  clutchOpportunities: 0,
  clutchesWon: 0,
  tradeKills: 0,
  tradeOpportunities: 0,
  missedTradeOpportunities: 0,
  tradedDeaths: 0,
  clutch1v1Opportunities: 0,
  clutch1v1Wins: 0,
  clutch1v2Opportunities: 0,
  clutch1v2Wins: 0,
  clutch1v3Opportunities: 0,
  clutch1v3Wins: 0,
  clutch1v4Opportunities: 0,
  clutch1v4Wins: 0,
  clutch1v5Opportunities: 0,
  clutch1v5Wins: 0,
  multi2k: 0,
  multi3k: 0,
  multi4k: 0,
  multi5k: 0,
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator * 100) / denominator;
}

export function useTacticalStats(filteredAnalyticsList: AnalyticsMatch[]) {
  const globalTacticalStats = useMemo<TacticalStats>(() => {
    const list = filteredAnalyticsList;
    if (list.length === 0) return EMPTY_STATS;

    let totalRounds = 0;
    let totalDeaths = 0;
    let totalHeadshots = 0;
    let totalBodyshots = 0;
    let totalLegshots = 0;
    let openingDuelWins = 0;
    let openingDuelLosses = 0;
    let clutchOps = 0;
    let clutchesWon = 0;
    let tradeKills = 0;
    let tradeOpportunities = 0;
    let missedTradeOpportunities = 0;
    let tradedDeaths = 0;
    let clutch1v1Ops = 0;
    let clutch1v1Wins = 0;
    let clutch1v2Ops = 0;
    let clutch1v2Wins = 0;
    let clutch1v3Ops = 0;
    let clutch1v3Wins = 0;
    let clutch1v4Ops = 0;
    let clutch1v4Wins = 0;
    let clutch1v5Ops = 0;
    let clutch1v5Wins = 0;
    let m2 = 0;
    let m3 = 0;
    let m4 = 0;
    let m5 = 0;

    for (const a of list) {
      const ov = a.overview ?? {};
      totalRounds += ov.rounds ?? 0;
      totalDeaths += ov.deaths ?? 0;
      totalHeadshots += ov.headshots ?? 0;
      totalBodyshots += ov.bodyshots ?? 0;
      totalLegshots += ov.legshots ?? 0;
      openingDuelWins += ov.first_kills ?? 0;
      openingDuelLosses += ov.first_deaths ?? 0;
      clutchOps += ov.clutch_opportunities ?? 0;
      clutchesWon += ov.clutches_won ?? 0;
      tradeKills += ov.trade_kills ?? 0;
      tradeOpportunities += ov.trade_opportunities ?? 0;
      missedTradeOpportunities += ov.missed_trade_opportunities ?? 0;
      tradedDeaths += ov.traded_deaths ?? 0;
      clutch1v1Ops += ov.clutch_1v1_opportunities ?? 0;
      clutch1v1Wins += ov.clutch_1v1_wins ?? 0;
      clutch1v2Ops += ov.clutch_1v2_opportunities ?? 0;
      clutch1v2Wins += ov.clutch_1v2_wins ?? 0;
      clutch1v3Ops += ov.clutch_1v3_opportunities ?? 0;
      clutch1v3Wins += ov.clutch_1v3_wins ?? 0;
      clutch1v4Ops += ov.clutch_1v4_opportunities ?? 0;
      clutch1v4Wins += ov.clutch_1v4_wins ?? 0;
      clutch1v5Ops += ov.clutch_1v5_opportunities ?? 0;
      clutch1v5Wins += ov.clutch_1v5_wins ?? 0;
      m2 += ov.multi_2k ?? 0;
      m3 += ov.multi_3k ?? 0;
      m4 += ov.multi_4k ?? 0;
      m5 += ov.multi_5k ?? 0;
    }

    const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
    const roundsWithMultikill = m2 + m3 + m4 + m5;
    const survivalRounds = Math.max(0, totalRounds - totalDeaths);

    return {
      openingDuelWinPct: pct(
        openingDuelWins,
        openingDuelWins + openingDuelLosses,
      ),
      clutchWinRate: pct(clutchesWon, clutchOps),
      survivalRate: pct(survivalRounds, totalRounds),
      multikillRate: pct(roundsWithMultikill, totalRounds),
      headshotPct: pct(totalHeadshots, totalShots),
      tradeKillRate: pct(tradeKills, totalRounds),
      tradeConversionRate: pct(tradeKills, tradeOpportunities),
      totalRounds,
      totalDeaths,
      totalHeadshots,
      totalBodyshots,
      totalLegshots,
      openingDuelWins,
      openingDuelLosses,
      clutchOpportunities: clutchOps,
      clutchesWon,
      tradeKills,
      tradeOpportunities,
      missedTradeOpportunities,
      tradedDeaths,
      clutch1v1Opportunities: clutch1v1Ops,
      clutch1v1Wins,
      clutch1v2Opportunities: clutch1v2Ops,
      clutch1v2Wins,
      clutch1v3Opportunities: clutch1v3Ops,
      clutch1v3Wins,
      clutch1v4Opportunities: clutch1v4Ops,
      clutch1v4Wins,
      clutch1v5Opportunities: clutch1v5Ops,
      clutch1v5Wins,
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
        value: clamp(s.tradeConversionRate),
        real: `${s.tradeConversionRate.toFixed(1)}%`,
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
        value: clamp(s.headshotPct),
        real: `${s.headshotPct.toFixed(1)}%`,
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
    return data;
  }, [globalTacticalStats]);

  const globalHeadshotData = useMemo<HeadshotDistributionDatum[]>(() => {
    const s = globalTacticalStats;
    return [
      { label: "Cabeza", value: s.totalHeadshots, color: "#ff4655" },
      { label: "Cuerpo", value: s.totalBodyshots, color: "#ff9d4d" },
      { label: "Piernas", value: s.totalLegshots, color: "#64a0ff" },
    ];
  }, [globalTacticalStats]);

  const globalOpeningDuelData = useMemo<OpeningDuelDatum[]>(() => {
    const s = globalTacticalStats;
    return [
      { label: "Ganados", value: s.openingDuelWins, color: "#46c878" },
      { label: "Perdidos", value: s.openingDuelLosses, color: "#ff4655" },
    ];
  }, [globalTacticalStats]);

  const globalSurvivalData = useMemo<SurvivalDatum[]>(() => {
    const s = globalTacticalStats;
    const survived = Math.max(0, s.totalRounds - s.totalDeaths);
    return [
      { label: "Sobrevive", value: survived, color: "#64a0ff" },
      { label: "Muere", value: s.totalDeaths, color: "#ff4655" },
    ];
  }, [globalTacticalStats]);

  const globalClutchData = useMemo<ClutchBreakdownDatum[]>(() => {
    const s = globalTacticalStats;
    const tiers = [
      {
        label: "1v1",
        opportunities: s.clutch1v1Opportunities,
        won: s.clutch1v1Wins,
      },
      {
        label: "1v2",
        opportunities: s.clutch1v2Opportunities,
        won: s.clutch1v2Wins,
      },
      {
        label: "1v3",
        opportunities: s.clutch1v3Opportunities,
        won: s.clutch1v3Wins,
      },
      {
        label: "1v4",
        opportunities: s.clutch1v4Opportunities,
        won: s.clutch1v4Wins,
      },
      {
        label: "1v5",
        opportunities: s.clutch1v5Opportunities,
        won: s.clutch1v5Wins,
      },
    ];

    const tierOpportunities = tiers.reduce(
      (sum, row) => sum + row.opportunities,
      0,
    );

    // Fallback for datasets that only expose total clutch metrics.
    if (tierOpportunities === 0 && s.clutchOpportunities > 0) {
      return [
        {
          label: "Total",
          opportunities: s.clutchOpportunities,
          won: s.clutchesWon,
          winRate: pct(s.clutchesWon, s.clutchOpportunities),
        },
      ];
    }

    return tiers.map((row) => ({
      ...row,
      winRate: pct(row.won, row.opportunities),
    }));
  }, [globalTacticalStats]);

  const globalTradeData = useMemo<TradeBreakdownDatum[]>(() => {
    const s = globalTacticalStats;
    return [
      { label: "Oportunidades", value: s.tradeOpportunities, color: "#8b96a8" },
      { label: "Trade Kills", value: s.tradeKills, color: "#64a0ff" },
      {
        label: "Oportunidades perdidas",
        value: s.missedTradeOpportunities,
        color: "#f59e0b",
      },
    ];
  }, [globalTacticalStats]);

  return {
    globalTacticalStats,
    globalRadarData,
    globalMultikillData,
    globalHeadshotData,
    globalOpeningDuelData,
    globalSurvivalData,
    globalClutchData,
    globalTradeData,
  };
}
