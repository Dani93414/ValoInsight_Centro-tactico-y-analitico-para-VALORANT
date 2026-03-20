from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

from backend.db.mongo_client import matches_collection

from .extractor import build_player_match_analytics_docs
from .rating import combine_role_scores, score_role_block
from .schemas import AnalyticsFilters

logger = logging.getLogger(__name__)

player_match_analytics_collection = matches_collection.database["player_match_analytics"]


def _aggregate_empty_scope() -> dict:
    return {
        "matches": 0,
        "rounds": 0,
        "wins": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "score": 0,
        "damage_dealt": 0,
        "damage_received": 0,
        "damage_delta": 0,
        "headshots": 0,
        "bodyshots": 0,
        "legshots": 0,
        "first_kills": 0,
        "first_deaths": 0,
        "opening_duel_wins": 0,
        "opening_duel_losses": 0,
        "trade_kills": 0,
        "traded_deaths": 0,
        "clutch_opportunities": 0,
        "clutches_won": 0,
        "survival_rounds": 0,
        "rounds_with_kill": 0,
        "rounds_with_assist": 0,
        "rounds_with_multikill": 0,
        "multi_2k": 0,
        "multi_3k": 0,
        "multi_4k": 0,
        "multi_5k": 0,
        "econ_spent": 0,
        "loadout_value_total": 0,
    }


