import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentes } from "../../../api/hooks";
import { safeDivide, normalizeArrayResponse } from "../../../utils/formatters";
import type { AgentContent } from "../../../types/agents";
import type { AnalyticsMatch } from "../../../types/dashboard";

/** Clamp a percentage value to [0, 100]. */
function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
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
    return agents.find((a) => a.uuid === agentId || a.id === agentId) ?? null;
  }, [rawAgents, agentId]);

  const agentMatches = useMemo(
    () => analyticsList.filter((m) => m.agent_id === agentId),
    [analyticsList, agentId],
  );

  /* ── Aggregate totals ── */
  const totals = useMemo(() => {
    return agentMatches.reduce(
      (acc, match) => {
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

        // Sides aggregation
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
      },
      {
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
      },
    );
  }, [agentMatches]);

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const m = totals.matches;
    return {
      matches: m,
      wins: totals.wins,
      winRate: safeDivide(totals.wins * 100, m),
      kd: safeDivide(totals.kills, Math.max(totals.deaths, 1)),
      kda: safeDivide(
        totals.kills + totals.assists,
        Math.max(totals.deaths, 1),
      ),
      killsPerMatch: safeDivide(totals.kills, Math.max(m, 1)),
      deathsPerMatch: safeDivide(totals.deaths, Math.max(m, 1)),
      assistsPerMatch: safeDivide(totals.assists, Math.max(m, 1)),
      acsAvg: safeDivide(totals.acs, Math.max(m, 1)),
      adrAvg: safeDivide(totals.adr, Math.max(m, 1)),
      hsAvg: safeDivide(totals.hs, Math.max(m, 1)),
      fkPerMatch: safeDivide(totals.firstKills, Math.max(m, 1)),
      fdPerMatch: safeDivide(totals.firstDeaths, Math.max(m, 1)),
      fkfdRatio: safeDivide(totals.firstKills, Math.max(totals.firstDeaths, 1)),
      openingDuelWinPct: safeDivide(totals.openingDuelWinPct, Math.max(m, 1)),
      tradeKillsPerMatch: safeDivide(totals.tradeKills, Math.max(m, 1)),
      clutchWinRate: safeDivide(
        totals.clutchesWon * 100,
        Math.max(totals.clutchOps, 1),
      ),
      survivalRate: safeDivide(totals.survivalRate, Math.max(m, 1)),
      multikillRate: safeDivide(totals.multikillRate, Math.max(m, 1)),
      damageDeltaPerMatch: safeDivide(totals.damageDelta, Math.max(m, 1)),
    };
  }, [totals]);

  /* ── Recent matches ── */
  const recentMatches = useMemo(() => {
    return [...agentMatches]
      .sort((a, b) => (b.game_start_millis ?? 0) - (a.game_start_millis ?? 0))
      .slice(0, 8);
  }, [agentMatches]);

  /* ── ACS Trend chart data ── */
  const miniChartData = useMemo(() => {
    return recentMatches
      .slice()
      .reverse()
      .map((match, index) => ({
        name: `Partida ${index + 1}`,
        shortName: `P${index + 1}`,
        acs: Number((match.overview?.acs ?? 0).toFixed(1)),
        result: match.won_match ? "Victoria" : "Derrota",
      }));
  }, [recentMatches]);

  /* ── Radar chart data ── */
  const radarData = useMemo(() => {
    const odWin = stats.openingDuelWinPct;
    const clutch = stats.clutchWinRate;
    const survival = stats.survivalRate;
    const multikill = stats.multikillRate;
    const hs = stats.hsAvg;
    const tradeEff =
      stats.tradeKillsPerMatch > 0
        ? clampPct(stats.tradeKillsPerMatch * 20)
        : 0;

    return [
      {
        metric: "Duelos iniciales",
        value: clampPct(odWin),
        fullMark: 100,
        real: `${odWin.toFixed(1)}%`,
      },
      {
        metric: "Clutches",
        value: clampPct(clutch),
        fullMark: 100,
        real: `${clutch.toFixed(1)}%`,
      },
      {
        metric: "Trade Kills",
        value: clampPct(tradeEff),
        fullMark: 100,
        real: `${tradeEff.toFixed(1)}%`,
      },
      {
        metric: "Supervivencia",
        value: clampPct(survival),
        fullMark: 100,
        real: `${survival.toFixed(1)}%`,
      },
      {
        metric: "Multikills",
        value: clampPct(multikill),
        fullMark: 100,
        real: `${multikill.toFixed(1)}%`,
      },
      {
        metric: "Headshot %",
        value: clampPct(hs * 2.5),
        fullMark: 100,
        real: `${hs.toFixed(1)}%`,
      },
    ];
  }, [stats]);

  /* ── Attack vs Defense stats ── */
  const sideStats = useMemo(() => {
    const atkR = Math.max(totals.atkRounds, 1);
    const defR = Math.max(totals.defRounds, 1);
    return {
      atkKD: safeDivide(totals.atkKills, Math.max(totals.atkDeaths, 1)),
      defKD: safeDivide(totals.defKills, Math.max(totals.defDeaths, 1)),
      atkADR: safeDivide(totals.atkDamage, atkR),
      defADR: safeDivide(totals.defDamage, defR),
      atkWinPct: safeDivide(totals.atkWins * 100, atkR),
      defWinPct: safeDivide(totals.defWins * 100, defR),
      atkFKPerRound: safeDivide(totals.atkFK, atkR),
      defFKPerRound: safeDivide(totals.defFK, defR),
    };
  }, [totals]);

  const hasSideData = totals.atkRounds > 0 || totals.defRounds > 0;

  /* ── Multikill breakdown ── */
  const multikillData = useMemo(() => {
    const data = [
      { label: "2K", value: totals.multi2k, color: "#64a0ff" },
      { label: "3K", value: totals.multi3k, color: "#a78bfa" },
      { label: "4K", value: totals.multi4k, color: "#f59e0b" },
      { label: "5K (Ace)", value: totals.multi5k, color: "#ff4655" },
    ];
    return data.filter((d) => d.value > 0);
  }, [totals]);

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
