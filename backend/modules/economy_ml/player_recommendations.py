from __future__ import annotations

from typing import Any

from modules.analytics.infrastructure.reference_data import (
    resolve_agent_name,
    resolve_agent_role,
)

from .content_catalog import find_gear, find_weapon, load_gear_catalog, load_weapon_catalog
from .agent_utility import agent_utility, player_agent_utility_features
from .economy_cases import classify_economy_case
from .player_form import build_player_form
from .player_style import build_match_player_style, player_weapon_fit_score
from .ultimate_inference import infer_ultimate_state
from .utility_budget import estimate_player_utility_budget


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _display_player_name(player: dict[str, Any]) -> str:
    game_name = str(player.get("gameName") or "Unknown")
    tag_line = str(player.get("tagLine") or "")
    return f"{game_name}#{tag_line}" if tag_line else game_name


def _weapon_name(weapon_id: Any) -> str | None:
    weapon = find_weapon(weapon_id)
    return str(weapon.get("displayName")) if weapon else None


def _gear_name(gear_id: Any) -> str | None:
    gear = find_gear(gear_id)
    return str(gear.get("displayName")) if gear else None


def _weapons_by_profile(profile: str) -> list[dict[str, Any]]:
    return [
        weapon for weapon in load_weapon_catalog().values()
        if profile in (weapon.get("usage_profile") or [])
    ]


def _pick_weapon(profile: str, budget: float) -> dict[str, Any] | None:
    candidates = [
        weapon for weapon in _weapons_by_profile(profile)
        if weapon.get("cost") is not None and float(weapon["cost"]) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: float(item.get("cost") or 0))


def _pick_named_weapon(name_part: str, budget: float) -> dict[str, Any] | None:
    normalized = name_part.lower()
    candidates = [
        weapon for weapon in load_weapon_catalog().values()
        if normalized in str(weapon.get("displayName") or "").lower()
        and weapon.get("cost") is not None
        and float(weapon["cost"]) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: float(item.get("cost") or 0))


def _pick_armor(level: str, budget: float) -> dict[str, Any] | None:
    candidates = [
        gear for gear in load_gear_catalog().values()
        if gear.get("armor_level") == level
        and gear.get("cost") is not None
        and float(gear["cost"]) <= budget
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda item: float(item.get("cost") or 0))


def _recommend_loadout(
    action: str, budget: float, role: str, utility: dict[str, Any]
) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    role_norm = str(role or "").lower()
    weapon_dependency = float(utility.get("weapon_dependency_score") or 0.5)
    low_econ_resilience = float(utility.get("low_economy_resilience") or 0.5)
    reasons: list[str] = []
    weapon: dict[str, Any] | None = None
    armor: dict[str, Any] | None = None

    if action == "FULL_OPERATOR":
        weapon = _pick_named_weapon("operator", budget)
        armor = _pick_armor("heavy", max(0, budget - float((weapon or {}).get("cost") or 0)))
        reasons.append("La recomendacion de equipo prioriza sniper de alto impacto.")
    elif action in {"FULL_RIFLES", "FORCE_2_RIFLES", "FORCE_RIFLE_LIGHT"}:
        weapon = _pick_weapon("rifle_default", budget)
        armor_level = "light" if action == "FORCE_RIFLE_LIGHT" else "heavy"
        armor = _pick_armor("heavy", max(0, budget - float((weapon or {}).get("cost") or 0))) or _pick_armor(armor_level, budget)
        reasons.append("La recomendacion de equipo busca armas principales con escudo adecuado.")
    elif action == "FORCE_OUTLAW":
        weapon = _pick_named_weapon("outlaw", budget) or _pick_weapon("sniper", budget)
        armor = _pick_armor("light", max(0, budget - float((weapon or {}).get("cost") or 0)))
        reasons.append("Compra parcial orientada a castigar rivales sin escudo pesado.")
    elif action == "SEMI_MARSHAL":
        weapon = _pick_named_weapon("marshal", budget) or _pick_weapon("sniper", budget)
        armor = _pick_armor("light", max(0, budget - float((weapon or {}).get("cost") or 0)))
        reasons.append("Compra economica de largo alcance con bajo coste.")
    elif action == "SEMI_SMG":
        weapon = _pick_weapon("close_range", budget)
        armor = _pick_armor("light", max(0, budget - float((weapon or {}).get("cost") or 0)))
        reasons.append("Compra parcial para disputar espacios cercanos.")
    elif action == "ECO_SHERIFF":
        weapon = _pick_named_weapon("sheriff", budget) or _pick_weapon("sidearm", budget)
        reasons.append("Eco con pistola de alto valor historico.")
    elif action == "ECO_PISTOL_UPGRADE":
        weapon = _pick_weapon("sidearm", budget)
        armor = _pick_armor("light", max(0, budget - float((weapon or {}).get("cost") or 0)))
        reasons.append("Mejora ligera manteniendo economia futura.")
    elif action == "BONUS_KEEP_WEAPONS":
        reasons.append("Ronda bonus: se prioriza conservar armas utiles si ya existen.")
    else:
        reasons.append("Ahorro completo o compra minima para conservar economia.")

    if action.startswith("ECO") and low_econ_resilience >= 0.65:
        reasons.append("Este agente tiene alto valor de utilidad potencial incluso con compra conservadora.")
    if weapon_dependency >= 0.65 and action not in {"ECO_CLASSIC", "BONUS_KEEP_WEAPONS"}:
        reasons.append("El agente depende mas del impacto con arma; se prioriza arma/escudo si la economia lo permite.")
    if low_econ_resilience >= 0.65 and weapon_dependency < 0.6 and armor is None and action not in {"ECO_CLASSIC"}:
        armor = _pick_armor("light", budget)
        reasons.append("Se valora supervivencia para conservar utilidad potencial de apoyo/control.")
    if "duelist" in role_norm and weapon and "close_range" in (weapon.get("usage_profile") or []):
        reasons.append("El rol puede aprovechar mejor armas de entrada y contacto cercano.")
    if weapon is None and action not in {"ECO_CLASSIC", "BONUS_KEEP_WEAPONS"}:
        reasons.append("No hay arma real en catalogo con coste compatible para este presupuesto estimado.")
    return weapon, armor, reasons


