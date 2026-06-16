from __future__ import annotations

from typing import Any

BUY_ACTIONS = [
    "ECO_CLASSIC", "ECO_PISTOL_UPGRADE", "ECO_SHERIFF", "SEMI_SMG",
    "SEMI_MARSHAL", "FORCE_OUTLAW", "FORCE_RIFLE_LIGHT", "FORCE_2_RIFLES",
    "FULL_RIFLES", "FULL_OPERATOR", "BONUS_KEEP_WEAPONS", "MIXED_LOW_BUY",
    "UNKNOWN",
]

# IDs vary between data providers. Add canonical UUIDs here as reference data is
# ingested; normalized display names are also supported immediately.
WEAPON_IDS: dict[str, set[str]] = {
    "rifle": {
        "vandal", "phantom", "bulldog", "guardian",
        "9c82e19d-4575-0200-1a81-3eacf00cf872",
        "ca11b433-4f09-02d4-01a1-f8b5d7ad4675",
        "ae3de142-4d85-2547-dd26-4e90bed35cf7",
        "4ade7faa-4cf1-8376-95ef-39884480959b",
    },
    "smg": {
        "spectre", "stinger",
        "462080d1-4035-2937-7c09-27aa2a5c27a7",
        "f7e1b454-4ad4-1063-ec0a-159e56b58941",
    },
    "machine_gun": {
        "ares", "odin",
        "55d8a0f4-4274-ca67-fe2c-06ab45efdf58",
        "63e6c2b6-4a8e-869c-3d4c-e38355226584",
    },
    "shotgun": {
        "bucky", "judge",
        "910be174-449b-c412-ab22-d0873436b21b",
        "ec845bf4-4f79-ddda-a3da-0db3774b2794",
    },
    "operator": {"operator", "a03b24d3-4319-996d-0f8c-94bbfba1dfc7"},
    "outlaw": {"outlaw", "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c"},
    "marshal": {"marshal", "c69d76ec-4eeb-cc26-40e5-0eb9e8b1e5b6"},
    "sheriff": {"sheriff", "e336c6b8-418d-9340-d77f-7a9e4cfe0702"},
    "sidearm": {
        "classic", "shorty", "frenzy", "ghost",
        "29a0cfab-485b-f5d5-779a-b59f85e204a8",
        "42da8ccc-40d5-affc-beec-15aa47b42eda",
        "44d4e95c-4157-0037-81b2-17841bf2e8e3",
        "1baa85b4-4c70-1284-64bb-6481dfc3bb4e",
    },
}
ARMOR_IDS: dict[str, set[str]] = {
    "heavy": {"heavy", "heavyshields", "heavy armor", "heavyarmor", "822bcab2-40a2-324e-c137-e09195ad7692"},
    "light": {"light", "lightshields", "light armor", "lightarmor", "4dec83d5-4902-9ab3-bed6-a7a390761157"},
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", " ")


def _in_set(value: Any, key: str, source: dict[str, set[str]]) -> bool:
    normalized = _norm(value)
    return normalized in source[key] or any(name in normalized for name in source[key])


def is_rifle(weapon_id: Any) -> bool: return _in_set(weapon_id, "rifle", WEAPON_IDS)
def is_smg(weapon_id: Any) -> bool: return _in_set(weapon_id, "smg", WEAPON_IDS)
def is_machine_gun(weapon_id: Any) -> bool: return _in_set(weapon_id, "machine_gun", WEAPON_IDS)
def is_shotgun(weapon_id: Any) -> bool: return _in_set(weapon_id, "shotgun", WEAPON_IDS)
def is_operator(weapon_id: Any) -> bool: return _in_set(weapon_id, "operator", WEAPON_IDS)
def is_outlaw(weapon_id: Any) -> bool: return _in_set(weapon_id, "outlaw", WEAPON_IDS)
def is_marshal(weapon_id: Any) -> bool: return _in_set(weapon_id, "marshal", WEAPON_IDS)
def is_sheriff(weapon_id: Any) -> bool: return _in_set(weapon_id, "sheriff", WEAPON_IDS)
def is_sidearm(weapon_id: Any) -> bool: return _in_set(weapon_id, "sidearm", WEAPON_IDS) or is_sheriff(weapon_id)
def is_sniper(weapon_id: Any) -> bool: return is_operator(weapon_id) or is_outlaw(weapon_id) or is_marshal(weapon_id)
def is_heavy_armor(armor_id: Any) -> bool: return _in_set(armor_id, "heavy", ARMOR_IDS)
def is_light_armor(armor_id: Any) -> bool: return _in_set(armor_id, "light", ARMOR_IDS)


def classify_team_buy_action(
    team_player_economies: list[dict], previous_round_context: dict | None = None
) -> str:
    economies = [economy or {} for economy in team_player_economies if isinstance(economy, dict)]
    if not economies:
        return "UNKNOWN"
    weapons = [economy.get("weapon") for economy in economies]
    total = sum(float(economy.get("loadoutValue") or 0) for economy in economies)
    spent = sum(float(economy.get("spent") or 0) for economy in economies)
    rifles = sum(is_rifle(weapon) for weapon in weapons)
    smgs = sum(is_smg(weapon) for weapon in weapons)
    machine_guns = sum(is_machine_gun(weapon) for weapon in weapons)
    shotguns = sum(is_shotgun(weapon) for weapon in weapons)
    operators = sum(is_operator(weapon) for weapon in weapons)
    outlaws = sum(is_outlaw(weapon) for weapon in weapons)
    marshals = sum(is_marshal(weapon) for weapon in weapons)
    sheriffs = sum(is_sheriff(weapon) for weapon in weapons)
    sidearms = sum(is_sidearm(weapon) for weapon in weapons)
    heavy = sum(is_heavy_armor(economy.get("armor")) for economy in economies)
    light = sum(is_light_armor(economy.get("armor")) for economy in economies)
    premium_primaries = rifles + machine_guns

    if previous_round_context and previous_round_context.get("won") and spent < 5000 and total >= 12000:
        return "BONUS_KEEP_WEAPONS"
    if operators and total >= 18000:
        return "FULL_OPERATOR"
    if premium_primaries >= 4 and heavy >= 3 and total >= 16000:
        return "FULL_RIFLES"
    if premium_primaries >= 2 and total >= 12000:
        return "FORCE_2_RIFLES"
    if rifles and light:
        return "FORCE_RIFLE_LIGHT"
    if machine_guns and total >= 9000:
        return "FORCE_2_RIFLES"
    if outlaws:
        return "FORCE_OUTLAW"
    if marshals:
        return "SEMI_MARSHAL"
    if smgs >= 2 or shotguns >= 2:
        return "SEMI_SMG"
    if sheriffs >= 2:
        return "ECO_SHERIFF"
    if sidearms >= 2 and total < 8000:
        return "ECO_PISTOL_UPGRADE"
    if total < 4000 and spent < 3000:
        return "ECO_CLASSIC"
    if total < 8000:
        return "ECO_PISTOL_UPGRADE"
    return "MIXED_LOW_BUY"
