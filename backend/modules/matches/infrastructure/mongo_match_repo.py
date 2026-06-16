"""MongoDB repository for match documents."""
from __future__ import annotations

import copy
from typing import Any, Optional

from infrastructure.mongo_client import matches_collection


def list_recent(limit: int = 20) -> list[dict[str, Any]]:
    """Return the most recent matches, newest first."""
    cursor = (
        matches_collection.find({}, {"_id": 0})
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    return list(cursor)


def list_training_matches(limit: int = 10000) -> list[dict[str, Any]]:
    """Return ranked matches with round economy for offline model training."""
    cursor = (
        matches_collection.find(
            {"matchInfo.isRanked": True, "roundResults.playerStats.economy": {"$exists": True}},
            {"_id": 0},
        )
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    return list(cursor)


def find_by_id(match_id: str) -> Optional[dict[str, Any]]:
    """Return a single match document by matchInfo.matchId, or None."""
    return matches_collection.find_one(
        {"matchInfo.matchId": match_id}, {"_id": 0}
    )


def find_by_player(puuid: str, *, limit: int = 50) -> list[dict[str, Any]]:
    """Return matches involving a player, newest first."""
    cursor = (
        matches_collection.find(
            {"players.puuid": puuid},
            {"_id": 0},
        )
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    return list(cursor)


def find_raw_by_match_id(match_id: str) -> Optional[dict[str, Any]]:
    """Return a single match document (including _id) for internal processing."""
    return matches_collection.find_one({"matchInfo.matchId": match_id})


def insert(match_obj: dict[str, Any]) -> bool:
    """Insert a match document. Returns True on success, False on duplicate."""
    try:
        matches_collection.insert_one(copy.deepcopy(match_obj))
        return True
    except Exception as exc:
        if "duplicate key" in str(exc).lower() or "E11000" in str(exc):
            return False
        raise


def set_player_analytics(match_id: str, puuid: str, analytics: dict[str, Any]) -> None:
    """Embed analytics for a single player in the match document."""
    matches_collection.update_one(
        {"matchInfo.matchId": match_id, "players.puuid": puuid},
        {"$set": {"players.$.analytics": analytics}},
    )
