import os
from threading import Lock

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

DB_URI = os.getenv("DB_URI")
DB_NAME = os.getenv("DB_NAME")

if not DB_URI or not DB_NAME:
    raise ValueError("Missing required environment variables: DB_URI or DB_NAME")

_is_localhost = "localhost" in DB_URI or "127.0.0.1" in DB_URI
_index_lock = Lock()
_indexes_ready = False

connect_kwargs: dict = {
    "serverSelectionTimeoutMS": 5000,
    "connect": False,
}
if not _is_localhost:
    connect_kwargs["tls"] = True

client = MongoClient(DB_URI, **connect_kwargs)
db = client[DB_NAME]

players_collection = db["players"]
matches_collection = db["matches"]
content_collection = db["content"]
leaderboards_collection = db["leaderboards"]
regions_collection = db["regions"]
users_collection = db["users"]


def _index_exists(collection, key_spec) -> bool:
    if isinstance(key_spec, str):
        desired = {key_spec: 1}
    elif isinstance(key_spec, tuple) and len(key_spec) == 2 and isinstance(key_spec[0], str):
        desired = {key_spec[0]: key_spec[1]}
    else:
        try:
            desired = {k: v for k, v in key_spec}
        except Exception:
            try:
                desired = {k: 1 for k in key_spec}
            except Exception as exc:
                raise ValueError(f"Unsupported key_spec format: {key_spec!r}") from exc

    for idx in collection.list_indexes():
        if dict(idx["key"]) == desired:
            return True
    return False


def ensure_indexes() -> None:
    """Ping MongoDB and create required indexes once, outside import time."""
    global _indexes_ready
    with _index_lock:
        if _indexes_ready:
            return

        client.admin.command("ping")

        if not _index_exists(players_collection, "puuid"):
            players_collection.create_index("puuid", unique=True)
        if not _index_exists(players_collection, [("gameName", 1), ("tagLine", 1)]):
            players_collection.create_index([("gameName", 1), ("tagLine", 1)])

        if not _index_exists(matches_collection, ("matchInfo.matchId", 1)):
            matches_collection.create_index("matchInfo.matchId", unique=True)
        if not _index_exists(
            matches_collection,
            [("players.puuid", 1), ("matchInfo.matchId", 1), ("matchInfo.mapId", 1)],
        ):
            matches_collection.create_index([
                ("players.puuid", 1),
                ("matchInfo.matchId", 1),
                ("matchInfo.mapId", 1),
            ])
        if not _index_exists(
            matches_collection,
            [("players.puuid", 1), ("matchInfo.gameStartMillis", -1)],
        ):
            matches_collection.create_index([
                ("players.puuid", 1),
                ("matchInfo.gameStartMillis", -1),
            ])
        if not _index_exists(
            matches_collection,
            [
                ("players.puuid", 1),
                ("matchInfo.isRanked", 1),
                ("matchInfo.mapId", 1),
                ("matchInfo.seasonId", 1),
            ],
        ):
            matches_collection.create_index([
                ("players.puuid", 1),
                ("matchInfo.isRanked", 1),
                ("matchInfo.mapId", 1),
                ("matchInfo.seasonId", 1),
            ])
        if not _index_exists(
            matches_collection,
            [
                ("matchInfo.isRanked", 1),
                ("matchInfo.seasonId", 1),
                ("matchInfo.queueId", 1),
                ("matchInfo.gameStartMillis", -1),
            ],
        ):
            matches_collection.create_index([
                ("matchInfo.isRanked", 1),
                ("matchInfo.seasonId", 1),
                ("matchInfo.queueId", 1),
                ("matchInfo.gameStartMillis", -1),
            ])
        if not _index_exists(
            matches_collection,
            [("matchInfo.isRanked", 1), ("matchInfo.mapId", 1), ("matchInfo.seasonId", 1)],
        ):
            matches_collection.create_index([
                ("matchInfo.isRanked", 1),
                ("matchInfo.mapId", 1),
                ("matchInfo.seasonId", 1),
            ])
        if not _index_exists(
            matches_collection,
            [
                ("players.puuid", 1),
                ("players.characterId", 1),
                ("matchInfo.isRanked", 1),
                ("matchInfo.mapId", 1),
            ],
        ):
            matches_collection.create_index([
                ("players.puuid", 1),
                ("players.characterId", 1),
                ("matchInfo.isRanked", 1),
                ("matchInfo.mapId", 1),
            ])

        if not _index_exists(regions_collection, "region"):
            regions_collection.create_index("region", unique=True)

        if not _index_exists(users_collection, "email"):
            users_collection.create_index("email", unique=True)
        if not _index_exists(users_collection, "puuid"):
            users_collection.create_index("puuid", unique=True)

        _indexes_ready = True
