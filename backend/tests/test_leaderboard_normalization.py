from backend.infrastructure.riot_http_client import (
    get_riot_leaderboard,
    _normalize_henrik_leaderboard,
    _normalize_riot_leaderboard,
)
from backend.infrastructure import riot_http_client


def test_henrik_leaderboard_normalization_keeps_card_and_title():
    payload = {
        "status": 1,
        "data": {
            "updated_at": "2026-03-12T21:24:31.213Z",
            "thresholds": [{"tier": 24, "start_index": 1, "threshold": 450}],
            "players": [
                {
                    "card": "card-uuid",
                    "title": "title-uuid",
                    "is_banned": False,
                    "is_anonymized": False,
                    "puuid": "player-puuid",
                    "name": "Player",
                    "tag": "EU",
                    "leaderboard_rank": 1,
                    "tier": 24,
                    "rr": 999,
                    "wins": 42,
                    "updated_at": "2026-03-12T21:24:31.213Z",
                }
            ],
        },
    }

    leaderboard = _normalize_henrik_leaderboard(payload)
    player = leaderboard["players"][0]

    assert leaderboard["source"] == "henrik"
    assert leaderboard["totalPlayers"] == 1
    assert player["PlayerCardID"] == "card-uuid"
    assert player["TitleID"] == "title-uuid"
    assert player["playerCard"] == "card-uuid"
    assert player["playerTitle"] == "title-uuid"
    assert player["leaderboardRank"] == 1
    assert player["rankedRating"] == 999


def test_riot_leaderboard_normalization_leaves_card_and_title_empty():
    payload = {
        "totalPlayers": 1,
        "players": [
            {
                "puuid": "player-puuid",
                "gameName": "Player",
                "tagLine": "EU",
                "leaderboardRank": 1,
                "rankedRating": 999,
                "numberOfWins": 42,
                "competitiveTier": 24,
            }
        ],
    }

    leaderboard = _normalize_riot_leaderboard(payload)
    player = leaderboard["players"][0]

    assert leaderboard["source"] == "riot"
    assert leaderboard["totalPlayers"] == 1
    assert player["PlayerCardID"] is None
    assert player["TitleID"] is None
    assert player["playerCard"] is None
    assert player["playerTitle"] is None
    assert player["leaderboardRank"] == 1
    assert player["rankedRating"] == 999


def test_riot_leaderboard_paginates_with_api_page_limit(monkeypatch):
    calls = []

    class Response:
        status_code = 200
        headers = {}

        def __init__(self, payload):
            self._payload = payload
            self.text = ""

        def json(self):
            return self._payload

    def fake_get(url, headers):
        calls.append(url)
        query = url.split("?", 1)[1]
        params = dict(part.split("=", 1) for part in query.split("&"))
        size = int(params["size"])
        start_index = int(params["startIndex"])
        players = [
            {
                "puuid": f"player-{rank}",
                "gameName": "Player",
                "tagLine": "EU",
                "leaderboardRank": rank,
            }
            for rank in range(start_index + 1, start_index + size + 1)
        ]
        return Response({"totalPlayers": 450, "players": players})

    monkeypatch.setattr(riot_http_client, "_get_headers", lambda: {"X-Riot-Token": "RGAPI-test"})
    monkeypatch.setattr(riot_http_client.requests, "get", fake_get)

    leaderboard = get_riot_leaderboard("act-id", "EU", size=450)

    assert len(leaderboard["players"]) == 450
    assert [url.split("size=", 1)[1].split("&", 1)[0] for url in calls] == ["200", "200", "50"]
    assert [url.split("startIndex=", 1)[1] for url in calls] == ["0", "200", "400"]
