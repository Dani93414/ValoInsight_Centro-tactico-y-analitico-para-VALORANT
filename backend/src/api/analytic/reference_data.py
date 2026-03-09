from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict

from db.mongo_client import content_collection


UNKNOWN_NAME = "Unknown"
UNKNOWN_ROLE = "Desconocido"


@lru_cache(maxsize=1)
def _latest_content_doc() -> Dict[str, Any]:
    doc = content_collection.find_one(
        {"type": "valorant_content"},
        sort=[("_id", -1)],
        projection={"_id": 0, "agents": 1, "maps": 1, "weapons": 1},
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


def clear_reference_cache() -> None:
    _latest_content_doc.cache_clear()
    agents_by_uuid.cache_clear()
    maps_by_uuid.cache_clear()
    weapons_by_uuid.cache_clear()


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