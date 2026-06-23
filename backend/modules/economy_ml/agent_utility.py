from __future__ import annotations

from functools import lru_cache
from typing import Any

from modules.analytics.infrastructure import reference_data


UTILITY_PROFILES = [
    "smoke", "flash", "recon", "stall", "trap", "mobility", "heal",
    "revive", "wall", "postplant", "entry", "anchor", "suppression",
    "area_damage", "vision_denial", "space_creation", "retake",
]
ROLE_KEYS = ("controller", "duelist", "initiator", "sentinel")

ROLE_PROFILE_FALLBACKS: dict[str, set[str]] = {
    "controller": {"smoke", "vision_denial"},
    "initiator": {"recon", "flash", "suppression", "entry"},
    "sentinel": {"trap", "stall", "anchor", "postplant"},
    "duelist": {"entry", "mobility", "space_creation"},
}

TEXT_PROFILE_RULES: dict[str, tuple[str, ...]] = {
    "smoke": ("smoke", "humo", "cortina", "cloud", "niebla"),
    "flash": ("flash", "cegar", "ciega", "destello", "blind"),
    "recon": ("recon", "revela", "reveal", "detect", "rastrea", "sonda"),
    "stall": ("ralentiza", "slow", "bloquea", "detiene", "vulnerable"),
    "trap": ("trampa", "trap", "torreta", "bot", "alarma", "cable"),
    "mobility": ("dash", "salto", "impulso", "teleport", "desliza", "vuela"),
    "heal": ("cura", "curar", "heal", "sanacion"),
    "revive": ("resucita", "revive", "resurrection"),
    "wall": ("muro", "wall", "barrera"),
    "postplant": ("molotov", "incendi", "poison", "veneno", "nanoplaga", "post"),
    "entry": ("entry", "duelista", "explos", "carga", "embestida"),
    "anchor": ("centinela", "anchor", "zona", "ancla"),
    "suppression": ("suprime", "suppression", "suppressed", "supresion"),
    "area_damage": ("dano", "damage", "granada", "explos", "incendi", "molotov"),
    "vision_denial": ("humo", "smoke", "vision", "cortina", "ciega", "blind"),
    "space_creation": ("espacio", "space", "dash", "salto", "explos", "duelista"),
}

AGENT_NAME_FALLBACKS: dict[str, set[str]] = {
    "sage": {"heal", "revive", "wall", "stall"},
    "cypher": {"trap", "anchor", "stall", "recon"},
    "killjoy": {"trap", "anchor", "stall"},
    "sova": {"recon"},
    "fade": {"recon"},
    "omen": {"smoke", "vision_denial", "mobility"},
    "brimstone": {"smoke", "vision_denial", "area_damage", "postplant"},
    "viper": {"smoke", "vision_denial", "area_damage", "postplant"},
    "harbor": {"smoke", "vision_denial", "wall"},
    "kayo": {"suppression", "flash", "entry"},
    "kay/o": {"suppression", "flash", "entry"},
    "jett": {"entry", "mobility", "space_creation", "weapon_dependency"},
    "raze": {"entry", "mobility", "space_creation", "area_damage"},
    "neon": {"entry", "mobility", "space_creation"},
}

ATTACK_PROFILES = {"entry", "space_creation", "smoke", "flash", "recon", "postplant"}
DEFENSE_PROFILES = {"anchor", "trap", "stall", "recon", "smoke", "area_damage"}
LOW_ECON_PROFILES = {"smoke", "recon", "stall", "trap", "heal", "wall", "vision_denial", "suppression"}
WEAPON_DEPENDENCY_PROFILES = {"entry", "mobility", "space_creation"}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _role_key(agent: dict[str, Any]) -> str:
    role = agent.get("role") if isinstance(agent.get("role"), dict) else {}
    role_name = _norm(role.get("displayName") or agent.get("role") or "")
    for key in ROLE_KEYS:
        if key in role_name:
            return key
    return "unknown"


def _agent_text(agent: dict[str, Any]) -> str:
    parts = [agent.get("displayName"), agent.get("description")]
    role = agent.get("role") if isinstance(agent.get("role"), dict) else {}
    parts.extend([role.get("displayName"), role.get("description")])
    for ability in agent.get("abilities") or []:
        if not isinstance(ability, dict):
            continue
        parts.extend([ability.get("displayName"), ability.get("description")])
    return _norm(" ".join(str(part or "") for part in parts))


def _score_from_profiles(profiles: set[str], emphasized: set[str]) -> float:
    known = profiles.intersection(UTILITY_PROFILES)
    if not known:
        return 0.5
    base = 0.35 + min(0.35, len(known) * 0.06)
    emphasis = min(0.3, len(known.intersection(emphasized)) * 0.08)
    return round(min(1.0, base + emphasis), 4)


