"""Abstract port for analytics data access."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class AnalyticsRepository(ABC):
    @abstractmethod
    def heatmap_maps_by_uuid(self) -> dict[str, dict[str, Any]]: ...

    @abstractmethod
    def find_ranked_analytics_rows(
        self,
        puuid: str,
        *,
        map_id: Optional[str] = None,
        season_ids: Optional[list[str]] = None,
        agent_id: Optional[str] = None,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_heatmap_matches(
        self, puuid: str, *, match_ids: set[str], map_id: Optional[str] = None,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_heatmap_matches_fallback(
        self,
        puuid: str,
        *,
        map_id: str,
        season_ids: Optional[list[str]] = None,
        match_ids: Optional[set[str]] = None,
        ranked_only: bool = True,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_agent_stats_for_player(
        self, puuid: str, *, map_id: str, season_ids: Optional[list[str]] = None,
    ) -> list[dict]: ...
