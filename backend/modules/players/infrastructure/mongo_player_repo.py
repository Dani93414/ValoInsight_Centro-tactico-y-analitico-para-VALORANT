"""MongoDB repository for player documents."""
from __future__ import annotations

import re
from typing import Any, Optional

from infrastructure.mongo_client import players_collection, matches_collection

MAX_SEARCH_TERM_LENGTH = 64
QUERY_MAX_TIME_MS = 3_000


def _safe_prefix_regex(value: Optional[str]) -> Optional[dict[str, str]]:
    """Build a bounded, escaped prefix regex suitable for autocomplete queries."""
    text = str(value or "").strip()
    if not text:
        return None
    text = text[:MAX_SEARCH_TERM_LENGTH]
    return {"$regex": f"^{re.escape(text)}", "$options": "i"}


def list_players(
    *,
    game_name: Optional[str] = None,
    tag_line: Optional[str] = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """List players optionally filtered by game name / tag line (regex, case-insensitive)."""
    query: dict[str, Any] = {}
    game_name_regex = _safe_prefix_regex(game_name)
    tag_line_regex = _safe_prefix_regex(tag_line)
    if game_name_regex:
        query["gameName"] = game_name_regex
    if tag_line_regex:
        query["tagLine"] = tag_line_regex
    return list(
        players_collection.find(query, {"_id": 0})
        .limit(limit)
        .max_time_ms(QUERY_MAX_TIME_MS)
    )


def search_players(
    *,
    game_name: Optional[str] = None,
    tag_line: Optional[str] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Autocomplete-optimised player search combining matches + players collections."""
    if not game_name and not tag_line:
        return []

    players_query: dict[str, Any] = {}
    game_name_regex = _safe_prefix_regex(game_name)
    tag_line_regex = _safe_prefix_regex(tag_line)
    if game_name_regex:
        players_query["gameName"] = game_name_regex
    if tag_line_regex:
        players_query["tagLine"] = tag_line_regex

    analytics_match: dict[str, Any] = {}
    if game_name_regex:
        analytics_match["players.gameName"] = game_name_regex
    if tag_line_regex:
        analytics_match["players.tagLine"] = tag_line_regex

    pipeline: list[dict[str, Any]] = [
        {"$match": analytics_match},
        {"$sort": {"matchInfo.gameStartMillis": -1}},
        {"$unwind": "$players"},
    ]

    unwind_match: dict[str, Any] = {}
    if game_name_regex:
        unwind_match["players.gameName"] = game_name_regex
    if tag_line_regex:
        unwind_match["players.tagLine"] = tag_line_regex
    if unwind_match:
        pipeline.append({"$match": unwind_match})

    pipeline.extend([
        {
            "$group": {
                "_id": "$players.puuid",
                "puuid": {"$first": "$players.puuid"},
                "gameName": {"$first": "$players.gameName"},
                "tagLine": {"$first": "$players.tagLine"},
                "accountLevel": {"$first": "$players.accountLevel"},
                "lastMatchStartMillis": {"$first": "$matchInfo.gameStartMillis"},
                "lastMatchDurationMillis": {"$first": "$matchInfo.gameLengthMillis"},
            }
        },
        {"$sort": {"lastMatchStartMillis": -1}},
        {"$limit": limit},
        {
            "$project": {
                "_id": 0,
                "puuid": 1,
                "gameName": {"$ifNull": ["$gameName", "Unknown"]},
                "tagLine": {"$ifNull": ["$tagLine", ""]},
                "accountLevel": {"$ifNull": ["$accountLevel", None]},
                "lastMatchStartMillis": {"$ifNull": ["$lastMatchStartMillis", None]},
                "lastMatchDurationMillis": {"$ifNull": ["$lastMatchDurationMillis", None]},
            }
        },
    ])

    results = list(matches_collection.aggregate(pipeline, maxTimeMS=QUERY_MAX_TIME_MS))
    seen_puuids = {row.get("puuid") for row in results if row.get("puuid")}

    if len(results) < limit:
        fallback_cursor = players_collection.find(
            players_query,
            {"_id": 0, "puuid": 1, "gameName": 1, "tagLine": 1, "accountLevel": 1},
        ).limit(limit).max_time_ms(QUERY_MAX_TIME_MS)

        for fallback in fallback_cursor:
            puuid = fallback.get("puuid")
            if not puuid or puuid in seen_puuids:
                continue
            results.append({
                "puuid": puuid,
                "gameName": fallback.get("gameName") or "Unknown",
                "tagLine": fallback.get("tagLine") or "",
                "accountLevel": fallback.get("accountLevel"),
                "lastMatchStartMillis": None,
                "lastMatchDurationMillis": None,
            })
            seen_puuids.add(puuid)
            if len(results) >= limit:
                break

    return results[:limit]


def find_by_puuid(puuid: str) -> Optional[dict[str, Any]]:
    """Return a single player document, or None."""
    return players_collection.find_one({"puuid": puuid}, {"_id": 0}, max_time_ms=QUERY_MAX_TIME_MS)


def aggregate_player_overview(player_docs: list[dict]) -> dict:
    """Aggregate numeric overview metrics across a list of player-match docs."""
    totals: dict[str, float] = {}

    for doc in player_docs:
        overview = doc.get("overview", {})
        if not isinstance(overview, dict):
            continue
        for key, value in overview.items():
            if isinstance(value, (int, float)):
                totals[key] = totals.get(key, 0.0) + float(value)

    matches = len(player_docs)
    rounds = int(totals.get("rounds", 0))
    deaths = max(float(totals.get("deaths", 0)), 1.0)

    totals["matches"] = float(matches)
    totals["kd_ratio"] = round(float(totals.get("kills", 0)) / deaths, 4)
    totals["win_rate"] = round((float(totals.get("wins", 0)) / rounds) * 100.0, 2) if rounds else 0.0
    totals["acs"] = round(float(totals.get("score", 0)) / rounds, 2) if rounds else 0.0
    totals["adr"] = round(float(totals.get("damage_dealt", 0)) / rounds, 2) if rounds else 0.0

    normalized: dict[str, int | float] = {}
    for key, value in totals.items():
        normalized[key] = int(value) if float(value).is_integer() else value
    return normalized


def find_ranked_matches_for_player(puuid: str) -> list[dict[str, Any]]:
    """Return ranked match sub-documents for a player with embedded analytics."""
    matches_cursor = matches_collection.find(
        {"players.puuid": puuid, "matchInfo.isRanked": True},
    ).sort("matchInfo.gameStartMillis", -1).max_time_ms(QUERY_MAX_TIME_MS)

    player_docs: list[dict[str, Any]] = []
    for match_obj in matches_cursor:
        match_info = match_obj.get("matchInfo") or {}
        for p in match_obj.get("players", []) or []:
            if p.get("puuid") != puuid:
                continue
            analytics = p.get("analytics")
            if not analytics:
                continue
            player_docs.append({
                "match_id": str(match_info.get("matchId") or ""),
                "won_match": analytics.get("won_match"),
                "is_ranked": match_info.get("isRanked", True),
                "queue_id": match_info.get("queueId"),
                "game_mode": match_info.get("gameMode"),
                "region": match_info.get("region"),
                "game_start_millis": match_info.get("gameStartMillis"),
                "season_id": str(match_info.get("seasonId") or "UNKNOWN"),
                "map_id": str(match_info.get("mapId") or "UNKNOWN"),
                "map_name": analytics.get("map_name"),
                "agent_id": str(p.get("characterId") or "UNKNOWN"),
                "agent_name": analytics.get("agent_name"),
                "overview": analytics.get("overview"),
                "role": analytics.get("role"),
                "competitive_tier": p.get("competitiveTier"),
                "account_level": p.get("accountLevel"),
                "player_totals_from_match": {
                    "kills": int((p.get("stats") or {}).get("kills", 0) or 0),
                    "deaths": int((p.get("stats") or {}).get("deaths", 0) or 0),
                    "assists": int((p.get("stats") or {}).get("assists", 0) or 0),
                    "score": int((p.get("stats") or {}).get("score", 0) or 0),
                    "rounds_played": int((p.get("stats") or {}).get("roundsPlayed", 0) or 0),
                },
            })
            break

    return player_docs


def find_raw_by_puuid(puuid: str) -> Optional[dict[str, Any]]:
    """Return player document including _id for internal processing."""
    return players_collection.find_one({"puuid": puuid}, max_time_ms=QUERY_MAX_TIME_MS)


def insert_player(doc: dict[str, Any]) -> None:
    """Insert a new player document."""
    players_collection.insert_one(doc)


def update_player(puuid: str, update: dict[str, Any]) -> None:
    """Update player fields by puuid."""
    players_collection.update_one({"puuid": puuid}, {"$set": update})
