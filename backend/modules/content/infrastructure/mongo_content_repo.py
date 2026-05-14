"""MongoDB queries for the content collection — no transformation logic."""

from functools import lru_cache
import hashlib
import re

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


def find_leaderboard(act_id: str, region: str = "eu", platform: str = "pc") -> dict | None:
    query = {"act_id": act_id, "region": region.upper(), "platform": platform.lower()}
    entry = leaderboards_collection.find_one(query, sort=[("_id", -1)])
    if entry or platform.lower() != "pc":
        return entry

    return leaderboards_collection.find_one(
        {"act_id": act_id, "region": region.upper(), "platform": {"$exists": False}},
        sort=[("_id", -1)],
    )


def find_previous_leaderboard(act_id: str, region: str = "eu", platform: str = "pc", current_id=None) -> dict | None:
    platform_norm = platform.lower()
    query = {"act_id": act_id, "region": region.upper(), "platform": platform_norm}
    if platform_norm == "pc":
        query = {
            "act_id": act_id,
            "region": region.upper(),
            "$or": [{"platform": platform_norm}, {"platform": {"$exists": False}}],
        }
    if current_id is not None:
        query["_id"] = {"$lt": current_id}
    return leaderboards_collection.find_one(query, sort=[("_id", -1)])


def get_leaderboard_regions() -> list[str]:
    return sorted(
        region for region in leaderboards_collection.distinct("region")
        if isinstance(region, str) and region.strip()
    )


def get_leaderboard_platforms() -> list[str]:
    platforms = {
        platform.lower()
        for platform in leaderboards_collection.distinct("platform")
        if isinstance(platform, str) and platform.strip()
    }
    if leaderboards_collection.count_documents({"platform": {"$exists": False}}, limit=1):
        platforms.add("pc")
    return sorted(platforms)


def get_rank_distribution_for_acts(act_ids: list[str]) -> list[dict]:
    clean_ids = [act_id for act_id in act_ids if isinstance(act_id, str) and act_id.strip()]
    if not clean_ids:
        return []
    pipeline = [
        {"$match": {"matchInfo.seasonId": {"$in": clean_ids}}},
        {"$unwind": "$players"},
        {"$match": {"players.competitiveTier": {"$type": "number", "$gte": 3}}},
        {"$group": {"_id": "$players.competitiveTier", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    rows = list(matches_collection.aggregate(pipeline, maxTimeMS=5000))
    total = sum(int(row.get("count") or 0) for row in rows)
    return [
        {
            "tier": int(row["_id"]),
            "count": int(row.get("count") or 0),
            "percentage": round((int(row.get("count") or 0) / total) * 100, 2) if total else 0,
        }
        for row in rows
        if row.get("_id") is not None
    ]


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


def local_player_card_icon(card_id: str | None) -> str | None:
    if not card_id:
        return None
    return f"/content/playercards/{card_id}/smallArt.png"


def fallback_player_card_icon(seed: str | None) -> str | None:
    doc = get_latest_content(("playercards",))
    playercards = [
        card
        for card in doc.get("playercards", []) or []
        if card.get("uuid") or card.get("id")
    ]
    if not playercards:
        return None

    digest = hashlib.sha256((seed or "unknown-player").encode("utf-8")).digest()
    index = int.from_bytes(digest[:4], "big") % len(playercards)
    card_id = playercards[index].get("uuid") or playercards[index].get("id")
    return local_player_card_icon(card_id)


def find_local_leaderboard_players(players: list[dict]) -> dict[str, dict]:
    lookups: list[tuple[str, str, str]] = []
    for player in players:
        game_name = str(player.get("gameName") or "").strip()
        tag_line = str(player.get("tagLine") or "").strip()
        if not game_name or not tag_line:
            continue
        key = f"{game_name.lower()}#{tag_line.lower()}"
        lookups.append((key, game_name, tag_line))

    if not lookups:
        return {}

    by_key: dict[str, dict] = {}
    player_or = [
        {
            "gameName": {"$regex": f"^{re.escape(game_name)}$", "$options": "i"},
            "tagLine": {"$regex": f"^{re.escape(tag_line)}$", "$options": "i"},
        }
        for _, game_name, tag_line in lookups
    ]

    for player in players_collection.find(
        {"$or": player_or},
        {"_id": 0, "puuid": 1, "gameName": 1, "tagLine": 1, "playerCard": 1, "playerCardId": 1},
    ):
        key = f"{str(player.get('gameName') or '').lower()}#{str(player.get('tagLine') or '').lower()}"
        card_id = player.get("playerCard") or player.get("playerCardId")
        puuid = player.get("puuid")
        by_key[key] = {
            "puuid": puuid,
            "hasProfile": bool(puuid),
            "playerCardIcon": local_player_card_icon(card_id),
        }

    missing = [(key, game_name, tag_line) for key, game_name, tag_line in lookups if key not in by_key]
    if not missing:
        return by_key

    match_or = [
        {
            "players.gameName": {"$regex": f"^{re.escape(game_name)}$", "$options": "i"},
            "players.tagLine": {"$regex": f"^{re.escape(tag_line)}$", "$options": "i"},
        }
        for _, game_name, tag_line in missing
    ]
    pipeline = [
        {"$match": {"$or": match_or}},
        {"$sort": {"matchInfo.gameStartMillis": -1}},
        {"$unwind": "$players"},
        {"$match": {"$or": match_or}},
        {
            "$group": {
                "_id": "$players.puuid",
                "puuid": {"$first": "$players.puuid"},
                "gameName": {"$first": "$players.gameName"},
                "tagLine": {"$first": "$players.tagLine"},
                "playerCard": {"$first": "$players.playerCard"},
                "playerCardId": {"$first": "$players.playerCardId"},
                "identityPlayerCard": {"$first": "$players.identity.playerCard"},
            }
        },
        {"$limit": len(missing)},
    ]

    for player in matches_collection.aggregate(pipeline, maxTimeMS=3000):
        key = f"{str(player.get('gameName') or '').lower()}#{str(player.get('tagLine') or '').lower()}"
        card_id = player.get("playerCard") or player.get("playerCardId") or player.get("identityPlayerCard")
        puuid = player.get("puuid")
        by_key[key] = {
            "puuid": puuid,
            "hasProfile": bool(puuid),
            "playerCardIcon": local_player_card_icon(card_id),
        }

    return by_key


def get_all_regions() -> list[dict]:
    return list(db.regions.find({}, {"_id": 0}))
