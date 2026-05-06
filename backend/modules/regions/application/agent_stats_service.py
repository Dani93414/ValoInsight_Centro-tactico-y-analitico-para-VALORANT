from __future__ import annotations

import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:
    from infrastructure.mongo_client import content_collection, matches_collection
    from shared.stat_formulas import finalize_core_stats
except ModuleNotFoundError:
    backend_root = Path(__file__).resolve().parents[3]
    if str(backend_root) not in sys.path:
        sys.path.append(str(backend_root))
    from backend.infrastructure.mongo_client import content_collection, matches_collection
    from backend.shared.stat_formulas import finalize_core_stats


_SUM_FIELDS = (
    "rounds", "wins", "kills", "deaths", "assists", "score",
    "damage_dealt", "damage_received", "headshots", "bodyshots", "legshots",
    "first_kills", "first_deaths", "opening_duel_wins", "opening_duel_losses",
    "trade_kills", "trade_opportunities", "missed_trade_opportunities",
    "traded_deaths", "clutch_opportunities", "clutches_won",
    "survival_rounds", "rounds_with_kill", "rounds_with_assist",
    "rounds_with_death", "rounds_with_kast",
    "rounds_with_direct_participation", "rounds_without_direct_participation",
    "rounds_only_kill", "rounds_only_assist", "rounds_only_death",
    "rounds_kill_assist", "rounds_kill_death", "rounds_assist_death",
    "rounds_kill_assist_death", "rounds_none", "rounds_combined_or_none",
    "rounds_with_multikill", "multi_2k", "multi_3k", "multi_4k", "multi_5k",
    "econ_spent", "loadout_value_total",
)


_RANK_NAMES = {
    3: "Iron 1",
    4: "Iron 2",
    5: "Iron 3",
    6: "Bronze 1",
    7: "Bronze 2",
    8: "Bronze 3",
    9: "Silver 1",
    10: "Silver 2",
    11: "Silver 3",
    12: "Gold 1",
    13: "Gold 2",
    14: "Gold 3",
    15: "Platinum 1",
    16: "Platinum 2",
    17: "Platinum 3",
    18: "Diamond 1",
    19: "Diamond 2",
    20: "Diamond 3",
    21: "Ascendant 1",
    22: "Ascendant 2",
    23: "Ascendant 3",
    24: "Immortal 1",
    25: "Immortal 2",
    26: "Immortal 3",
    27: "Radiant",
}


def _safe_div(num: float, den: float) -> float:
    return round(num / den, 4) if den else 0.0


def _normalize_region(raw: str | None) -> str | None:
    value = str(raw or "").strip().upper()
    return value or None


def _normalize_filter(raw: str | None) -> str | None:
    value = str(raw or "").strip()
    return value if value and value.lower() != "all" else None


def _coerce_rank(raw: str | int | None) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, int):
        return raw if raw >= 3 else None
    value = str(raw).strip()
    if not value or value.lower() == "all":
        return None
    try:
        tier = int(float(value))
        return tier if tier >= 3 else None
    except ValueError:
        normalized = value.lower()
        for tier, label in _RANK_NAMES.items():
            if label.lower() == normalized:
                return tier
    return None


def _latest_content_maps_acts() -> tuple[dict[str, str], dict[str, str]]:
    doc = content_collection.find_one(
        {"type": "valorant_content"},
        {"_id": 0, "maps.uuid": 1, "maps.displayName": 1, "maps.name": 1, "acts.id": 1, "acts.name": 1},
        sort=[("_id", -1)],
    ) or {}
    maps = {
        str(item.get("uuid") or ""): str(item.get("displayName") or item.get("name") or item.get("uuid") or "")
        for item in doc.get("maps", []) or []
        if item.get("uuid")
    }
    acts = {
        str(item.get("id") or ""): str(item.get("name") or item.get("id") or "")
        for item in doc.get("acts", []) or []
        if item.get("id")
    }
    return maps, acts


def _base_match_query(region: str | None, map_id: str | None, act_id: str | None) -> dict[str, Any]:
    query: dict[str, Any] = {"matchInfo.isRanked": True, "players.analytics": {"$exists": True}}
    if region:
        query["matchInfo.region"] = {"$in": [region, region.lower(), region.upper()]}
    if map_id:
        query["matchInfo.mapId"] = map_id
    if act_id:
        query["matchInfo.seasonId"] = act_id
    return query


def _player_matches_filters(player: dict[str, Any], *, rank: int | None, role: str | None) -> bool:
    if rank is not None and int(player.get("competitiveTier") or 0) != rank:
        return False
    if role:
        analytics = player.get("analytics") or {}
        player_role = str(analytics.get("role") or "").strip().lower()
        if player_role != role.strip().lower():
            return False
    return True


