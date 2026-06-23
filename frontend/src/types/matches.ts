/* =====================================================
   Raw match-detail types used in MatchDetailModal.
   ===================================================== */

export type RawLocation = {
  x?: number;
  y?: number;
};

export type RawFinishingDamage = {
  damageType?: string;
  damageItem?: string;
  isSecondaryFireMode?: boolean;
  // Backward-compatible alias used in older payloads.
  item?: string;
};

export type RawPlayerLocation = {
  puuid?: string;
  viewRadians?: number;
  location?: RawLocation;
};

export type RawKillEvent = {
  killer?: string;
  victim?: string;
  killerLocation?: RawLocation;
  victimLocation?: RawLocation;
  finishingDamage?: RawFinishingDamage;
  assistants?: string[] | string | null;
  playerLocations?: RawPlayerLocation[];
  timeSinceRoundStartMillis?: number;
  timeSinceGameStartMillis?: number;
};

export type RawRoundDamage = {
  receiver?: string;
  damage?: number;
  legshots?: number;
  bodyshots?: number;
  headshots?: number;
};

export type RawRoundPlayerEconomy = {
  loadoutValue?: number;
  weapon?: string;
  armor?: string;
  remaining?: number;
  spent?: number;
};

export type RawRoundPlayerAbility = {
  grenadeEffects?: unknown;
  ability1Effects?: unknown;
  ability2Effects?: unknown;
  ultimateEffects?: unknown;
};

export type RawRoundPlayerStat = {
  puuid?: string;
  kills?: RawKillEvent[];
  damage?: RawRoundDamage[];
  score?: number;
  economy?: RawRoundPlayerEconomy;
  ability?: RawRoundPlayerAbility;
};

export type RawRound = {
  roundNum?: number;
  roundResult?: string;
  roundCeremony?: string;
  winningTeam?: string;
  winningTeamRole?: string;
  bombPlanter?: string;
  bombDefuser?: string;
  plantRoundTime?: number;
  plantPlayerLocations?: RawPlayerLocation[];
  plantLocation?: RawLocation;
  plantSite?: string;
  defuseRoundTime?: number;
  defusePlayerLocations?: RawPlayerLocation[];
  defuseLocation?: RawLocation;
  playerStats?: RawRoundPlayerStat[];
  roundResultCode?: string;
};

export type RawPlayerAbilityCasts = {
  grenadeCasts?: number;
  ability1Casts?: number;
  ability2Casts?: number;
  ultimateCasts?: number;
};

export type RawPlayerMatchStats = {
  score?: number;
  roundsPlayed?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  playtimeMillis?: number;
  abilityCasts?: RawPlayerAbilityCasts;
};

export type RawPlayer = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  teamId?: string;
  partyId?: string;
  characterId?: string;
  competitiveTier?: number;
  competitiveTierImage?: string;
  playerCard?: string;
  playerTitle?: string;
  accountLevel?: number;
  isObserver?: boolean;
  stats?: RawPlayerMatchStats;
};

export type RawTeam = {
  teamId?: string;
  won?: boolean;
  roundsWon?: number;
  roundsLost?: number;
};

export type RawMatchDetail = {
  matchInfo?: {
    matchId?: string;
    mapId?: string;
    gameLengthMillis?: number;
    gameStartMillis?: number;
    queueId?: string;
    gameMode?: string;
    isRanked?: boolean;
    seasonId?: string;
  };
  players?: RawPlayer[];
  coaches?: Array<Record<string, unknown>>;
  teams?: RawTeam[];
  roundResults?: RawRound[];
};

export type EconomyMlAlternative = {
  action: string;
  estimated_match_win_probability: number | null;
  estimated_round_win_probability?: number | null;
  estimated_fullbuy_next_round_probability?: number | null;
  is_available: boolean;
  reason_if_unavailable?: string | null;
  historical_support?: number;
  team_plan?: EconomyMlTeamPlan | null;
};

