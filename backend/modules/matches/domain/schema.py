"""Schema-v1/v2 compatibility and RAW-refresh policy in one place."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

NEW = "NEW"
UP_TO_DATE = "UP_TO_DATE"
LEGACY_CANDIDATE = "LEGACY_CANDIDATE"
REFRESH_FAILED_PREVIOUSLY = "REFRESH_FAILED_PREVIOUSLY"


def get_schema_version(match: dict[str, Any] | None) -> int:
    schema = (match or {}).get("dataSchema") or {}
    try:
        return int(schema.get("version", 1))
    except (TypeError, ValueError):
        return 1


def get_performance_score(player: dict[str, Any] | None) -> float | None:
    value = ((player or {}).get("performance") or {}).get("score")
    return float(value) if isinstance(value, (int, float)) else None


def get_round_economy(player_stat: dict[str, Any] | None) -> dict[str, Any]:
    return ((player_stat or {}).get("economy") or {})


def get_first_blood(round_result: dict[str, Any] | None) -> str | None:
    return (round_result or {}).get("firstBloodPlayer")


def needs_riot_raw_refresh(match: dict[str, Any] | None, *, force: bool = False, missing_performance: bool = False) -> bool:
    if not match:
        return True
    if force:
        return True
    refresh = match.get("rawRefresh") or {}
    if refresh.get("status") in {"not_available", "permanent_error"}:
        return False
    if get_schema_version(match) < 2 or (match.get("dataSchema") or {}).get("source") != "riot_raw":
        return True
    if missing_performance:
        return any(not ((player.get("performance") or {}).get("available")) for player in (match.get("players") or []))
    return False


def classify_match(match: dict[str, Any] | None, *, force: bool = False, missing_performance: bool = False) -> str:
    if not match:
        return NEW
    refresh = match.get("rawRefresh") or {}
    if not force and refresh.get("status") in {"not_available", "permanent_error"}:
        return REFRESH_FAILED_PREVIOUSLY
    if not force and refresh.get("status") == "temporary_error":
        retry_after = refresh.get("nextRetryAt")
        if retry_after:
            try:
                if datetime.fromisoformat(str(retry_after).replace("Z", "+00:00")) > datetime.now(timezone.utc):
                    return REFRESH_FAILED_PREVIOUSLY
            except ValueError:
                # A malformed historic stamp must never strand a match forever.
                pass
    return LEGACY_CANDIDATE if needs_riot_raw_refresh(match, force=force, missing_performance=missing_performance) else UP_TO_DATE


def refresh_stamp(status: str, *, source: str = "riot_raw", retry_after_seconds: int = 300) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    result = {"lastAttemptAt": now, "status": status, "source": source}
    if status == "success":
        result["lastSuccessAt"] = now
    elif status == "temporary_error":
        result["nextRetryAt"] = (datetime.now(timezone.utc) + timedelta(seconds=max(1, retry_after_seconds))).isoformat()
    return result
