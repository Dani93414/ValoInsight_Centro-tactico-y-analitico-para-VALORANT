import type { Agente } from "../../../types/agents";
import type { AnalyticsMatch } from "../../../types/dashboard";
import { normalizeLabel, safeDivide } from "../../../utils/formatters";
import type { PersonalAgentStats } from "../types";
import { buildAgentLookup } from "./agentKeys";

type PersonalAverageKey =
  | "avg_kd"
  | "avg_kda"
  | "avg_acs"
  | "avg_adr"
  | "avg_headshot_pct"
  | "avg_fk_rate"
  | "avg_fd_rate"
  | "avg_survival_rate"
  | "avg_clutch_win_rate"
  | "deaths_per_round"
  | "assist_rate"
  | "kast_pct"
  | "trade_rate"
  | "opening_duel_win_pct";

type PersonalStatAccumulator = {
  picks: number;
  wins: number;
  totals: {
    rounds: number;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    damage: number;
    headshots: number;
    bodyshots: number;
    legshots: number;
    firstKills: number;
    firstDeaths: number;
    roundsWithAssist: number;
    roundsWithKast: number;
    survivalRounds: number;
    clutchOpportunities: number;
    clutchesWon: number;
    tradeKills: number;
    tradeOpportunities: number;
    openingDuelWins: number;
    openingDuelLosses: number;
  };
};

const emptyAccumulator = (): PersonalStatAccumulator => ({
  picks: 0,
  wins: 0,
  totals: {
    rounds: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    damage: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
    firstKills: 0,
    firstDeaths: 0,
    roundsWithAssist: 0,
    roundsWithKast: 0,
    survivalRounds: 0,
    clutchOpportunities: 0,
    clutchesWon: 0,
    tradeKills: 0,
    tradeOpportunities: 0,
    openingDuelWins: 0,
    openingDuelLosses: 0,
  },
});

function buildPersonalDerivedStats(accumulator: PersonalStatAccumulator) {
  const total = accumulator.totals;
  const totalShots = total.headshots + total.bodyshots + total.legshots;
  const rounds = total.rounds;

  return {
    avg_kd: safeDivide(total.kills, Math.max(total.deaths, 1)),
    avg_kda: safeDivide(total.kills + total.assists, Math.max(total.deaths, 1)),
    avg_acs: safeDivide(total.score, rounds),
    avg_adr: safeDivide(total.damage, rounds),
    avg_headshot_pct: safeDivide(total.headshots * 100, totalShots),
    avg_fk_rate: safeDivide(total.firstKills * 100, rounds),
    avg_fd_rate: safeDivide(total.firstDeaths * 100, rounds),
    avg_survival_rate: safeDivide(total.survivalRounds * 100, rounds),
    avg_clutch_win_rate: safeDivide(total.clutchesWon * 100, total.clutchOpportunities),
    deaths_per_round: safeDivide(total.deaths, rounds),
    assist_rate: safeDivide(total.roundsWithAssist * 100, rounds),
    kast_pct: safeDivide(total.roundsWithKast * 100, rounds),
    trade_rate: safeDivide(total.tradeKills * 100, total.tradeOpportunities),
    opening_duel_win_pct: safeDivide(
      total.openingDuelWins * 100,
      total.openingDuelWins + total.openingDuelLosses,
    ),
  } satisfies Partial<Pick<PersonalAgentStats, PersonalAverageKey>>;
}

export function buildPersonalStatsByAgent(
  analyticsList: AnalyticsMatch[] | undefined,
  agents: Agente[],
  filters: { map: string; rank: string; act: string },
): Map<string, PersonalAgentStats> {
  const statSeeds = new Map<string, PersonalStatAccumulator>();
  const keyByMatchValue = buildAgentLookup(agents);

  (analyticsList ?? []).forEach((match) => {
    if (filters.map !== "all" && match.map_id !== filters.map) return;
    if (filters.rank !== "all" && String(match.competitive_tier ?? "") !== filters.rank) return;
    if (filters.act !== "all" && match.season_id !== filters.act) return;

    const agentKey =
      keyByMatchValue.get(normalizeLabel(match.agent_id)) ??
      keyByMatchValue.get(normalizeLabel(match.agent_name));
    if (!agentKey) return;

    const current = statSeeds.get(agentKey) ?? emptyAccumulator();
    const overview = match.overview ?? {};

    current.picks += 1;
    current.wins += match.won_match ? 1 : 0;
    current.totals.rounds += overview.rounds ?? match.player_totals_from_match?.rounds_played ?? 0;
    current.totals.kills += overview.kills ?? match.player_totals_from_match?.kills ?? 0;
    current.totals.deaths += overview.deaths ?? match.player_totals_from_match?.deaths ?? 0;
    current.totals.assists += overview.assists ?? match.player_totals_from_match?.assists ?? 0;
    current.totals.score += match.player_totals_from_match?.score ?? 0;
    current.totals.damage +=
      typeof overview.adr === "number" && typeof overview.rounds === "number"
        ? overview.adr * overview.rounds
        : 0;
    current.totals.headshots += overview.headshots ?? 0;
    current.totals.bodyshots += overview.bodyshots ?? 0;
    current.totals.legshots += overview.legshots ?? 0;
    current.totals.firstKills += overview.first_kills ?? 0;
    current.totals.firstDeaths += overview.first_deaths ?? 0;
    current.totals.roundsWithAssist += overview.rounds_with_assist ?? 0;
    current.totals.roundsWithKast += overview.rounds_with_kast ?? 0;
    current.totals.survivalRounds += overview.survival_rounds ?? 0;
    current.totals.clutchOpportunities += overview.clutch_opportunities ?? 0;
    current.totals.clutchesWon += overview.clutches_won ?? 0;
    current.totals.tradeKills += overview.trade_kills ?? 0;
    current.totals.tradeOpportunities += overview.trade_opportunities ?? 0;
    current.totals.openingDuelWins += overview.opening_duel_wins ?? 0;
    current.totals.openingDuelLosses += overview.opening_duel_losses ?? 0;
    statSeeds.set(agentKey, current);
  });

  const totalPicks = Array.from(statSeeds.values()).reduce(
    (total, stats) => total + stats.picks,
    0,
  );
  const result = new Map<string, PersonalAgentStats>();
  statSeeds.forEach((stats, agentKey) => {
    result.set(agentKey, {
      picks: stats.picks,
      wins: stats.wins,
      losses: Math.max(0, stats.picks - stats.wins),
      rounds: stats.totals.rounds,
      kills: stats.totals.kills,
      deaths: stats.totals.deaths,
      assists: stats.totals.assists,
      ...buildPersonalDerivedStats(stats),
      usagePct: safeDivide(stats.picks * 100, totalPicks),
      winRate: safeDivide(stats.wins * 100, stats.picks),
    });
  });

  return result;
}
