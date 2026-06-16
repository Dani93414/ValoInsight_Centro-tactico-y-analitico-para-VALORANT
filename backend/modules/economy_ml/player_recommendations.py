from __future__ import annotations

from typing import Any

from modules.analytics.infrastructure.reference_data import (
    resolve_agent_name,
    resolve_agent_role,
)

from .content_catalog import find_gear, find_weapon, load_gear_catalog, load_weapon_catalog


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


def _recommend_loadout(action: str, budget: float, role: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    role_norm = str(role or "").lower()
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

    if "duelist" in role_norm and weapon and "close_range" in (weapon.get("usage_profile") or []):
        reasons.append("El rol puede aprovechar mejor armas de entrada y contacto cercano.")
    if weapon is None and action not in {"ECO_CLASSIC", "BONUS_KEEP_WEAPONS"}:
        reasons.append("No hay arma real en catalogo con coste compatible para este presupuesto estimado.")
    return weapon, armor, reasons


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
        weapon, armor, reasons = _recommend_loadout(recommended_action, estimated_credits, role)
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
            "reason": reasons + [
                "Datos individuales historicos insuficientes; recomendacion basada en accion de equipo, rol y catalogo real."
            ],
            "confidence": None,
            "player_weapon_stats": None,
        })
    return result
