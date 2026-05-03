from __future__ import annotations

from datetime import datetime
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from infrastructure.mongo_client import players_collection, users_collection

QUERY_MAX_TIME_MS = 3_000


class UserConflictError(ValueError):
    """Raised when unique user constraints are violated."""


def find_player_by_puuid(puuid: str) -> dict[str, Any] | None:
    return players_collection.find_one(
        {"puuid": puuid},
        {"_id": 0, "puuid": 1, "gameName": 1, "tagLine": 1},
        max_time_ms=QUERY_MAX_TIME_MS,
    )


def find_user_by_email(email: str) -> dict[str, Any] | None:
    return users_collection.find_one(
        {"email": email},
        max_time_ms=QUERY_MAX_TIME_MS,
    )


def find_user_by_puuid(puuid: str) -> dict[str, Any] | None:
    return users_collection.find_one(
        {"puuid": puuid},
        max_time_ms=QUERY_MAX_TIME_MS,
    )


def find_user_by_id(user_id: str) -> dict[str, Any] | None:
    try:
        object_id = ObjectId(user_id)
    except Exception:
        return None
    return users_collection.find_one(
        {"_id": object_id},
        max_time_ms=QUERY_MAX_TIME_MS,
    )


def insert_user(user_doc: dict[str, Any]) -> dict[str, Any]:
    try:
        result = users_collection.insert_one(user_doc)
    except DuplicateKeyError as exc:
        raise UserConflictError("Email o jugador ya asociado") from exc

    created = dict(user_doc)
    created["_id"] = result.inserted_id
    return created


def update_last_login(user_id: ObjectId, last_login_at: datetime) -> None:
    users_collection.update_one(
        {"_id": user_id},
        {"$set": {"lastLoginAt": last_login_at}},
    )