def classify_agent_utility_profile(agent: dict[str, Any]) -> dict[str, Any]:
    role_key = _role_key(agent)
    profiles: set[str] = set(ROLE_PROFILE_FALLBACKS.get(role_key, set()))
    text = _agent_text(agent)
    for profile, tokens in TEXT_PROFILE_RULES.items():
        if any(token in text for token in tokens):
            profiles.add(profile)
    name = _norm(agent.get("displayName"))
    for name_key, fallback_profiles in AGENT_NAME_FALLBACKS.items():
        if name_key in name:
            profiles.update(profile for profile in fallback_profiles if profile in UTILITY_PROFILES)

    known_profiles = sorted(profile for profile in profiles if profile in UTILITY_PROFILES)
    if not known_profiles:
        known_profiles = ["unknown"]

    known_set = set(known_profiles) - {"unknown"}
    base_score = _score_from_profiles(known_set, set())
    low_economy_resilience = round(
        min(1.0, 0.35 + len(known_set.intersection(LOW_ECON_PROFILES)) * 0.08),
        4,
    ) if known_set else 0.5
    weapon_dependency_score = round(
        min(1.0, 0.25 + len(known_set.intersection(WEAPON_DEPENDENCY_PROFILES)) * 0.14),
        4,
    ) if known_set else 0.5

    role = agent.get("role") if isinstance(agent.get("role"), dict) else {}
    return {
        "agent_id": str(agent.get("uuid") or "UNKNOWN"),
        "agent_name": agent.get("displayName") or "Unknown",
        "role": role.get("displayName") or "Unknown",
        "role_key": role_key,
        "utility_profiles": known_profiles,
        "base_utility_score": base_score,
        "attack_utility_score": _score_from_profiles(known_set, ATTACK_PROFILES),
        "defense_utility_score": _score_from_profiles(known_set, DEFENSE_PROFILES),
        "low_economy_resilience": low_economy_resilience,
        "weapon_dependency_score": weapon_dependency_score,
        **{f"{profile}_score": (1.0 if profile in known_set else 0.0) for profile in UTILITY_PROFILES},
    }


@lru_cache(maxsize=1)
def load_agent_utility_catalog() -> dict[str, dict[str, Any]]:
    return {
        agent_id: classify_agent_utility_profile(agent)
        for agent_id, agent in reference_data.agents_by_uuid().items()
        if isinstance(agent, dict)
    }


def agent_utility(agent_id: Any) -> dict[str, Any]:
    catalog = load_agent_utility_catalog()
    value = str(agent_id or "")
    if value in catalog:
        return catalog[value]
    return classify_agent_utility_profile({"uuid": value, "displayName": "Unknown"})


def summarize_team_agent_utility(
    players: list[dict[str, Any]],
    *,
    side: str,
    estimated_credits: float,
    prefix: str,
) -> dict[str, float | int]:
    utilities = [agent_utility(player.get("characterId")) for player in players]
    count = max(len(utilities), 1)
    side_key = "attack_utility_score" if side == "attack" else "defense_utility_score"
    low_econ_factor = 1.15 if estimated_credits < 10000 else 1.0
    features: dict[str, float | int] = {}
    for role in ROLE_KEYS:
        features[f"{prefix}_{role}_count"] = sum(1 for item in utilities if item.get("role_key") == role)
    for profile in UTILITY_PROFILES:
        value = round(
            sum(float(item.get(f"{profile}_score") or 0) for item in utilities) / count,
            4,
        )
        features[f"{prefix}_{profile}_utility_score"] = value
        features[f"{prefix}_{profile}_score"] = value
    total = sum(float(item.get(side_key) or item.get("base_utility_score") or 0.5) for item in utilities) / count
    attack_total = sum(float(item.get("attack_utility_score") or item.get("base_utility_score") or 0.5) for item in utilities) / count
    defense_total = sum(float(item.get("defense_utility_score") or item.get("base_utility_score") or 0.5) for item in utilities) / count
    low_resilience = sum(float(item.get("low_economy_resilience") or 0.5) for item in utilities) / count
    weapon_dependency = sum(float(item.get("weapon_dependency_score") or 0.5) for item in utilities) / count
    features[f"{prefix}_total_utility_score"] = round(total, 4)
    features[f"{prefix}_attack_utility_score"] = round(attack_total, 4)
    features[f"{prefix}_defense_utility_score"] = round(defense_total, 4)
    features[f"{prefix}_low_economy_resilience"] = round(min(1.0, low_resilience * low_econ_factor), 4)
    features[f"{prefix}_weapon_dependency_score"] = round(weapon_dependency, 4)
    return features


def build_utility_diff_features(team_features: dict, enemy_features: dict) -> dict[str, float]:
    return {
        "utility_score_diff": round(
            float(team_features.get("team_total_utility_score") or 0)
            - float(enemy_features.get("enemy_total_utility_score") or 0),
            4,
        ),
        "low_economy_resilience_diff": round(
            float(team_features.get("team_low_economy_resilience") or 0)
            - float(enemy_features.get("enemy_low_economy_resilience") or 0),
            4,
        ),
        "weapon_dependency_diff": round(
            float(team_features.get("team_weapon_dependency_score") or 0)
            - float(enemy_features.get("enemy_weapon_dependency_score") or 0),
            4,
        ),
    }


def player_agent_utility_features(agent_id: Any, side: str) -> dict[str, Any]:
    utility = agent_utility(agent_id)
    side_score = utility.get("attack_utility_score") if side == "attack" else utility.get("defense_utility_score")
    return {
        "agent_utility_profiles": ",".join(utility.get("utility_profiles") or ["unknown"]),
        "agent_base_utility_score": utility.get("base_utility_score"),
        "agent_side_utility_score": side_score,
        "agent_low_economy_resilience": utility.get("low_economy_resilience"),
        "agent_weapon_dependency_score": utility.get("weapon_dependency_score"),
        "agent_entry_score": utility.get("entry_score"),
        "agent_anchor_score": utility.get("anchor_score"),
        "agent_recon_score": utility.get("recon_score"),
        "agent_smoke_score": utility.get("smoke_score"),
        "agent_flash_score": utility.get("flash_score"),
        "agent_stall_score": utility.get("stall_score"),
        "agent_postplant_score": utility.get("postplant_score"),
    }


def clear_agent_utility_cache() -> None:
    load_agent_utility_catalog.cache_clear()
