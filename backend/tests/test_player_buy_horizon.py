import unittest
from unittest.mock import patch

import numpy as np

from modules.economy_ml.player_buy_dataset import FEATURES, match_rows
from modules.economy_ml.player_buy_model import alternatives, support_key, grade_rows
from modules.economy_ml.player_buy_horizon import credit_scenario, two_round_values
from test_player_buy import CATALOG, match


class NeverSurvives:
    def predict_proba(self, frame):
        return np.tile([1., 0.], (len(frame), 1))


class HorizonTests(unittest.TestCase):
    def rows(self):
        row = match_rows(match(), CATALOG)[0]
        row.update(round_number=5, phase="normal", credits_before_buy=2200, loss_streak=1,
                   candidate_remaining=200, candidate_cost=2000, other_spend_reserve=0,
                   weapon_id="sheriff", armor_id="heavy", history_profiles="{}")
        return [row, dict(row, weapon_id="classic", armor_id="none", candidate_remaining=2200,
                          candidate_cost=0, decision_type="save")]

    def model(self):
        support = {(w, a, phase, budget): 20 for w in CATALOG["weapons"] for a in CATALOG["armors"]
                   for phase in ("normal", "last_half") for budget in range(10)}
        return {"support": support, "survival": {"pipeline": NeverSurvives(), "calibrator": NeverSurvives()}}

    def future_prediction(self, _, frame):
        # Synthetic learned response: a complete rifle buy is strong next round.
        return np.array([.9 if w in ("vandal", "phantom") and a == "heavy" else .1
                         for w, a in zip(frame.weapon_id, frame.armor_id)])

    def test_saving_beats_two_weak_purchases_despite_lower_current_probability(self):
        rows = self.rows()
        with patch("modules.economy_ml.player_buy_model.predict", side_effect=self.future_prediction):
            q, horizon = two_round_values(self.model(), rows, np.array([.55, .45]), CATALOG)
        self.assertEqual(horizon.tolist(), [2, 2])
        self.assertGreater(q[1], q[0])
        self.assertEqual(credit_scenario(rows[0], False, False), 2600)
        self.assertEqual(credit_scenario(rows[1], False, False), 4600)
        self.assertEqual(credit_scenario(rows[1], False, True), 3200)

    def test_reset_and_matchpoint_do_not_reward_saving_for_nonexistent_budget(self):
        for rn, own, enemy in ((12, 3, 8), (24, 11, 12), (25, 12, 12), (20, 7, 12), (20, 12, 7)):
            rows = [dict(r, round_number=rn, team_score_before=own, enemy_score_before=enemy) for r in self.rows()]
            with patch("modules.economy_ml.player_buy_model.predict", side_effect=self.future_prediction):
                q, horizon = two_round_values(self.model(), rows, np.array([.55, .45]), CATALOG)
            np.testing.assert_equal(q, [.55, .45])
            self.assertEqual(horizon.tolist(), [1, 1])

    def test_future_events_never_change_purchase_value(self):
        rows = self.rows()
        with patch("modules.economy_ml.player_buy_model.predict", side_effect=self.future_prediction):
            q, _ = two_round_values(self.model(), rows, np.array([.55, .45]), CATALOG)
            changed, _ = two_round_values(self.model(), [dict(r, next_round_won=0, next_weapon_observed="vandal", round_won=0, player_survived=True) for r in rows], np.array([.55, .45]), CATALOG)
        np.testing.assert_equal(q, changed)
        self.assertFalse(set(FEATURES) & {"next_round_won", "next_weapon_observed", "player_survived"})

    def test_missing_future_support_falls_back_without_inventing_value(self):
        model = self.model()
        model["support"] = {}
        q, horizon = two_round_values(model, self.rows(), np.array([.55, .45]), CATALOG)
        np.testing.assert_equal(q, [.55, .45])
        self.assertEqual(horizon.tolist(), [1, 1])

    def test_save_candidate_preserves_other_spending(self):
        row = self.rows()[0]
        row.update(weapon_id="sheriff", armor_id="light", previous_survived=False, remaining=800)
        support = {support_key(dict(row, weapon_id=w, armor_id=a)): 20 for w in CATALOG["weapons"] for a in CATALOG["armors"]}
        options = alternatives(row, CATALOG, support)
        save = next(o for o in options if o["decision_type"] == "save")
        self.assertEqual(save["candidate_remaining"], 2000)  # 200 reserved for other spending
        self.assertEqual(save["candidate_cost"], 0)

    def test_switching_to_free_weapon_is_not_labelled_as_keeping_equipment(self):
        row = self.rows()[0]
        row.update(previous_survived=True, remaining=200)
        options = alternatives(row, CATALOG, self.model()["support"])
        switched = next(o for o in options if o["weapon_id"] == "classic" and o["armor_id"] == "heavy")
        kept = next(o for o in options if o["weapon_id"] == "sheriff" and o["armor_id"] == "heavy")
        self.assertEqual(switched["decision_type"], "buy")
        self.assertEqual(kept["decision_type"], "keep")
        self.assertEqual(switched["candidate_remaining"], row["remaining"])

    def test_grade_emits_explicit_save_recommendation(self):
        row = self.rows()[0]
        row.update(remaining=200, previous_survived=False, game_start_millis=5000)
        model = self.model()
        model["selection_cutoff"] = 0
        def predicted(_, frame):
            if (frame.round_number == 5).all():
                return np.array([.45 if w == "classic" else .55 for w in frame.weapon_id])
            return self.future_prediction(_, frame)
        with patch("modules.economy_ml.player_buy_model.predict", side_effect=predicted):
            result = grade_rows([row], {"catalog": CATALOG, "models": [model], "available": True})[0]
        self.assertEqual(result["planning_horizon"], 2)
        self.assertEqual(result["recommendation"]["decision_type"], "save")
        self.assertLess(result["quality"], 100)

    def test_learned_continuation_uses_candidate_saldo_not_future_result(self):
        model = {"next_value": {}}
        rows = self.rows()
        with patch("modules.economy_ml.player_buy_continuation.predict_continuation",
                   side_effect=lambda _, candidates: np.array([.9 if r["candidate_remaining"] > 2000 else .1 for r in candidates])):
            q, horizon = two_round_values(model, rows, np.array([.55, .45]), CATALOG)
            altered, _ = two_round_values(model, [dict(r, round_won=1, next_round_won=1) for r in rows], np.array([.55, .45]), CATALOG)
            terminal, h_terminal = two_round_values(model, [dict(r, enemy_score_before=12) for r in rows], np.array([.55, .45]), CATALOG)
        self.assertGreater(q[1], q[0])
        np.testing.assert_equal(q, altered)
        np.testing.assert_equal(terminal, [.55, .45])
        self.assertEqual(horizon.tolist(), [2, 2])
        self.assertEqual(h_terminal.tolist(), [1, 1])


if __name__ == "__main__":
    unittest.main()
