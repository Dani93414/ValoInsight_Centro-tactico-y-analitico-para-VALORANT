/** Shape consumed only by the read-only panel for saved, pre-v10 responses. */
type LegacyPlayer = Partial<Record<
  "credits_before_buy" | "estimated_credits" | "real_spent" | "real_loadout_value" |
  "agent_utility_score" | "agent_weapon_dependency_score" | "recommended_ability_budget" |
  "player_fit_score" | "player_form_score", number
>> & {
  puuid: string;
  player_name?: string;
  agent?: string;
  role?: string;
  real_weapon?: string;
  real_armor?: string;
  recommended_weapon?: string;
  recommended_armor?: string;
  reason?: string[];
  recommended_utility_focus?: string[];
  recommended_ability_focus?: string[];
};

type LegacyPlan = Partial<Record<
  "team_plan_value" | "predicted_round_win" | "predicted_match_win" |
  "next_round_fullbuy_probability" | "coherence_score" | "economic_risk_score" |
  "estimated_weapon_spend" | "weapon_spend_estimate" | "estimated_armor_spend" |
  "armor_spend_estimate" | "estimated_ability_spend" | "expected_remaining" |
  "expected_remaining_after_buy", number
>> & {
  macro_case?: string;
  team_buy_case?: string;
  subtype?: string;
  team_buy_subtype?: string;
  ability_budget_unknown?: boolean;
  warnings?: string[];
};

type LegacyRound = Partial<Record<
  "prebuy_credits_selected" | "team_credits_before_buy" | "team_spent" | "team_loadout" |
  "team_possible_drop_credit_gap" | "num_viable_alternatives" | "delta_team_plan_value" |
  "delta_round_win" | "delta_next_fullbuy" | "prebuy_credits_rules" | "prebuy_credits_observed", number
>> & Partial<Record<
  "credit_estimate_quality" | "target_loadout_case" | "observed_cashflow_case" |
  "cashflow_case" | "planned_cashflow_case" | "recommendation_status" |
  "credit_estimate_inconsistency_reason" | "team_drop_reconciliation_status", string
>> & {
  round_number: number;
  team_id: string;
  rank_name: string;
  model_scope: string;
  real_buy_action: string;
  recommended_action: string;
  confidence: number;
  in_sample?: boolean;
  real_action_estimated_match_win_probability: number | null;
  estimated_match_win_probability: number;
  delta_vs_real: number | null;
  explanation: string[];
  similar_rounds_summary: { similar_rounds_found: number };
  utility_summary?: Partial<Record<"team_total_utility_score" | "team_low_economy_resilience" |
    "team_weapon_dependency_score" | "utility_score_diff", number>>;
  recommended_team_plan?: LegacyPlan;
  limitations?: string[];
  alternatives: { action: string; estimated_match_win_probability: number | null;
    reason_if_unavailable?: string; historical_support?: number }[];
  player_recommendations?: LegacyPlayer[];
};

export type LegacyEconomyResponse = {
  rounds: LegacyRound[];
  model_metadata?: {
    model_counts?: { global?: number; rank_groups?: number; rank_names?: number };
    global_metrics?: { roc_auc?: number };
    created_at?: string;
    dataset_rows?: number;
    schema_version?: number;
    includes_agent_utility?: boolean;
    agent_utility_features_count?: number;
  };
};
