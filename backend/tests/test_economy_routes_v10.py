import inspect
import unittest
from unittest.mock import patch

from modules.economy_ml.interfaces.routes import match_economy_ml
from modules.matches.interfaces.routes import get_match_economy_ml


MATCH = {"matchInfo": {"matchId": "m"}, "players": [], "roundResults": []}


class EconomyRoutesV10Tests(unittest.TestCase):
    def test_main_match_route_uses_player_first_engine(self):
        source = inspect.getsource(get_match_economy_ml)
        self.assertIn("recommend_match_economy", source)
        self.assertNotIn("predict_match_economy_recommendations", source)
        self.assertNotIn("ACTION_TEMPLATES", source)

    def test_both_routes_return_compatible_contract(self):
        with patch("modules.matches.interfaces.routes.mongo_match_repo.find_by_id", return_value=MATCH):
            main = get_match_economy_ml("m")
        with patch("modules.economy_ml.interfaces.routes.mongo_match_repo.find_by_id", return_value=MATCH):
            direct = match_economy_ml("m")
        for payload in (main, direct):
            self.assertEqual(payload["engine"], "player_first_v10")
            self.assertEqual(payload["match_id"], "m")
            self.assertTrue(payload["available"])
            self.assertIsInstance(payload["rounds"], list)
            self.assertIsInstance(payload["limitations"], list)
        self.assertEqual(set(main), set(direct))


if __name__ == "__main__":
    unittest.main()
