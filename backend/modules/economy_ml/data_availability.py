from __future__ import annotations

from hashlib import sha256
from typing import Any

from modules.analytics.infrastructure import reference_data

from .ability_catalog import load_ability_catalog
from .data_contract import (
    CONTENT_AVAILABLE, CONTENT_MISSING, DERIVED_POST_ROUND_ONLY,
    DERIVED_PRE_ROUND, DIRECT_AVAILABLE, NOT_AVAILABLE, UNSAFE_LEAKAGE,
)


def _get_path(doc: dict[str, Any], path: str) -> Any:
    current: Any = doc
    for part in path.split("."):
        if isinstance(current, list):
            current = current[0] if current else None
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _field(field: str, status: str, source: str | None, usable_as: str, notes: str) -> dict[str, Any]:
    return {
        "field": field,
        "status": status,
        "source": source,
        "usable_as": usable_as,
        "notes": notes,
    }


def _sample_match() -> dict[str, Any]:
    try:
        from infrastructure.mongo_client import matches_collection

        return matches_collection.find_one(
            {"roundResults.playerStats.economy": {"$exists": True}},
            {"_id": 0},
            sort=[("matchInfo.gameStartMillis", -1)],
        ) or {}
    except Exception:
        return {}


def _sample_player() -> dict[str, Any]:
    try:
        from infrastructure.mongo_client import players_collection

        return players_collection.find_one({}, {"_id": 0}) or {}
    except Exception:
        return {}


def _direct_or_missing(match: dict[str, Any], field: str, path: str, usable: str = "pre_round_feature") -> dict[str, Any]:
    value = _get_path(match, path)
    return _field(
        field,
        DIRECT_AVAILABLE if value is not None else NOT_AVAILABLE,
        f"matches_collection.{path}" if value is not None else None,
        usable if value is not None else "not_usable",
        "Dato observado directamente en documentos de partida." if value is not None else "No encontrado en muestra de partida.",
    )


