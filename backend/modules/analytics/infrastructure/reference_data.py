from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict

try:
    from infrastructure.mongo_client import content_collection
except ModuleNotFoundError:
    from backend.infrastructure.mongo_client import content_collection


UNKNOWN_NAME = "Unknown"
UNKNOWN_ROLE = "Desconocido"


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


def resolve_melee_weapon_id() -> str:
    for weapon_id, item in weapons_by_uuid().items():
        category = str(item.get("category") or "").lower()
        name = str(item.get("displayName") or "").lower()
        if "melee" in category or "knife" in name or "cuchillo" in name:
            return weapon_id
    return "MELEE"
