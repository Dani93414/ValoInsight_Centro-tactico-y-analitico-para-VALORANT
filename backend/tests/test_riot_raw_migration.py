from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from ingestion.riot_raw_adapter import adapt_riot_raw_match, is_riot_raw_match
from ingestion.riot_performance_parser import parse_riot_performance
from infrastructure.riot_raw_client import RiotRawRequest
from modules.matches.application.riot_raw_refresh import (
    enrich_riot_raw_with_henrik_match,
    merge_riot_raw_match,
    needs_henrik_enrichment,
)
from modules.matches.domain.schema import (
    LEGACY_CANDIDATE,
    REFRESH_FAILED_PREVIOUSLY,
    UP_TO_DATE,
    classify_match,
)


RAW = {
    "matchInfo": {"matchId": "m-1", "mapId": "/Game/Maps/Ascent/Ascent", "queueID": "competitive", "gameVersion": "release-13.06"},
    "players": [{"subject": "p1", "gameName": "", "tagLine": "", "teamId": "Blue", "stats": {"score": 100, "kills": 10, "deaths": 5, "assists": 3}}],
    "playerScores": [{"subject": "p1", "TempValueG": 472.49, "TempValueA": 205.3, "TempValueW": 9}],
    "roundResults": [{"roundNum": 0, "firstBloodPlayer": "p1", "playerEconomies": [{"subject": "p1", "spent": 2900, "remaining": 100}], "playerStats": [{"subject": "p1", "score": 100}]}],
}


