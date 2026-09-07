import copy
import json
import unittest
from unittest.mock import patch

import numpy as np

from modules.economy_ml.player_buy_dataset import build_dataset, match_rows, FEATURES, apply_history
from modules.economy_ml.player_buy_model import alternatives, grade_rows, support_key


CATALOG = {"weapons": {key: {"id": key, "name": key, "cost": cost} for key, cost in
                       (("classic", 0), ("vandal", 2900), ("phantom", 2900), ("sheriff", 800))},
           "armors": {key: {"id": key, "name": key, "cost": cost} for key, cost in
                      (("none", 0), ("light", 400), ("heavy", 1000))}}


def match(mid="m", time=1000, count=3):
    players = [{"puuid": p, "teamId": t, "characterId": "agent", "competitiveTier": 10}
               for p, t in (("p", "A"), ("q", "B"))]
    rounds = []
    for n in range(count):
        rounds.append({"roundNum": n, "winningTeam": "A", "winningTeamRole": "attack",
                       "roundResult": "Elimination", "bombPlanter": "string", "bombDefuser": "string",
                       "playerStats": [{"puuid": p["puuid"], "economy": {"remaining": 100,
                                        "weapon": "classic", "armor": "string", "loadoutValue": 0},
                                        "kills": [], "damage": []} for p in players]})
    return {"matchInfo": {"matchId": mid, "gameStartMillis": time, "isRanked": True, "mapId": "map"},
            "players": players, "roundResults": rounds}


class PlayerBuyDatasetTests(unittest.TestCase):
    def test_credits_are_previous_remaining_plus_income_not_spent(self):
        m = match()
        m["roundResults"][0]["playerStats"][0]["economy"]["spent"] = 99999
        m["roundResults"][0]["playerStats"][0]["kills"] = [{"killer": "p", "victim": "q"}]
        rows = match_rows(m, CATALOG)
        self.assertEqual(rows[0]["credits_before_buy"], 800)
        self.assertEqual(rows[2]["credits_before_buy"], 3300)
        self.assertEqual(rows[3]["credits_before_buy"], 2000)

    def test_plant_and_configured_defuse_pay_each_team(self):
        m = match()
        m["roundResults"][0].update(bombPlanter="p", bombDefuser="q", winningTeam="B", roundResult="Bomb defused")
        rows = match_rows(m, CATALOG)
        self.assertEqual(rows[2]["credits_before_buy"], 2300)
        self.assertEqual(rows[3]["credits_before_buy"], 3400)

    def test_loss_streak_reset_and_cap(self):
        m = match(count=5)
        for rnd in m["roundResults"]:
            rnd["playerStats"][0]["kills"] = [{"killer": "p", "victim": "q"}]
        rows = match_rows(m, CATALOG)
        self.assertEqual([r["credits_before_buy"] for r in rows if r["puuid"] == "q"], [800, 2000, 2500, 3000, 3000])
        m["roundResults"][2]["playerStats"][0]["economy"]["remaining"] = 8900
        rows = match_rows(m, CATALOG)
        self.assertEqual(rows[6]["credits_before_buy"], 9000)

    def test_save_penalty_individual_and_half_reset(self):
        m = match(count=14)
        m["roundResults"][0].update(winningTeam="B", winningTeamRole="defense", roundResult="Time expired")
        rows = match_rows(m, CATALOG)
        self.assertEqual(rows[2]["credits_before_buy"], 1100)
        self.assertEqual(rows[24]["credits_before_buy"], 800)
        self.assertEqual(rows[24]["loss_streak"], 0)

    def test_missing_remaining_and_unknown_armor_are_not_zero(self):
        m = match()
        del m["roundResults"][0]["playerStats"][0]["economy"]["remaining"]
        del m["roundResults"][0]["playerStats"][0]["economy"]["armor"]
        rows = match_rows(m, CATALOG)
        self.assertIsNone(rows[2]["credits_before_buy"])
        self.assertEqual(rows[0]["armor_id"], "unknown")

    def test_history_excludes_current_and_simultaneous_matches(self):
        frame = build_dataset([match("future", 3000), match("first", 1000), match("tie", 1000), match("middle", 2000)], CATALOG)
        self.assertTrue((frame[frame.game_start_millis == 1000].history_player_rounds == 0).all())
        self.assertTrue((frame[frame.match_id == "middle"].history_player_rounds == 6).all())
        self.assertTrue((frame[frame.match_id == "future"].history_agent_rounds == 9).all())
        changed = match("future", 3000)
        changed["roundResults"][0]["winningTeam"] = "B"
        other = build_dataset([match("first", 1000), match("tie", 1000), match("middle", 2000), changed], CATALOG)
        self.assertEqual(frame[frame.match_id == "middle"][FEATURES].to_json(), other[other.match_id == "middle"][FEATURES].to_json())

    def test_candidate_history_is_recomputed_for_alternative_weapon(self):
        row = {"weapon_id": "vandal"}
        apply_history(row, {"weapons": {"vandal": [100, 90, 50, 12000], "phantom": [20, 10, 10, 2400]}}, "phantom")
        self.assertEqual(row["history_weapon_rounds"], 20)

    def test_post_decision_fields_are_not_state_features(self):
        self.assertFalse(set(FEATURES) & {"round_won", "remaining", "loadout_value", "round_kills", "round_damage", "rank_observed", "puuid"})


