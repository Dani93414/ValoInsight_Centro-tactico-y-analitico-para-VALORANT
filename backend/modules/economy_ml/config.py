from __future__ import annotations

PLAN_VALUE_WEIGHTS = {
    "normal": {
        "match_win": 0.20, "round_win": 0.25, "future_economy": 0.25,
        "utility": 0.10, "weapon": 0.05, "armor": 0.03, "player_fit": 0.07, "coherence": 0.10,
        "risk": 0.10, "uncertainty": 0.05,
    },
    "eco": {
        "match_win": 0.10, "round_win": 0.10, "future_economy": 0.45,
        "utility": 0.10, "weapon": 0.03, "armor": 0.02, "player_fit": 0.05, "coherence": 0.10,
        "risk": 0.20, "uncertainty": 0.10,
    },
    "pistol": {
        "match_win": 0.20, "round_win": 0.30, "future_economy": 0.20,
        "utility": 0.13, "weapon": 0.04, "armor": 0.03, "player_fit": 0.07, "coherence": 0.08,
        "risk": 0.08, "uncertainty": 0.05,
    },
    "bonus": {
        "match_win": 0.20, "round_win": 0.20, "future_economy": 0.30,
        "utility": 0.10, "weapon": 0.03, "armor": 0.02, "player_fit": 0.05, "coherence": 0.12,
        "risk": 0.10, "uncertainty": 0.05,
    },
    "stabilization": {
        "match_win": 0.25, "round_win": 0.10, "future_economy": 0.30,
        "utility": 0.10, "weapon": 0.03, "armor": 0.02, "player_fit": 0.05, "coherence": 0.15,
        "risk": 0.10, "uncertainty": 0.05,
    },
    "match_point_or_overtime": {
        "match_win": 0.30, "round_win": 0.35, "future_economy": 0.05,
        "utility": 0.10, "weapon": 0.07, "armor": 0.03, "player_fit": 0.10, "coherence": 0.05,
        "risk": 0.03, "uncertainty": 0.02,
    },
}

MIN_ACTION_SUPPORT = 25
MIN_PROPENSITY = 0.03
