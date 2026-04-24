import unittest

from modules.analytics.domain.extractor import (
    _compute_trade_metrics,
    _find_trade_kill_count,
)


def _kill(
    ts: int,
    killer: str,
    victim: str,
    killer_location: dict | None = None,
    victim_location: dict | None = None,
) -> dict:
    player_locations = []
    if killer_location is not None:
        player_locations.append({"puuid": killer, "location": killer_location})

    return {
        "timeSinceRoundStartMillis": ts,
        "killer": killer,
        "victim": victim,
        "victimLocation": victim_location,
        "playerLocations": player_locations,
    }


class TradeKillLogicTest(unittest.TestCase):
    def test_trade_conversion_counts_within_5_seconds_window(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                killer_location={"x": 2000, "y": 2000},
                victim_location={"x": 0, "y": 0},
            ),
            _kill(
                5500,
                "P1",
                "E1",
                killer_location={"x": 120, "y": 120},
                victim_location={"x": 10, "y": 10},
            ),
        ]

        trade_kills, traded_deaths = _find_trade_kill_count(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1"},
            enemy_team={"E1"},
        )

        self.assertEqual(trade_kills, 1)
        self.assertEqual(traded_deaths, 0)

    def test_realistic_trade_opportunity_counts_as_missed_when_player_is_nearby(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                victim_location={"x": 0, "y": 0},
            )
        ]
        kills[0]["playerLocations"].append(
            {"puuid": "P1", "location": {"x": 150, "y": 150}}
        )

        metrics = _compute_trade_metrics(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1"},
            enemy_team={"E1"},
        )

        self.assertEqual(metrics["trade_kills"], 0)
        self.assertEqual(metrics["trade_opportunities"], 1)
        self.assertEqual(metrics["missed_trade_opportunities"], 1)
        self.assertEqual(metrics["traded_deaths"], 0)

    def test_far_away_teammate_death_does_not_count_as_missed_trade_opportunity(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                victim_location={"x": 0, "y": 0},
            )
        ]
        kills[0]["playerLocations"].append(
            {"puuid": "P1", "location": {"x": 5000, "y": 5000}}
        )

        metrics = _compute_trade_metrics(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1"},
            enemy_team={"E1"},
        )

        self.assertEqual(metrics["trade_kills"], 0)
        self.assertEqual(metrics["trade_opportunities"], 0)
        self.assertEqual(metrics["missed_trade_opportunities"], 0)

    def test_raw_trade_kill_still_counts_even_when_initial_position_was_not_realistic(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                victim_location={"x": 0, "y": 0},
            ),
            _kill(
                1800,
                "P1",
                "E1",
                killer_location={"x": 80, "y": 80},
                victim_location={"x": 70, "y": 70},
            ),
        ]
        kills[0]["playerLocations"].append(
            {"puuid": "P1", "location": {"x": 5000, "y": 5000}}
        )

        metrics = _compute_trade_metrics(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1"},
            enemy_team={"E1"},
        )

        self.assertEqual(metrics["trade_kills"], 1)
        self.assertEqual(metrics["trade_opportunities"], 1)
        self.assertEqual(metrics["missed_trade_opportunities"], 0)
        self.assertEqual(metrics["trade_conversion_rate"], 100.0)

    def test_raw_trade_kill_still_counts_when_conversion_location_is_outside_threshold(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                victim_location={"x": 0, "y": 0},
            ),
            _kill(
                1800,
                "P1",
                "E1",
                killer_location={"x": 5000, "y": 5000},
                victim_location={"x": 4900, "y": 4900},
            ),
        ]
        kills[0]["playerLocations"].append(
            {"puuid": "P1", "location": {"x": 5000, "y": 5000}}
        )

        metrics = _compute_trade_metrics(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1"},
            enemy_team={"E1"},
        )

        self.assertEqual(metrics["trade_kills"], 1)
        self.assertEqual(metrics["trade_opportunities"], 1)
        self.assertEqual(metrics["missed_trade_opportunities"], 0)
        self.assertEqual(metrics["trade_conversion_rate"], 100.0)

    def test_trade_opportunity_converts_once_and_closes(self):
        kills = [
            _kill(
                1000,
                "E1",
                "T1",
                killer_location={"x": 100, "y": 100},
                victim_location={"x": 0, "y": 0},
            ),
            _kill(
                1300,
                "E1",
                "T2",
                killer_location={"x": 110, "y": 110},
                victim_location={"x": 10, "y": 10},
            ),
            _kill(
                1600,
                "P1",
                "E1",
                killer_location={"x": 20, "y": 20},
                victim_location={"x": 20, "y": 20},
            ),
            _kill(
                1900,
                "P1",
                "E1",
                killer_location={"x": 25, "y": 25},
                victim_location={"x": 25, "y": 25},
            ),
        ]

        trade_kills, traded_deaths = _find_trade_kill_count(
            kills=kills,
            puuid="P1",
            player_team={"P1", "T1", "T2"},
            enemy_team={"E1"},
        )

        self.assertEqual(trade_kills, 1)
        self.assertEqual(traded_deaths, 0)


if __name__ == "__main__":
    unittest.main()
