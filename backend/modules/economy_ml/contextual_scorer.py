from __future__ import annotations

from typing import Any

from .content_catalog import weapon_role
from .round_win_model import RoundWinLoadoutModel


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _name(player: dict) -> str:
    return str((player.get("weapon") or {}).get("displayName") or "").lower()


def apply_contextual_adjustments(base: dict, players: list[dict], context: dict,
                                 model: RoundWinLoadoutModel | None = None) -> dict:
    advanced = context.get("advanced_context") or {}
    map_adjustment = player_fit = enemy_adjustment = utility_adjustment = ultimate_adjustment = armor_adjustment = 0.0
    warnings: list[str] = []

    map_context = advanced.get("map_context") or {}
    profile = map_context.get("map_profile") or {}
    for player in players:
        role = weapon_role(_name(player))
        if role == "sniper":
            map_adjustment += _num(profile.get("operator_affinity")) * .12
        elif role == "rifle":
            map_adjustment += _num(profile.get("rifle_affinity")) * .10
        elif role == "shotgun":
            map_adjustment += _num(profile.get("shotgun_affinity")) * .10

    profiles = advanced.get("player_profiles") or {}
    for player in players:
        profile = profiles.get(str(player.get("puuid"))) or {}
        if not profile.get("available"):
            continue
        role = weapon_role(_name(player))
        tendency = _num(profile.get(f"{role}_tendency"))
        player_fit += (tendency - .25) * .025 * _num(profile.get("confidence"))
        if role == "sniper":
            rates = profile.get("weapon_kill_rate") or {}
            sniper_rate = max((_num(value) for key, value in rates.items() if weapon_role(key) == "sniper"), default=0)
            player_fit += (.015 if sniper_rate >= .7 else -.015) * _num(profile.get("confidence"))

    enemy = advanced.get("enemy_economy") or {}
    enemy_buy = enemy.get("enemy_buy_recommendation")
    heavy = sum(_name(player) in {"odin", "operator"} for player in players)
    weak = sum(_num(player.get("weapon_value")) < 1600 for player in players)
    if enemy_buy == "ENEMY_ECO" and heavy:
        enemy_adjustment -= .10 * heavy
        warnings.append("context_enemy_eco_overbuy")
    if enemy_buy == "ENEMY_FULL_BUY" and weak:
        enemy_adjustment -= .055 * weak
        warnings.append("context_enemy_full_buy_underpowered")

    ultimates = advanced.get("ultimates") or {}
    for player in players:
        ult = ultimates.get(str(player.get("puuid"))) or {}
        if not ult.get("ultimate_ready"):
            continue
        agent = str(ult.get("agent") or "").lower()
        if agent in {"chamber", "jett"} and _num(player.get("weapon_value")) >= 2900 and not player.get("keep_weapon"):
            ultimate_adjustment -= .055
            warnings.append(f"context_{agent}_ultimate_reduces_weapon_need")
        if _num(player.get("armor_value")) >= 400:
            ultimate_adjustment += .01

    durability = advanced.get("armor_durability") or {}
    for player in players:
        state = durability.get(str(player.get("puuid"))) or {}
        maximum, remaining = _num(state.get("armor_max_value")), state.get("armor_value_remaining")
        if state.get("available") and maximum and remaining is not None:
            ratio = _num(remaining) / maximum
            if player.get("keep_armor") and ratio < .5:
                armor_adjustment -= .05
                warnings.append("context_damaged_armor_should_refresh")
            elif player.get("keep_armor") and ratio >= .8:
                armor_adjustment += .015

    usage = advanced.get("ability_usage") or {}
    for player in players:
        state = usage.get(str(player.get("puuid"))) or {}
        used = sum(int(value or 0) for value in (state.get("used_abilities_by_slot") or {}).values())
        if state.get("available") and used == 0 and _num(player.get("ability_cost")) >= 500:
            utility_adjustment -= .025

    features = {
        "team_weapon_value": _num(base.get("weapon_value")), "team_armor_value": _num(base.get("armor_value")),
        "team_utility_value": _num(base.get("utility_value")), "enemy_weapon_value": 0,
        "enemy_armor_value": 0, "enemy_utility_value": 0,
        "rifle_count": sum(weapon_role(_name(p)) == "rifle" for p in players),
        "op_count": sum(_name(p) == "operator" for p in players),
        "smg_count": sum(weapon_role(_name(p)) == "smg" for p in players),
        "sidearm_count": sum(weapon_role(_name(p)) == "sidearm" for p in players),
        "heavy_weapon_count": sum(weapon_role(_name(p)) == "heavy" for p in players),
        "map": map_context.get("map_name"), "side": context.get("side"),
        "round_number": context.get("round_number"), "score_diff": context.get("score_diff"),
        "loss_streak": context.get("loss_streak"), "team_credits": context.get("team_estimated_credits_before_buy"),
        "enemy_credits": context.get("enemy_estimated_credits_before_buy"), "enemy_buy_class": enemy_buy,
    }
    prediction = (model or RoundWinLoadoutModel()).predict_round_win(features)
    ml_adjustment = 0.0
    if prediction.get("available") and prediction.get("round_win_probability") is not None:
        ml_adjustment = (_num(prediction["round_win_probability"]) - _num(base.get("round_win_probability"))) * .18
    adjustment = max(-.35, min(.25, map_adjustment + player_fit + enemy_adjustment + utility_adjustment + ultimate_adjustment + armor_adjustment + ml_adjustment))
    raw = _num(base.get("team_plan_value")) + adjustment
    result = dict(base)
    result.update({
        "team_plan_value": round(raw, 5), "team_plan_score": round(max(0.0, min(1.0, raw)), 5),
        "score": round(max(0.0, min(1.0, raw)), 5), "rule_score": base.get("team_plan_score"),
        "ml_round_win_probability": prediction.get("round_win_probability"),
        "future_economy_score": base.get("synchronization"), "enemy_adjustment": round(enemy_adjustment, 5),
        "map_adjustment": round(map_adjustment, 5), "player_fit_adjustment": round(player_fit, 5),
        "utility_adjustment": round(utility_adjustment, 5), "ultimate_adjustment": round(ultimate_adjustment, 5),
        "armor_adjustment": round(armor_adjustment, 5), "risk_penalty": base.get("rule_penalty"),
        "contextual_adjustment": round(adjustment, 5), "ml_prediction": prediction,
        "warnings": list(dict.fromkeys((base.get("warnings") or []) + warnings)),
        "debug_warnings": list(dict.fromkeys((base.get("debug_warnings") or []) + warnings + prediction.get("warnings", []))),
        "confidence": round(max(.15, min(1.0, _num(base.get("data_confidence")) * .75 + (_num(prediction.get("confidence")) if prediction.get("available") else .2) * .25)), 4),
    })
    return result
