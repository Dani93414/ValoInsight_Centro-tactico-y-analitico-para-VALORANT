/* =====================================================
   Raw match-detail types used in MatchDetailModal.
   ===================================================== */

export type RawKillEvent = {
  killer?: string;
  victim?: string;
  killerLocation?: { x?: number; y?: number };
  victimLocation?: { x?: number; y?: number };
  finishingDamage?: {
    item?: string;
    damageType?: string;
  };
  timeSinceRoundStartMillis?: number;
};

export type RawRoundPlayerStat = {
  puuid?: string;
  kills?: RawKillEvent[];
};

export type RawRound = {
  roundNum?: number;
  winningTeam?: string;
  bombPlanter?: string;
  bombDefuser?: string;
  plantSite?: string;
  playerStats?: RawRoundPlayerStat[];
};

export type RawPlayer = {
  puuid?: string;
  gameName?: string;
  tagLine?: string;
  teamId?: string;
  characterId?: string;
  stats?: {
    score?: number;
    kills?: number;
    deaths?: number;
    assists?: number;
  };
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
    gameStartMillis?: number;
    queueId?: string;
    gameMode?: string;
    isRanked?: boolean;
    seasonId?: string;
  };
  players?: RawPlayer[];
  teams?: RawTeam[];
  roundResults?: RawRound[];
};
