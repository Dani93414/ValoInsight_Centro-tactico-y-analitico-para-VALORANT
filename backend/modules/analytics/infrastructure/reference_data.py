from __future__ import annotations

from functools import lru_cache
import re
import unicodedata
from typing import Any, Dict

try:
    from infrastructure.mongo_client import content_collection
except ModuleNotFoundError:
    from backend.infrastructure.mongo_client import content_collection


UNKNOWN_NAME = "Unknown"
UNKNOWN_ROLE = "Desconocido"

_ABILITY_SLOT_ALIASES = {
    "grenadeability": "grenade",
    "grenade": "grenade",
    "ability1": "ability1",
    "ability2": "ability2",
    "ultimate": "ultimate",
}

_ABILITY_WEAPON_SLOT_ALIASES = {
    ("22697a3d-45bf-8dd7-4fec-84a9e28c69d7", "856d9a7e-4b06-dc37-15dc-9d809c37cb90"): "ability1",
    ("22697a3d-45bf-8dd7-4fec-84a9e28c69d7", "39099fb5-4293-def4-1e09-2e9080ce7456"): "ultimate",
    ("bb2a4828-46eb-8cd1-e765-15848195d751", "95336ae4-45d4-1032-cfaf-6bad01910607"): "ultimate",
}


@lru_cache(maxsize=1)
def _latest_content_doc() -> Dict[str, Any]:
    doc = content_collection.find_one(
        {"type": "valorant_content"},
        sort=[("_id", -1)],
        projection={"_id": 0, "agents": 1, "maps": 1, "weapons": 1, "gear": 1},
    )
    return doc or {}


@lru_cache(maxsize=1)
def agents_by_uuid() -> Dict[str, Dict[str, Any]]:
    raw = _latest_content_doc().get("agents", []) or []
    return {str(item.get("uuid")): item for item in raw if isinstance(item, dict) and item.get("uuid")}


@lru_cache(maxsize=1)
def maps_by_uuid() -> Dict[str, Dict[str, Any]]:
    raw = _latest_content_doc().get("maps", []) or []
    return {str(item.get("uuid")): item for item in raw if isinstance(item, dict) and item.get("uuid")}


@lru_cache(maxsize=1)
def weapons_by_uuid() -> Dict[str, Dict[str, Any]]:
    raw = _latest_content_doc().get("weapons", []) or []
    return {str(item.get("uuid")): item for item in raw if isinstance(item, dict) and item.get("uuid")}


@lru_cache(maxsize=1)
def gear_by_uuid() -> Dict[str, Dict[str, Any]]:
    raw = _latest_content_doc().get("gear", []) or []
    return {str(item.get("uuid")): item for item in raw if isinstance(item, dict) and item.get("uuid")}


def clear_reference_cache() -> None:
    _latest_content_doc.cache_clear()
    agents_by_uuid.cache_clear()
    maps_by_uuid.cache_clear()
    weapons_by_uuid.cache_clear()
    gear_by_uuid.cache_clear()
    abilities_by_uuid.cache_clear()


def resolve_agent_name(agent_id: str) -> str:
    agent = agents_by_uuid().get(str(agent_id))
    return agent.get("displayName", UNKNOWN_NAME) if agent else UNKNOWN_NAME


def resolve_agent_role(agent_id: str) -> str:
    agent = agents_by_uuid().get(str(agent_id))
    role = (agent or {}).get("role") or {}
    return role.get("displayName", UNKNOWN_ROLE)


def resolve_map_name(map_id: str) -> str:
    item = maps_by_uuid().get(str(map_id))
    return item.get("displayName", UNKNOWN_NAME) if item else UNKNOWN_NAME


def resolve_weapon_name(weapon_id: str) -> str:
    item = weapons_by_uuid().get(str(weapon_id))
    return item.get("displayName", UNKNOWN_NAME) if item else UNKNOWN_NAME


def resolve_gear_name(gear_id: str) -> str:
    item = gear_by_uuid().get(str(gear_id))
    return item.get("displayName", UNKNOWN_NAME) if item else UNKNOWN_NAME


def resolve_weapon_or_gear_name(item_id: str) -> str:
    weapon_name = resolve_weapon_name(item_id)
    if weapon_name != UNKNOWN_NAME:
        return weapon_name
    return resolve_gear_name(item_id)


