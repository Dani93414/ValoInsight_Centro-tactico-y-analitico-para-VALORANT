"""Abstract port for match data access."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class MatchRepository(ABC):
    @abstractmethod
    def list_recent(self, limit: int = 20) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_by_id(self, match_id: str) -> Optional[dict[str, Any]]: ...

    @abstractmethod
    def find_by_player(self, puuid: str, *, limit: int = 50) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_raw_by_match_id(self, match_id: str) -> Optional[dict[str, Any]]: ...

    @abstractmethod
    def insert(self, match_obj: dict[str, Any]) -> bool: ...

    @abstractmethod
    def set_player_analytics(self, match_id: str, puuid: str, analytics: dict[str, Any]) -> None: ...
