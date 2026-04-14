"""Use case: ingest a single match document into the system."""
from __future__ import annotations

import logging

from modules.matches.infrastructure import mongo_match_repo
from modules.analytics.domain.extractor import build_player_analytics_embedded
from modules.players.application.update_player_from_match import update_players_from_match
from scripts.regions_update import update_region_from_match, update_regions

logger = logging.getLogger(__name__)


def _safe_match_id(match_obj: dict) -> str | None:
    return (match_obj.get("matchInfo") or {}).get("matchId")


def _embed_analytics(match_obj: dict) -> int:
    """Compute per-player analytics and embed into the match document in MongoDB."""
    match_id = _safe_match_id(match_obj)
    if not match_id:
        return 0

    analytics_by_puuid = build_player_analytics_embedded(match_obj)
    if not analytics_by_puuid:
        return 0

    for puuid, analytics in analytics_by_puuid.items():
        mongo_match_repo.set_player_analytics(match_id, puuid, analytics)

    return len(analytics_by_puuid)


def process_single_match_with_status(match_obj: dict) -> str:
    """
    Ingest a single match object and return one of:
    - inserted
    - already_exists
    - failed
    """
    if not match_obj or "matchInfo" not in match_obj:
        logger.error("Invalid match payload: missing matchInfo")
        return "failed"

    match_id = _safe_match_id(match_obj)
    if not match_id:
        logger.error("Invalid match payload: missing matchInfo.matchId")
        return "failed"

    try:
        existing_match = mongo_match_repo.find_raw_by_match_id(match_id)

        if existing_match:
            logger.info("Match %s already present. Skip insert.", match_id)
            try:
                _embed_analytics(existing_match)
            except Exception as analytics_exc:
                logger.warning(
                    "Analytics embed skipped/failed for existing match %s: %s",
                    match_id,
                    analytics_exc,
                )
            return "already_exists"

        if not mongo_match_repo.insert(match_obj):
            logger.info("Match %s inserted by concurrent process. Skip.", match_id)
            return "already_exists"

        logger.info("Match %s stored in MongoDB.", match_id)

    except Exception as exc:
        logger.error("Error storing match %s: %s", match_id, exc)
        return "failed"

    try:
        update_players_from_match(match_obj)

        try:
            _embed_analytics(match_obj)
        except Exception as analytics_exc:
            logger.error("Analytics embed failed for match %s: %s", match_id, analytics_exc)

        update_region_from_match(match_obj)
        return "inserted"

    except Exception as exc:
        logger.error("Error updating derived stats for %s: %s", match_id, exc)
        return "failed"


def process_single_match(match_obj: dict) -> bool:
    """Backward-compatible wrapper kept for existing callers."""
    status = process_single_match_with_status(match_obj)
    return status in {"inserted", "already_exists"}


def recalculate_global_stats() -> None:
    """Rebuild region aggregates from all matches."""
    logger.info("Requesting global regions recalculation.")
    update_regions()
