from modules.analytics.application.filters import AnalyticsFilters

__all__ = [
    "AnalyticsFilters",
    "rebuild_all_player_match_analytics",
    "rebuild_match_player_analytics",
    "get_player_performance",
]


def __getattr__(name: str):
    if name in {
        "rebuild_all_player_match_analytics",
        "rebuild_match_player_analytics",
        "get_player_performance",
    }:
        from modules.analytics.application.service import (
            get_player_performance,
            rebuild_all_player_match_analytics,
            rebuild_match_player_analytics,
        )

        exports = {
            "rebuild_all_player_match_analytics": rebuild_all_player_match_analytics,
            "rebuild_match_player_analytics": rebuild_match_player_analytics,
            "get_player_performance": get_player_performance,
        }
        return exports[name]

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
