import os
import unittest
import requests
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv()

API_KEY = os.getenv("RIOT_API_KEY")

# Datos de ejemplo (puedes cambiarlos)
REGION = "europe"  # cambia según tu servidor ("na", "ap", etc.)
GAME_NAME = "No Screams"  # nombre de jugador
TAG_LINE = "GFS"    # tag del jugador

# Construir URL del endpoint
url = f"https://{REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{GAME_NAME}/{TAG_LINE}"

RUN_EXTERNAL_TESTS = os.getenv("RUN_EXTERNAL_TESTS") == "1"


def _fetch_account() -> requests.Response:
    headers = {"X-Riot-Token": API_KEY or ""}
    return requests.get(url, headers=headers, timeout=20)


class RiotApiConnectivityTest(unittest.TestCase):
    @unittest.skipUnless(
        RUN_EXTERNAL_TESTS,
        "External Riot API test disabled. Set RUN_EXTERNAL_TESTS=1 to enable.",
    )
    def test_riot_account_lookup(self):
        response = _fetch_account()
        self.assertEqual(
            response.status_code,
            200,
            msg=f"Unexpected status: {response.status_code} body={response.text}",
        )


if __name__ == "__main__":
    unittest.main()
