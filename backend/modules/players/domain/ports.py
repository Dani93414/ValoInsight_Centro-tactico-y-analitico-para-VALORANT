"""Abstract port for player data access."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional


class PlayerRepository(ABC):
    @abstractmethod
    def list_players(
        self, *, game_name: Optional[str] = None, tag_line: Optional[str] = None, limit: int = 20,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def search_players(
        self, *, game_name: Optional[str] = None, tag_line: Optional[str] = None, limit: int = 10,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def find_by_puuid(self, puuid: str) -> Optional[dict[str, Any]]: ...

    @abstractmethod
    def find_raw_by_puuid(self, puuid: str) -> Optional[dict[str, Any]]: ...

    @abstractmethod
    def insert_player(self, doc: dict[str, Any]) -> None: ...

    @abstractmethod
    def update_player(self, puuid: str, update: dict[str, Any]) -> None: ...
