export type PlayerStats = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  region?: string;
  accountLevel?: number;
  totalMatches?: number;
  totalWins?: number;
  totalKills?: number;
  totalDeaths?: number;
  totalAssists?: number;
  totalScore?: number;
  totalPlaytimeMillis?: number;
  totalRoundsPlayed?: number;
  totalHeadshots?: number;
  totalBodyshots?: number;
  totalLegshots?: number;
  mostPlayedAgents?: Array<{
    agentId: string;
    matches: number;
  }>;
};

export type WeaponStat = {
  weaponId: string;
  weaponName: string;
  rounds?: number;
  kills: number;
  deaths: number;
  assists?: number;
  kdRatio: number;
};

export type AnalyticsMatch = {
  id: string;
  match_id?: string;
  won_match?: boolean;
  season_id?: string;
  map_id?: string;
  map_name?: string;
  game_start_millis?: number;
  agent_id?: string;
  agent_name?: string;
  team_agents?: Array<{
    agent_id?: string | null;
    agent_name?: string | null;
  }>;
  role?: string;
  competitive_tier?: number;
  overview?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    acs?: number;
    adr?: number;
    headshot_pct?: number;
    rounds?: number;
    wins?: number;
    losses?: number;
    headshots?: number;
    bodyshots?: number;
    legshots?: number;
    weapon_stats?: Array<Record<string, unknown>> | Record<string, Record<string, unknown>>;
    first_kills?: number;
    first_deaths?: number;
    opening_duel_wins?: number;
    opening_duel_losses?: number;
    plants?: number;
    defuses?: number;
    plant_opportunities?: number;
    defuse_opportunities?: number;
    plants_per_opportunity_pct?: number;
    defuses_per_opportunity_pct?: number;
    opening_duel_win_pct?: number;
    trade_kills?: number;
    trade_opportunities?: number;
    missed_trade_opportunities?: number;
    trade_conversion_rate?: number;
    traded_deaths?: number;
    clutch_opportunities?: number;
    clutches_won?: number;
    clutch_win_rate?: number;
    clutch_1v1_opportunities?: number;
    clutch_1v1_wins?: number;
    clutch_1v2_opportunities?: number;
    clutch_1v2_wins?: number;
    clutch_1v3_opportunities?: number;
    clutch_1v3_wins?: number;
    clutch_1v4_opportunities?: number;
    clutch_1v4_wins?: number;
    clutch_1v5_opportunities?: number;
    clutch_1v5_wins?: number;
    survival_rounds?: number;
    rounds_with_kill?: number;
    rounds_with_assist?: number;
    rounds_with_death?: number;
    rounds_with_direct_participation?: number;
    rounds_without_direct_participation?: number;
    rounds_with_kill_pct?: number;
    rounds_with_assist_pct?: number;
    rounds_with_death_pct?: number;
    rounds_with_direct_participation_pct?: number;
    rounds_without_direct_participation_pct?: number;
    rounds_only_kill?: number;
    rounds_only_assist?: number;
    rounds_only_death?: number;
    rounds_kill_assist?: number;
    rounds_kill_death?: number;
    rounds_assist_death?: number;
    rounds_kill_assist_death?: number;
    rounds_none?: number;
    rounds_combined_or_none?: number;
    rounds_only_kill_pct?: number;
    rounds_only_assist_pct?: number;
    rounds_only_death_pct?: number;
    rounds_kill_assist_pct?: number;
    rounds_kill_death_pct?: number;
    rounds_assist_death_pct?: number;
    rounds_kill_assist_death_pct?: number;
    rounds_none_pct?: number;
    rounds_combined_or_none_pct?: number;
    rounds_with_kast?: number;
    survival_rate?: number;
    multikill_rate?: number;
    multi_2k?: number;
    multi_3k?: number;
    multi_4k?: number;
    multi_5k?: number;
    round_ceremonies?: Record<string, number>;
    damage_delta?: number;
    damage_delta_per_round?: number;
    kd_ratio?: number;
    kast?: number;
    kast_pct?: number;
    kill_assist_survive_trade_pct?: number;
  };
  player_totals_from_match?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    score?: number;
    rounds_played?: number;
  };
  sides?: {
    attack?: AnalyticsSideStats;
    defense?: AnalyticsSideStats;
  };
};