def safe_div(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _finalize_aggregate(scope: dict) -> dict:
    rounds = scope.get("rounds", 0)
    kills = scope.get("kills", 0)
    deaths = scope.get("deaths", 0)
    assists = scope.get("assists", 0)
    shots = scope.get("headshots", 0) + scope.get("bodyshots", 0) + scope.get("legshots", 0)

    scope["kd_ratio"] = safe_div(kills, max(deaths, 1))
    scope["kda_ratio"] = safe_div(kills + assists, max(deaths, 1))
    scope["acs"] = safe_div(scope.get("score", 0), rounds)
    scope["adr"] = safe_div(scope.get("damage_dealt", 0), rounds)
    scope["damage_delta_per_round"] = safe_div(scope.get("damage_delta", 0), rounds)
    scope["kills_per_round"] = safe_div(kills, rounds)
    scope["deaths_per_round"] = safe_div(deaths, rounds)
    scope["assists_per_round"] = safe_div(assists, rounds)
    scope["headshot_pct"] = safe_div(scope.get("headshots", 0) * 100.0, shots)
    scope["win_rate"] = safe_div(scope.get("wins", 0) * 100.0, rounds)
    scope["survival_rate"] = safe_div(scope.get("survival_rounds", 0) * 100.0, rounds)
    scope["fk_rate"] = safe_div(scope.get("first_kills", 0) * 100.0, rounds)
    scope["fd_rate"] = safe_div(scope.get("first_deaths", 0) * 100.0, rounds)
    scope["fkfd_diff_per_round"] = safe_div(
        scope.get("first_kills", 0) - scope.get("first_deaths", 0),
        rounds,
    )
    opening_total = scope.get("opening_duel_wins", 0) + scope.get("opening_duel_losses", 0)
    scope["opening_duel_win_pct"] = safe_div(scope.get("opening_duel_wins", 0) * 100.0, opening_total)
    scope["trade_kills_per_round"] = safe_div(scope.get("trade_kills", 0), rounds)
    scope["traded_deaths_per_round"] = safe_div(scope.get("traded_deaths", 0), rounds)
    scope["clutch_win_rate"] = safe_div(scope.get("clutches_won", 0) * 100.0, scope.get("clutch_opportunities", 0))
    scope["multikill_rate"] = safe_div(scope.get("rounds_with_multikill", 0) * 100.0, rounds)
    scope["damage_per_1000_credits"] = safe_div(scope.get("damage_dealt", 0) * 1000.0, scope.get("econ_spent", 0))
    scope["average_loadout_value"] = safe_div(scope.get("loadout_value_total", 0), rounds)
    return scope


def _merge_scope_into(target: dict, source: dict) -> None:
    for key in (
        "rounds",
        "wins",
        "kills",
        "deaths",
        "assists",
        "score",
        "damage_dealt",
        "damage_received",
        "damage_delta",
        "headshots",
        "bodyshots",
        "legshots",
        "first_kills",
        "first_deaths",
        "opening_duel_wins",
        "opening_duel_losses",
        "trade_kills",
        "traded_deaths",
        "clutch_opportunities",
        "clutches_won",
        "survival_rounds",
        "rounds_with_kill",
        "rounds_with_assist",
        "rounds_with_multikill",
        "multi_2k",
        "multi_3k",
        "multi_4k",
        "multi_5k",
        "econ_spent",
        "loadout_value_total",
    ):
        target[key] += int(source.get(key, 0) or 0)


def _extract_scope_from_doc(doc: dict, filters: AnalyticsFilters) -> Optional[dict]:
    """
    Devuelve el bloque correcto según filtros:
    - sin side ni weapon: overview
    - solo side: sides[side]
    - solo weapon: overview.weapon_stats[weapon]
    - side + weapon: sides[side].weapon_stats[weapon]
    """
    if filters.side and filters.weapon_id:
        side_block = (doc.get("sides") or {}).get(filters.side)
        if not side_block:
            return None
        return (side_block.get("weapon_stats") or {}).get(filters.weapon_id)

    if filters.side:
        return (doc.get("sides") or {}).get(filters.side)

    if filters.weapon_id:
        return (doc.get("overview") or {}).get("weapon_stats", {}).get(filters.weapon_id)

    return doc.get("overview")


def _aggregate_docs(docs: Iterable[dict], filters: AnalyticsFilters) -> dict:
    total = _aggregate_empty_scope()
    total["matches"] = 0

    for doc in docs:
        scope = _extract_scope_from_doc(doc, filters)
        if not scope:
            continue
        total["matches"] += 1
        _merge_scope_into(total, scope)

    return _finalize_aggregate(total)


def _aggregate_docs_by_role(docs: Iterable[dict], filters: AnalyticsFilters) -> Dict[str, dict]:
    role_buckets: Dict[str, dict] = defaultdict(_aggregate_empty_scope)
    role_matches: Dict[str, int] = defaultdict(int)

    for doc in docs:
        scope = _extract_scope_from_doc(doc, filters)
        if not scope:
            continue
        role = doc.get("role") or "Desconocido"
        role_matches[role] += 1
        _merge_scope_into(role_buckets[role], scope)

    finalized = {}
    for role, bucket in role_buckets.items():
        bucket["matches"] = role_matches[role]
        finalized[role] = _finalize_aggregate(bucket)
    return finalized


def _docs_cursor_to_list(cursor) -> List[dict]:
    return list(cursor)


def _index_exists(collection, key_spec: list[tuple[str, int]], unique: Optional[bool] = None) -> bool:
    desired_key = dict(key_spec)
    for idx in collection.list_indexes():
        if dict(idx.get("key", {})) != desired_key:
            continue
        if unique is None:
            return True
        if bool(idx.get("unique", False)) == bool(unique):
            return True
    return False


def ensure_indexes() -> None:
    if not _index_exists(player_match_analytics_collection, [("match_id", 1), ("puuid", 1)], unique=True):
        player_match_analytics_collection.create_index(
            [("match_id", 1), ("puuid", 1)],
            unique=True,
        )

    for key_spec in (
        [("puuid", 1)],
        [("is_ranked", 1)],
        [("map_id", 1)],
        [("agent_id", 1)],
        [("season_id", 1)],
        [("role", 1)],
    ):
        if not _index_exists(player_match_analytics_collection, key_spec):
            player_match_analytics_collection.create_index(key_spec)


def rebuild_match_player_analytics(match_obj: dict) -> int:
    ensure_indexes()

    docs = build_player_match_analytics_docs(match_obj)
    if not docs:
        return 0

    match_id = docs[0]["match_id"]
    player_match_analytics_collection.delete_many({"match_id": match_id})

    if docs:
        player_match_analytics_collection.insert_many(docs)

    return len(docs)


def rebuild_all_player_match_analytics(batch_size: int = 200) -> dict:
    ensure_indexes()

    processed_matches = 0
    inserted_docs = 0
    failed_matches = 0

    last_id = None
    while True:
        query = {} if last_id is None else {"_id": {"$gt": last_id}}
        docs = list(
            matches_collection.find(query).sort("_id", 1).limit(batch_size)
        )
        if not docs:
            break

        for match_obj in docs:
            try:
                count = rebuild_match_player_analytics(match_obj)
                processed_matches += 1
                inserted_docs += count
            except Exception as exc:
                failed_matches += 1
                logger.exception("Error generando analytics para una partida: %s", exc)

        last_id = docs[-1]["_id"]

    return {
        "processed_matches": processed_matches,
        "inserted_docs": inserted_docs,
        "failed_matches": failed_matches,
    }


def get_player_performance(puuid: str, filters: Optional[AnalyticsFilters] = None) -> dict:
    if not puuid:
        raise ValueError("puuid es obligatorio")

    filters = (filters or AnalyticsFilters()).normalized()

    player_query = filters.to_mongo_query(puuid=puuid)
    all_query = filters.to_mongo_query()

    player_docs = _docs_cursor_to_list(player_match_analytics_collection.find(player_query))
    if not player_docs:
        return {
            "puuid": puuid,
            "filters": filters.__dict__,
            "sample": {"matches": 0, "rounds": 0},
            "overview": {},
            "rating": {},
            "by_role": {},
        }

    all_docs = _docs_cursor_to_list(player_match_analytics_collection.find(all_query))

    overview = _aggregate_docs(player_docs, filters)
    by_role_player = _aggregate_docs_by_role(player_docs, filters)
    by_role_all = _aggregate_docs_by_role(all_docs, filters)

    role_scores = []
    detailed_roles = {}

    for role, agg in by_role_player.items():
        if agg.get("rounds", 0) <= 0:
            continue

        baseline_docs_same_role = []
        for doc in all_docs:
            if doc.get("role") != role:
                continue
            scope = _extract_scope_from_doc(doc, filters)
            if scope and scope.get("rounds", 0) > 0:
                baseline_docs_same_role.append(scope)

        rating_payload = score_role_block(
            aggregate_block=agg,
            baseline_blocks=baseline_docs_same_role,
            role=role,
        )

        role_scores.append({
            "rounds": agg["rounds"],
            "rating_payload": rating_payload,
        })

        detailed_roles[role] = {
            "sample": {
                "matches": agg.get("matches", 0),
                "rounds": agg.get("rounds", 0),
            },
            "overview": agg,
            "rating": rating_payload,
        }

    combined_rating = combine_role_scores(role_scores)

    return {
        "puuid": puuid,
        "filters": filters.__dict__,
        "sample": {
            "matches": overview.get("matches", 0),
            "rounds": overview.get("rounds", 0),
        },
        "overview": overview,
        "rating": combined_rating,
        "by_role": detailed_roles,
    }