def build_data_availability_report() -> dict[str, Any]:
    match = _sample_match()
    player = _sample_player()
    agents = reference_data.agents_by_uuid()
    weapons = reference_data.weapons_by_uuid()
    gear = reference_data.gear_by_uuid()
    maps = reference_data.maps_by_uuid()
    abilities = [
        ability
        for agent in load_ability_catalog().values()
        for ability in agent.get("abilities", [])
    ]
    content_abilities = [
        ability
        for agent in agents.values()
        for ability in (agent.get("abilities") or [])
        if isinstance(ability, dict)
    ]
    content_ability_cost_available = any(
        ability.get("cost") is not None
        or ability.get("credits") is not None
        or ability.get("creditCost") is not None
        or ((ability.get("shopData") or {}).get("cost") is not None if isinstance(ability.get("shopData"), dict) else False)
        for ability in content_abilities
    )
    catalog_ability_cost_available = any(ability.get("ability_cost_available") for ability in abilities)

    fields = [
        _direct_or_missing(match, "match_id", "matchInfo.matchId"),
        _direct_or_missing(match, "game_start_millis", "matchInfo.gameStartMillis"),
        _direct_or_missing(match, "season_id", "matchInfo.seasonId"),
        _direct_or_missing(match, "queue_id", "matchInfo.queueId"),
        _direct_or_missing(match, "map_id", "matchInfo.mapId"),
        _direct_or_missing(match, "is_ranked", "matchInfo.isRanked"),
        _direct_or_missing(match, "teams", "teams"),
        _direct_or_missing(match, "players", "players"),
        _direct_or_missing(match, "roundResults", "roundResults"),
        _direct_or_missing(match, "round number", "roundResults.roundNum"),
        _field("winning team", DIRECT_AVAILABLE if _get_path(match, "roundResults.winningTeam") is not None else NOT_AVAILABLE, "matches_collection.roundResults.winningTeam", "label_or_post_round_analysis", "Post-ronda; no se usa como feature pre-ronda."),
        _field("team score before round", DERIVED_PRE_ROUND, "roundResults previo acumulado", "pre_round_feature", "Derivado secuencialmente antes de cada ronda."),
        _field("side attack/defense", DERIVED_PRE_ROUND, "bombPlanter/winningTeamRole/ronda", "pre_round_feature", "Derivado sin usar resultado futuro de la misma ronda para la prediccion."),
        _direct_or_missing(match, "player team", "players.teamId"),
        _direct_or_missing(match, "player agent", "players.characterId"),
        _direct_or_missing(match, "player competitive tier", "players.competitiveTier"),
        _direct_or_missing(match, "round player economy", "roundResults.playerStats.economy"),
        _direct_or_missing(match, "weapon", "roundResults.playerStats.economy.weapon", "observed_action_or_label_context"),
        _direct_or_missing(match, "armor", "roundResults.playerStats.economy.armor", "observed_action_or_label_context"),
        _direct_or_missing(match, "remaining credits", "roundResults.playerStats.economy.remaining", "post_buy_observed_or_credit_update"),
        _direct_or_missing(match, "spent", "roundResults.playerStats.economy.spent", "post_buy_observed_or_credit_update"),
        _direct_or_missing(match, "loadout value", "roundResults.playerStats.economy.loadoutValue", "observed_action_or_label_context"),
        _field("kills", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.playerStats.kills") is not None else NOT_AVAILABLE, "matches_collection.roundResults.playerStats.kills", "post_round_label_or_analysis", "Nunca feature pre-ronda de la misma ronda."),
        _field("damage", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.playerStats.damage") is not None else NOT_AVAILABLE, "matches_collection.roundResults.playerStats.damage", "post_round_label_or_analysis", "Nunca feature pre-ronda de la misma ronda."),
        _field("score", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.playerStats.score") is not None else NOT_AVAILABLE, "matches_collection.roundResults.playerStats.score", "post_round_label_or_analysis", "Nunca feature pre-ronda de la misma ronda."),
        _field("ability data", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.playerStats.ability") is not None else NOT_AVAILABLE, "matches_collection.roundResults.playerStats.ability", "post_round_analysis_only", "Uso de habilidades observado, no compra pre-ronda."),
        _field("ultimate effects", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.playerStats.ability.ultimateEffects") is not None else NOT_AVAILABLE, "matches_collection.roundResults.playerStats.ability.ultimateEffects", "post_round_analysis_only", "Puede informar entrenamiento/análisis posterior, no disponibilidad pre-ronda exacta."),
        _field("plant", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.bombPlanter") is not None else NOT_AVAILABLE, "matches_collection.roundResults.bombPlanter", "post_round_analysis_only", "Planter de la ronda actual seria fuga si entra como feature."),
        _field("defuse", DERIVED_POST_ROUND_ONLY if _get_path(match, "roundResults.bombDefuser") is not None else NOT_AVAILABLE, "matches_collection.roundResults.bombDefuser", "post_round_analysis_only", "Defuser de la ronda actual seria fuga si entra como feature."),
        _field("players_collection", DIRECT_AVAILABLE if player else NOT_AVAILABLE, "players_collection", "historical_player_style_if_time_safe", "Disponible para fallback de estilo si hay documentos."),
    ]

    content_fields = [
        ("agents", bool(agents), "content_collection.agents"),
        ("agent uuid", bool(agents), "content_collection.agents[].uuid"),
        ("agent name", any(a.get("displayName") for a in agents.values()), "content_collection.agents[].displayName"),
        ("agent role", any(a.get("role") for a in agents.values()), "content_collection.agents[].role"),
        ("agent abilities", bool(abilities), "content_collection.agents[].abilities"),
        ("ability slot", any(a.get("ability_slot") for a in abilities), "content_collection.agents[].abilities[].slot"),
        ("ability name", any(a.get("ability_name") for a in abilities), "content_collection.agents[].abilities[].displayName"),
        ("ability description", any(a.get("ability_description") for a in abilities), "content_collection.agents[].abilities[].description"),
        ("content ability cost", content_ability_cost_available, "content_collection.agents[].abilities[].cost"),
        ("weapons", bool(weapons), "content_collection.weapons"),
        ("weapon uuid", bool(weapons), "content_collection.weapons[].uuid"),
        ("weapon name", any(w.get("displayName") for w in weapons.values()), "content_collection.weapons[].displayName"),
        ("weapon category", any(w.get("category") or (w.get("shopData") or {}).get("category") for w in weapons.values()), "content_collection.weapons[].category/shopData.category"),
        ("weapon cost", any((w.get("shopData") or {}).get("cost") is not None for w in weapons.values()), "content_collection.weapons[].shopData.cost"),
        ("weapon stats", any(w.get("weaponStats") for w in weapons.values()), "content_collection.weapons[].weaponStats"),
        ("gear", bool(gear), "content_collection.gear"),
        ("armor cost", any((g.get("shopData") or {}).get("cost") is not None for g in gear.values()), "content_collection.gear[].shopData.cost"),
        ("armor type", any(g.get("displayName") or g.get("category") for g in gear.values()), "content_collection.gear[].displayName/category"),
        ("maps", bool(maps), "content_collection.maps"),
        ("map name", any(m.get("displayName") for m in maps.values()), "content_collection.maps[].displayName"),
        ("map geometry/callouts", any(m.get("xMultiplier") or m.get("callouts") for m in maps.values()), "content_collection.maps[].xMultiplier/callouts"),
        ("competitive tiers", False, "content_collection.competitiveTiers"),
    ]
    for field, ok, source in content_fields:
        fields.append(_field(
            field,
            CONTENT_AVAILABLE if ok else CONTENT_MISSING,
            source if ok else None,
            "pre_round_plan_feature" if ok else "not_usable",
            "Disponible en contenido cargado." if ok else "No encontrado en contenido; no se debe inventar desde Mongo.",
        ))
    fields.append(_field(
        "ability cost",
        DIRECT_AVAILABLE if catalog_ability_cost_available else NOT_AVAILABLE,
        "backend/modules/economy_ml/data/ability_catalog_seed.json" if catalog_ability_cost_available else None,
        "pre_round_plan_feature" if catalog_ability_cost_available else "not_usable",
        "Coste procedente del catalogo manual versionado; esta es la fuente esperada porque Mongo/content no incluye costes de habilidades.",
    ))

    unsafe = [
        item["field"] for item in fields
        if item["status"] in {DERIVED_POST_ROUND_ONLY, UNSAFE_LEAKAGE}
    ]
    digest = sha256(repr(sorted((item["field"], item["status"], item["source"]) for item in fields)).encode("utf-8")).hexdigest()
    return {
        "available": True,
        "report_hash": digest,
        "summary": {
            "sample_match_available": bool(match),
            "sample_player_available": bool(player),
            "ability_cost_available": catalog_ability_cost_available,
            "content_ability_cost_available": content_ability_cost_available,
            "ability_cost_source": "manual_versioned_catalog" if catalog_ability_cost_available else "not_available",
            "unsafe_pre_round_fields": unsafe,
        },
        "fields": fields,
    }