def _item_cost(item: dict[str, Any] | None) -> float:
    return _number((item or {}).get("cost"))


def _recommended_utility_budget(action: str, available_after_loadout: float, utility: dict[str, Any]) -> float:
    low_economy = float(utility.get("low_economy_resilience") or 0.5)
    base_caps = {
        "ECO_CLASSIC": 0,
        "ECO_PISTOL_UPGRADE": 300,
        "ECO_SHERIFF": 350,
        "SEMI_SMG": 600,
        "SEMI_MARSHAL": 550,
        "MIXED_LOW_BUY": 650,
        "FORCE_OUTLAW": 500,
        "FORCE_RIFLE_LIGHT": 450,
        "FORCE_2_RIFLES": 450,
        "FULL_RIFLES": 900,
        "FULL_OPERATOR": 800,
        "BONUS_KEEP_WEAPONS": 650,
    }
    cap = base_caps.get(action, 500)
    if low_economy >= 0.65 and action.startswith("ECO"):
        cap += 200
    return round(max(0.0, min(float(cap), available_after_loadout)), 2)


def _utility_focus(utility: dict[str, Any], side: str) -> list[str]:
    profiles = [str(item) for item in utility.get("utility_profiles") or [] if item != "unknown"]
    attack_priority = ["smoke", "flash", "recon", "entry", "space_creation", "postplant"]
    defense_priority = ["smoke", "stall", "trap", "anchor", "recon", "area_damage"]
    priority = attack_priority if side == "attack" else defense_priority
    ordered = [profile for profile in priority if profile in profiles]
    ordered.extend(profile for profile in profiles if profile not in ordered)
    return ordered[:3]