def _normalize_lookup(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", normalized)


def _sanitize_segment(value: Any) -> str:
    text = str(value if value is not None else "item").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", text)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text)
    text = text.strip("._")
    return text[:120] if text else "item"


def _local_ability_icon(agent_id: str, display_name: Any) -> str | None:
    if not agent_id or not display_name:
        return None
    return f"/content/agents/{agent_id}/abilities/{_sanitize_segment(display_name)}/displayIcon.png"


@lru_cache(maxsize=1)
def abilities_by_uuid() -> Dict[str, Dict[str, Any]]:
    abilities: Dict[str, Dict[str, Any]] = {}
    for agent_id, agent in agents_by_uuid().items():
        agent_name = agent.get("displayName") or agent.get("name")
        for ability in agent.get("abilities") or []:
            if not isinstance(ability, dict):
                continue
            slot = str(ability.get("slot") or "").strip()
            display_name = ability.get("displayName") or ability.get("name") or slot
            ability_id = (
                ability.get("uuid")
                or ability.get("id")
                or ability.get("assetPath")
                or (f"{agent_id}:{slot}" if slot else None)
                or f"{agent_id}:{_normalize_lookup(display_name)}"
            )
            if not ability_id:
                continue
            payload = {
                **ability,
                "uuid": str(ability_id),
                "displayName": display_name,
                "displayIcon": _local_ability_icon(agent_id, display_name)
                or ability.get("displayIcon"),
                "slot": slot,
                "agentUuid": agent_id,
                "agentName": agent_name,
            }
            keys = {
                str(ability_id),
                str(ability.get("uuid") or ""),
                str(ability.get("id") or ""),
                str(ability.get("assetPath") or ""),
                str(ability.get("rawName") or ""),
                str(display_name or ""),
                str(slot or ""),
                f"{agent_id}:{slot}" if slot else "",
                f"{agent_id}:{_normalize_lookup(display_name)}",
            }
            for key in keys:
                if key:
                    abilities.setdefault(key, payload)
    return abilities


def find_ability(value: Any, *, agent_id: str | None = None) -> Dict[str, Any] | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    ability_map = abilities_by_uuid()
    candidate_keys = [raw]
    normalized = _normalize_lookup(raw)
    agent_key = str(agent_id or "").strip()
    weapon_slot = _ABILITY_WEAPON_SLOT_ALIASES.get((agent_key, raw.lower()))
    slot_alias = _ABILITY_SLOT_ALIASES.get(normalized)
    if weapon_slot:
        candidate_keys.append(f"{agent_key}:{weapon_slot}")
        normalized = weapon_slot
    elif slot_alias and agent_key:
        candidate_keys.append(f"{agent_key}:{slot_alias}")
        normalized = slot_alias
    if agent_key:
        candidate_keys.extend([f"{agent_key}:{raw}", f"{agent_key}:{normalized}"])
    for key in candidate_keys:
        item = ability_map.get(key)
        if item:
            return item

    for item in ability_map.values():
        if agent_id and item.get("agentUuid") != agent_id:
            continue
        if normalized in {
            _normalize_lookup(item.get("displayName")),
            _normalize_lookup(item.get("slot")),
            _normalize_lookup(item.get("uuid")),
            _normalize_lookup(item.get("id")),
            _normalize_lookup(item.get("assetPath")),
            _normalize_lookup(item.get("rawName")),
        }:
            return item
    if agent_id:
        return find_ability(raw)
    return None


def resolve_ability_name(ability_id: str) -> str:
    item = find_ability(ability_id)
    return item.get("displayName", UNKNOWN_NAME) if item else UNKNOWN_NAME


def resolve_ability_icon(ability_id: str) -> str | None:
    item = find_ability(ability_id)
    return item.get("displayIcon") if item else None


def resolve_melee_weapon_id() -> str:
    for weapon_id, item in weapons_by_uuid().items():
        category = str(item.get("category") or "").lower()
        name = str(item.get("displayName") or "").lower()
        if "melee" in category or "knife" in name or "cuchillo" in name:
            return weapon_id
    return "MELEE"
