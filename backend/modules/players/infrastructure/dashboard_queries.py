"""MongoDB queries used by the player dashboard service."""
from __future__ import annotations

from typing import Any

from infrastructure.mongo_client import content_collection, matches_collection


_DASHBOARD_CONTENT_PROJECTION = {
    "_id": 0,
    "agents.uuid": 1,
    "agents.id": 1,
    "agents.displayName": 1,
    "agents.name": 1,
    "agents.displayIcon": 1,
    "agents.fullPortrait": 1,
    "agents.bustPortrait": 1,
    "maps.uuid": 1,
    "maps.id": 1,
    "maps.displayName": 1,
    "maps.name": 1,
    "maps.splash": 1,
    "maps.listViewIcon": 1,
    "maps.listViewIconTall": 1,
    "maps.displayIcon": 1,
    "weapons.uuid": 1,
    "weapons.id": 1,
    "weapons.displayName": 1,
    "weapons.displayIcon": 1,
    "acts.id": 1,
    "acts.name": 1,
    "acts.parentId": 1,
    "acts.parent_id": 1,
    "acts.parentName": 1,
    "acts.parent.name": 1,
    "acts.type": 1,
    "acts.isActive": 1,
    "competitiveTiers.uuid": 1,
    "competitiveTiers.id": 1,
    "competitiveTiers.tiers": 1,
    "competitive_tiers.uuid": 1,
    "competitive_tiers.id": 1,
    "competitive_tiers.tiers": 1,
}


def get_dashboard_content() -> dict[str, Any]:
    return (
        content_collection.find_one(
            {"type": "valorant_content"},
            sort=[("_id", -1)],
            projection=_DASHBOARD_CONTENT_PROJECTION,
        )
        or {}
    )


def find_ranked_matches_cursor(puuid: str, projection: dict | None = None):
    """Return a cursor of ranked matches for a player, newest first."""
    query = {"players.puuid": puuid, "matchInfo.isRanked": True}
    cursor = matches_collection.find(query, projection).sort(
        "matchInfo.gameStartMillis", -1
    )
    return cursor


def find_recent_matches_with_rank(puuid: str, limit: int = 50):
    projection = {
        "_id": 0,
        "players.puuid": 1,
        "players.competitiveTier": 1,
        "players.competitive_tier": 1,
        "matchInfo.gameStartMillis": 1,
    }
    return (
        matches_collection.find({"players.puuid": puuid}, projection)
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )


def find_match_durations(match_ids: list[str]):
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids:
        return []
    return matches_collection.find(
        {
            "$or": [
                {"metadata.match_id": {"$in": clean_ids}},
                {"matchInfo.matchId": {"$in": clean_ids}},
            ]
        },
        {
            "_id": 0,
            "metadata.match_id": 1,
            "matchInfo.matchId": 1,
            "matchInfo.gameLengthMillis": 1,
        },
    )


def find_match_parties(match_ids: list[str]):
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids:
        return []
    return matches_collection.find(
        {
            "$or": [
                {"matchInfo.matchId": {"$in": clean_ids}},
                {"metadata.match_id": {"$in": clean_ids}},
            ]
        },
        {
            "_id": 0,
            "matchInfo.matchId": 1,
            "metadata.match_id": 1,
            "players.puuid": 1,
            "players.partyId": 1,
        },
    )


def aggregate_weapon_usage(pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return list(matches_collection.aggregate(pipeline, allowDiskUse=True))


def count_player_matches(puuid: str) -> int:
    return matches_collection.count_documents({"players.puuid": puuid})