class RiotRawMigrationTests(unittest.TestCase):
    def test_performance_ratings_preserve_raw_direction_despite_casing_or_nested_shape(self):
        parsed = parse_riot_performance({
            "TempValueG": 300,
            "TempValueA": 120,
            "ratings": {
                "TempValueA": "DOUBLE-UP",
                "TempValueB": {"rating": "Down"},
            },
            "TempValueL": {"TempValueQ": {"utilityUsage": "UP"}},
        })

        self.assertEqual(parsed["components"]["damage"]["rating"], "double_up")
        self.assertEqual(parsed["components"]["trades"]["rating"], "down")
        self.assertEqual(parsed["components"]["utilityUsage"]["rating"], "up")

    def test_raw_request_is_explicit_and_matchdetails_scoped(self):
        self.assertEqual(RiotRawRequest("m-1", "eu", "pc").body(), {
            "platform": "pc", "queries": "", "region": "eu", "type": "matchdetails", "value": "m-1"
        })

    def test_raw_adapter_preserves_observed_economy_and_unknown_temp_values(self):
        self.assertTrue(is_riot_raw_match(RAW))
        match = adapt_riot_raw_match(RAW)
        self.assertEqual(match["dataSchema"]["version"], 2)
        self.assertEqual(match["matchInfo"]["queueId"], "competitive")
        self.assertEqual(match["players"][0]["performance"]["score"], 472.49)
        self.assertEqual(match["players"][0]["performance"]["rawUnknownValues"], {"TempValueW": 9})
        stat = match["roundResults"][0]["playerStats"][0]
        self.assertEqual(stat["economy"]["spent"], 2900)
        self.assertEqual(stat["economy"]["spentSource"], "riot_raw")
        self.assertEqual(match["roundResults"][0]["firstBloodPlayer"], "p1")

    def test_legacy_upgrade_keeps_names_and_embedded_analytics_idempotently(self):
        legacy = {"matchInfo": {"matchId": "m-1"}, "players": [{"puuid": "p1", "gameName": "Known", "tagLine": "TAG", "competitiveTier": 20, "playerCard": "card-1", "playerTitle": "title-1", "accountLevel": 300, "analytics": {"overview": {"kills": 10}}}]}
        normalized = adapt_riot_raw_match(RAW)
        merged, _ = merge_riot_raw_match(legacy, normalized)
        player = merged["players"][0]
        self.assertEqual(merged["matchInfo"]["matchId"], "m-1")
        self.assertEqual(player["gameName"], "Known")
        self.assertEqual(player["tagLine"], "TAG")
        self.assertEqual(player["competitiveTier"], 20)
        self.assertEqual(player["playerCard"], "card-1")
        self.assertEqual(player["playerTitle"], "title-1")
        self.assertEqual(player["accountLevel"], 300)
        self.assertEqual(player["analytics"]["overview"]["kills"], 10)
        merged_again, _ = merge_riot_raw_match(merged, normalized)
        self.assertEqual(merged_again["matchInfo"]["matchId"], "m-1")
        self.assertEqual(merged_again["players"][0]["analytics"], player["analytics"])

    def test_refresh_classification_resumes_without_hammering_unavailable_matches(self):
        legacy = {"matchInfo": {"matchId": "m-1"}}
        self.assertEqual(classify_match(legacy), LEGACY_CANDIDATE)
        legacy["rawRefresh"] = {"status": "not_available"}
        self.assertEqual(classify_match(legacy), REFRESH_FAILED_PREVIOUSLY)
        v2 = {"dataSchema": {"version": 2, "source": "riot_raw"}, "players": [{"performance": {"available": False}}]}
        self.assertEqual(classify_match(v2), UP_TO_DATE)

    def test_temporary_error_retries_after_its_cooldown(self):
        legacy = {"matchInfo": {"matchId": "m-1"}, "rawRefresh": {"status": "temporary_error"}}
        self.assertEqual(classify_match(legacy), LEGACY_CANDIDATE)
        legacy["rawRefresh"]["nextRetryAt"] = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        self.assertEqual(classify_match(legacy), REFRESH_FAILED_PREVIOUSLY)

    def test_adapter_keeps_top_level_kills_and_equipment_ids(self):
        payload = {
            **RAW,
            "kills": [{"round": "0", "roundTime": 50, "killer": "p1", "victim": "p2", "assistants": []}],
            "roundResults": [{"roundNum": 0, "playerEconomies": [{"subject": "p1", "weapon": {"id": "weapon-1"}, "armor": {"id": "armor-1"}}], "playerStats": [{"subject": "p1", "kills": []}]}],
        }
        stat = adapt_riot_raw_match(payload)["roundResults"][0]["playerStats"][0]
        self.assertEqual(stat["economy"]["weapon"], "weapon-1")
        self.assertEqual(stat["economy"]["armor"], "armor-1")
        self.assertEqual(len(stat["kills"]), 1)

    def test_adapter_preserves_only_explicit_round_afk_flags(self):
        payload = {
            **RAW,
            "roundResults": [{
                "roundNum": 0,
                "playerStats": [{"subject": "p1", "wasAfk": True, "stayedInSpawn": True}],
            }],
        }

        stat = adapt_riot_raw_match(payload)["roundResults"][0]["playerStats"][0]
        self.assertTrue(stat["isAfk"])
        self.assertTrue(stat["stayedInSpawn"])

    def test_merge_rejects_a_raw_response_for_another_match(self):
        wrong = adapt_riot_raw_match({**RAW, "matchInfo": {**RAW["matchInfo"], "matchId": "m-other"}})
        with self.assertRaises(ValueError):
            merge_riot_raw_match({"matchInfo": {"matchId": "m-1"}}, wrong)

    def test_henrik_v4_only_fills_raw_identity_and_profile_gaps(self):
        normalized = adapt_riot_raw_match(RAW)
        self.assertTrue(needs_henrik_enrichment(normalized))
        filled = enrich_riot_raw_with_henrik_match(normalized, {
            "metadata": {"map": {"name": "Ascent"}},
            "players": [{
                "puuid": "p1", "name": "Known", "tag": "TAG",
                "currenttier": 20, "player_card": "card-1",
                "player_title": "title-1", "account_level": 300,
            }],
        })
        player = normalized["players"][0]
        self.assertEqual(player["gameName"], "Known")
        self.assertEqual(player["tagLine"], "TAG")
        self.assertEqual(player["competitiveTier"], 20)
        self.assertEqual(player["playerCard"], "card-1")
        self.assertEqual(player["playerTitle"], "title-1")
        self.assertEqual(player["accountLevel"], 300)
        self.assertEqual(normalized["matchInfo"]["mapId"], "/Game/Maps/Ascent/Ascent")
        self.assertEqual(normalized["matchInfo"]["legacyMapName"], "Ascent")
        self.assertIn("gameName", filled)
