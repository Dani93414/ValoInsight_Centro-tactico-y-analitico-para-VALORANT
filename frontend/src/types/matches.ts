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

export type EconomyItem = {
  uuid?: string;
  displayName?: string | null;
  cost?: number | null;
  armor_level?: string;
  usage_profile?: string[];
  purchase_cost?: number;
  weapon_value?: number;
  source?: "bought_self" | "carried" | "dropped" | "unknown" | string;
  warnings?: string[];
};

export type EconomyDisplayRecommendation = {
  weapon_label: string;
  armor_label: string;
  loadout_label: string;
  ability_label: string;
  spend_label: string;
  source_label: string;
};

export type ObservedPlayerEconomy = RawRoundPlayerEconomy & {
  weapon_raw?: unknown;
  armor_raw?: unknown;
  weapon?: string;
  armor?: string;
  weapon_display: EconomyItem;
  armor_display: EconomyItem;
  warnings: string[];
  debug_warnings: string[];
};

export type EconomyAbilityPurchase = {
  name: string;
  charges: number;
  cost: number;
  cost_per_charge?: number;
  source: "free_round_start" | "bought" | "free_and_bought" | string;
  tactical_types?: string[];
};

export type EconomyPurchaseHypothesis = {
  weapon_source: "default_spawn_weapon" | "bought_self" | "bought_by_teammate" | "carried" | "picked_up" | "unknown" | string;
  armor_source: "bought_self" | "carried" | "unknown" | string;
  confidence: number;
  estimated_self_spend: number | null;
  estimated_team_spend_impact: number | null;
  buys_for_teammate?: boolean | null;
  utility_bought_estimated: EconomyAbilityPurchase[];
  free_utility_granted: EconomyAbilityPurchase[];
  utility_status: "estimated" | "unknown" | string;
  reasons: string[];
  warnings: string[];
  debug_warnings?: string[];
};

export type LegalPlayerPurchase = {
  puuid: string;
  weapon: EconomyItem | null;
  armor: EconomyItem | null;
  abilities: EconomyAbilityPurchase[];
  keep_weapon: boolean;
  self_cost: number;
  weapon_cost: number;
  weapon_purchase_cost: number;
  weapon_value: number;
  weapon_source: "bought_self" | "carried" | "dropped" | "none" | "unknown" | string;
  armor_cost: number;
  armor_purchase_cost: number;
  armor_value: number;
  armor_effective_value?: number;
  armor_full_value?: number;
  armor_durability_ratio?: number | null;
  armor_source: "bought_self" | "carried" | "none" | "unknown" | string;
  keep_armor: boolean;
  ability_cost: number;
  expected_remaining: number;
  bought_by?: string | null;
  buys_for?: string | string[] | null;
  warnings: string[];
  display?: EconomyDisplayRecommendation;
};

export type EconomyPlayerProjection = {
  puuid: string;
  credits_after_buy: number;
  credits_if_win: number;
  credits_if_loss: number;
  can_full_buy_if_win: boolean;
  can_full_buy_if_loss: boolean;
  economic_risk: number;
  drop_bought_for?: string | string[] | null;
  drop_received_from?: string | null;
};

export type EconomyProjection = {
  score?: number;
  team_plan_score?: number;
  team_plan_value?: number;
  round_win_probability?: number;
  match_win_probability?: number;
  ml_support?: number | null;
  future_if_win?: number;
  future_if_loss?: number;
  synchronization?: number;
  economic_risk?: number;
  team_spend?: number;
  weapon_value?: number;
  armor_value?: number;
  utility_value?: number;
  rule_penalty?: number;
  data_confidence?: number;
  confidence?: number;
  rule_score?: number;
  ml_round_win_probability?: number | null;
  future_economy_score?: number;
  enemy_adjustment?: number;
  map_adjustment?: number;
  site_adjustment?: number;
  player_fit_adjustment?: number;
  utility_adjustment?: number;
  ultimate_adjustment?: number;
  armor_adjustment?: number;
  ml_adjustment?: number;
  contextual_adjustment?: number;
  players?: EconomyPlayerProjection[];
  players_can_full_buy_if_win?: number;
  players_can_full_buy_if_loss?: number;
  players_desynchronized_if_loss?: number;
  warnings?: string[];
};

export type TeamPlanAlternative = {
  [key: string]: any;
  plan_kind: string;
  team_plan_score: number;
  team_plan_value?: number;
  players: LegalPlayerPurchase[];
  economy_projection: EconomyProjection;
  valid: boolean;
  warnings: string[];
  debug_warnings?: string[];
};

export type EconomyMlPlayerRecommendation = {
  puuid: string;
  player_name?: string | null;
  agent?: string | null;
  role?: string | null;
  credits_before_buy: number | null;
  observed_weapon?: string | null;
  observed_armor?: string | null;
  inferred_real_purchase: EconomyPurchaseHypothesis;
  recommended_purchase: LegalPlayerPurchase;
  reason: string;
  context_reasons?: string[];
  warnings: string[];
  debug_warnings?: string[];
  confidence: number;
};

export type EconomyContextSignal = {
  available: boolean;
  confidence: number;
  source: string;
  warnings: string[];
  [key: string]: unknown;
};

export type EconomyAdvancedContext = {
  map_context?: EconomyContextSignal & { map_id?: string | null; map_name?: string | null; map_url?: string | null; map_profile?: Record<string, unknown> };
  site_tendencies?: EconomyContextSignal & { likely_attack_site?: string | null; rounds_observed?: number };
  enemy_economy?: EconomyContextSignal & { enemy_buy_recommendation?: string | null; enemy_full_buy_probability?: number };
  player_profiles?: Record<string, EconomyContextSignal & { preferred_weapons?: string[]; sample_size?: number }>;
  ultimates?: Record<string, EconomyContextSignal & { agent?: string; ultimate_ready?: boolean | null }>;
  armor_durability?: Record<string, EconomyContextSignal & { armor_type?: string | null; armor_value_remaining?: number | null; armor_max_value?: number | null }>;
  ability_usage?: Record<string, EconomyContextSignal & { agent?: string; used_abilities_by_slot?: Record<string, number> }>;
  ml_prediction?: {
    available: boolean;
    round_win_probability: number | null;
    confidence: number;
    model_scope?: string;
    feature_version?: string;
    warnings: string[];
  };
};

export type EconomyMlRoundRecommendation = {
  [key: string]: any;
  round_number: number;
  team_id: string;
  side: string;
  score_before: { team: number | null; enemy: number | null };
  real_team_buy_observed: Record<string, ObservedPlayerEconomy>;
  inferred_team_buy: Record<string, EconomyPurchaseHypothesis[]>;
  recommended_team_buy: string;
  team_plan_score: number;
  team_plan_value?: number;
  confidence: number;
  players: EconomyMlPlayerRecommendation[];
  alternatives: TeamPlanAlternative[];
  economy_projection: EconomyProjection;
  advanced_context?: EconomyAdvancedContext;
  warnings: string[];
  debug_warnings: string[];
};

export type EconomyMlResponse = {
  [key: string]: any;
  available: boolean;
  engine: "player_first_v10";
  advanced_engine?: "player_first_v11_contextual" | string;
  reason?: string;
  match_id: string;
  rounds: EconomyMlRoundRecommendation[];
  limitations: string[];
  debug_limitations?: string[];
};
