from __future__ import annotations

from collections import Counter
from functools import lru_cache
from typing import Any

from modules.analytics.infrastructure import reference_data


CONTENT_UNAVAILABLE_REASON = "No hay datos de contenido de Valorant cargados en Mongo"


def _norm(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", " ")


def _compact(value: Any) -> str:
    return "".join(ch for ch in _norm(value) if ch.isalnum())


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _shop_data(item: dict[str, Any]) -> dict[str, Any]:
    shop = item.get("shopData")
    return shop if isinstance(shop, dict) else {}


def _api_category(item: dict[str, Any]) -> str:
    return str(item.get("category") or _shop_data(item).get("category") or "unknown")


def _category_text(item: dict[str, Any]) -> str:
    return str(_shop_data(item).get("categoryText") or item.get("categoryText") or "")


def _weapon_cost(item: dict[str, Any]) -> float | None:
    shop = _shop_data(item)
    return _number(shop.get("cost") if "cost" in shop else item.get("cost"))


USAGE_PROFILE_RULES: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (
    ("melee", ("melee", "knife", "cuchillo"), ()),
    ("sidearm", ("sidearm", "pistol", "pistola"), ()),
    ("rifle_default", ("rifle", "rifles", "fusil"), ()),
    ("sniper", ("sniper", "snipers", "francotirador"), ()),
    ("shotgun", ("shotgun", "escopeta"), ()),
    ("machine_gun", ("machinegun", "machine gun", "heavy weapons", "armas pesadas", "ametralladora"), ()),
    ("close_range", ("smg", "submachine", "shotgun", "escopeta"), ()),
    ("mid_range", ("rifle", "smg", "submachine"), ()),
    ("long_range", ("rifle", "sniper", "guardian", "marshal", "operator", "outlaw"), ()),
    ("operator_style", (), ("operator",)),
    ("anti_light_armor", (), ("outlaw", "marshal")),
    ("eco_punish", ("sidearm", "pistol", "sniper"), ("sheriff", "marshal", "outlaw")),
)


@lru_cache(maxsize=1)
def content_available() -> bool:
    return bool(reference_data.weapons_by_uuid() or reference_data.maps_by_uuid() or reference_data.gear_by_uuid())


def _weapon_usage_profile(item: dict[str, Any]) -> list[str]:
    category = _api_category(item)
    category_text = _category_text(item)
    name = item.get("displayName")
    haystack = " ".join([_norm(category), _norm(category_text), _norm(name)])
    compact_haystack = _compact(haystack)
    profiles: list[str] = []
    for profile, category_terms, name_terms in USAGE_PROFILE_RULES:
        if any(_compact(term) in compact_haystack for term in category_terms):
            profiles.append(profile)
            continue
        if any(_compact(term) in compact_haystack for term in name_terms):
            profiles.append(profile)
    return list(dict.fromkeys(profiles)) or ["unknown"]


def _normalize_weapon(uuid: str, item: dict[str, Any]) -> dict[str, Any]:
    weapon_stats = item.get("weaponStats") if isinstance(item.get("weaponStats"), dict) else {}
    return {
        "uuid": uuid,
        "displayName": item.get("displayName"),
        "name": item.get("displayName"),
        "api_category": _api_category(item),
        "categoryText": _category_text(item),
        "shopData": _shop_data(item),
        "cost": _weapon_cost(item),
        "fireRate": weapon_stats.get("fireRate"),
        "magazineSize": weapon_stats.get("magazineSize"),
        "wallPenetration": weapon_stats.get("wallPenetration"),
        "equipTimeSeconds": weapon_stats.get("equipTimeSeconds"),
        "reloadTimeSeconds": weapon_stats.get("reloadTimeSeconds"),
        "usage_profile": _weapon_usage_profile(item),
        "raw": item,
    }


@lru_cache(maxsize=1)
def load_weapon_catalog() -> dict[str, dict[str, Any]]:
    return {
        uuid: _normalize_weapon(uuid, item)
        for uuid, item in reference_data.weapons_by_uuid().items()
        if isinstance(item, dict)
    }


@lru_cache(maxsize=1)
def load_map_catalog() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for uuid, item in reference_data.maps_by_uuid().items():
        callouts = item.get("callouts") if isinstance(item.get("callouts"), list) else []
        result[uuid] = {
            "uuid": uuid,
            "displayName": item.get("displayName"),
            "mapUrl": item.get("mapUrl"),
            "xMultiplier": item.get("xMultiplier"),
            "yMultiplier": item.get("yMultiplier"),
            "xScalarToAdd": item.get("xScalarToAdd"),
            "yScalarToAdd": item.get("yScalarToAdd"),
            "callouts": callouts,
            "callout_count": len(callouts),
            "raw": item,
        }
    return result


@lru_cache(maxsize=1)
def load_gear_catalog() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for uuid, item in reference_data.gear_by_uuid().items():
        shop = _shop_data(item)
        name = item.get("displayName")
        category = str(item.get("category") or shop.get("category") or "")
        text = " ".join([_norm(name), _norm(category), _norm(shop.get("categoryText"))])
        armor_level = "none"
        if "heavy" in text or "pesad" in text:
            armor_level = "heavy"
        elif "light" in text or "liger" in text:
            armor_level = "light"
        result[uuid] = {
            "uuid": uuid,
            "displayName": name,
            "api_category": category or "unknown",
            "categoryText": shop.get("categoryText"),
            "cost": _number(shop.get("cost")),
            "armor_level": armor_level,
            "raw": item,
        }
    return result


def build_weapon_usage_taxonomy() -> dict[str, list[dict[str, Any]]]:
    taxonomy: dict[str, list[dict[str, Any]]] = {}
    for weapon in load_weapon_catalog().values():
        for profile in weapon["usage_profile"]:
            taxonomy.setdefault(profile, []).append({
                "uuid": weapon["uuid"],
                "name": weapon["displayName"],
                "api_category": weapon["api_category"],
                "cost": weapon["cost"],
            })
    return taxonomy


def find_weapon(value: Any) -> dict[str, Any] | None:
    text = str(value or "").strip()
    if not text:
        return None
    catalog = load_weapon_catalog()
    if text in catalog:
        return catalog[text]
    compact = _compact(text)
    for weapon in catalog.values():
        if _compact(weapon.get("displayName")) == compact:
            return weapon
    return None


def find_gear(value: Any) -> dict[str, Any] | None:
    text = str(value or "").strip()
    if not text:
        return None
    catalog = load_gear_catalog()
    if text in catalog:
        return catalog[text]
    compact = _compact(text)
    for gear in catalog.values():
        if _compact(gear.get("displayName")) == compact:
            return gear
    return None


def weapon_has_profile(value: Any, profile: str) -> bool:
    weapon = find_weapon(value)
    return bool(weapon and profile in weapon.get("usage_profile", []))


def gear_armor_level(value: Any) -> str:
    gear = find_gear(value)
    return str((gear or {}).get("armor_level") or "none")


def build_content_report() -> dict[str, Any]:
    weapons = list(load_weapon_catalog().values())
    gear = list(load_gear_catalog().values())
    maps = list(load_map_catalog().values())
    if not weapons and not gear and not maps:
        return {"available": False, "reason": CONTENT_UNAVAILABLE_REASON}

    category_counts = Counter(str(weapon.get("api_category") or "unknown") for weapon in weapons)
    profile_counts = Counter(
        profile
        for weapon in weapons
        for profile in (weapon.get("usage_profile") or ["unknown"])
    )
    return {
        "available": True,
        "weapons_found": len(weapons),
        "gear_found": len(gear),
        "maps_found": len(maps),
        "weapon_categories": dict(sorted(category_counts.items())),
        "usage_profiles": dict(sorted(profile_counts.items())),
        "weapons": [
            {
                "uuid": weapon["uuid"],
                "name": weapon.get("displayName"),
                "api_category": weapon.get("api_category"),
                "categoryText": weapon.get("categoryText"),
                "usage_profile": weapon.get("usage_profile"),
                "cost": weapon.get("cost"),
            }
            for weapon in weapons
        ],
        "gear": [
            {
                "uuid": item["uuid"],
                "name": item.get("displayName"),
                "api_category": item.get("api_category"),
                "armor_level": item.get("armor_level"),
                "cost": item.get("cost"),
            }
            for item in gear
        ],
        "maps": [
            {
                "uuid": item["uuid"],
                "name": item.get("displayName"),
                "callout_count": item.get("callout_count"),
            }
            for item in maps
        ],
    }


def clear_catalog_cache() -> None:
    content_available.cache_clear()
    load_weapon_catalog.cache_clear()
    load_map_catalog.cache_clear()
    load_gear_catalog.cache_clear()
