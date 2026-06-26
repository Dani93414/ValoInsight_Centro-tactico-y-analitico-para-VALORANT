from __future__ import annotations

import re
from typing import Any

from modules.analytics.infrastructure.reference_data import (
    UNKNOWN_NAME,
    find_ability,
    resolve_ability_icon,
    resolve_ability_name,
    resolve_gear_name,
    resolve_melee_weapon_id,
    resolve_weapon_name,
    weapons_by_uuid,
)


def _clean_id(value: Any) -> str:
    text = str(value or "").strip()
    return text or "UNKNOWN"


def _readable_unknown(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    if not text:
        return fallback
    text = re.sub(r"[_-]+", " ", text)
    return " ".join(part.capitalize() for part in text.split()) or fallback


def resolve_damage_source(
    kill: dict[str, Any],
    *,
    fallback_weapon_id: str | None = None,
    killer_agent_id: str | None = None,
) -> dict[str, Any]:
    finishing_damage = kill.get("finishingDamage") or {}
    damage_type = str(finishing_damage.get("damageType") or "").strip()
    damage_type_lower = damage_type.lower()
    damage_item = _clean_id(
        finishing_damage.get("damageItem") or finishing_damage.get("item")
    )
    fallback_id = _clean_id(fallback_weapon_id)
    source_id = damage_item if damage_item != "UNKNOWN" else fallback_id

    if damage_type_lower == "melee":
        melee_id = resolve_melee_weapon_id()
        return {
            "source_id": melee_id,
            "source_name": "Melee",
            "source_type": "melee",
            "icon": None,
            "damage_type": damage_type or None,
            "is_ability": False,
        }

    if damage_type_lower in {"fall", "falling"}:
        return {
            "source_id": "FALL",
            "source_name": "Caida",
            "source_type": "fall",
            "icon": None,
            "damage_type": damage_type or None,
            "is_ability": False,
        }

    if damage_type_lower in {"bomb", "spike"}:
        return {
            "source_id": "BOMB",
            "source_name": "Spike",
            "source_type": "bomb",
            "icon": None,
            "damage_type": damage_type or None,
            "is_ability": False,
        }

    weapon_doc = weapons_by_uuid().get(source_id)
    ability = find_ability(source_id, agent_id=killer_agent_id)
    if weapon_doc:
        weapon_name = resolve_weapon_name(source_id)
        if weapon_name == UNKNOWN_NAME:
            weapon_name = resolve_gear_name(source_id)
        return {
            "source_id": source_id,
            "source_name": weapon_name if weapon_name != UNKNOWN_NAME else _readable_unknown(source_id, "Arma desconocida"),
            "source_type": "weapon",
            "icon": weapon_doc.get("displayIcon") if weapon_doc else None,
            "damage_type": damage_type or None,
            "is_ability": False,
        }

    if damage_type_lower == "ability" or ability:
        ability_id = str((ability or {}).get("uuid") or source_id)
        ability_name = (
            (ability or {}).get("displayName")
            or resolve_ability_name(ability_id)
            or _readable_unknown(source_id, "Habilidad desconocida")
        )
        ability_icon = (ability or {}).get("displayIcon") or resolve_ability_icon(ability_id)
        return {
            "source_id": ability_id,
            "source_name": ability_name if ability_name != UNKNOWN_NAME else _readable_unknown(source_id, "Habilidad desconocida"),
            "source_type": "ability",
            "icon": ability_icon,
            "damage_type": damage_type or None,
            "is_ability": True,
        }

    if damage_type_lower == "weapon":
        return {
            "source_id": source_id,
            "source_name": _readable_unknown(source_id, "Arma desconocida"),
            "source_type": "weapon",
            "icon": None,
            "damage_type": damage_type or None,
            "is_ability": False,
        }

    return {
        "source_id": source_id,
        "source_name": _readable_unknown(source_id, damage_type or "Unknown"),
        "source_type": damage_type_lower if damage_type_lower in {"melee", "fall", "bomb"} else "unknown",
        "icon": None,
        "damage_type": damage_type or None,
        "is_ability": False,
    }