export type EconomyMlTeamPlan = {
  macro_case?: string;
  subtype?: string;
  team_total_budget?: number;
  estimated_total_spend?: number;
  estimated_weapon_spend?: number;
  estimated_armor_spend?: number;
  estimated_ability_spend?: number | null;
  expected_remaining?: number;
  future_economy_score?: number;
  utility_value_score?: number;
  weapon_value_score?: number;
  armor_value_score?: number;
  coherence_score?: number;
  economic_risk_score?: number;
  incoherence_penalty?: number;
  predicted_match_win?: number | null;
  predicted_round_win?: number | null;
  next_round_fullbuy_probability?: number | null;
  warnings?: string[];
  players?: EconomyMlPlayerRecommendation[];
  ability_budget_unknown?: boolean;
  team_buy_case?: string;
  team_buy_subtype?: string;
  source_action?: string;
  total_team_spend?: number;
  weapon_spend_estimate?: number;
  armor_spend_estimate?: number;
  ability_spend_estimate?: number;
  expected_remaining_after_buy?: number;
  next_round_buy_probability?: number;
  team_utility_total_value?: number;
  team_weapon_total_value?: number;
  team_armor_total_value?: number;
  team_economy_risk?: number;
  coherence_penalty?: number;
  coherence_warnings?: string[];
  team_plan_value?: number;
  average_player_fit_score?: number;
  plan_value_context?: string;
  ability_purchase_certainty?: string;
};

export type EconomyMlPlayerRecommendation = {
  puuid: string;
  player_name: string;
  agent_id?: string;
  agent?: string;
  role?: string;
  estimated_credits?: number;
  real_weapon_id?: string | null;
  real_weapon?: string | null;
  real_armor_id?: string | null;
  real_armor?: string | null;
  recommended_weapon_id?: string | null;
  recommended_weapon?: string | null;
  recommended_armor_id?: string | null;
  recommended_armor?: string | null;
  recommended_ability_budget?: number | null;
  recommended_ability_focus?: string[];
  recommended_utility_focus?: string[];
  ability_purchase_certainty?: string;
  expected_spend?: number;
  expected_remaining?: number;
  estimated_total_recommended_spend?: number;
  expected_remaining_after_buy?: number;
  style_profile?: Record<string, number | string | null>;
  form?: Record<string, number | string | null>;
  ultimate_estimate?: Record<string, number | string | null>;
  player_weapon_fit_score?: number | null;
  player_form_score?: number | null;
  player_fit_score?: number | null;
  agent_utility_score?: number | null;
  agent_utility_summary?: string[];
  agent_weapon_dependency_score?: number | null;
  agent_low_economy_resilience?: number | null;
  reason?: string[];
  confidence?: number | null;
  player_weapon_stats?: {
    rounds?: number;
    kd_ratio?: number;
    win_rate?: number;
  } | null;
};

export type EconomyMlRoundRecommendation = {
  round_number: number;
  team_id: string;
  team_label: string;
  rank_name: string;
  rank_group: string;
  real_buy_action: string;
  recommended_action: string;
  decision_type: string;
  model_scope: string;
  confidence: number;
  estimated_match_win_probability: number;
  estimated_round_win_probability?: number | null;
  estimated_fullbuy_next_round_probability?: number | null;
  team_plan?: EconomyMlTeamPlan | null;
  recommended_team_plan?: EconomyMlTeamPlan | null;
  real_action_estimated_match_win_probability: number | null;
  delta_vs_real: number | null;
  alternatives: EconomyMlAlternative[];
  similar_rounds_summary: {
    similar_rounds_found: number;
    by_action?: Record<string, { samples: number; match_win_rate: number }>;
  };
  utility_summary?: {
    team_total_utility_score?: number | null;
    enemy_total_utility_score?: number | null;
    utility_score_diff?: number | null;
    team_low_economy_resilience?: number | null;
    enemy_low_economy_resilience?: number | null;
    team_weapon_dependency_score?: number | null;
    enemy_weapon_dependency_score?: number | null;
    team_smoke_utility_score?: number | null;
    team_recon_utility_score?: number | null;
    team_flash_utility_score?: number | null;
    team_stall_utility_score?: number | null;
  };
  player_recommendations?: EconomyMlPlayerRecommendation[];
  explanation: string[];
  limitations?: string[];
};

export type EconomyMlResponse = {
  available: boolean;
  reason?: string;
  match_id: string;
  model_metadata?: {
    schema_version?: number | null;
    created_at?: string | null;
    dataset_rows?: number | null;
    estimation_type?: string | null;
    includes_agent_utility?: boolean;
    agent_utility_features_count?: number;
    model_counts?: {
      global?: number;
      rank_groups?: number;
      rank_names?: number;
    };
    global_metrics?: {
      accuracy?: number | null;
      roc_auc?: number | null;
      log_loss?: number | null;
      brier_score?: number | null;
      samples?: number | null;
      positive_rate?: number | null;
    };
    limitations?: string[];
  };
  rounds: EconomyMlRoundRecommendation[];
};