/** Side stats as returned by the analytics pipeline (snake_case). */
export type AnalyticsSideStats = {
  rounds?: number;
  wins?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  score?: number;
  damage_dealt?: number;
  damage_received?: number;
  headshots?: number;
  bodyshots?: number;
  legshots?: number;
  acs?: number;
  adr?: number;
  kd_ratio?: number;
  headshot_pct?: number;
  first_kills?: number;
  first_deaths?: number;
  rounds_with_kill?: number;
  rounds_with_assist?: number;
  rounds_with_death?: number;
  rounds_with_direct_participation?: number;
  rounds_without_direct_participation?: number;
  rounds_only_kill?: number;
  rounds_only_assist?: number;
  rounds_only_death?: number;
  rounds_kill_assist?: number;
  rounds_kill_death?: number;
  rounds_assist_death?: number;
  rounds_kill_assist_death?: number;
  rounds_none?: number;
  rounds_combined_or_none?: number;
  rounds_with_multikill?: number;
  multi_2k?: number;
  multi_3k?: number;
  multi_4k?: number;
  multi_5k?: number;
};

export type SideStats = {
  rounds: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damageDealt: number;
  damageReceived: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
};

export type MatchCard = {
  id: string;
  seasonId: string;
  dateLabel: string;
  timestamp: number;
  map: string;
  agent: string;
  agentId?: string;
  role: string;
  queue: string;
  mode: string;
  result: "Victoria" | "Derrota" | "Empate";
  roundScore: string;
  ranked: boolean;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  playtimeMillis?: number;
  score: number;
  acs: number;
  adr: number;
  hs: number;
  kd: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  competitiveTier?: number;
  competitiveTierImage?: string;
  accountLevel?: number;
  weaponStats: WeaponStat[];
  sides?: { attack?: SideStats; defense?: SideStats } | null;
  partySize?: number;
};

export type ActSummary = {
  matches: number;
  wins: number;
  winRate: number;
  kd: number;
  kda: number;
  acs: number;
  killsPerMatch: number;
  hsAvg: number;
};

export type RankInfo = {
  tier?: number | null;
  name: string;
  image?: string | null;
  smallIcon?: string | null;
  source?: string;
  rankSource?: string;
  isUnranked?: boolean;
};

export type HeaderVisualCard = {
  title: string;
  subtitle: string;
  image?: string | null;
  valueLabel?: string;
};

export type DashboardMetric = {
  label: string;
  value: number;
  percent: number;
  helper: string;
  benchmark: string;
};

export type RankComparisonMetricKey =
  | "kd"
  | "k"
  | "d"
  | "a"
  | "kda"
  | "acs"
  | "hsPct"
  | "kast"
  | "incDamage"
  | "wr"
  | "wins"
  | "losses";

export type RankComparisonMetricComparison = {
  percentile: number;
  sampleSize: number;
  isNeutral: boolean;
  value?: number | null;
  rawValue?: number | null;
  adjustedValue?: number | null;
  rankingValue?: number | null;
  rankingMethod?: "bayesian_shrinkage" | string;
  metricSampleSize?: number;
  metricSampleBasis?: string;
  cohortMean?: number | null;
  priorWeight?: number;
};

export type RankComparisonPayload = {
  baseTier?: number | null;
  baseRankName?: string;
  cohortTiers?: number[];
  cohortLabels?: string[];
  sampleSize?: number;
  metricComparisons?: Partial<
    Record<RankComparisonMetricKey, RankComparisonMetricComparison>
  >;
  notes?: string[];
  baseTierSource?: string;
  baseTierSeasonId?: string | null;
  visualRankName?: string;
  cohortReferenceTier?: number | null;
  cohortReferenceRankName?: string;
};

