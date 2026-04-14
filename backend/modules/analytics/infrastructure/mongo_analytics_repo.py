"""MongoDB queries for analytics (heatmap events, filter options, ranked analytics)."""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

from infrastructure.mongo_client import content_collection, matches_collection


@lru_cache(maxsize=1)
def heatmap_maps_by_uuid() -> dict[str, dict[str, Any]]:
    """Load only map metadata needed by heatmap endpoints."""
    doc = content_collection.find_one(
        {"type": "valorant_content"},
        sort=[("_id", -1)],
        projection={"_id": 0, "maps": 1},
    )
    maps_raw = (doc or {}).get("maps") or []

    result: dict[str, dict[str, Any]] = {}
    for item in maps_raw:
        if not isinstance(item, dict):
            continue
        uuid = str(item.get("uuid") or "").strip()
        if not uuid:
            continue
        result[uuid] = {"displayName": item.get("displayName") or uuid}
    return result


def find_ranked_analytics_rows(
    puuid: str,
    *,
    map_id: Optional[str] = None,
    season_ids: Optional[list[str]] = None,
    agent_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Return lightweight per-match rows extracted from the matches collection."""
    elem: dict[str, Any] = {"puuid": puuid}
    if agent_id:
        elem["characterId"] = agent_id

    query: dict[str, Any] = {
        "players": {"$elemMatch": elem},
        "matchInfo.isRanked": True,
    }
    if map_id:
        query["matchInfo.mapId"] = map_id
    if season_ids:
        if len(season_ids) == 1:
            query["matchInfo.seasonId"] = season_ids[0]
        else:
            query["matchInfo.seasonId"] = {"$in": season_ids}

    projection = {
        "_id": 0,
        "matchInfo.matchId": 1,
        "matchInfo.mapId": 1,
        "matchInfo.seasonId": 1,
        "players.puuid": 1,
        "players.characterId": 1,
    }

    rows: list[dict[str, Any]] = []
    for match_obj in matches_collection.find(query, projection):
        match_info = match_obj.get("matchInfo") or {}
        match_id = str(match_info.get("matchId") or "").strip()
        if not match_id:
            continue
        player_agent = ""
        for p in match_obj.get("players", []) or []:
            if p.get("puuid") == puuid:
                player_agent = str(p.get("characterId") or "")
                break
        rows.append({
            "match_id": match_id,
            "map_id": str(match_info.get("mapId") or ""),
            "season_id": str(match_info.get("seasonId") or ""),
            "agent_id": player_agent,
        })
    return rows


HEATMAP_MATCH_PROJECTION = {
    "_id": 0,
    "matchInfo.matchId": 1,
    "matchInfo.mapId": 1,
    "matchInfo.seasonId": 1,
    "matchInfo.gameStartMillis": 1,
    "players.puuid": 1,
    "players.teamId": 1,
    "players.characterId": 1,
    "roundResults.roundNum": 1,
    "roundResults.plantRoundTime": 1,
    "roundResults.bombPlanter": 1,
    "roundResults.plantLocation.x": 1,
    "roundResults.plantLocation.y": 1,
    "roundResults.plantSite": 1,
    "roundResults.defuseRoundTime": 1,
    "roundResults.bombDefuser": 1,
    "roundResults.defuseLocation.x": 1,
    "roundResults.defuseLocation.y": 1,
    "roundResults.playerStats.kills.killer": 1,
    "roundResults.playerStats.kills.victim": 1,
    "roundResults.playerStats.kills.timeSinceRoundStartMillis": 1,
    "roundResults.playerStats.kills.timeSinceGameStartMillis": 1,
    "roundResults.playerStats.kills.playerLocations.puuid": 1,
    "roundResults.playerStats.kills.playerLocations.location.x": 1,
    "roundResults.playerStats.kills.playerLocations.location.y": 1,
    "roundResults.playerStats.kills.victimLocation.x": 1,
    "roundResults.playerStats.kills.victimLocation.y": 1,
}


def find_heatmap_matches(
    puuid: str,
    *,
    match_ids: set[str],
    map_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    if not match_ids:
        return []
    query: dict[str, Any] = {
        "players.puuid": puuid,
        "matchInfo.matchId": {"$in": list(match_ids)},
    }
    if map_id:
        query["matchInfo.mapId"] = map_id
    return list(matches_collection.find(query, HEATMAP_MATCH_PROJECTION))


def find_heatmap_matches_fallback(
    puuid: str,
    *,
    map_id: str,
    season_ids: Optional[list[str]] = None,
    match_ids: Optional[set[str]] = None,
    ranked_only: bool = True,
) -> list[dict[str, Any]]:
    """Fallback query for environments where analytics docs are not yet available."""
    query: dict[str, Any] = {
        "players.puuid": puuid,
        "matchInfo.mapId": map_id,
    }
    if ranked_only:
        query["matchInfo.isRanked"] = True
    if season_ids:
        if len(season_ids) == 1:
            query["matchInfo.seasonId"] = season_ids[0]
        else:
            query["matchInfo.seasonId"] = {"$in": season_ids}
    if match_ids:
        query["matchInfo.matchId"] = {"$in": list(match_ids)}
    return list(matches_collection.find(query, HEATMAP_MATCH_PROJECTION))


def find_agent_stats_for_player(
    puuid: str,
    *,
    map_id: str,
    season_ids: Optional[list[str]] = None,
) -> list[dict]:
    """Return matches with player data for per-agent counting."""
    match_query: dict = {
        "players.puuid": puuid,
        "matchInfo.mapId": map_id,
        "matchInfo.isRanked": True,
    }
    if season_ids:
        if len(season_ids) == 1:
            match_query["matchInfo.seasonId"] = season_ids[0]
        elif season_ids:
            match_query["matchInfo.seasonId"] = {"$in": season_ids}

    matches = list(
        matches_collection.find(match_query, {"_id": 0, "players": 1})
    )
    if not matches:
        relaxed_query = dict(match_query)
        relaxed_query.pop("matchInfo.isRanked", None)
        matches = list(
            matches_collection.find(relaxed_query, {"_id": 0, "players": 1})
        )
    return matches
