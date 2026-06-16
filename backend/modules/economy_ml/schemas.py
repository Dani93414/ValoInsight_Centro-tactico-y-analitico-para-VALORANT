from __future__ import annotations

SCHEMA_VERSION = 2
LABEL_COLUMNS = ["round_won", "match_won"]
IDENTIFIER_COLUMNS = ["match_id", "team_id", "enemy_team_id", "game_start_millis"]
NON_FEATURE_COLUMNS = IDENTIFIER_COLUMNS + LABEL_COLUMNS + ["real_buy_action"]

PREBUY_CATEGORICAL_FEATURES = [
    "map_id", "season_id", "queue_id", "rank_name", "rank_group", "side",
    "team_credit_estimate_quality", "enemy_credit_estimate_quality",
]
PREBUY_NUMERIC_FEATURES = [
    "round_number", "is_ranked", "rank_tier_avg", "rank_tier_median",
    "team_score_before", "enemy_score_before", "score_diff", "previous_round_won",
    "win_streak", "loss_streak", "enemy_win_streak", "enemy_loss_streak",
    "is_pistol_round", "is_second_round", "is_bonus_candidate",
    "is_last_round_before_switch", "is_match_point", "is_overtime",
    "team_estimated_credits_before_buy", "enemy_estimated_credits_before_buy",
    "credits_before_buy_diff", "team_players_can_full_buy_estimate",
    "enemy_players_can_full_buy_estimate", "team_players_low_money",
    "enemy_players_low_money",
]

# These describe the chosen intervention. For historical rows they come from the
# observed post-buy loadout. For alternatives they are generated coherently.
ACTION_NUMERIC_FEATURES = [
    "action_total_loadout", "action_total_remaining",
    "action_heavy_armor_count", "action_light_armor_count", "action_no_armor_count",
    "action_rifle_count", "action_smg_count", "action_sniper_count",
    "action_operator_count", "action_outlaw_count", "action_marshal_count",
    "action_sheriff_count", "action_players_without_heavy_armor",
]

CATEGORICAL_FEATURES = PREBUY_CATEGORICAL_FEATURES + ["buy_action"]
NUMERIC_FEATURES = PREBUY_NUMERIC_FEATURES + ACTION_NUMERIC_FEATURES
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
PROPENSITY_FEATURES = PREBUY_NUMERIC_FEATURES + PREBUY_CATEGORICAL_FEATURES

# Explicit audit list: these must never enter either model.
FORBIDDEN_FEATURES = {
    "round_won", "match_won", "winningTeam", "roundResult", "roundCeremony",
    "kills", "damage", "score", "bombPlanter", "bombDefuser", "plant", "defuse",
    "team_total_loadout", "enemy_total_loadout", "enemy_rifle_count",
    "enemy_heavy_armor_count",
}
