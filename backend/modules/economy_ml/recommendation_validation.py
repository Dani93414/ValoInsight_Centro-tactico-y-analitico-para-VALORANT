from __future__ import annotations

from typing import Any

from .economy_rules import armor_cost, item_cost, weapon_cost


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _weapon_cost(recommendation: dict[str, Any]) -> float:
    if "weapon_cost" in recommendation:
        return _number(recommendation.get("weapon_cost"))
    weapon = recommendation.get("weapon") or recommendation.get("recommended_weapon")
    if isinstance(weapon, dict):
        return item_cost(weapon)
    return weapon_cost(weapon or recommendation.get("recommended_weapon_id"))


def _armor_cost(recommendation: dict[str, Any]) -> float:
    if recommendation.get("armor_is_free_exception") or recommendation.get("recommended_armor_is_free_exception"):
        return 0.0
    if "armor_cost" in recommendation:
        return _number(recommendation.get("armor_cost"))
    armor = recommendation.get("armor") or recommendation.get("recommended_armor")
    if isinstance(armor, dict):
        return item_cost(armor)
    return armor_cost(armor or recommendation.get("recommended_armor_id"))


def _ability_cost(recommendation: dict[str, Any]) -> float:
    if "ability_cost" in recommendation:
        return _number(recommendation.get("ability_cost"))
    abilities = recommendation.get("abilities") or recommendation.get("recommended_abilities") or []
    if abilities:
        return sum(_number(item.get("cost")) for item in abilities if isinstance(item, dict))
    return _number(recommendation.get("ability_budget") or recommendation.get("recommended_ability_budget"))


def player_recommendation_total_cost(recommendation: dict[str, Any]) -> dict[str, float]:
    weapon = _weapon_cost(recommendation)
    armor = _armor_cost(recommendation)
    ability = _ability_cost(recommendation)
    return {
        "weapon_cost": round(weapon, 2),
        "armor_cost": round(armor, 2),
        "ability_cost": round(ability, 2),
        "total_cost": round(weapon + armor + ability, 2),
    }


def validate_player_recommendation_budget(
    recommendation: dict,
    *,
    estimated_credits: float,
) -> tuple[bool, list[str]]:
    costs = player_recommendation_total_cost(recommendation)
    if costs["total_cost"] <= _number(estimated_credits) + 1e-6:
        return True, []
    return False, ["La compra recomendada supera los creditos estimados del jugador."]


def validate_team_plan_allocation(allocation: dict) -> dict:
    violations = list(allocation.get("violations") or [])
    warnings = list(allocation.get("warnings") or [])
    team_budget = _number(allocation.get("team_estimated_credits_before_buy"))
    team_total = _number(allocation.get("team_total_cost"))
    if team_budget and team_total > team_budget + 1e-6:
        violations.append(f"team: recommended cost {team_total:.0f} exceeds estimated credits {team_budget:.0f}")
    for player in allocation.get("players") or []:
        estimated = _number(player.get("estimated_credits"))
        valid, reasons = validate_player_recommendation_budget(player, estimated_credits=estimated)
        if not valid:
            total = player_recommendation_total_cost(player)["total_cost"]
            violations.append(
                f"{player.get('puuid')}: recommended cost {total:.0f} exceeds estimated credits {estimated:.0f}"
            )
            warnings.extend(reasons)
    return {"valid": not violations, "violations": violations, "warnings": warnings}


def conservative_player_recommendation(*, puuid: str, estimated_credits: float) -> dict[str, Any]:
    return {
        "puuid": puuid,
        "estimated_credits": _number(estimated_credits),
        "weapon": None,
        "armor": None,
        "abilities": [],
        "ability_budget": 0.0,
        "total_cost": 0.0,
        "expected_remaining": _number(estimated_credits),
        "slot": "classic_utility",
        "reasons": ["Fallback conservador: Classic y solo utilidad clave si cabe."],
    }