def build_player_recommendations(
    match: dict[str, Any],
    state: dict[str, Any],
    recommended_action: str,
) -> list[dict[str, Any]]:
    players = [p for p in match.get("players") or [] if p.get("puuid") and p.get("teamId") == state.get("team_id")]
    pstats_by_puuid: dict[str, dict[str, Any]] = {}
    for round_obj in match.get("roundResults") or []:
        round_num = round_obj.get("roundNum")
        display_round = int(round_num) + 1 if isinstance(round_num, int) and round_num + 1 == state.get("round_number") else round_num
        if display_round != state.get("round_number"):
            continue
        pstats_by_puuid = {
            str(item.get("puuid")): item
            for item in round_obj.get("playerStats") or []
            if item.get("puuid")
        }
        break

    team_budget = _number(state.get("team_estimated_credits_before_buy"))
    per_player_budget = team_budget / max(len(players), 1)
    result: list[dict[str, Any]] = []
    for player in players:
        puuid = str(player.get("puuid"))
        economy = (pstats_by_puuid.get(puuid) or {}).get("economy") or {}
        estimated_credits = max(per_player_budget, _number(economy.get("remaining")) + _number(economy.get("spent")))
        agent_id = str(player.get("characterId") or "UNKNOWN")
        role = resolve_agent_role(agent_id)
        utility = agent_utility(agent_id)
        utility_features = player_agent_utility_features(agent_id, str(state.get("side") or "unknown"))
        weapon, armor, reasons = _recommend_loadout(recommended_action, estimated_credits, role, utility)
        loadout_spend = _item_cost(weapon) + _item_cost(armor)
        macro_case = classify_economy_case(state, recommended_action)["macro_buy_case"]
        utility_budget_payload = estimate_player_utility_budget(
            agent_id,
            str(state.get("side") or "unknown"),
            max(0.0, estimated_credits - loadout_spend),
            macro_case,
        )
        utility_budget = utility_budget_payload.get("recommended_ability_budget")
        total_recommended_spend = min(estimated_credits, loadout_spend + _number(utility_budget))
        expected_remaining = max(0.0, estimated_credits - total_recommended_spend)
        utility_profiles = utility.get("utility_profiles") or ["unknown"]
        style = build_match_player_style(player)
        form = build_player_form(match, puuid, int(state.get("round_number") or 1))
        ultimate = infer_ultimate_state(match, puuid, resolve_agent_name(agent_id), int(state.get("round_number") or 1))
        weapon_fit = player_weapon_fit_score(style, (weapon or {}).get("displayName"))
        form_score = max(0.0, min(1.0, 0.5 + float(form.get("hot_streak_score") or 0) * 0.25 - float(form.get("cold_streak_score") or 0) * 0.25))
        role_fit = 0.65 if utility_budget_payload.get("priority_utility_profiles", ["unknown"])[0] != "unknown" else 0.5
        player_fit = round(max(0.0, min(1.0, (weapon_fit + form_score + role_fit) / 3)), 4)
        ability_reason = utility_budget_payload.get("reason")
        result.append({
            "puuid": puuid,
            "player_name": _display_player_name(player),
            "agent_id": agent_id,
            "agent": resolve_agent_name(agent_id),
            "role": role,
            "estimated_credits": estimated_credits,
            "real_weapon_id": economy.get("weapon"),
            "real_weapon": _weapon_name(economy.get("weapon")),
            "real_armor_id": economy.get("armor"),
            "real_armor": _gear_name(economy.get("armor")),
            "recommended_weapon_id": (weapon or {}).get("uuid"),
            "recommended_weapon": (weapon or {}).get("displayName"),
            "recommended_armor_id": (armor or {}).get("uuid"),
            "recommended_armor": (armor or {}).get("displayName"),
            "recommended_ability_budget": utility_budget,
            "recommended_utility_focus": utility_budget_payload.get("priority_utility_profiles") or _utility_focus(utility, str(state.get("side") or "unknown")),
            "ability_purchase_certainty": "estimated_plan_not_observed",
            "expected_spend": round(total_recommended_spend, 2),
            "expected_remaining": round(expected_remaining, 2),
            "estimated_total_recommended_spend": round(total_recommended_spend, 2),
            "expected_remaining_after_buy": round(expected_remaining, 2),
            "style_profile": style,
            "form": form,
            "ultimate_estimate": ultimate,
            "player_weapon_fit_score": round(weapon_fit, 4),
            "player_form_score": round(form_score, 4),
            "player_fit_score": player_fit,
            "agent_utility_score": utility_features.get("agent_side_utility_score"),
            "agent_utility_summary": [
                f"Perfiles potenciales: {', '.join(str(item) for item in utility_profiles)}",
                "No se conoce compra real de habilidades; la utilidad recomendada es presupuesto potencial del plan.",
            ],
            "agent_weapon_dependency_score": utility.get("weapon_dependency_score"),
            "agent_low_economy_resilience": utility.get("low_economy_resilience"),
            "reason": reasons + [
                *( [str(ability_reason)] if ability_reason else [] ),
                "Datos individuales historicos insuficientes; recomendacion basada en accion de equipo, rol y catalogo real."
            ],
            "confidence": None,
            "player_weapon_stats": None,
        })
    return result
