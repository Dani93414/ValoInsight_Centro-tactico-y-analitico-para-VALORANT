from __future__ import annotations

from typing import Any

MAX_CREDITS = 9000.0

STANDARD_STARTING_CREDITS = 800.0
HALF_START_ROUNDS = {1, 13}

OVERTIME_STARTING_CREDITS = 5000.0
SUDDEN_DEATH_STARTING_CREDITS = 5000.0

KILL_REWARD = 200.0
SPIKE_PLANT_REWARD = 300.0
SPIKE_PLANT_REWARD_MODE = "team_attackers"
SPIKE_PLANT_REWARD_MODES = {"team_attackers", "planter_only", "disabled"}

ROUND_WIN_REWARD = 3000.0

LOSS_REWARD_1 = 1900.0
LOSS_REWARD_2 = 2400.0
LOSS_REWARD_3_PLUS = 2900.0

SAVE_PENALTY_REWARD = 1000.0

LIGHT_ARMOR_COST = 400.0
HEAVY_ARMOR_COST = 1000.0
SHERIFF_COST = 800.0

AFK_CREDIT_BONUS_PER_MISSING_PLAYER = None
AFK_CREDIT_BONUS_SOURCE = "inferred_from_observed_economy"
AFK_BONUS_MIN_SAMPLES = 10
AFK_BONUS_MIN_CONFIDENCE = 0.7
AFK_BONUS_ROUNDING = 50

RECONCILIATION_TOLERANCE = 50.0


def clamp_credits(value: Any) -> float:
    try:
        numeric = float(value or 0)
    except (TypeError, ValueError):
        numeric = 0.0
    return min(MAX_CREDITS, max(0.0, numeric))


def fixed_round_start_credits(round_number: int) -> float | None:
    if int(round_number or 0) in HALF_START_ROUNDS:
        return STANDARD_STARTING_CREDITS
    if int(round_number or 0) >= 25:
        return OVERTIME_STARTING_CREDITS
    return None


def loss_reward(loss_streak_after_round: int) -> float:
    if loss_streak_after_round <= 1:
        return LOSS_REWARD_1
    if loss_streak_after_round == 2:
        return LOSS_REWARD_2
    return LOSS_REWARD_3_PLUS


def round_result_income(
    *,
    team_won: bool,
    loss_streak_after_round: int,
    save_penalty_applies: bool,
) -> float:
    if team_won:
        return ROUND_WIN_REWARD
    if save_penalty_applies:
        return SAVE_PENALTY_REWARD
    return loss_reward(loss_streak_after_round)


def save_penalty_applies(
    *,
    side: str,
    team_won: bool,
    player_survived: bool | None,
    spike_planted: bool,
    round_result: str | None,
    round_ceremony: str | None,
) -> bool:
    if team_won or player_survived is not True:
        return False
    normalized_side = str(side or "").strip().lower()
    result = str(round_result or "").strip().lower()
    ceremony = str(round_ceremony or "").strip().lower()
    text = f"{result} {ceremony}"

    if normalized_side == "attack":
        return (not spike_planted) or "time" in text or "eliminated" in text
    if normalized_side == "defense":
        return "detonat" in text or "explode" in text or "bomb" in text or "spike" in text
    return False


def reconciliation_status(expected: float, observed: float | None) -> tuple[float | None, str]:
    if observed is None:
        return None, "not_observable"
    delta = float(observed) - float(expected)
    if abs(delta) <= RECONCILIATION_TOLERANCE:
        return delta, "matched"
    if delta > RECONCILIATION_TOLERANCE:
        return delta, "observed_more_than_expected"
    return delta, "observed_less_than_expected"
