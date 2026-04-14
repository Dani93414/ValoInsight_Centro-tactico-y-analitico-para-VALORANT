# Re-export shim — canonical locations:
#   modules.matches.application.ingest_match
#   modules.players.application.update_player_from_match
from modules.matches.application.ingest_match import (  # noqa: F401
    process_single_match_with_status,
    process_single_match,
    recalculate_global_stats,
)