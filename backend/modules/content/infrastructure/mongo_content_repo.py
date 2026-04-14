"""MongoDB queries for the content collection — no transformation logic."""

from functools import lru_cache

from infrastructure.mongo_client import (
    content_collection,
    leaderboards_collection,
    players_collection,
    matches_collection,
    db,
)


@lru_cache(maxsize=32)
def get_latest_content(projected_fields: tuple[str, ...]) -> dict:
    import copy

    projection = {field: 1 for field in projected_fields}
    projection["_id"] = 0

    doc = (
        content_collection.find_one(
            {"type": "valorant_content"},
            sort=[("_id", -1)],
            projection=projection,
        )
        or {}
    )
    return copy.deepcopy(doc)


def get_raw_latest() -> dict:
    return content_collection.find_one({}, sort=[("_id", -1)]) or {}


def find_leaderboard(act_id: str, region: str = "eu") -> dict | None:
    return leaderboards_collection.find_one(
        {"act_id": act_id, "region": region.upper()}
    )


def find_player_by_puuid(puuid: str) -> dict | None:
    return players_collection.find_one({"puuid": puuid}, {"_id": 0})


def find_matches_by_player(puuid: str, limit: int = 10) -> list[dict]:
    direct_cursor = (
        matches_collection.find({"players.puuid": puuid}, {"_id": 0})
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    direct_matches = list(direct_cursor)
    if direct_matches:
        return direct_matches

    player = players_collection.find_one({"puuid": puuid})
    if not player or "matches" not in player:
        return []

    match_ids = player["matches"][-limit:]
    partidas = (
        matches_collection.find(
            {"matchInfo.matchId": {"$in": match_ids}},
            {"_id": 0},
        )
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
    )
    return list(partidas)


def get_all_regions() -> list[dict]:
    return list(db.regions.find({}, {"_id": 0}))
