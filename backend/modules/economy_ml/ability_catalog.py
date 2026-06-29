from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from modules.analytics.infrastructure import reference_data


SEED_PATH = Path(__file__).parent / "data" / "ability_catalog_seed.json"

TACTICAL_TYPES = {
    "smoke", "vision_denial", "flash", "nearsight", "recon", "reveal",
    "trap", "stall", "slow", "concuss", "suppress", "vulnerable", "decay",
    "damage", "area_damage", "postplant", "retake", "anchor", "entry",
    "space_creation", "mobility", "teleport", "dash", "escape", "heal",
    "revive", "shield", "wall", "buff", "weapon", "eco_replacement",
    "plant", "defuse", "flank_control", "anti_utility", "info", "unknown",
}

EXPECTED_AGENT_NAMES = {
    "Cypher", "Deadlock", "Killjoy", "Sage", "Veto", "Vyse", "Chamber",
    "Astra", "Breach", "Brimstone", "Clove", "Fade", "Gekko", "Harbor",
    "Iso", "Jett", "KAY/O", "Miks", "Neon", "Omen", "Phoenix", "Raze",
    "Reyna", "Skye", "Sova", "Tejo", "Viper", "Waylay", "Yoru",
}

PROFILE_TERMS: dict[str, tuple[str, ...]] = {
    "smoke": ("smoke", "humo", "cortina", "cloud"),
    "vision_denial": ("vision", "smoke", "humo", "blind", "ciega", "nearsight"),
    "flash": ("flash", "blind", "ciega", "destello"),
    "nearsight": ("nearsight", "paranoia", "blind", "ciega"),
    "recon": ("recon", "detect", "rastrea", "scan", "sonda"),
    "reveal": ("reveal", "revela"),
    "trap": ("trap", "trampa", "alarm", "bot", "cable", "turret", "torreta"),
    "stall": ("slow", "ralentiza", "detiene", "vulnerable", "bloquea", "wall"),
    "slow": ("slow", "ralentiza"),
    "concuss": ("concuss", "aturd", "stun"),
    "suppress": ("suppress", "suprime", "suppression"),
    "vulnerable": ("vulnerable",),
    "decay": ("decay", "deterior"),
    "damage": ("damage", "dano", "daño", "granada", "explos", "incendi"),
    "area_damage": ("area", "molotov", "incendi", "poison", "veneno", "granada"),
    "postplant": ("post", "plant", "molotov", "incendi", "poison"),
    "retake": ("retake", "recon", "heal", "flash"),
    "anchor": ("anchor", "centinela", "zona"),
    "entry": ("entry", "duelista", "embestida", "explos"),
    "space_creation": ("space", "espacio", "dash", "salto"),
    "mobility": ("dash", "teleport", "salto", "vuela", "desliza"),
    "teleport": ("teleport", "tp"),
    "dash": ("dash",),
    "escape": ("escape", "teleport", "dash"),
    "heal": ("heal", "cura", "sanacion"),
    "revive": ("revive", "resucita", "resurrection"),
    "shield": ("shield", "escudo"),
    "wall": ("wall", "muro", "barrera"),
    "buff": ("buff", "stim", "combat stim"),
    "weapon": ("weapon", "arma", "blade", "headhunter", "tour de force"),
    "eco_replacement": ("blade", "headhunter", "tour de force", "weapon"),
    "plant": ("plant", "spike"),
    "defuse": ("defuse", "desarm"),
    "flank_control": ("flank", "flanco", "trap", "alarm", "cable"),
    "anti_utility": ("anti", "interceptor", "suppress"),
    "info": ("info", "recon", "reveal", "detect"),
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _compact(value: Any) -> str:
    return "".join(ch for ch in _norm(value) if ch.isalnum())


def _number_or_none(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _int_or_none(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _load_seed() -> dict[str, Any]:
    if not SEED_PATH.exists():
        return {"agents": {}, "needs_review": True}
    try:
        return json.loads(SEED_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"agents": {}, "needs_review": True, "load_error": True}


def _role_name(agent: dict[str, Any]) -> str:
    role = agent.get("role") if isinstance(agent.get("role"), dict) else {}
    return str(role.get("displayName") or agent.get("role") or "Unknown")


def _ability_cost_from_content(ability: dict[str, Any]) -> float | None:
    for key in ("cost", "credits", "creditCost"):
        parsed = _number_or_none(ability.get(key))
        if parsed is not None:
            return parsed
    shop = ability.get("shopData") if isinstance(ability.get("shopData"), dict) else {}
    return _number_or_none(shop.get("cost"))


def _infer_tactical_types(ability: dict[str, Any], role: str = "") -> list[str]:
    text = _norm(" ".join(str(ability.get(key) or "") for key in ("displayName", "name", "description", "slot")))
    types = [
        tactical_type for tactical_type, terms in PROFILE_TERMS.items()
        if any(term in text for term in terms)
    ]
    if not types:
        role_norm = _norm(role)
        if "controller" in role_norm or "controlador" in role_norm:
            types = ["smoke", "vision_denial"]
        elif "initiator" in role_norm or "iniciador" in role_norm:
            types = ["recon", "info"]
        elif "sentinel" in role_norm or "centinela" in role_norm:
            types = ["trap", "anchor"]
        elif "duelist" in role_norm or "duelista" in role_norm:
            types = ["entry", "space_creation"]
    return _clean_tactical_types(types)


def classify_ability_profiles(ability: dict[str, Any], role: str = "") -> list[str]:
    return _infer_tactical_types(ability, role)


def _clean_tactical_types(values: list[Any] | None) -> list[str]:
    result = []
    for value in values or []:
        normalized = str(value or "").strip()
        if normalized in TACTICAL_TYPES and normalized not in result:
            result.append(normalized)
    return result or ["unknown"]


def _score(types: list[str], emphasized: set[str]) -> float:
    known = set(types) - {"unknown"}
    if not known:
        return 0.5
    return round(min(1.0, 0.35 + len(known) * 0.05 + len(known & emphasized) * 0.08), 4)


def _finalize_ability(
    *,
    agent_id: str,
    agent_name: str,
    role: str,
    ability: dict[str, Any],
    source: str,
    warnings: list[str] | None = None,
    needs_review: bool = False,
) -> dict[str, Any]:
    tactical_types = _clean_tactical_types(ability.get("tactical_types")) if ability.get("tactical_types") else _infer_tactical_types(ability, role)
    cost = _number_or_none(ability.get("cost_credits"))
    if cost is None:
        cost = _ability_cost_from_content(ability)
    slot = ability.get("slot") or ability.get("ability_slot")
    name = ability.get("name") or ability.get("displayName") or ability.get("ability_name")
    kind = ability.get("ability_kind") or ("ultimate" if str(slot).upper() == "X" else "unknown")
    if kind == "ultimate":
        cost = None
    payload = {
        "agent_id": agent_id,
        "agent_name": agent_name,
        "role": role,
        "slot": slot,
        "name": name,
        "description": ability.get("description") or ability.get("ability_description"),
        "ability_kind": kind,
        "tactical_types": tactical_types,
        "max_charges": _int_or_none(ability.get("max_charges") or ability.get("maxCharges")),
        "free_charges_at_round_start": int(ability.get("free_charges_at_round_start") or 0),
        "purchasable_charges": _int_or_none(ability.get("purchasable_charges")),
        "cost_credits": cost,
        "cost_per_charge": _number_or_none(ability.get("cost_per_charge")) if kind != "ultimate" else None,
        "ultimate_points": _int_or_none(ability.get("ultimate_points")),
        "is_signature": bool(ability.get("is_signature") or kind == "signature"),
        "is_round_start_ability": bool(ability.get("is_round_start_ability")),
        "is_free_at_round_start": bool(ability.get("is_free_at_round_start")),
        "is_purchasable": bool(ability.get("is_purchasable")) if "is_purchasable" in ability else kind != "ultimate",
        "is_rechargeable": bool(ability.get("is_rechargeable")),
        "carries_over": bool(ability.get("carries_over")) if "carries_over" in ability else None,
        "recharge_rule": ability.get("recharge_rule") or "unknown",
        "resource_name": ability.get("resource_name"),
        "notes": ability.get("notes"),
        "source": source,
        "needs_review": bool(needs_review or ability.get("needs_review")),
        "warnings": warnings or [],
    }
    payload["ability_cost_available"] = payload["cost_credits"] is not None
    payload["missing_cost"] = bool(kind != "ultimate" and payload["is_purchasable"] and payload["cost_credits"] is None)
    if payload["missing_cost"]:
        payload["needs_review"] = True
        payload["warnings"] = list(dict.fromkeys(payload["warnings"] + ["missing_cost"]))
    payload["ability_slot"] = payload["slot"]
    payload["ability_name"] = payload["name"]
    payload["ability_description"] = payload["description"]
    payload["ability_cost"] = payload["cost_credits"]
    payload["utility_profiles"] = payload["tactical_types"]
    payload["attack_value_score"] = _score(tactical_types, {"entry", "space_creation", "smoke", "flash", "recon", "plant"})
    payload["defense_value_score"] = _score(tactical_types, {"anchor", "trap", "stall", "recon", "smoke", "retake"})
    payload["low_economy_value_score"] = _score(tactical_types, {"smoke", "recon", "stall", "trap", "heal", "weapon", "eco_replacement"})
    payload["postplant_value_score"] = _score(tactical_types, {"postplant", "flank_control", "area_damage", "plant"})
    payload["retake_value_score"] = _score(tactical_types, {"retake", "recon", "flash", "heal", "smoke", "defuse"})
    payload["entry_value_score"] = _score(tactical_types, {"entry", "flash", "space_creation", "suppress", "dash"})
    payload["stall_value_score"] = _score(tactical_types, {"stall", "trap", "wall", "area_damage", "slow"})
    payload["information_value_score"] = _score(tactical_types, {"recon", "reveal", "trap", "flank_control", "info"})
    return payload


def normalize_ability_catalog_from_content() -> dict[str, dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for agent_id, agent in reference_data.agents_by_uuid().items():
        agent_name = str(agent.get("displayName") or "Unknown")
        role = _role_name(agent)
        abilities = [
            _finalize_ability(
                agent_id=agent_id,
                agent_name=agent_name,
                role=role,
                ability=ability,
                source="content_collection",
            )
            for ability in (agent.get("abilities") or [])
            if isinstance(ability, dict)
        ]
        catalog[agent_id] = {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "role": role,
            "source": "content_collection",
            "needs_review": False,
            "round_start_ability": next((item["name"] for item in abilities if item.get("is_round_start_ability")), None),
            "abilities": abilities,
            "warnings": [],
        }
    return catalog


def _manual_agent_payload(agent_name: str, seed_agent: dict[str, Any]) -> dict[str, Any]:
    role = str(seed_agent.get("role") or "Unknown")
    abilities = [
        _finalize_ability(
            agent_id="",
            agent_name=agent_name,
            role=role,
            ability=ability,
            source="manual_seed",
            needs_review=bool(seed_agent.get("needs_review", True)),
        )
        for ability in seed_agent.get("abilities") or []
        if isinstance(ability, dict)
    ]
    return {
        "agent_id": "",
        "agent_name": agent_name,
        "role": role,
        "source": "manual_seed",
        "needs_review": bool(seed_agent.get("needs_review", True)),
        "round_start_ability": seed_agent.get("round_start_ability"),
        "abilities": abilities,
        "warnings": [],
    }


def merge_content_catalog_with_manual_seed() -> dict[str, dict[str, Any]]:
    content_catalog = normalize_ability_catalog_from_content()
    seed = _load_seed()
    seed_agents = seed.get("agents") if isinstance(seed.get("agents"), dict) else {}
    by_name = {_compact(agent["agent_name"]): agent_id for agent_id, agent in content_catalog.items()}

    for seed_name, seed_agent in seed_agents.items():
        manual = _manual_agent_payload(seed_name, seed_agent)
        agent_id = by_name.get(_compact(seed_name))
        if not agent_id:
            manual["needs_review"] = True
            manual["warnings"].append("missing_from_content_collection")
            content_catalog[f"manual:{seed_name}"] = manual
            continue
        target = content_catalog[agent_id]
        target["source"] = "content_collection+manual_seed"
        target["manual_seed_available"] = True
        if _compact(target.get("role")) != _compact(manual.get("role")):
            target["needs_review"] = True
            target["warnings"].append(f"role_conflict: content={target.get('role')} manual={manual.get('role')}")
        if manual.get("round_start_ability"):
            target["round_start_ability"] = target.get("round_start_ability") or manual["round_start_ability"]
        content_by_slot = {_compact(item.get("slot")): item for item in target.get("abilities") or [] if item.get("slot")}
        content_by_name = {_compact(item.get("name")): item for item in target.get("abilities") or [] if item.get("name")}
        for manual_ability in manual["abilities"]:
            existing = content_by_slot.get(_compact(manual_ability.get("slot"))) or content_by_name.get(_compact(manual_ability.get("name")))
            if not existing:
                manual_ability["agent_id"] = agent_id
                manual_ability["source"] = "manual_seed_fallback"
                manual_ability["needs_review"] = True
                manual_ability["warnings"].append("missing_from_content_collection")
                target["abilities"].append(manual_ability)
                continue
            if existing.get("name") and manual_ability.get("name") and _compact(existing["name"]) != _compact(manual_ability["name"]):
                existing["needs_review"] = True
                existing["warnings"].append(f"name_conflict_with_manual_seed:{manual_ability['name']}")
            for field in (
                "ability_kind", "tactical_types", "max_charges",
                "free_charges_at_round_start", "purchasable_charges",
                "ultimate_points", "is_signature", "is_round_start_ability",
                "is_free_at_round_start", "is_purchasable", "is_rechargeable",
                "carries_over", "recharge_rule", "resource_name", "notes",
            ):
                if field in {
                    "max_charges", "free_charges_at_round_start", "purchasable_charges",
                    "ultimate_points", "is_signature", "is_round_start_ability",
                    "is_free_at_round_start", "is_purchasable", "is_rechargeable",
                    "carries_over", "recharge_rule",
                } and field in manual_ability and manual_ability.get(field) is not None:
                    existing[field] = manual_ability[field]
                elif existing.get(field) in (None, "", [], ["unknown"], "unknown") and manual_ability.get(field) not in (None, "", []):
                    existing[field] = manual_ability[field]
            if existing.get("cost_credits") is None and manual_ability.get("cost_credits") is not None:
                existing["cost_credits"] = manual_ability["cost_credits"]
                existing["cost_per_charge"] = manual_ability.get("cost_per_charge")
                existing["source"] = "content_collection+manual_seed_cost"
            elif (
                existing.get("cost_credits") is not None
                and manual_ability.get("cost_credits") is not None
                and float(existing["cost_credits"]) != float(manual_ability["cost_credits"])
            ):
                existing["needs_review"] = True
                existing["warnings"].append(
                    f"cost_conflict_with_manual_seed:{manual_ability['cost_credits']}"
                )
            existing.update(_finalize_ability(
                agent_id=agent_id,
                agent_name=target["agent_name"],
                role=target["role"],
                ability=existing,
                source=existing.get("source") or target["source"],
                warnings=existing.get("warnings") or [],
                needs_review=bool(existing.get("needs_review")),
            ))

    content_names = {_compact(agent["agent_name"]) for agent in content_catalog.values()}
    seed_names = {_compact(name) for name in seed_agents}
    for agent in content_catalog.values():
        if _compact(agent["agent_name"]) not in seed_names:
            agent["needs_review"] = True
            agent["warnings"].append("missing_from_manual_seed")
    for expected in sorted(EXPECTED_AGENT_NAMES):
        if _compact(expected) not in content_names and _compact(expected) not in seed_names:
            content_catalog[f"missing:{expected}"] = {
                "agent_id": "",
                "agent_name": expected,
                "role": "Unknown",
                "source": "missing",
                "needs_review": True,
                "round_start_ability": None,
                "abilities": [],
                "warnings": ["missing_from_content_collection", "missing_from_manual_seed"],
            }
    return content_catalog


@lru_cache(maxsize=1)
def load_ability_catalog() -> dict[str, dict[str, Any]]:
    return merge_content_catalog_with_manual_seed()


def get_agent_ability_catalog(agent_id_or_name: str) -> dict[str, Any] | None:
    needle = _compact(agent_id_or_name)
    for agent_id, agent in load_ability_catalog().items():
        if _compact(agent_id) == needle or _compact(agent.get("agent_name")) == needle:
            return agent
    return None


def agent_abilities(agent_id_or_name: Any) -> list[dict[str, Any]]:
    agent = get_agent_ability_catalog(str(agent_id_or_name or ""))
    return list((agent or {}).get("abilities") or [])


def ability_costs_available() -> bool:
    return any(
        ability.get("cost_credits") is not None
        for agent in load_ability_catalog().values()
        for ability in agent.get("abilities") or []
        if ability.get("ability_kind") != "ultimate"
    )


def validate_ability_catalog() -> dict[str, Any]:
    invalid_types: list[dict[str, Any]] = []
    ultimate_costs: list[dict[str, Any]] = []
    missing_costs: list[dict[str, Any]] = []
    incomplete_agents: list[str] = []
    for agent in load_ability_catalog().values():
        if agent.get("needs_review") or len(agent.get("abilities") or []) < 4:
            incomplete_agents.append(agent.get("agent_name") or "Unknown")
        for ability in agent.get("abilities") or []:
            for tactical_type in ability.get("tactical_types") or []:
                if tactical_type not in TACTICAL_TYPES:
                    invalid_types.append({"agent": agent.get("agent_name"), "ability": ability.get("name"), "type": tactical_type})
            if ability.get("ability_kind") == "ultimate" and ability.get("cost_credits") is not None:
                ultimate_costs.append({"agent": agent.get("agent_name"), "ability": ability.get("name")})
            if ability.get("ability_kind") != "ultimate" and ability.get("cost_credits") is None:
                missing_costs.append({"agent": agent.get("agent_name"), "ability": ability.get("name")})
    return {
        "valid": not invalid_types and not ultimate_costs,
        "invalid_tactical_types": invalid_types,
        "ultimate_credit_costs": ultimate_costs,
        "abilities_missing_cost": missing_costs,
        "agents_incomplete_or_needing_review": sorted(set(incomplete_agents)),
    }


def build_ability_catalog_report() -> dict[str, Any]:
    catalog = load_ability_catalog()
    abilities = [ability for agent in catalog.values() for ability in agent.get("abilities") or []]
    with_cost = [ability for ability in abilities if ability.get("cost_credits") is not None]
    without_cost = [ability for ability in abilities if ability.get("cost_credits") is None]
    agents_incomplete = [
        agent.get("agent_name")
        for agent in catalog.values()
        if agent.get("needs_review") or len(agent.get("abilities") or []) < 4
    ]
    warnings = [
        {"agent": agent.get("agent_name"), "warnings": agent.get("warnings")}
        for agent in catalog.values()
        if agent.get("warnings")
    ]
    return {
        "available": True,
        "agents_loaded": len(catalog),
        "abilities_loaded": len(abilities),
        "abilities_with_cost": len(with_cost),
        "abilities_without_cost": len(without_cost),
        "agents_incomplete": sorted(set(item for item in agents_incomplete if item)),
        "needs_review_count": sum(1 for agent in catalog.values() if agent.get("needs_review")),
        "warnings": warnings,
        "validation": validate_ability_catalog(),
        "source": "content_collection_plus_manual_seed",
        "seed_path": str(SEED_PATH),
    }


def clear_ability_catalog_cache() -> None:
    load_ability_catalog.cache_clear()
