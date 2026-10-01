from __future__ import annotations

import logging
from uuid import uuid4

try:
    from backend.infrastructure.mongo_client import matches_collection, players_collection
    from backend.modules.players.application.update_player_from_match import update_players_from_match
except ModuleNotFoundError:
    from infrastructure.mongo_client import matches_collection, players_collection
    from modules.players.application.update_player_from_match import update_players_from_match

logger = logging.getLogger(__name__)


def _progress_label(done: int, total: int) -> str:
    pct = (done / total * 100.0) if total else 100.0
    return f"[{pct:5.1f}%] [{done}/{total}]"


def rebuild_players_from_matches() -> dict:
    """
    Rebuild players from matches using a staging collection.

    The live collection is replaced only after every match has been processed
    successfully. A failed rebuild therefore leaves the previous player
    profiles available instead of exposing an empty/partial collection.
    """
    live_collection = players_collection
    staging_collection = live_collection.database[f"{live_collection.name}__rebuild_{uuid4().hex}"]
    staging_collection.create_index("puuid", unique=True)
    staging_collection.create_index([("gameName", 1), ("tagLine", 1)])
    # update_players_from_match imports its repository through either the
    # ``modules`` or ``backend.modules`` namespace depending on the launcher.
    # Obtain that exact module from the function globals so the staging route
    # cannot accidentally modify the other Python module alias.
    player_repo = update_players_from_match.__globals__["mongo_player_repo"]
    original_repo_collection = player_repo.players_collection
    player_repo.players_collection = staging_collection

    processed = 0
    failed = 0

    total_matches = matches_collection.count_documents({})
    cursor = matches_collection.find({}, {"_id": 0}).sort("matchInfo.gameStartMillis", 1)

    try:
        for match_obj in cursor:
            try:
                update_players_from_match(match_obj)
                processed += 1
            except Exception as exc:
                failed += 1
                logger.error(
                    "Failed rebuilding players from match %s: %s",
                    (match_obj.get("matchInfo") or {}).get("matchId"),
                    exc,
                )

            done = processed + failed
            if done == total_matches or done % 25 == 0:
                print(f"{_progress_label(done, total_matches)} [REBUILD_PLAYERS]")

        if failed:
            raise RuntimeError(f"Players rebuild aborted: {failed} match(es) failed; live collection was not replaced")
        staging_collection.rename(live_collection.name, dropTarget=True)
        return {"processed_matches": processed, "failed_matches": 0}
    except Exception:
        staging_collection.drop()
        raise
    finally:
        player_repo.players_collection = original_repo_collection
