from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from modules.auth.infrastructure import mongo_auth_repo
from modules.auth.infrastructure.security import (
    InvalidTokenError,
    decode_access_token,
    hash_password,
    verify_password,
)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def _now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_email(email: str) -> str:
    normalized = normalize_email(email)
    if len(normalized) > 254 or not EMAIL_RE.match(normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email no valido",
        )
    return normalized


def validate_password(password: str) -> None:
    if not isinstance(password, str) or not (
        MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contrasena debe tener entre 8 y 128 caracteres",
        )


def validate_puuid(puuid: str) -> str:
    normalized = puuid.strip()
    if not normalized or len(normalized) > 128:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PUUID no valido",
        )
    return normalized


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user.get("_id", "")),
        "email": user.get("email", ""),
        "puuid": user.get("puuid", ""),
        "gameName": user.get("gameName", ""),
        "tagLine": user.get("tagLine", ""),
        "createdAt": user.get("createdAt"),
        "lastLoginAt": user.get("lastLoginAt"),
    }


def register_user(email: str, password: str, puuid: str) -> dict[str, Any]:
    normalized_email = validate_email(email)
    validate_password(password)
    normalized_puuid = validate_puuid(puuid)

    player = mongo_auth_repo.find_player_by_puuid(normalized_puuid)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El jugador seleccionado no existe",
        )

    if mongo_auth_repo.find_user_by_email(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya esta registrado",
        )
    if mongo_auth_repo.find_user_by_puuid(normalized_puuid):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este jugador ya esta asociado a otra cuenta",
        )

    now = _now()
    user_doc = {
        "email": normalized_email,
        "password_hash": hash_password(password),
        "puuid": normalized_puuid,
        "gameName": player.get("gameName") or "Unknown",
        "tagLine": player.get("tagLine") or "",
        "favorites": [],
        "recentPlayers": [],
        "frequentPlayers": {},
        "createdAt": now,
        "lastLoginAt": now,
    }

    try:
        created = mongo_auth_repo.insert_user(user_doc)
    except mongo_auth_repo.UserConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email o jugador ya asociado",
        ) from None

    return created


def login_user(email: str, password: str) -> dict[str, Any]:
    normalized_email = validate_email(email)
    user = mongo_auth_repo.find_user_by_email(normalized_email)
    if not user or not verify_password(password, str(user.get("password_hash", ""))):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    last_login_at = _now()
    user_id = user.get("_id")
    if isinstance(user_id, ObjectId):
        mongo_auth_repo.update_last_login(user_id, last_login_at)
    user["lastLoginAt"] = last_login_at
    return user


def get_user_from_token(token: str | None) -> dict[str, Any]:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No hay sesion activa",
        )

    try:
        payload = decode_access_token(token)
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion no valida",
        ) from None

    user = mongo_auth_repo.find_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesion no valida",
        )
    return user