export type DashboardPayload = {
  player: PlayerStats;
  totalMatchesInDb: number;
  agentNameMap: Record<string, string>;
  agentMediaMap: Record<
    string,
    {
      name?: string;
      image?: string | null;
      displayIcon?: string | null;
      roleName?: string;
      roleIcon?: string | null;
    }
  >;
  mapMediaMap?: Record<string, string>;
  analyticsList: AnalyticsMatch[];
  roundStats?: {
    total_rounds: number;
    rounds_with_kill: number;
    rounds_with_assist: number;
    rounds_with_death: number;
    rounds_with_kast?: number;
    rounds_with_kill_pct: number;
    rounds_with_assist_pct: number;
    rounds_with_death_pct: number;
    rounds_with_kast_pct?: number;
    first_bloods: number;
    aces: number;
    plants?: number;
    defuses?: number;
    plant_opportunities?: number;
    defuse_opportunities?: number;
    plants_per_opportunity_pct?: number;
    defuses_per_opportunity_pct?: number;
    direct_participation_rounds: number;
    no_direct_participation_rounds: number;
    direct_participation_pct: number;
    no_direct_participation_pct: number;
    distribution_only_kills_rounds: number;
    distribution_only_assists_rounds: number;
    distribution_only_deaths_rounds: number;
    distribution_kill_assist_rounds: number;
    distribution_kill_death_rounds: number;
    distribution_assist_death_rounds: number;
    distribution_kill_assist_death_rounds: number;
    distribution_none_rounds: number;
    distribution_combined_or_none_rounds: number;
    distribution_only_kills_pct: number;
    distribution_only_assists_pct: number;
    distribution_only_deaths_pct: number;
    distribution_kill_assist_pct: number;
    distribution_kill_death_pct: number;
    distribution_assist_death_pct: number;
    distribution_kill_assist_death_pct: number;
    distribution_none_pct: number;
    distribution_combined_or_none_pct: number;
  };
  currentActId?: string | null;
  matchPagination?: {
    page: number;
    pageSize: number;
    totalMatches: number;
    totalPages: number;
  };
  currentRank: RankInfo;
  rankComparison?: RankComparisonPayload;
  headerShowcase: HeaderVisualCard[];
  mostPlayedAgents: Array<{
    id: string;
    name: string;
    matches: number;
    image?: string | null;
  }>;
  mostPlayedWeapons?: Array<{
    id: string;
    name: string;
    type?: string;
    isAbility?: boolean;
    kills: number;
    matches: number;
    image?: string | null;
  }>;
  metrics: {
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
  };
  shotChart: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  performanceMetrics: DashboardMetric[];
  insights: {
    primary?: string;
    mostPlayedAgent?: {
      id: string;
      name: string;
      matches: number;
    } | null;
    bestMap?: {
      map: string;
      matches: number;
      winRate: number;
    } | null;
    bestWeapon?: {
      name: string;
      matches: number;
      kills?: number;
      winRate: number;
    } | null;
  };
  actOptions: Array<{ id: string; label: string }>;
  actSections: Record<
    string,
    {
      summary: ActSummary;
      matches: MatchCard[];
    }
  >;
};

export type CompetitiveTierAsset = {
  tier?: number | string | null;
  smallIcon?: string;
  largeIcon?: string;
  rankTriangleUpIcon?: string;
  rankTriangleDownIcon?: string;
  tierName?: string;
  divisionName?: string;
};

export type HeaderCardKind = "agent" | "map" | "weapon" | "default";

export type HeaderAgentImageAdjustment = {
  /** Horizontal focus point in the original image (0–100 %). 50 = center */
  objX: number;
  /** Zoom level. 1 = fill container (cover), >1 = zoom in further */
  scale: number;
  /** Vertical shift after scaling (%). Negative = move image up */
  shiftY: number;
  /** Where the bottom fade begins (%) */
  fadeStart: number;
  /** Midpoint of the bottom fade (%) */
  fadeMid: number;
  /** Where the bottom fade ends — fully transparent (%) */
  fadeEnd: number;
  /** Flip the image horizontally */
  flip?: boolean;
};

export type SideFilter = "all" | "attack" | "defense";
export type PartySizeFilter = "all" | "solo" | "duo" | "trio" | "team";

export type DashboardFilters = {
  actId: string;
  agentId: string;
  map: string;
  side: SideFilter;
  partySize: PartySizeFilter;
  queueId: string;
};
