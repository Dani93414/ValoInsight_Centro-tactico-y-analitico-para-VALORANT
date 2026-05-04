from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from infrastructure.mongo_client import matches_collection, players_collection, users_collection

QUERY_MAX_TIME_MS = 3_000
MAX_RECENT_PLAYERS = 20


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _user_id(user: dict[str, Any]) -> ObjectId | None:
    user_id = user.get("_id")
    return user_id if isinstance(user_id, ObjectId) else None


def _display_name(player: dict[str, Any]) -> str:
    game_name = player.get("gameName") or "Unknown"
    tag_line = player.get("tagLine") or ""
    return f"{game_name}#{tag_line}" if tag_line else game_name


def _project_player(player: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    puuid = player.get("puuid") or player.get("_id") or ""
    payload = {
        "id": puuid,
        "puuid": puuid,
        "gameName": player.get("gameName") or "Unknown",
        "tagLine": player.get("tagLine") or "",
        "displayName": _display_name(player),
        "accountLevel": player.get("accountLevel"),
        "lastMatchStartMillis": player.get("lastMatchStartMillis"),
        "lastMatchDurationMillis": player.get("lastMatchDurationMillis"),
        "lastCompetitiveTier": player.get("lastCompetitiveTier"),
        "lastCompetitiveTierImage": player.get("lastCompetitiveTierImage"),
    }
    if extra:
        payload.update(extra)
    return payload


def _ordered_unique_puuids(puuids: Iterable[str], limit: int = 50) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for puuid in puuids:
        if not isinstance(puuid, str):
            continue
        normalized = puuid.strip()
        if not normalized or normalized in seen:
            continue
        ordered.append(normalized)
        seen.add(normalized)
        if len(ordered) >= limit:
            break
    return ordered


def enrich_players(
    puuids: Iterable[str],
    *,
    extras_by_puuid: dict[str, dict[str, Any]] | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    ordered_puuids = _ordered_unique_puuids(puuids, limit=limit)
    if not ordered_puuids:
        return []

    pipeline: list[dict[str, Any]] = [
        {"$match": {"players.puuid": {"$in": ordered_puuids}}},
        {"$sort": {"matchInfo.gameStartMillis": -1}},
        {"$unwind": "$players"},
        {"$match": {"players.puuid": {"$in": ordered_puuids}}},
        {
            "$group": {
                "_id": "$players.puuid",
                "puuid": {"$first": "$players.puuid"},
                "gameName": {"$first": "$players.gameName"},
                "tagLine": {"$first": "$players.tagLine"},
                "accountLevel": {"$first": "$players.accountLevel"},
                "lastMatchStartMillis": {"$first": "$matchInfo.gameStartMillis"},
                "lastMatchDurationMillis": {"$first": "$matchInfo.gameLengthMillis"},
                "lastCompetitiveTier": {"$first": "$players.competitiveTier"},
                "lastCompetitiveTierImage": {"$first": "$players.competitiveTierImage"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "puuid": 1,
                "gameName": {"$ifNull": ["$gameName", "Unknown"]},
                "tagLine": {"$ifNull": ["$tagLine", ""]},
                "accountLevel": {"$ifNull": ["$accountLevel", None]},
                "lastMatchStartMillis": {"$ifNull": ["$lastMatchStartMillis", None]},
                "lastMatchDurationMillis": {"$ifNull": ["$lastMatchDurationMillis", None]},
                "lastCompetitiveTier": {"$ifNull": ["$lastCompetitiveTier", None]},
                "lastCompetitiveTierImage": {"$ifNull": ["$lastCompetitiveTierImage", None]},
            }
        },
    ]

    latest_players = {
        row["puuid"]: row
        for row in matches_collection.aggregate(pipeline, maxTimeMS=QUERY_MAX_TIME_MS)
        if row.get("puuid")
    }

    missing = [puuid for puuid in ordered_puuids if puuid not in latest_players]
    if missing:
        cursor = players_collection.find(
            {"puuid": {"$in": missing}},
            {"_id": 0, "puuid": 1, "gameName": 1, "tagLine": 1, "accountLevel": 1},
            max_time_ms=QUERY_MAX_TIME_MS,
        )
        for player in cursor:
            puuid = player.get("puuid")
            if puuid:
                latest_players[puuid] = {
                    "puuid": puuid,
                    "gameName": player.get("gameName") or "Unknown",
                    "tagLine": player.get("tagLine") or "",
                    "accountLevel": player.get("accountLevel"),
                    "lastMatchStartMillis": None,
                    "lastMatchDurationMillis": None,
                    "lastCompetitiveTier": None,
                    "lastCompetitiveTierImage": None,
                }

    extras_by_puuid = extras_by_puuid or {}
    return [
        _project_player(latest_players[puuid], extras_by_puuid.get(puuid))
        for puuid in ordered_puuids
        if puuid in latest_players
    ]


def get_favorite_puuids(user: dict[str, Any]) -> list[str]:
    return _ordered_unique_puuids(user.get("favorites") or [], limit=100)


def add_favorite(user: dict[str, Any], puuid: str) -> None:
    user_id = _user_id(user)
    if not user_id:
        return
    users_collection.update_one({"_id": user_id}, {"$addToSet": {"favorites": puuid}})


def remove_favorite(user: dict[str, Any], puuid: str) -> None:
    user_id = _user_id(user)
    if not user_id:
        return
    users_collection.update_one({"_id": user_id}, {"$pull": {"favorites": puuid}})


def get_recent_entries(user: dict[str, Any]) -> list[dict[str, Any]]:
    entries = user.get("recentPlayers") or []
    if not isinstance(entries, list):
        return []
    normalized = [
        entry for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("puuid"), str)
    ]
    def viewed_at_timestamp(entry: dict[str, Any]) -> float:
        viewed_at = entry.get("viewedAt")
        if isinstance(viewed_at, datetime):
            return viewed_at.timestamp()
        return 0.0

    normalized.sort(key=viewed_at_timestamp, reverse=True)
    return normalized[:MAX_RECENT_PLAYERS]


def add_recent_player(user: dict[str, Any], puuid: str) -> None:
    user_id = _user_id(user)
    if not user_id:
        return

    existing = get_recent_entries(user)
    next_entries = [{"puuid": puuid, "viewedAt": _now()}]
    next_entries.extend(entry for entry in existing if entry.get("puuid") != puuid)
    users_collection.update_one(
        {"_id": user_id},
        {"$set": {"recentPlayers": next_entries[:MAX_RECENT_PLAYERS]}},
    )


def get_frequent_players(user: dict[str, Any], limit: int = 20) -> list[dict[str, Any]]:
    user_puuid = str(user.get("puuid") or "").strip()
    if not user_puuid:
        return []

    pipeline: list[dict[str, Any]] = [
        {"$match": {"players.puuid": user_puuid}},
        {"$unwind": "$players"},
        {"$match": {"players.puuid": {"$ne": user_puuid}}},
        {
            "$group": {
                "_id": "$players.puuid",
                "sharedMatches": {"$sum": 1},
            }
        },
        {"$sort": {"sharedMatches": -1, "_id": 1}},
        {"$limit": limit},
    ]
    rows = list(matches_collection.aggregate(pipeline, maxTimeMS=QUERY_MAX_TIME_MS))
    puuids = [row["_id"] for row in rows if row.get("_id")]
    extras = {
        row["_id"]: {"sharedMatches": int(row.get("sharedMatches") or 0)}
        for row in rows
        if row.get("_id")
    }
    return enrich_players(puuids, extras_by_puuid=extras, limit=limit)
