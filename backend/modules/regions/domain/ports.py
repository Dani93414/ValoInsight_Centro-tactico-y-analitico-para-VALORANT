"""Abstract port for region data access."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class RegionRepository(ABC):
    @abstractmethod
    def get_all_sorted(self) -> list[dict[str, Any]]: ...
