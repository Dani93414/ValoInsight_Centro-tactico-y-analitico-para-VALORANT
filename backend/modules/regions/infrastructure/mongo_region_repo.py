"""MongoDB repository for region documents."""
from __future__ import annotations

from typing import Any

from infrastructure.mongo_client import regions_collection


def get_all_sorted() -> list[dict[str, Any]]:
    """Return all region stats sorted by avg K/D descending."""
    regiones = list(regions_collection.find({}, {"_id": 0}))
    return sorted(regiones, key=lambda x: x.get("avg_kd", 0), reverse=True)
