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
  is_available: boolean;
  reason_if_unavailable?: string | null;
  historical_support?: number;
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
  real_action_estimated_match_win_probability: number | null;
  delta_vs_real: number | null;
  alternatives: EconomyMlAlternative[];
  similar_rounds_summary: {
    similar_rounds_found: number;
    by_action?: Record<string, { samples: number; match_win_rate: number }>;
  };
  explanation: string[];
};

export type EconomyMlResponse = {
  available: boolean;
  reason?: string;
  match_id: string;
  model_metadata?: {
    created_at?: string | null;
    dataset_rows?: number | null;
    estimation_type?: string | null;
    limitations?: string[];
  };
  rounds: EconomyMlRoundRecommendation[];
};
