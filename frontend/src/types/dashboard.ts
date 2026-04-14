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
  kills: number;
  deaths: number;
  kdRatio: number;
};

export type AnalyticsMatch = {
  id: string;
  match_id?: string;
  won_match?: boolean;
  map_name?: string;
  game_start_millis?: number;
  agent_id?: string;
  agent_name?: string;
  role?: string;
  overview?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    acs?: number;
    adr?: number;
    headshot_pct?: number;
    rounds?: number;
    wins?: number;
    headshots?: number;
    bodyshots?: number;
    legshots?: number;
    weapon_stats?: Array<Record<string, unknown>>;
    first_kills?: number;
    first_deaths?: number;
    opening_duel_win_pct?: number;
    trade_kills?: number;
    traded_deaths?: number;
    clutch_opportunities?: number;
    clutches_won?: number;
    clutch_win_rate?: number;
    survival_rate?: number;
    multikill_rate?: number;
    multi_2k?: number;
    multi_3k?: number;
    multi_4k?: number;
    multi_5k?: number;
    damage_delta?: number;
    damage_delta_per_round?: number;
    kd_ratio?: number;
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
  tier?: number;
  name: string;
  image?: string;
  smallIcon?: string;
};

export type HeaderVisualCard = {
  title: string;
  subtitle: string;
  image?: string | null;
};

export type DashboardMetric = {
  label: string;
  value: number;
  percent: number;
  helper: string;
  benchmark: string;
};

export type DashboardPayload = {
  player: PlayerStats;
  totalMatchesInDb: number;
  agentNameMap: Record<string, string>;
  agentMediaMap: Record<
    string,
    { name?: string; image?: string | null; displayIcon?: string | null }
  >;
  mapMediaMap?: Record<string, string>;
  analyticsList: AnalyticsMatch[];
  currentActId?: string | null;
  currentRank: RankInfo;
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
