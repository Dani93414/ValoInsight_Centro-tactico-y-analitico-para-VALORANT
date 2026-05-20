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
  matches_played?: number;
  matches?: number;
  rounds_played?: number;
  rounds?: number;
  totals?: RegionMetricTotals;
  pick_rate?: number;
  win_rate?: number;
  adjusted_win_rate?: number;
  score?: number;
  sample?: number;
  sample_confidence?: number;
  avg_kd?: number;
  avg_kda?: number;
  avg_acs?: number;
  avg_adr?: number;
  kd?: number;
  kda?: number;
  acs?: number;
  adr?: number;
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
  map_url?: string;
  matches_played?: number;
  matches?: number;
  player_matches?: number;
  wins?: number;
  rounds_played?: number;
  rounds_won?: number;
  rounds_lost?: number;
  win_rate?: number;
  player_win_rate?: number;
  total_rounds?: number;
  map_rounds?: number;
  player_rounds?: number;
  team_round_wins?: number;
  team_round_losses?: number;
  team_round_win_rate?: number;
  attack_rounds?: number;
  attack_wins?: number;
  attack_win_rate?: number;
  defense_rounds?: number;
  defense_wins?: number;
  defense_win_rate?: number;
  round_differential?: number;
  rounds_with_kast?: number;
  kast_rounds?: number;
  kast_rate?: number;
  kast_has_trade_component?: boolean;
  survived_rounds?: number;
  survival_rounds?: number;
  damage_dealt?: number;
  damage_received?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  clutch_opportunities?: number;
  clutches_won?: number;
  clutch_rate?: number | null;
  kast_pct?: number;
  survival_rate?: number;
  clutch_win_rate?: number | null;
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
  round_ceremonies?: Record<string, number | RegionRoundCeremonyStats>;
  agent_stats?: Record<string, RegionMapAgentStats>;
  weapon_stats?: Record<string, RegionMapWeaponStats>;
  composition_stats?: Record<string, RegionMapCompositionStats>;
  totals?: RegionMetricTotals;
};

export type RegionRoundCeremonyStats = {
  wins?: number;
  rounds?: number;
  percentage_of_wins?: number;
};

export type RegionMapAgentStats = RegionAgentStats & {
  agent_name?: string;
  matches_played?: number;
  rounds_played?: number;
  pick_count?: number;
  score?: number;
  adjusted_win_rate?: number;
  sample?: number;
  sample_confidence?: number;
  survival_rate?: number;
  kast_rate?: number;
  kd?: number;
  kda?: number;
  adr?: number;
  acs?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  damage_dealt?: number;
};

export type RegionWeaponStats = {
  weapon_name?: string;
  is_armor?: boolean;
  rounds_equipped?: number;
  rounds_purchased?: number;
  wins?: number;
  win_rate?: number;
  round_win_rate?: number;
  adjusted_round_win_rate?: number;
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
  use_rate?: number;
  score?: number;
  sample?: number;
  sample_confidence?: number;
};

export type RegionMapWeaponStats = RegionWeaponStats & {
  rounds_won_with_weapon?: number;
  round_win_rate?: number;
  adjusted_round_win_rate?: number;
  use_rate?: number;
  score?: number;
  sample?: number;
  sample_confidence?: number;
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
  key?: string;
  agent_ids?: string[];
  agent_names?: string[];
  agents?: string[];
  matches_played?: number;
  matches?: number;
  wins?: number;
  losses?: number;
  rounds_won?: number;
  rounds_lost?: number;
  win_rate?: number;
  adjusted_win_rate?: number;
  pick_rate?: number;
  score?: number;
  sample?: number;
  sample_confidence?: number;
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
