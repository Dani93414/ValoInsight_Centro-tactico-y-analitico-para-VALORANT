"""HenrikDev RAW proxy client.  This module deliberately returns Riot JSON untouched."""
from __future__ import annotations

import os
import random
import time
from email.utils import parsedate_to_datetime
from dataclasses import dataclass
from typing import Any

import requests
from dotenv import load_dotenv

from infrastructure.henrik_rate_limit import ThreadSafeRateLimiter

# The RAW client is also used by the single-match refresh utility and by
# diagnostic tools. Do not rely on the history downloader having happened to
# load the project environment first.
load_dotenv()

HENRIK_RAW_URL = "https://api.henrikdev.xyz/valorant/v1/raw"
HENRIK_V4_MATCH_URL = "https://api.henrikdev.xyz/valorant/v4/match"
DEFAULT_RPM = int(os.getenv("HENRIK_REQUESTS_PER_MINUTE", "60"))
DEFAULT_SAFETY = float(os.getenv("HENRIK_RATE_LIMIT_SAFETY_FACTOR", "1.10"))
GLOBAL_HENRIK_LIMITER = ThreadSafeRateLimiter(DEFAULT_RPM, DEFAULT_SAFETY)


class RiotRawError(RuntimeError):
    retryable = False


class RiotRawTemporaryError(RiotRawError):
    retryable = True


class RiotRawNotFound(RiotRawError):
    pass


class RiotRawBadRequest(RiotRawError):
    pass


@dataclass(frozen=True)
class RiotRawRequest:
    match_id: str
    region: str = "eu"
    platform: str = "pc"

    def body(self) -> dict[str, str]:
        # Henrik's RAW dispatcher resolves ``matchdetails`` + the match id to
        # Riot's match-details/v1/matches/{id}.  ``queries`` is intentionally
        # empty: it is reserved for query-string parameters, not an URL.
        return {
            "platform": self.platform,
            "queries": "",
            "region": self.region,
            "type": "matchdetails",
            "value": self.match_id,
        }


def _api_key() -> str:
    key = (os.getenv("HENRY_API_KEY") or os.getenv("HENRIK_API_KEY") or os.getenv("API_KEY") or "").strip()
    if not key:
        raise RiotRawBadRequest("Missing HENRY_API_KEY/HENRIK_API_KEY for Henrik RAW proxy")
    return key


def _retry_after(response: requests.Response, attempt: int) -> float:
    value = response.headers.get("Retry-After", "")
    try:
        retry_after = float(value)
    except ValueError:
        try:
            retry_after = max(0.0, (parsedate_to_datetime(value).timestamp() - time.time()))
        except (TypeError, ValueError, IndexError, OverflowError):
            retry_after = 0.0
    exponential = min(30.0, 1.5 * (2 ** (attempt - 1)))
    return max(retry_after, exponential) + random.uniform(0.0, 0.75)


def get_raw_match(
    match_id: str,
    region: str = "eu",
    platform: str = "pc",
    *,
    session: requests.Session | None = None,
    limiter: ThreadSafeRateLimiter | None = None,
    timeout: float = 45.0,
    max_retries: int = 5,
) -> dict[str, Any]:
    """Fetch a match through Henrik's RAW proxy without normalising the body."""
    if not str(match_id or "").strip():
        raise RiotRawBadRequest("match_id is required")
    request = RiotRawRequest(str(match_id).strip(), region.lower(), platform.lower())
    client = session or requests.Session()
    rate_limiter = limiter or GLOBAL_HENRIK_LIMITER
    headers = {"Authorization": _api_key(), "Accept": "application/json", "Content-Type": "application/json"}

    for attempt in range(1, max_retries + 1):
        rate_limiter.wait()
        try:
            response = client.post(HENRIK_RAW_URL, headers=headers, json=request.body(), timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as exc:
            if attempt == max_retries:
                raise RiotRawTemporaryError(f"RAW network failure for {match_id}: {exc}") from exc
            time.sleep(min(30.0, 1.5 * (2 ** (attempt - 1))) + random.uniform(0, 0.75))
            continue

        if response.status_code == 200:
            try:
                payload = response.json()
            except ValueError as exc:
                raise RiotRawTemporaryError(f"RAW returned non-JSON for {match_id}") from exc
            # Henrik envelopes most responses; Riot payload itself remains unmodified.
            return payload.get("data") if isinstance(payload, dict) and isinstance(payload.get("data"), dict) else payload
        if response.status_code == 404:
            raise RiotRawNotFound(f"RAW match not found: {match_id}")
        if response.status_code == 400:
            raise RiotRawBadRequest(f"RAW bad request for {match_id}: {response.text[:300]}")
        if response.status_code == 429 or 500 <= response.status_code <= 599:
            if attempt == max_retries:
                raise RiotRawTemporaryError(f"RAW HTTP {response.status_code} for {match_id}")
            time.sleep(_retry_after(response, attempt))
            continue
        raise RiotRawError(f"RAW HTTP {response.status_code} for {match_id}: {response.text[:300]}")
    raise RiotRawTemporaryError(f"RAW retries exhausted for {match_id}")


def get_henrik_match(
    match_id: str,
    region: str = "eu",
    *,
    session: requests.Session | None = None,
    limiter: ThreadSafeRateLimiter | None = None,
    timeout: float = 45.0,
    max_retries: int = 5,
) -> dict[str, Any]:
    """Fetch Henrik v4 match detail only for presentation metadata fallback.

    Callers must retain RAW as the owner of gameplay data.  This endpoint is
    used solely when Riot's RAW payload omitted player identity/profile fields.
    """
    if not str(match_id or "").strip():
        raise RiotRawBadRequest("match_id is required")
    client = session or requests.Session()
    rate_limiter = limiter or GLOBAL_HENRIK_LIMITER
    headers = {"Authorization": _api_key(), "Accept": "application/json"}
    url = f"{HENRIK_V4_MATCH_URL}/{str(region).lower()}/{str(match_id).strip()}"

    for attempt in range(1, max_retries + 1):
        rate_limiter.wait()
        try:
            response = client.get(url, headers=headers, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as exc:
            if attempt == max_retries:
                raise RiotRawTemporaryError(f"v4 match network failure for {match_id}: {exc}") from exc
            time.sleep(_retry_after(requests.Response(), attempt))
            continue
        if response.status_code == 200:
            try:
                payload = response.json()
            except ValueError as exc:
                raise RiotRawTemporaryError(f"v4 match returned non-JSON for {match_id}") from exc
            data = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(data, dict):
                raise RiotRawTemporaryError(f"v4 match malformed response for {match_id}")
            return data
        if response.status_code == 404:
            raise RiotRawNotFound(f"v4 match not found: {match_id}")
        if response.status_code == 400:
            raise RiotRawBadRequest(f"v4 match bad request for {match_id}: {response.text[:300]}")
        if response.status_code == 429 or 500 <= response.status_code <= 599:
            if attempt == max_retries:
                raise RiotRawTemporaryError(f"v4 match HTTP {response.status_code} for {match_id}")
            time.sleep(_retry_after(response, attempt))
            continue
        raise RiotRawError(f"v4 match HTTP {response.status_code} for {match_id}: {response.text[:300]}")
    raise RiotRawTemporaryError(f"v4 match retries exhausted for {match_id}")
