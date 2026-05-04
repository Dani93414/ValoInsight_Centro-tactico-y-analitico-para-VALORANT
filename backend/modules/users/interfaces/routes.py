from __future__ import annotations

from fastapi import APIRouter, Cookie, HTTPException, status

from modules.auth.application.auth_service import get_user_from_token
from modules.users.infrastructure import mongo_user_repo

router = APIRouter()


def _current_user(access_token: str | None) -> dict:
    return get_user_from_token(access_token)


def _validate_puuid(puuid: str) -> str:
    normalized = puuid.strip()
    if not normalized or len(normalized) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PUUID no valido",
        )
    return normalized


@router.get("/me/favorites")
def get_favorites(access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    favorite_puuids = mongo_user_repo.get_favorite_puuids(user)
    return mongo_user_repo.enrich_players(favorite_puuids, limit=50)


@router.post("/me/favorites/{puuid}")
def add_favorite(puuid: str, access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    normalized_puuid = _validate_puuid(puuid)
    mongo_user_repo.add_favorite(user, normalized_puuid)
    return {"ok": True}


@router.delete("/me/favorites/{puuid}")
def remove_favorite(puuid: str, access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    normalized_puuid = _validate_puuid(puuid)
    mongo_user_repo.remove_favorite(user, normalized_puuid)
    return {"ok": True}


@router.get("/me/recent")
def get_recent_players(access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    recent_entries = mongo_user_repo.get_recent_entries(user)
    puuids = [entry["puuid"] for entry in recent_entries]
    return mongo_user_repo.enrich_players(puuids, limit=20)


@router.post("/me/recent/{puuid}")
def add_recent_player(puuid: str, access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    normalized_puuid = _validate_puuid(puuid)
    mongo_user_repo.add_recent_player(user, normalized_puuid)
    return {"ok": True}


@router.get("/me/frequent")
def get_frequent_players(access_token: str | None = Cookie(default=None)):
    user = _current_user(access_token)
    return mongo_user_repo.get_frequent_players(user, limit=20)
