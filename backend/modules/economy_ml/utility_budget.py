from __future__ import annotations

from typing import Any

from .ability_catalog import ability_costs_available, agent_abilities, get_agent_ability_catalog


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def priority_profiles_for_agent(agent_id: Any, side: str) -> list[str]:
    abilities = agent_abilities(agent_id)
    profiles: list[str] = []
    preferred = (
        ["smoke", "flash", "recon", "entry", "space_creation", "site_execute", "postplant"]
        if side == "attack"
        else ["smoke", "stall", "trap", "anchor", "recon", "retake", "flank_control"]
    )
    for profile in preferred:
        if any(profile in (ability.get("tactical_types") or ability.get("utility_profiles") or []) for ability in abilities):
            profiles.append(profile)
    for ability in abilities:
        for profile in ability.get("tactical_types") or ability.get("utility_profiles") or []:
            if profile not in profiles and profile != "unknown":
                profiles.append(profile)
    return profiles[:3] or ["unknown"]


def estimate_player_utility_budget(agent_id: Any, side: str, available_credits: float, macro_case: str) -> dict[str, Any]:
    costs_available = ability_costs_available()
    profiles = priority_profiles_for_agent(agent_id, side)
    if not costs_available:
        return {
            "recommended_ability_budget": None,
            "minimum_utility_budget": None,
            "priority_utility_profiles": profiles,
            "priority_utility_types": profiles,
            "free_round_start_ability": (get_agent_ability_catalog(str(agent_id or "")) or {}).get("round_start_ability"),
            "free_round_start_ability_types": [],
            "ability_cost_available": False,
            "utility_budget_pressure": 0.0,
            "ability_budget_unknown": True,
            "reason": "No hay coste de habilidades disponible en contenido; se recomienda foco de utilidad, no presupuesto exacto.",
        }
    abilities = [
        ability for ability in agent_abilities(agent_id)
        if ability.get("ability_cost_available") and set(ability.get("tactical_types") or ability.get("utility_profiles") or []) & set(profiles)
    ]
    minimum = min((_num(ability.get("cost_credits") if ability.get("cost_credits") is not None else ability.get("ability_cost")) for ability in abilities), default=0.0)
    key_budget = sum(
        _num(ability.get("cost_credits") if ability.get("cost_credits") is not None else ability.get("ability_cost"))
        for ability in abilities
        if ability.get("is_purchasable")
    )
    cap_by_case = {
        "ECO": 350, "SEMIBUY": 650, "STABILIZATION": 650,
        "FORCE": 500, "FULLBUY": 900, "BONUS": 650,
    }.get(macro_case, 500)
    budget = min(max(0.0, available_credits), cap_by_case)
    if minimum and budget < minimum:
        budget = 0.0
    pressure = 1.0 - min(1.0, budget / max(cap_by_case, 1))
    return {
        "recommended_ability_budget": round(budget, 2),
        "minimum_utility_budget": round(minimum, 2) if minimum else 0.0,
        "minimum_key_utility_budget": round(key_budget, 2),
        "priority_utility_profiles": profiles,
        "priority_utility_types": profiles,
        "free_round_start_ability": (get_agent_ability_catalog(str(agent_id or "")) or {}).get("round_start_ability"),
        "free_round_start_ability_types": [
            tactical_type
            for ability in agent_abilities(agent_id)
            if ability.get("is_round_start_ability")
            for tactical_type in (ability.get("tactical_types") or [])
        ][:3],
        "ability_cost_available": True,
        "utility_budget_pressure": round(pressure, 4),
        "ability_budget_unknown": False,
    }


def estimate_team_utility_budget(players: list[dict[str, Any]], side: str, available_credits: float, macro_case: str) -> dict[str, Any]:
    per_player = available_credits / max(len(players), 1)
    player_budgets = {}
    total = 0.0
    unknown = not ability_costs_available()
    profiles: list[str] = []
    for player in players:
        agent_id = player.get("characterId") or player.get("agent_id")
        payload = estimate_player_utility_budget(agent_id, side, per_player, macro_case)
        player_budgets[str(player.get("puuid") or agent_id)] = payload
        if payload.get("recommended_ability_budget") is not None:
            total += _num(payload.get("recommended_ability_budget"))
        for profile in payload.get("priority_utility_profiles") or []:
            if profile not in profiles:
                profiles.append(profile)
    return {
        "recommended_ability_budget_team": None if unknown else round(total, 2),
        "recommended_ability_budget_by_player": player_budgets,
        "minimum_utility_budget": None if unknown else round(total * 0.5, 2),
        "priority_utility_profiles": profiles[:5],
        "utility_budget_pressure": 0.0 if unknown else round(max(0.0, 1.0 - total / max(available_credits, 1)), 4),
        "ability_budget_unknown": unknown,
    }
