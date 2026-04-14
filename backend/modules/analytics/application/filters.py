from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(slots=True)
class AnalyticsFilters:
    map_id: Optional[str] = None
    agent_id: Optional[str] = None
    season_id: Optional[str] = None
    weapon_id: Optional[str] = None
    side: Optional[str] = None  # "attack" | "defense" | None

    def normalized(self) -> "AnalyticsFilters":
        side = self.side.lower().strip() if self.side else None
        if side not in {None, "attack", "defense"}:
            raise ValueError("side debe ser None, 'attack' o 'defense'")
        return AnalyticsFilters(
            map_id=str(self.map_id) if self.map_id else None,
            agent_id=str(self.agent_id) if self.agent_id else None,
            season_id=str(self.season_id) if self.season_id else None,
            weapon_id=str(self.weapon_id) if self.weapon_id else None,
            side=side,
        )

    def to_mongo_query(self, puuid: Optional[str] = None) -> dict:
        """Build a query dict targeting the *matches* collection (embedded analytics model)."""
        query: dict = {"matchInfo.isRanked": True}

        if self.map_id:
            query["matchInfo.mapId"] = self.map_id
        if self.season_id:
            query["matchInfo.seasonId"] = self.season_id

        # puuid and agent_id live in the same players[] subdoc → use $elemMatch
        elem: dict = {}
        if puuid:
            elem["puuid"] = puuid
        if self.agent_id:
            elem["characterId"] = self.agent_id

        if elem:
            query["players"] = {"$elemMatch": elem}
        return query