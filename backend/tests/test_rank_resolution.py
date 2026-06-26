import unittest
from unittest.mock import patch

from modules.players.application.player_dashboard_service import build_player_dashboard
from modules.players.application.rank_resolution import resolve_current_visual_rank


CONTENT_DOC = {
    "agents": [],
    "maps": [],
    "weapons": [],
    "acts": [
        {"id": "act-new", "name": "Acto nuevo", "type": "act", "isActive": True},
        {"id": "act-old", "name": "Acto anterior", "type": "act", "isActive": False},
    ],
    "competitiveTiers": [
        {
            "uuid": "tiers",
            "tiers": [
                {"tier": 0, "tierName": "Unrated", "divisionName": "Unused"},
                {"tier": 18, "tierName": "Diamond 1", "divisionName": "Diamond"},
            ],
        }
    ],
}


def _doc(season_id: str, tier, timestamp: int) -> dict:
    return {
        "season_id": season_id,
        "competitive_tier": tier,
        "game_start_millis": timestamp,
        "agent_id": "agent",
        "agent_name": "Sova",
        "map_name": "Ascent",
        "overview": {"rounds": 20, "wins": 10},
        "player_totals_from_match": {
            "kills": 10,
            "deaths": 8,
            "assists": 3,
            "score": 3000,
            "rounds_played": 20,
        },
    }


class RankResolutionTest(unittest.TestCase):
    def test_current_act_unranked_matches_show_unranked(self):
        rank = resolve_current_visual_rank(
            current_act_docs=[_doc("act-new", 0, 2000)],
            mapped_matches=[
                {"seasonId": "act-new", "competitiveTier": 0, "timestamp": 2000},
                {"seasonId": "act-old", "competitiveTier": 18, "timestamp": 1000},
            ],
            player={"competitiveTier": 18},
            rank_icon_map={0: "/unranked.png", 18: "/diamond.png"},
            rank_icon_by_name_map={"unrated": "/unranked.png"},
        )

        self.assertIsNone(rank["tier"])
        self.assertEqual(rank["name"], "Sin rango")
        self.assertEqual(rank["source"], "current_act_unranked")
        self.assertEqual(rank["image"], "/unranked.png")

    def test_no_current_act_matches_can_fallback_to_latest_global_rank(self):
        rank = resolve_current_visual_rank(
            current_act_docs=[],
            mapped_matches=[
                {"seasonId": "act-old", "competitiveTier": 18, "timestamp": 1000},
            ],
            player={},
            rank_icon_map={18: "/diamond.png"},
            rank_icon_by_name_map={},
        )

        self.assertEqual(rank["tier"], 18)
        self.assertEqual(rank["name"], "Diamond 1")
        self.assertEqual(rank["source"], "latest_global_ranked")

    @patch("modules.players.application.player_dashboard_service.get_player_rank_comparison")
    @patch("modules.players.application.player_dashboard_service._load_weapon_usage_summary")
    @patch("modules.players.application.player_dashboard_service._get_dashboard_content")
    def test_dashboard_does_not_show_previous_rank_when_current_act_is_unranked(
        self,
        content_mock,
        weapon_mock,
        comparison_mock,
    ):
        content_mock.return_value = CONTENT_DOC
        weapon_mock.return_value = []
        comparison_mock.return_value = {}

        dashboard = build_player_dashboard(
            {"puuid": "p1", "competitiveTier": 18},
            [_doc("act-new", 0, 2000), _doc("act-old", 18, 1000)],
        )

        self.assertIsNone(dashboard["currentRank"]["tier"])
        self.assertEqual(dashboard["currentRank"]["name"], "Sin rango")
        self.assertEqual(dashboard["currentRank"]["source"], "current_act_unranked")


if __name__ == "__main__":
    unittest.main()
