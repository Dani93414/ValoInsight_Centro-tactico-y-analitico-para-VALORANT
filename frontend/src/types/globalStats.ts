export type RegionMetricTotals = {
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
  first_kills?: number;
  first_deaths?: number;
  opening_duel_wins?: number;
  opening_duel_losses?: number;
  survival_rounds?: number;
  rounds_with_assist?: number;
  rounds_with_kast?: number;
  clutch_opportunities?: number;
  clutches_won?: number;
  trade_kills?: number;
  trade_opportunities?: number;
  missed_trade_opportunities?: number;
  traded_deaths?: number;
  multi_2k?: number;
  multi_3k?: number;
  multi_4k?: number;
  multi_5k?: number;
  econ_spent?: number;
  loadout_value_total?: number;
};

export type RegionAverages = {
  kd_ratio?: number;
  kda_ratio?: number;
  acs?: number;
  adr?: number;
  headshot_pct?: number;
  kast_pct?: number;
  survival_rate?: number;
  clutch_win_rate?: number;
  opening_duel_win_pct?: number;
  multikill_rate?: number;
  damage_per_1000_credits?: number;
  kills_per_round?: number;
  deaths_per_round?: number;
  assists_per_round?: number;
  fk_rate?: number;
  fd_rate?: number;
  trade_kills_per_round?: number;
  average_loadout_value?: number;
};

export type RegionSideStats = {
  rounds?: number;
  wins?: number;
  win_rate?: number;
  kills?: number;
  deaths?: number;
  adr?: number;
  kills_per_round?: number;
};

export type RegionAgentStats = {
  agent_name?: string;
  role?: string;
  picks?: number;
  wins?: number;
  matches?: number;
  rounds?: number;
  totals?: RegionMetricTotals;
  pick_rate?: number;
  win_rate?: number;
  avg_kd?: number;
  avg_kda?: number;
  avg_acs?: number;
  avg_adr?: number;
  avg_headshot_pct?: number;
  avg_fk_rate?: number;
  avg_fd_rate?: number;
  avg_survival_rate?: number;
  avg_clutch_win_rate?: number;
  deaths_per_round?: number;
  assist_rate?: number;
  kast_pct?: number;
  trade_rate?: number;
  trade_kills_per_round?: number;
  opening_duel_win_pct?: number;
};

export type RegionMapStats = {
  map_name?: string;
  matches?: number;
  player_matches?: number;
  wins?: number;
  win_rate?: number;
  player_win_rate?: number;
  total_rounds?: number;
  map_rounds?: number;
  player_rounds?: number;
  team_round_wins?: number;
  team_round_losses?: number;
  team_round_win_rate?: number;
  rounds_with_kast?: number;
  survival_rounds?: number;
  clutch_opportunities?: number;
  clutches_won?: number;
  kast_pct?: number;
  survival_rate?: number;
  clutch_win_rate?: number;
  avg_rounds_per_match?: number;
  averages?: Pick<
    RegionAverages,
    | "kd_ratio"
    | "acs"
    | "adr"
    | "headshot_pct"
    | "kast_pct"
    | "survival_rate"
    | "clutch_win_rate"
    | "kills_per_round"
    | "deaths_per_round"
  >;
  sides?: {
    attack?: RegionSideStats;
    defense?: RegionSideStats;
  };
  round_ceremonies?: Record<string, number>;
};

export type RegionWeaponStats = {
  weapon_name?: string;
  is_armor?: boolean;
  rounds_equipped?: number;
  rounds_purchased?: number;
  wins?: number;
  win_rate?: number;
  kills?: number;
  deaths?: number;
  headshots?: number;
  bodyshots?: number;
  legshots?: number;
  headshot_pct?: number;
  damage_dealt?: number;
  damage_received?: number;
  survival_rounds?: number;
  survival_rate?: number;
  damage_received_per_round?: number;
  loadout_value_total?: number;
  average_loadout_value?: number;
  kd_ratio?: number;
  kills_per_round?: number;
  adr?: number;
  pick_rate_per_round?: number;
};

export type RegionEconomyStats = {
  rounds?: number;
  wins?: number;
  win_rate?: number;
  kd_ratio?: number;
  adr?: number;
};

export type RegionTopAgent = {
  agentId?: string;
  agent_name?: string;
  role?: string;
  picks?: number;
  win_rate?: number;
};

export type RegionTopMap = {
  mapId?: string;
  map_name?: string;
  matches?: number;
};

export type RegionTopWeapon = {
  weaponId?: string;
  weapon_name?: string;
  kills?: number;
  headshot_pct?: number;
};

export type RegionStats = {
  region: string;
  totalMatches?: number;
  uniquePlayers?: number;
  totalRounds?: number;
  avgRoundsPerMatch?: number;
  totals?: RegionMetricTotals;
  averages?: RegionAverages;
  sides?: {
    attack?: RegionSideStats;
    defense?: RegionSideStats;
  };
  economy?: Record<string, RegionEconomyStats>;
  agentStats?: Record<string, RegionAgentStats>;
  mapStats?: Record<string, RegionMapStats>;
  weaponStats?: Record<string, RegionWeaponStats>;
  mostPlayedAgents?: RegionTopAgent[];
  mostPlayedMaps?: RegionTopMap[];
  mostLethalWeapons?: RegionTopWeapon[];
  updatedAt?: string;
};

export type GlobalAgentStatsOption = {
  value: string;
  label: string;
  count?: number;
};

export type GlobalAgentStatsPayload = {
  filters?: {
    region?: string | null;
    rank?: string | null;
    map?: string | null;
    act?: string | null;
    role?: string | null;
  };
  options?: {
    maps?: GlobalAgentStatsOption[];
    ranks?: GlobalAgentStatsOption[];
    acts?: GlobalAgentStatsOption[];
  };
  sampleSize?: {
    matches?: number;
    picks?: number;
    agents?: number;
  };
  warnings?: string[];
  agentStats?: Record<string, RegionAgentStats>;
};

export type GlobalAgentStatsFilters = {
  region?: string;
  rank?: string;
  map?: string;
  act?: string;
  role?: string;
};

export type RegionMapCompositionStats = {
  key: string;
  agents: string[];
  matches?: number;
  wins?: number;
  rounds_won?: number;
  rounds_lost?: number;
  win_rate?: number;
};

export type GlobalMapStatsPayload = {
  filters?: {
    region?: string | null;
    rank?: string | null;
    map?: string | null;
    act?: string | null;
    agent?: string | null;
  };
  options?: {
    maps?: GlobalAgentStatsOption[];
    ranks?: GlobalAgentStatsOption[];
    acts?: GlobalAgentStatsOption[];
    agents?: GlobalAgentStatsOption[];
  };
  sampleSize?: {
    matches?: number;
    players?: number;
    maps?: number;
  };
  warnings?: string[];
  mapStats?: Record<string, RegionMapStats>;
  agentStatsByMap?: Record<string, Record<string, RegionAgentStats>>;
  weaponStatsByMap?: Record<string, Record<string, RegionWeaponStats>>;
  compositionsByMap?: Record<string, RegionMapCompositionStats[]>;
};

export type GlobalMapStatsFilters = {
  region?: string;
  rank?: string;
  map?: string;
  act?: string;
  agent?: string;
};
