import { useMemo } from "react";
import type {
  AnalyticsMatch,
  AnalyticsSideStats,
} from "../../../types/dashboard";
import {
  formatDate,
  normalizeLabel,
  safeDivide,
} from "../../../utils/formatters";

type TrendPoint = {
  label: string;
  shortLabel: string;
  acs: number;
  won: boolean;
};

type SideSummary = {
  rounds: number;
  wins: number;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  firstKills: number;
  winRate: number;
  kd: number;
  acs: number;
  adr: number;
};

type SideRow = {
  label: string;
  attackValue: number;
  defenseValue: number;
  kind: "number" | "percent";
  decimals?: number;
};

type AgentBreakdown = {
  name: string;
  shortName: string;
  matches: number;
  wins: number;
  winRate: number;
  acsAvg: number;
};

type WeaponBreakdown = {
  name: string;
  shortName: string;
  kills: number;
  matches: number;
  headshotPct: number;
};

type MapDetailStats = {
  matches: number;
  wins: number;
  losses: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  winRate: number;
  kd: number;
  kda: number;
  acsAvg: number;
  adrAvg: number;
  hsPct: number;
  killsPerMatch: number;
  deathsPerMatch: number;
  assistsPerMatch: number;
  tradeKillsPerMatch: number;
  firstKillsPerMatch: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator * 100) / denominator;
}

