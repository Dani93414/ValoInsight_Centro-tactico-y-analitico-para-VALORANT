import unittest

from modules.analytics.infrastructure.heatmap_extractor import (
    EVENT_DEFUSE,
    EVENT_FIRST_BLOOD,
    EVENT_KILL,
    EVENT_KILL_ENEMY_POSITION,
    EVENT_PLANT,
    _determine_side,
    extract_spatial_events,
)


class HeatmapExtractorTest(unittest.TestCase):
    def setUp(self):
        self.map_transform = {
            "x_mult": 0.001,
            "x_add": 0.0,
            "y_mult": 0.001,
            "y_add": 0.0,
        }

    def test_kill_and_first_blood_use_killer_position(self):
        puuid = "killer-1"
        victim = "victim-1"

        match = {
            "matchInfo": {"matchId": "m-1"},
            "players": [
                {"puuid": puuid, "teamId": "Red", "characterId": "agent-1", "gameName": "Killer"},
                {"puuid": victim, "teamId": "Blue", "characterId": "agent-2", "gameName": "Victim"},
            ],
            "roundResults": [
                {
                    "roundNum": 0,
                    "plantRoundTime": 0,
                    "playerStats": [
                        {
                            "kills": [
                                {
                                    "killer": puuid,
                                    "victim": victim,
                                    "timeSinceRoundStartMillis": 1000,
                                    "timeSinceGameStartMillis": 1000,
                                    "victimLocation": {"x": 900, "y": 900},
                                    "playerLocations": [
                                        {"puuid": puuid, "location": {"x": 100, "y": 200}},
                                        {"puuid": victim, "location": {"x": 900, "y": 900}},
                                    ],
                                }
                            ]
                        }
                    ],
                }
            ],
        }

        events = extract_spatial_events(
            [match],
            puuid,
            map_transform=self.map_transform,
            event_types={EVENT_KILL, EVENT_FIRST_BLOOD},
        )

        self.assertEqual(len(events), 2)

        kill_event = next(e for e in events if e["event_type"] == EVENT_KILL)
        first_blood_event = next(e for e in events if e["event_type"] == EVENT_FIRST_BLOOD)

        self.assertAlmostEqual(kill_event["x"], 0.2, places=6)
        self.assertAlmostEqual(kill_event["y"], 0.1, places=6)
        self.assertAlmostEqual(first_blood_event["x"], 0.2, places=6)
        self.assertAlmostEqual(first_blood_event["y"], 0.1, places=6)

    def test_kill_event_is_skipped_when_killer_position_missing(self):
        puuid = "killer-1"
        victim = "victim-1"

        match = {
            "matchInfo": {"matchId": "m-2"},
            "players": [
                {"puuid": puuid, "teamId": "Red", "characterId": "agent-1", "gameName": "Killer"},
                {"puuid": victim, "teamId": "Blue", "characterId": "agent-2", "gameName": "Victim"},
            ],
            "roundResults": [
                {
                    "roundNum": 0,
                    "plantRoundTime": 0,
                    "playerStats": [
                        {
                            "kills": [
                                {
                                    "killer": puuid,
                                    "victim": victim,
                                    "timeSinceRoundStartMillis": 1000,
                                    "timeSinceGameStartMillis": 1000,
                                    "victimLocation": {"x": 900, "y": 900},
                                    "playerLocations": [
                                        {"puuid": victim, "location": {"x": 900, "y": 900}},
                                    ],
                                }
                            ]
                        }
                    ],
                }
            ],
        }

        events = extract_spatial_events(
            [match],
            puuid,
            map_transform=self.map_transform,
            event_types={EVENT_KILL, EVENT_FIRST_BLOOD},
        )

        self.assertEqual(events, [])

    def test_kill_enemy_position_uses_victim_location(self):
        puuid = "killer-1"
        victim = "victim-1"

        match = {
            "matchInfo": {"matchId": "m-3"},
            "players": [
                {"puuid": puuid, "teamId": "Red", "characterId": "agent-1", "gameName": "Killer"},
                {"puuid": victim, "teamId": "Blue", "characterId": "agent-2", "gameName": "Victim"},
            ],
            "roundResults": [
                {
                    "roundNum": 0,
                    "plantRoundTime": 0,
                    "playerStats": [
                        {
                            "kills": [
                                {
                                    "killer": puuid,
                                    "victim": victim,
                                    "timeSinceRoundStartMillis": 1000,
                                    "timeSinceGameStartMillis": 1000,
                                    "victimLocation": {"x": 900, "y": 300},
                                    "playerLocations": [
                                        {"puuid": puuid, "location": {"x": 100, "y": 200}},
                                        {"puuid": victim, "location": {"x": 900, "y": 300}},
                                    ],
                                }
                            ]
                        }
                    ],
                }
            ],
        }

        events = extract_spatial_events(
            [match],
            puuid,
            map_transform=self.map_transform,
            event_types={EVENT_KILL_ENEMY_POSITION},
        )

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event["event_type"], EVENT_KILL_ENEMY_POSITION)
        self.assertAlmostEqual(event["x"], 0.3, places=6)
        self.assertAlmostEqual(event["y"], 0.9, places=6)

    def test_overtime_side_alternates_every_round(self):
        self.assertEqual(_determine_side("Red", 24, 26), "attack")
        self.assertEqual(_determine_side("Red", 25, 26), "defense")
        self.assertEqual(_determine_side("Red", 26, 28), "attack")
        self.assertEqual(_determine_side("Blue", 24, 26), "defense")
        self.assertEqual(_determine_side("Blue", 25, 26), "attack")

    def test_objective_events_keep_temporal_round_phase(self):
        puuid = "planter-1"

        match = {
            "matchInfo": {"matchId": "m-4"},
            "players": [
                {"puuid": puuid, "teamId": "Red", "characterId": "agent-1", "gameName": "Planter"},
            ],
            "roundResults": [
                {
                    "roundNum": 0,
                    "plantRoundTime": 35000,
                    "bombPlanter": puuid,
                    "plantLocation": {"x": 100, "y": 200},
                    "plantSite": "A",
                    "defuseRoundTime": 45000,
                    "bombDefuser": puuid,
                    "defuseLocation": {"x": 120, "y": 220},
                    "playerStats": [],
                }
            ],
        }

        events = extract_spatial_events(
            [match],
            puuid,
            map_transform=self.map_transform,
            event_types={EVENT_PLANT, EVENT_DEFUSE},
        )

        plant_event = next(e for e in events if e["event_type"] == EVENT_PLANT)
        defuse_event = next(e for e in events if e["event_type"] == EVENT_DEFUSE)

        self.assertEqual(plant_event["round_phase"], "mid")
        self.assertEqual(plant_event["objective_event"], EVENT_PLANT)
        self.assertEqual(defuse_event["round_phase"], "post_plant")
        self.assertEqual(defuse_event["objective_event"], EVENT_DEFUSE)


if __name__ == "__main__":
    unittest.main()
