from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, Iterable, List, Optional

try:
    from infrastructure.mongo_client import matches_collection
except ModuleNotFoundError:
    from backend.infrastructure.mongo_client import matches_collection

from modules.analytics.domain.extractor import build_player_analytics_embedded
from modules.analytics.infrastructure.reference_data import clear_reference_cache
from modules.analytics.domain.rating import combine_role_scores, score_role_block
from modules.analytics.application.filters import AnalyticsFilters

logger = logging.getLogger(__name__)

PLAYER_PERFORMANCE_MATCH_LIMIT = 1_000
PLAYER_PERFORMANCE_BASELINE_LIMIT = 5_000
QUERY_MAX_TIME_MS = 5_000
PERFORMANCE_PROJECTION = {
    "_id": 0,
    "players.puuid": 1,
    "players.characterId": 1,
    "players.analytics": 1,
}


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
        "clutch_1v1_opportunities": 0,
        "clutch_1v1_wins": 0,
        "clutch_1v2_opportunities": 0,
        "clutch_1v2_wins": 0,
        "clutch_1v3_opportunities": 0,
        "clutch_1v3_wins": 0,
        "clutch_1v4_opportunities": 0,
        "clutch_1v4_wins": 0,
        "clutch_1v5_opportunities": 0,
        "clutch_1v5_wins": 0,
        "survival_rounds": 0,
        "rounds_with_kill": 0,
        "rounds_with_assist": 0,
        "rounds_with_death": 0,
        "rounds_with_direct_participation": 0,
        "rounds_with_multikill": 0,
        "multi_2k": 0,
        "multi_3k": 0,
        "multi_4k": 0,
        "multi_5k": 0,
        "econ_spent": 0,
        "loadout_value_total": 0,
    }


from shared.math_utils import safe_div as _safe_div_raw
from shared.stat_formulas import finalize_core_stats


def safe_div(numerator: float, denominator: float) -> float:
    return _safe_div_raw(numerator, denominator, 4)


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
        "clutch_1v1_opportunities",
        "clutch_1v1_wins",
        "clutch_1v2_opportunities",
        "clutch_1v2_wins",
        "clutch_1v3_opportunities",
        "clutch_1v3_wins",
        "clutch_1v4_opportunities",
        "clutch_1v4_wins",
        "clutch_1v5_opportunities",
        "clutch_1v5_wins",
        "survival_rounds",
        "rounds_with_kill",
        "rounds_with_assist",
        "rounds_with_death",
        "rounds_with_direct_participation",
        "rounds_with_multikill",
        "multi_2k",
        "multi_3k",
        "multi_4k",
        "multi_5k",
        "econ_spent",
        "loadout_value_total",
    ):
        target[key] += int(source.get(key, 0) or 0)

    if "rounds_with_kast" in source and source.get("rounds_with_kast") is not None:
        target["rounds_with_kast"] = int(target.get("rounds_with_kast", 0) or 0) + int(
            source.get("rounds_with_kast", 0) or 0
        )


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

    return finalize_core_stats(total)


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
        finalized[role] = finalize_core_stats(bucket)
    return finalized


def _extract_analytics_docs_from_matches(
    match_cursor,
    puuid: Optional[str] = None,
    agent_id: Optional[str] = None,
) -> List[dict]:
    """
    Given a cursor of match documents, extract the embedded analytics subdocs.
    If puuid is given, only return that player's analytics per match.
    If agent_id is given, additionally filter by characterId.
    Returns a list of analytics subdocs (each has overview, sides, role, etc.).
    """
    docs: List[dict] = []
    for match_obj in match_cursor:
        for player in match_obj.get("players", []) or []:
            analytics = player.get("analytics")
            if not analytics:
                continue
            if puuid and player.get("puuid") != puuid:
                continue
            if agent_id and str(player.get("characterId") or "") != agent_id:
                continue
            docs.append(analytics)
    return docs


def rebuild_match_player_analytics(match_obj: dict) -> int:
    """Compute analytics for every player in *match_obj* and embed them in-place."""
    match_info = match_obj.get("matchInfo") or {}
    match_id = match_info.get("matchId")
    if not match_id:
        return 0

    analytics_by_puuid = build_player_analytics_embedded(match_obj)
    if not analytics_by_puuid:
        return 0

    for puuid, analytics in analytics_by_puuid.items():
        matches_collection.update_one(
            {"matchInfo.matchId": match_id, "players.puuid": puuid},
            {"$set": {"players.$.analytics": analytics}},
        )

    return len(analytics_by_puuid)


def rebuild_all_player_match_analytics(batch_size: int = 200) -> dict:
    # Ensure map/agent/weapon names are resolved against the latest content snapshot.
    clear_reference_cache()

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
        "embedded_players": inserted_docs,
        "failed_matches": failed_matches,
    }


def get_player_performance(puuid: str, filters: Optional[AnalyticsFilters] = None) -> dict:
    if not puuid:
        raise ValueError("puuid es obligatorio")

    filters = (filters or AnalyticsFilters()).normalized()

    player_query = filters.to_mongo_query(puuid=puuid)
    all_query = filters.to_mongo_query()

    player_matches = (
        matches_collection.find(player_query, PERFORMANCE_PROJECTION)
        .sort("matchInfo.gameStartMillis", -1)
        .limit(PLAYER_PERFORMANCE_MATCH_LIMIT)
        .max_time_ms(QUERY_MAX_TIME_MS)
    )
    player_docs = _extract_analytics_docs_from_matches(
        player_matches, puuid=puuid, agent_id=filters.agent_id,
    )
    if not player_docs:
        return {
            "puuid": puuid,
            "filters": filters.__dict__,
            "sample": {"matches": 0, "rounds": 0},
            "overview": {},
            "rating": {},
            "by_role": {},
        }

    all_matches = (
        matches_collection.find(all_query, PERFORMANCE_PROJECTION)
        .sort("matchInfo.gameStartMillis", -1)
        .limit(PLAYER_PERFORMANCE_BASELINE_LIMIT)
        .max_time_ms(QUERY_MAX_TIME_MS)
    )
    all_docs = _extract_analytics_docs_from_matches(
        all_matches, agent_id=filters.agent_id,
    )

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