function shortenLabel(value: string, maxLength = 12): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function useMapDetailStats({
  mapName,
  analyticsList,
}: {
  mapName: string;
  analyticsList: AnalyticsMatch[];
}) {
  const normalizedMapName = normalizeLabel(mapName);

  const mapMatches = useMemo(
    () =>
      analyticsList.filter(
        (match) => normalizeLabel(match.map_name) === normalizedMapName,
      ),
    [analyticsList, normalizedMapName],
  );

  const computed = useMemo(() => {
    let matches = 0;
    let wins = 0;
    let rounds = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let totalScore = 0;
    let totalDamage = 0;
    let totalHeadshots = 0;
    let totalBodyshots = 0;
    let totalLegshots = 0;
    let totalTradeKills = 0;
    let totalFirstKills = 0;

    const attackTotals = {
      rounds: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      score: 0,
      firstKills: 0,
    };

    const defenseTotals = {
      rounds: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      score: 0,
      firstKills: 0,
    };

    const recentTimeline: Array<TrendPoint & { timestamp: number }> = [];
    const agentMap = new Map<
      string,
      {
        name: string;
        matches: number;
        wins: number;
        acsTotal: number;
      }
    >();
    const weaponMap = new Map<
      string,
      {
        name: string;
        kills: number;
        matches: number;
        headshots: number;
        bodyshots: number;
        legshots: number;
      }
    >();

    for (const match of mapMatches) {
      const overview = match.overview ?? {};
      const playerTotals = match.player_totals_from_match ?? {};
      const matchKills = toNumber(playerTotals.kills ?? overview.kills);
      const matchDeaths = toNumber(playerTotals.deaths ?? overview.deaths);
      const matchAssists = toNumber(playerTotals.assists ?? overview.assists);
      const matchRounds = toNumber(
        playerTotals.rounds_played ?? overview.rounds,
      );
      const matchScore = toNumber(playerTotals.score);
      const matchDamage = toNumber(overview.adr) * Math.max(matchRounds, 0);

      matches += 1;
      wins += match.won_match ? 1 : 0;
      rounds += matchRounds;
      kills += matchKills;
      deaths += matchDeaths;
      assists += matchAssists;
      totalScore += matchScore;
      totalDamage += matchDamage;
      totalHeadshots += toNumber(overview.headshots);
      totalBodyshots += toNumber(overview.bodyshots);
      totalLegshots += toNumber(overview.legshots);
      totalTradeKills += toNumber(overview.trade_kills);
      totalFirstKills += toNumber(overview.first_kills);

      const timestamp = toNumber(match.game_start_millis);
      recentTimeline.push({
        timestamp,
        label: formatDate(timestamp),
        shortLabel: "",
        acs: safeDivide(matchScore, Math.max(matchRounds, 1)),
        won: Boolean(match.won_match),
      });

      const agentKey = String(
        match.agent_id ?? match.agent_name ?? "unknown",
      ).trim();
      const agentName =
        String(match.agent_name ?? "Agente desconocido").trim() ||
        "Agente desconocido";
      const currentAgent = agentMap.get(agentKey);
      if (currentAgent) {
        currentAgent.matches += 1;
        currentAgent.wins += match.won_match ? 1 : 0;
        currentAgent.acsTotal += safeDivide(
          matchScore,
          Math.max(matchRounds, 1),
        );
      } else {
        agentMap.set(agentKey, {
          name: agentName,
          matches: 1,
          wins: match.won_match ? 1 : 0,
          acsTotal: safeDivide(matchScore, Math.max(matchRounds, 1)),
        });
      }

      const accumulateSide = (
        side: AnalyticsSideStats | undefined,
        target: typeof attackTotals,
      ) => {
        if (!side) return;
        target.rounds += toNumber(side.rounds);
        target.wins += toNumber(side.wins);
        target.kills += toNumber(side.kills);
        target.deaths += toNumber(side.deaths);
        target.damage += toNumber(side.damage_dealt);
        target.score += toNumber(side.score);
        target.firstKills += toNumber(side.first_kills);
      };

      accumulateSide(match.sides?.attack, attackTotals);
      accumulateSide(match.sides?.defense, defenseTotals);

      const weaponRows = Array.isArray(overview.weapon_stats)
        ? overview.weapon_stats
        : [];

      for (const row of weaponRows) {
        if (!row || typeof row !== "object") continue;
        const item = row as Record<string, unknown>;
        const weaponKills = toNumber(item.kills);
        const weaponDeaths = toNumber(item.deaths);
        const weaponAssists = toNumber(item.assists);
        const weaponRounds = toNumber(item.rounds);
        const hasUsage =
          weaponKills > 0 ||
          weaponDeaths > 0 ||
          weaponAssists > 0 ||
          weaponRounds > 0;

        if (!hasUsage) continue;

        const weaponKey = String(
          item.weapon_id ??
            item.key ??
            item.weapon_name ??
            item.name ??
            "unknown",
        ).trim();
        const weaponName =
          String(
            item.weapon_name ?? item.name ?? item.key ?? "Arma desconocida",
          ).trim() || "Arma desconocida";
        const currentWeapon = weaponMap.get(weaponKey);
        const headshots = toNumber(item.headshots);
        const bodyshots = toNumber(item.bodyshots);
        const legshots = toNumber(item.legshots);

        if (currentWeapon) {
          currentWeapon.kills += weaponKills;
          currentWeapon.matches += 1;
          currentWeapon.headshots += headshots;
          currentWeapon.bodyshots += bodyshots;
          currentWeapon.legshots += legshots;
        } else {
          weaponMap.set(weaponKey, {
            name: weaponName,
            kills: weaponKills,
            matches: 1,
            headshots,
            bodyshots,
            legshots,
          });
        }
      }
    }

    const totalImpacts = totalHeadshots + totalBodyshots + totalLegshots;
    const losses = Math.max(matches - wins, 0);

    const buildSideSummary = (source: typeof attackTotals): SideSummary => ({
      rounds: source.rounds,
      wins: source.wins,
      kills: source.kills,
      deaths: source.deaths,
      damage: source.damage,
      score: source.score,
      firstKills: source.firstKills,
      winRate: pct(source.wins, Math.max(source.rounds, 1)),
      kd: safeDivide(source.kills, Math.max(source.deaths, 1)),
      acs: safeDivide(source.score, Math.max(source.rounds, 1)),
      adr: safeDivide(source.damage, Math.max(source.rounds, 1)),
    });

    const attack = buildSideSummary(attackTotals);
    const defense = buildSideSummary(defenseTotals);

    const sideRows: SideRow[] = [
      {
        label: "Win rate",
        attackValue: attack.winRate,
        defenseValue: defense.winRate,
        kind: "percent",
        decimals: 1,
      },
      {
        label: "KD",
        attackValue: attack.kd,
        defenseValue: defense.kd,
        kind: "number",
        decimals: 2,
      },
      {
        label: "ACS",
        attackValue: attack.acs,
        defenseValue: defense.acs,
        kind: "number",
        decimals: 1,
      },
      {
        label: "ADR",
        attackValue: attack.adr,
        defenseValue: defense.adr,
        kind: "number",
        decimals: 1,
      },
      {
        label: "First kills",
        attackValue: attack.firstKills,
        defenseValue: defense.firstKills,
        kind: "number",
        decimals: 0,
      },
    ];

    const topAgentsData: AgentBreakdown[] = Array.from(agentMap.values())
      .map((entry) => ({
        name: entry.name,
        shortName: shortenLabel(entry.name),
        matches: entry.matches,
        wins: entry.wins,
        winRate: pct(entry.wins, Math.max(entry.matches, 1)),
        acsAvg: safeDivide(entry.acsTotal, Math.max(entry.matches, 1)),
      }))
      .sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches;
        return b.winRate - a.winRate;
      })
      .slice(0, 5);

    const topWeaponsData: WeaponBreakdown[] = Array.from(weaponMap.values())
      .map((entry) => ({
        name: entry.name,
        shortName: shortenLabel(entry.name),
        kills: entry.kills,
        matches: entry.matches,
        headshotPct: pct(
          entry.headshots,
          entry.headshots + entry.bodyshots + entry.legshots,
        ),
      }))
      .sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.matches - a.matches;
      })
      .slice(0, 5);

    const recentTrendData = recentTimeline
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8)
      .reverse()
      .map((entry, index) => ({
        ...entry,
        shortLabel: `P${index + 1}`,
      }));

    const preferredSide =
      attack.rounds >= 8 || defense.rounds >= 8
        ? attack.winRate >= defense.winRate
          ? {
              label: "Ataque",
              rounds: attack.rounds,
              winRate: attack.winRate,
            }
          : {
              label: "Defensa",
              rounds: defense.rounds,
              winRate: defense.winRate,
            }
        : null;

    const primaryInsight = preferredSide
      ? `Tu lado más fiable aquí es ${preferredSide.label.toLowerCase()} (${preferredSide.winRate.toFixed(1)}% en ${preferredSide.rounds} rondas).`
      : topAgentsData[0]
        ? `Tu agente más consistente aquí es ${topAgentsData[0].name} (${topAgentsData[0].winRate.toFixed(1)}% de win rate en ${topAgentsData[0].matches} partidas).`
        : `Has jugado ${matches} partidas filtradas en ${mapName}.`;

    const stats: MapDetailStats = {
      matches,
      wins,
      losses,
      rounds,
      kills,
      deaths,
      assists,
      winRate: pct(wins, Math.max(matches, 1)),
      kd: safeDivide(kills, Math.max(deaths, 1)),
      kda: safeDivide(kills + assists, Math.max(deaths, 1)),
      acsAvg: safeDivide(totalScore, Math.max(rounds, 1)),
      adrAvg: safeDivide(totalDamage, Math.max(rounds, 1)),
      hsPct: pct(totalHeadshots, totalImpacts),
      killsPerMatch: safeDivide(kills, Math.max(matches, 1)),
      deathsPerMatch: safeDivide(deaths, Math.max(matches, 1)),
      assistsPerMatch: safeDivide(assists, Math.max(matches, 1)),
      tradeKillsPerMatch: safeDivide(totalTradeKills, Math.max(matches, 1)),
      firstKillsPerMatch: safeDivide(totalFirstKills, Math.max(matches, 1)),
    };

    return {
      stats,
      primaryInsight,
      recentTrendData,
      sideRows,
      topAgentsData,
      topWeaponsData,
      hasSideData: attack.rounds > 0 || defense.rounds > 0,
    };
  }, [mapMatches, mapName]);

  return {
    mapMatches,
    ...computed,
  };
}
