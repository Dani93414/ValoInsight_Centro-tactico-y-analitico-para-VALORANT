"""Abstract port for content data access."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class ContentRepository(ABC):
    @abstractmethod
    def get_latest_content(self, projected_fields: tuple[str, ...]) -> dict: ...

    @abstractmethod
    def get_raw_latest(self) -> dict: ...

    @abstractmethod
    def find_leaderboard(self, act_id: str, region: str = "eu") -> Optional[dict]: ...

    @abstractmethod
    def find_player_by_puuid(self, puuid: str) -> Optional[dict]: ...

    @abstractmethod
    def find_matches_by_player(self, puuid: str, limit: int = 10) -> list[dict]: ...

    @abstractmethod
    def get_all_regions(self) -> list[dict]: ...