class PlayerBuyRankingTests(unittest.TestCase):
    def row(self):
        row = match_rows(match(), CATALOG)[0]
        row.update(weapon_id="phantom", armor_id="light", weapon_value=2900, armor_value=400,
                   credits_before_buy=4500, remaining=1000, previous_survived=False, phase="normal",
                   history_profiles=json.dumps({}), game_start_millis=5000)
        return row

    def supported(self, row):
        return {support_key(dict(row, weapon_id=w, armor_id=a)): 20 for w in CATALOG["weapons"] for a in CATALOG["armors"]}

    def test_affordability_preserves_other_spending(self):
        row = self.row()
        options = alternatives(row, CATALOG, self.supported(row))
        self.assertTrue(any(o["weapon_id"] == "vandal" for o in options))
        self.assertTrue(all(o["candidate_cost"] <= o["candidate_budget"] for o in options))
        row.update(credits_before_buy=3300, remaining=0)
        options = alternatives(row, CATALOG, self.supported(row))
        self.assertFalse(any(o["weapon_id"] == "vandal" and o["armor_id"] == "heavy" for o in options))

    def test_unknown_drop_never_refunded(self):
        row = self.row()
        row.update(previous_survived=True, remaining=100)
        options = alternatives(row, CATALOG, self.supported(row))
        self.assertFalse(any(o["weapon_id"] == "vandal" for o in options))

    def test_future_model_never_grades_historical_match(self):
        row = self.row()
        result = grade_rows([row], {"catalog": CATALOG, "available": True,
                                  "models": [{"selection_cutoff": 5000}]})
        self.assertIsNone(result[0]["quality"])

    def test_similar_weapons_get_high_grades_and_no_change(self):
        row = self.row()
        bundle = {"catalog": CATALOG, "available": True, "models": [{"selection_cutoff": 1000, "support": self.supported(row)}]}
        with patch("modules.economy_ml.player_buy_model.predict", side_effect=lambda _, frame: np.array([.51 if w == "vandal" else .50 for w in frame.weapon_id])):
            result = grade_rows([row], bundle)[0]
        self.assertGreaterEqual(result["quality"], 98)
        self.assertIsNone(result["recommendation"])

    def test_recommendation_can_change_only_shield(self):
        row = self.row()
        bundle = {"catalog": CATALOG, "available": True, "models": [{"selection_cutoff": 1000, "support": self.supported(row)}]}
        def probabilities(_, frame):
            return np.array([.7 if w == "phantom" and a == "heavy" else .5 for w, a in zip(frame.weapon_id, frame.armor_id)])
        with patch("modules.economy_ml.player_buy_model.predict", side_effect=probabilities):
            result = grade_rows([row], bundle)[0]
        self.assertIsNone(result["recommendation"]["weapon_id"])
        self.assertEqual(result["recommendation"]["armor_id"], "heavy")


if __name__ == "__main__":
    unittest.main()
