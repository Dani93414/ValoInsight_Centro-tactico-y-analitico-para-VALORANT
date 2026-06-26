from __future__ import annotations

SCHEMA_VERSION = 6
LABEL_COLUMNS = [
    "round_won", "match_won", "next_round_fullbuy_possible",
    "next_round_team_estimated_credits",
]
IDENTIFIER_COLUMNS = ["match_id", "team_id", "enemy_team_id", "game_start_millis"]
NON_FEATURE_COLUMNS = IDENTIFIER_COLUMNS + LABEL_COLUMNS + ["real_buy_action"]

PREBUY_CATEGORICAL_FEATURES = [
    "map_id", "season_id", "queue_id", "rank_name", "rank_group", "side",
    "team_credit_estimate_quality", "enemy_credit_estimate_quality",
    "macro_buy_case", "economy_intent", "round_context_case",
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
    "team_credit_min", "team_credit_max", "team_credit_mean",
    "team_credit_median", "team_credit_std",
    "team_players_can_buy_sheriff", "team_players_can_buy_light_armor",
    "team_players_can_buy_sheriff_light", "team_players_can_buy_ghost_light",
    "enemy_credit_min", "enemy_credit_max", "enemy_credit_mean",
    "enemy_credit_median", "enemy_credit_std",
    "enemy_players_can_buy_sheriff", "enemy_players_can_buy_light_armor",
    "enemy_players_can_buy_sheriff_light", "enemy_players_can_buy_ghost_light",
]

AGENT_UTILITY_NUMERIC_FEATURES = [
    "team_controller_count", "team_duelist_count", "team_initiator_count", "team_sentinel_count",
    "enemy_controller_count", "enemy_duelist_count", "enemy_initiator_count", "enemy_sentinel_count",
    "team_smoke_utility_score", "team_flash_utility_score", "team_recon_utility_score",
    "team_stall_utility_score", "team_trap_utility_score", "team_mobility_utility_score",
    "team_heal_utility_score", "team_revive_utility_score", "team_wall_utility_score",
    "team_postplant_utility_score", "team_entry_utility_score", "team_anchor_utility_score",
    "team_suppression_utility_score", "team_area_damage_utility_score",
    "team_vision_denial_utility_score", "team_space_creation_utility_score",
    "enemy_smoke_utility_score", "enemy_flash_utility_score", "enemy_recon_utility_score",
    "enemy_stall_utility_score", "enemy_trap_utility_score", "enemy_mobility_utility_score",
    "enemy_heal_utility_score", "enemy_revive_utility_score", "enemy_wall_utility_score",
    "enemy_postplant_utility_score", "enemy_entry_utility_score", "enemy_anchor_utility_score",
    "enemy_suppression_utility_score", "enemy_area_damage_utility_score",
    "enemy_vision_denial_utility_score", "enemy_space_creation_utility_score",
    "team_total_utility_score", "enemy_total_utility_score", "utility_score_diff",
    "team_attack_utility_score", "team_defense_utility_score",
    "enemy_attack_utility_score", "enemy_defense_utility_score",
    "team_low_economy_resilience", "enemy_low_economy_resilience",
    "low_economy_resilience_diff", "team_weapon_dependency_score",
    "enemy_weapon_dependency_score", "weapon_dependency_diff",
    "team_smoke_score", "team_flash_score", "team_recon_score",
    "team_stall_score", "team_trap_score", "team_mobility_score",
    "team_heal_score", "team_revive_score", "team_wall_score",
    "team_postplant_score", "team_entry_score", "team_anchor_score",
    "team_suppression_score", "team_area_damage_score",
    "team_vision_denial_score", "team_space_creation_score", "team_retake_score",
    "enemy_smoke_score", "enemy_flash_score", "enemy_recon_score",
    "enemy_stall_score", "enemy_trap_score", "enemy_mobility_score",
    "enemy_heal_score", "enemy_revive_score", "enemy_wall_score",
    "enemy_postplant_score", "enemy_entry_score", "enemy_anchor_score",
    "enemy_suppression_score", "enemy_area_damage_score",
    "enemy_vision_denial_score", "enemy_space_creation_score", "enemy_retake_score",
]

PREBUY_NUMERIC_FEATURES += AGENT_UTILITY_NUMERIC_FEATURES

# These describe the chosen intervention. For historical rows they come from the
# observed post-buy loadout. For alternatives they are generated coherently.
ACTION_NUMERIC_FEATURES = [
    "action_total_loadout", "action_total_remaining",
    "action_heavy_armor_count", "action_light_armor_count", "action_no_armor_count",
    "action_rifle_count", "action_smg_count", "action_sniper_count",
    "action_operator_count", "action_outlaw_count", "action_marshal_count",
    "action_sheriff_count", "action_players_without_heavy_armor",
]

PLAN_NUMERIC_FEATURES = [
    "plan_estimated_total_spend", "plan_estimated_weapon_spend",
    "plan_estimated_armor_spend", "plan_estimated_ability_spend",
    "plan_expected_remaining", "plan_future_economy_score",
    "plan_utility_value_score", "plan_weapon_value_score",
    "plan_armor_value_score", "plan_coherence_score",
    "plan_economic_risk_score", "plan_incoherence_penalty",
]

PLAYER_AGGREGATE_FEATURES = [
    "team_avg_player_fit_score", "team_avg_player_form_score",
    "team_avg_weapon_fit_score",
]

UTILITY_FEATURES = AGENT_UTILITY_NUMERIC_FEATURES

CATEGORICAL_FEATURES = PREBUY_CATEGORICAL_FEATURES + ["buy_action"]
NUMERIC_FEATURES = PREBUY_NUMERIC_FEATURES + ACTION_NUMERIC_FEATURES
MODEL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
PROPENSITY_FEATURES = PREBUY_NUMERIC_FEATURES + PREBUY_CATEGORICAL_FEATURES

# Explicit audit list: these must never enter either model.
FORBIDDEN_FEATURES = {
    "round_won", "match_won", "winningTeam", "roundResult", "roundCeremony",
    "kills", "damage", "score", "bombPlanter", "bombDefuser", "plant", "defuse",
    "team_total_loadout", "enemy_total_loadout", "enemy_rifle_count",
    "enemy_heavy_armor_count", "ability.ultimateEffects",
    "used_ultimate_this_round", "current_round_kills", "current_round_damage",
    "current_round_score",
}

POST_ROUND_ONLY_COLUMNS = {
    "round_won", "match_won", "winningTeam", "roundResult", "roundCeremony",
    "kills", "damage", "score", "bombPlanter", "bombDefuser", "plant",
    "defuse", "ability", "ultimateEffects", "used_ultimate_this_round",
    "next_round_team_estimated_credits", "next_round_fullbuy_possible",
    "next_round_players_can_fullbuy", "next_round_players_low_money",
    "won_next_2_rounds", "won_next_3_rounds", "score_diff_after_2_rounds",
    "score_diff_after_3_rounds", "economy_recovered_next_round",
    "team_economy_desync_next_round",
}


def validate_no_feature_leakage(features: list[str] | None = None) -> dict:
    checked = set(features or MODEL_FEATURES)
    forbidden = sorted(checked.intersection(FORBIDDEN_FEATURES))
    post_round = sorted(checked.intersection(POST_ROUND_ONLY_COLUMNS))
    return {
        "valid": not forbidden and not post_round,
        "forbidden_features": forbidden,
        "post_round_only_features": post_round,
    }
