import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentes } from "../../../api/hooks";
import { safeDivide, normalizeArrayResponse } from "../../../utils/formatters";
import type { AgentContent } from "../../../types/agents";
import type { AnalyticsMatch } from "../../../types/dashboard";

export type AgentTotals = {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  acs: number;
  adr: number;
  hs: number;
  firstKills: number;
  firstDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  clutchOps: number;
  clutchesWon: number;
  survivalRate: number;
  multikillRate: number;
  openingDuelWinPct: number;
  multi2k: number;
  multi3k: number;
  multi4k: number;
  multi5k: number;
  damageDelta: number;
  atkRounds: number;
  atkKills: number;
  atkDeaths: number;
  atkDamage: number;
  atkWins: number;
  atkFK: number;
  defRounds: number;
  defKills: number;
  defDeaths: number;
  defDamage: number;
  defWins: number;
  defFK: number;
};

export type AgentDerivedStats = {
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kda: number;
  killsPerMatch: number;
  deathsPerMatch: number;
  assistsPerMatch: number;
  acsAvg: number;
  adrAvg: number;
  hsAvg: number;
  fkPerMatch: number;
  fdPerMatch: number;
  fkfdRatio: number;
  openingDuelWinPct: number;
  tradeKillsPerMatch: number;
  clutchWinRate: number;
  survivalRate: number;
  multikillRate: number;
  damageDeltaPerRound: number;
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function emptyTotals(): AgentTotals {
  return {
    matches: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    rounds: 0,
    acs: 0,
    adr: 0,
    hs: 0,
    firstKills: 0,
    firstDeaths: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    clutchOps: 0,
    clutchesWon: 0,
    survivalRate: 0,
    multikillRate: 0,
    openingDuelWinPct: 0,
    multi2k: 0,
    multi3k: 0,
    multi4k: 0,
    multi5k: 0,
    damageDelta: 0,
    atkRounds: 0,
    atkKills: 0,
    atkDeaths: 0,
    atkDamage: 0,
    atkWins: 0,
    atkFK: 0,
    defRounds: 0,
    defKills: 0,
    defDeaths: 0,
    defDamage: 0,
    defWins: 0,
    defFK: 0,
  };
}

export function calculateAgentTotals(agentMatches: AnalyticsMatch[]): AgentTotals {
  return agentMatches.reduce((acc, match) => {
    const ov = match.overview ?? {};
    const pt = match.player_totals_from_match ?? {};
    const kills = pt.kills ?? ov.kills ?? 0;
    const deaths = pt.deaths ?? ov.deaths ?? 0;
    const assists = pt.assists ?? ov.assists ?? 0;
    const rounds = pt.rounds_played ?? ov.rounds ?? 0;

    acc.matches += 1;
    acc.wins += match.won_match ? 1 : 0;
    acc.kills += kills;
    acc.deaths += deaths;
    acc.assists += assists;
    acc.rounds += rounds;
    acc.acs += ov.acs ?? 0;
    acc.adr += ov.adr ?? 0;
    acc.hs += ov.headshot_pct ?? 0;
    acc.firstKills += ov.first_kills ?? 0;
    acc.firstDeaths += ov.first_deaths ?? 0;
    acc.tradeKills += ov.trade_kills ?? 0;
    acc.tradedDeaths += ov.traded_deaths ?? 0;
    acc.clutchOps += ov.clutch_opportunities ?? 0;
    acc.clutchesWon += ov.clutches_won ?? 0;
    acc.survivalRate += ov.survival_rate ?? 0;
    acc.multikillRate += ov.multikill_rate ?? 0;
    acc.openingDuelWinPct += ov.opening_duel_win_pct ?? 0;
    acc.multi2k += ov.multi_2k ?? 0;
    acc.multi3k += ov.multi_3k ?? 0;
    acc.multi4k += ov.multi_4k ?? 0;
    acc.multi5k += ov.multi_5k ?? 0;
    acc.damageDelta += ov.damage_delta ?? 0;

    const atk = match.sides?.attack;
    const def = match.sides?.defense;
    if (atk) {
      acc.atkRounds += atk.rounds ?? 0;
      acc.atkKills += atk.kills ?? 0;
      acc.atkDeaths += atk.deaths ?? 0;
      acc.atkDamage += atk.damage_dealt ?? 0;
      acc.atkWins += atk.wins ?? 0;
      acc.atkFK += atk.first_kills ?? 0;
    }
    if (def) {
      acc.defRounds += def.rounds ?? 0;
      acc.defKills += def.kills ?? 0;
      acc.defDeaths += def.deaths ?? 0;
      acc.defDamage += def.damage_dealt ?? 0;
      acc.defWins += def.wins ?? 0;
      acc.defFK += def.first_kills ?? 0;
    }

    return acc;
  }, emptyTotals());
}

export function calculateAgentDerivedStats(totals: AgentTotals): AgentDerivedStats {
  const matches = totals.matches;
  return {
    matches,
    wins: totals.wins,
    winRate: safeDivide(totals.wins * 100, matches),
    kd: safeDivide(totals.kills, Math.max(totals.deaths, 1)),
    kda: safeDivide(totals.kills + totals.assists, Math.max(totals.deaths, 1)),
    killsPerMatch: safeDivide(totals.kills, Math.max(matches, 1)),
    deathsPerMatch: safeDivide(totals.deaths, Math.max(matches, 1)),
    assistsPerMatch: safeDivide(totals.assists, Math.max(matches, 1)),
    acsAvg: safeDivide(totals.acs, Math.max(matches, 1)),
    adrAvg: safeDivide(totals.adr, Math.max(matches, 1)),
    hsAvg: safeDivide(totals.hs, Math.max(matches, 1)),
    fkPerMatch: safeDivide(totals.firstKills, Math.max(matches, 1)),
    fdPerMatch: safeDivide(totals.firstDeaths, Math.max(matches, 1)),
    fkfdRatio: safeDivide(totals.firstKills, Math.max(totals.firstDeaths, 1)),
    openingDuelWinPct: safeDivide(totals.openingDuelWinPct, Math.max(matches, 1)),
    tradeKillsPerMatch: safeDivide(totals.tradeKills, Math.max(matches, 1)),
    clutchWinRate: safeDivide(totals.clutchesWon * 100, Math.max(totals.clutchOps, 1)),
    survivalRate: safeDivide(totals.survivalRate, Math.max(matches, 1)),
    multikillRate: safeDivide(totals.multikillRate, Math.max(matches, 1)),
    damageDeltaPerRound: safeDivide(totals.damageDelta, Math.max(totals.rounds, 1)),
  };
}

export function buildRecentMatches(agentMatches: AnalyticsMatch[]) {
  return [...agentMatches]
    .sort((a, b) => (b.game_start_millis ?? 0) - (a.game_start_millis ?? 0))
    .slice(0, 8);
}

export function buildMiniChartData(recentMatches: AnalyticsMatch[]) {
  return recentMatches
    .slice()
    .reverse()
    .map((match, index) => ({
      name: `Partida ${index + 1}`,
      shortName: `P${index + 1}`,
      acs: Number((match.overview?.acs ?? 0).toFixed(1)),
      result: match.won_match ? "Victoria" : "Derrota",
    }));
}

export function buildRadarData(stats: AgentDerivedStats) {
  const tradeEff =
    stats.tradeKillsPerMatch > 0 ? clampPct(stats.tradeKillsPerMatch * 20) : 0;

  return [
    {
      metric: "Duelos iniciales",
      value: clampPct(stats.openingDuelWinPct),
      fullMark: 100,
      real: `${stats.openingDuelWinPct.toFixed(1)}%`,
    },
    {
      metric: "Clutches",
      value: clampPct(stats.clutchWinRate),
      fullMark: 100,
      real: `${stats.clutchWinRate.toFixed(1)}%`,
    },
    {
      metric: "Trade Kills",
      value: clampPct(tradeEff),
      fullMark: 100,
      real: `${tradeEff.toFixed(1)}%`,
    },
    {
      metric: "Supervivencia",
      value: clampPct(stats.survivalRate),
      fullMark: 100,
      real: `${stats.survivalRate.toFixed(1)}%`,
    },
    {
      metric: "Multikills",
      value: clampPct(stats.multikillRate),
      fullMark: 100,
      real: `${stats.multikillRate.toFixed(1)}%`,
    },
    {
      metric: "Headshot %",
      value: clampPct(stats.hsAvg * 2.5),
      fullMark: 100,
      real: `${stats.hsAvg.toFixed(1)}%`,
    },
  ];
}

export function buildSideStats(totals: AgentTotals) {
  const atkRounds = Math.max(totals.atkRounds, 1);
  const defRounds = Math.max(totals.defRounds, 1);
  return {
    atkKD: safeDivide(totals.atkKills, Math.max(totals.atkDeaths, 1)),
    defKD: safeDivide(totals.defKills, Math.max(totals.defDeaths, 1)),
    atkADR: safeDivide(totals.atkDamage, atkRounds),
    defADR: safeDivide(totals.defDamage, defRounds),
    atkWinPct: safeDivide(totals.atkWins * 100, atkRounds),
    defWinPct: safeDivide(totals.defWins * 100, defRounds),
    atkFKPerRound: safeDivide(totals.atkFK, atkRounds),
    defFKPerRound: safeDivide(totals.defFK, defRounds),
  };
}

export function buildMultikillData(totals: AgentTotals) {
  return [
    { label: "2K", value: totals.multi2k, color: "#64a0ff" },
    { label: "3K", value: totals.multi3k, color: "#a78bfa" },
    { label: "4K", value: totals.multi4k, color: "#f59e0b" },
    { label: "5K (Ace)", value: totals.multi5k, color: "#ff4655" },
  ].filter((data) => data.value > 0);
}

export function useAgentDetailStats({
  agentId,
  analyticsList,
  agentNameMap,
}: {
  agentId: string;
  analyticsList: AnalyticsMatch[];
  agentNameMap: Record<string, string>;
}) {
  const navigate = useNavigate();
  const { data: rawAgents, isLoading: loading } = useAgentes();

  const agentContent = useMemo(() => {
    const agents = normalizeArrayResponse<AgentContent>(rawAgents);
    return agents.find((agent) => agent.uuid === agentId || agent.id === agentId) ?? null;
  }, [rawAgents, agentId]);

  const agentMatches = useMemo(
    () => analyticsList.filter((match) => match.agent_id === agentId),
    [analyticsList, agentId],
  );

  const totals = useMemo(() => calculateAgentTotals(agentMatches), [agentMatches]);
  const stats = useMemo(() => calculateAgentDerivedStats(totals), [totals]);
  const recentMatches = useMemo(() => buildRecentMatches(agentMatches), [agentMatches]);
  const miniChartData = useMemo(
    () => buildMiniChartData(recentMatches),
    [recentMatches],
  );
  const radarData = useMemo(() => buildRadarData(stats), [stats]);
  const sideStats = useMemo(() => buildSideStats(totals), [totals]);
  const multikillData = useMemo(() => buildMultikillData(totals), [totals]);
  const hasSideData = totals.atkRounds > 0 || totals.defRounds > 0;
  const displayName =
    agentContent?.displayName ??
    agentContent?.name ??
    agentNameMap[agentId] ??
    "Agente";

  return {
    navigate,
    loading,
    agentContent,
    stats,
    recentMatches,
    miniChartData,
    radarData,
    sideStats,
    hasSideData,
    multikillData,
    displayName,
  };
}

