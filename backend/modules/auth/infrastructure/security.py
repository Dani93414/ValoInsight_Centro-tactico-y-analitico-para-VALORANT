from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import timedelta
from typing import Any

from config import settings

PASSWORD_ALGORITHM = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 390_000
JWT_ALGORITHM = "HS256"


class InvalidTokenError(ValueError):
    """Raised when a JWT cannot be trusted."""


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return (
        f"{PASSWORD_ALGORITHM}${PASSWORD_ITERATIONS}$"
        f"{salt.hex()}${password_hash.hex()}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, hash_hex = stored_hash.split("$", 3)
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)
    except (AttributeError, TypeError, ValueError):
        return False

    if algorithm != PASSWORD_ALGORITHM:
        return False

    actual_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual_hash, expected_hash)


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(message: str) -> str:
    digest = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        message.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return _base64url_encode(digest)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    now = int(time.time())
    expires_in = expires_delta or timedelta(minutes=settings.JWT_EXPIRES_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + int(expires_in.total_seconds()),
    }
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    encoded_header = _base64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _base64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{encoded_header}.{encoded_payload}"
    return f"{signing_input}.{_sign(signing_input)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, signature = token.split(".", 2)
        signing_input = f"{encoded_header}.{encoded_payload}"
        if not hmac.compare_digest(signature, _sign(signing_input)):
            raise InvalidTokenError("Invalid token signature")

        header = json.loads(_base64url_decode(encoded_header))
        if header.get("alg") != JWT_ALGORITHM:
            raise InvalidTokenError("Unsupported token algorithm")

        payload = json.loads(_base64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise InvalidTokenError("Invalid token") from exc

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        raise InvalidTokenError("Expired token")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise InvalidTokenError("Invalid token subject")

    return payload
