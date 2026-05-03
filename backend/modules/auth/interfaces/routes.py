from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Cookie, Response
from pydantic import BaseModel, Field

from config import settings
from modules.auth.application.auth_service import (
    get_user_from_token,
    login_user,
    public_user,
    register_user,
)
from modules.auth.infrastructure.security import create_access_token

router = APIRouter()

COOKIE_NAME = "access_token"


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    puuid: str = Field(..., min_length=1, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


def _set_session_cookie(response: Response, user_id: str) -> None:
    token = create_access_token(
        user_id,
        expires_delta=timedelta(minutes=settings.JWT_EXPIRES_MINUTES),
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="lax",
    )


@router.post("/register")
def register(payload: RegisterRequest, response: Response):
    user = register_user(payload.email, payload.password, payload.puuid)
    session_user = public_user(user)
    _set_session_cookie(response, session_user["id"])
    return session_user


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    user = login_user(payload.email, payload.password)
    session_user = public_user(user)
    _set_session_cookie(response, session_user["id"])
    return session_user


@router.get("/me")
def me(access_token: str | None = Cookie(default=None)):
    return public_user(get_user_from_token(access_token))


@router.post("/logout")
def logout(response: Response):
    _clear_session_cookie(response)
    return {"ok": True}
