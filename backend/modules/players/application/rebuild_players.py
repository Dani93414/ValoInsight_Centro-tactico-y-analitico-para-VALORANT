from __future__ import annotations

import logging

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
    Reconstruye players desde cero a partir de matches.
    Debe ejecutarse despues de insertar partidas en paralelo.
    """
    players_collection.delete_many({})

    processed = 0
    failed = 0

    total_matches = matches_collection.count_documents({})
    cursor = matches_collection.find({}, {"_id": 0}).sort("matchInfo.gameStartMillis", 1)

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

    return {
        "processed_matches": processed,
        "failed_matches": failed,
    }