def _build_options(region: str | None) -> dict[str, list[dict[str, Any]]]:
    query = _base_match_query(region, None, None)
    projection = {
        "_id": 0,
        "matchInfo.mapId": 1,
        "matchInfo.seasonId": 1,
        "players.competitiveTier": 1,
    }
    map_names, act_names = _latest_content_maps_acts()
    map_counts: Counter[str] = Counter()
    act_counts: Counter[str] = Counter()
    rank_counts: Counter[int] = Counter()

    for match in matches_collection.find(query, projection):
        map_id = str((match.get("matchInfo") or {}).get("mapId") or "").strip()
        act_id = str((match.get("matchInfo") or {}).get("seasonId") or "").strip()
        if map_id:
            map_counts[map_id] += 1
        if act_id:
            act_counts[act_id] += 1
        for player in match.get("players", []) or []:
            tier = _coerce_rank(player.get("competitiveTier"))
            if tier:
                rank_counts[tier] += 1

    maps = [
        {"value": key, "label": map_names.get(key, key), "count": count}
        for key, count in map_counts.items()
    ]
    maps.sort(key=lambda item: str(item["label"]).lower())

    acts = [
        {"value": key, "label": act_names.get(key, key), "count": count}
        for key, count in act_counts.items()
    ]
    acts.sort(key=lambda item: str(item["label"]).lower())

    ranks = [
        {"value": str(key), "label": _RANK_NAMES.get(key, f"Tier {key}"), "count": count}
        for key, count in rank_counts.items()
    ]
    ranks.sort(key=lambda item: int(item["value"]))

    return {"maps": maps, "acts": acts, "ranks": ranks}


def get_global_agent_stats(
    *,
    region: str | None = None,
    rank: str | int | None = None,
    map_id: str | None = None,
    act_id: str | None = None,
    role: str | None = None,
) -> dict[str, Any]:
    region_norm = _normalize_region(region)
    map_norm = _normalize_filter(map_id)
    act_norm = _normalize_filter(act_id)
    role_norm = _normalize_filter(role)
    rank_tier = _coerce_rank(rank)

    query = _base_match_query(region_norm, map_norm, act_norm)
    projection = {
        "_id": 0,
        "matchInfo.matchId": 1,
        "players.characterId": 1,
        "players.competitiveTier": 1,
        "players.analytics": 1,
    }

    agents = defaultdict(lambda: {
        "agent_name": "Unknown",
        "role": "Desconocido",
        "picks": 0,
        "wins": 0,
        "totals": Counter(),
    })
    match_ids: set[str] = set()
    filtered_picks = 0

    for match in matches_collection.find(query, projection):
        match_id = str((match.get("matchInfo") or {}).get("matchId") or "").strip()
        match_has_pick = False
        for player in match.get("players", []) or []:
            analytics = player.get("analytics") or {}
            if not analytics or not _player_matches_filters(player, rank=rank_tier, role=role_norm):
                continue

            overview = analytics.get("overview") or {}
            agent_id = str(player.get("characterId") or "UNKNOWN")
            bucket = agents[agent_id]
            bucket["agent_name"] = analytics.get("agent_name") or bucket["agent_name"]
            bucket["role"] = analytics.get("role") or bucket["role"]
            bucket["picks"] += 1
            bucket["wins"] += 1 if analytics.get("won_match") else 0
            for field in _SUM_FIELDS:
                bucket["totals"][field] += int(overview.get(field, 0) or 0)
            filtered_picks += 1
            match_has_pick = True
        if match_has_pick and match_id:
            match_ids.add(match_id)

    agent_stats: dict[str, Any] = {}
    for agent_id, bucket in agents.items():
        totals = dict(bucket["totals"])
        derived = finalize_core_stats(dict(totals))
        picks = int(bucket["picks"])
        agent_stats[agent_id] = {
            "agent_name": bucket["agent_name"],
            "role": bucket["role"],
            "picks": picks,
            "matches": picks,
            "wins": int(bucket["wins"]),
            "rounds": int(totals.get("rounds", 0)),
            "totals": {field: int(totals.get(field, 0) or 0) for field in _SUM_FIELDS},
            "pick_rate": _safe_div(picks * 100.0, filtered_picks),
            "win_rate": _safe_div(int(bucket["wins"]) * 100.0, picks),
            "avg_kd": derived["kd_ratio"],
            "avg_kda": derived["kda_ratio"],
            "avg_acs": derived["acs"],
            "avg_adr": derived["adr"],
            "avg_headshot_pct": derived["headshot_pct"],
            "avg_fk_rate": derived["fk_rate"],
            "avg_fd_rate": derived["fd_rate"],
            "avg_survival_rate": derived["survival_rate"],
            "avg_clutch_win_rate": derived["clutch_win_rate"],
            "deaths_per_round": derived["deaths_per_round"],
            "assist_rate": derived["rounds_with_assist_pct"],
            "kast_pct": derived.get("kast_pct", 0.0),
            "trade_rate": derived["trade_conversion_rate"],
            "trade_kills_per_round": derived["trade_kills_per_round"],
            "opening_duel_win_pct": derived["opening_duel_win_pct"],
        }

    warnings = []
    if filtered_picks == 0:
        warnings.append("No hay datos globales para el subconjunto filtrado.")
    elif filtered_picks < 100:
        warnings.append("Muestra global baja para el subconjunto filtrado.")

    return {
        "filters": {
            "region": region_norm,
            "rank": str(rank_tier) if rank_tier is not None else None,
            "map": map_norm,
            "act": act_norm,
            "role": role_norm,
        },
        "options": _build_options(region_norm),
        "sampleSize": {
            "matches": len(match_ids),
            "picks": filtered_picks,
            "agents": len(agent_stats),
        },
        "warnings": warnings,
        "agentStats": agent_stats,
    }
