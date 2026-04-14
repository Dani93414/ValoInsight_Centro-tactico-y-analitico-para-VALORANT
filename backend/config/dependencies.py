"""Dependency wiring — maps abstract ports to concrete MongoDB implementations.

Currently all repositories are module-level singletons (stateless function
collections).  This module re-exports them under their port names so that
application code *could* swap implementations without touching business logic.
"""
from __future__ import annotations

from modules.content.infrastructure import mongo_content_repo as content_repo
from modules.players.infrastructure import mongo_player_repo as player_repo
from modules.matches.infrastructure import mongo_match_repo as match_repo
from modules.analytics.infrastructure import mongo_analytics_repo as analytics_repo
from modules.regions.infrastructure import mongo_region_repo as region_repo

__all__ = [
    "content_repo",
    "player_repo",
    "match_repo",
    "analytics_repo",
    "region_repo",
]
