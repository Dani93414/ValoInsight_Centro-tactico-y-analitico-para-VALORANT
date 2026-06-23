from __future__ import annotations

from typing import Any


ULT_REPLACEMENT_AGENT_NAMES = {
    "jett": 0.8,
    "chamber": 0.75,
    "raze": 0.55,
    "neon": 0.35,
}


def _display_round(raw_round: Any, index: int) -> int:
    try:
        value = int(raw_round)
        return value + 1 if value == index else value
    except (TypeError, ValueError):
        return index + 1


def _used_ult(pstat: dict[str, Any]) -> bool:
    ability = pstat.get("ability") if isinstance(pstat.get("ability"), dict) else {}
    effects = ability.get("ultimateEffects")
    if effects in (None, [], {}, ""):
        return False
    return True


def infer_ultimate_state(match: dict[str, Any], puuid: str, agent_name: str, round_number: int) -> dict[str, Any]:
    rounds_since = None
    kills_since = 0
    for index, round_obj in enumerate(match.get("roundResults") or []):
        number = _display_round(round_obj.get("roundNum"), index)
        if number >= round_number:
            break
        for pstat in round_obj.get("playerStats") or []:
            if pstat.get("puuid") != puuid:
                continue
            kills_since += sum(1 for kill in pstat.get("kills") or [] if kill.get("killer") == puuid)
            if _used_ult(pstat):
                rounds_since = 0
                kills_since = 0
            elif rounds_since is not None:
                rounds_since += 1
    if rounds_since is None:
        probability = min(0.65, kills_since / 8)
    else:
        probability = min(0.85, rounds_since / 7 + kills_since / 8)
    replacement = 0.0
    name = str(agent_name or "").lower()
    for key, score in ULT_REPLACEMENT_AGENT_NAMES.items():
        if key in name:
            replacement = score
            break
    return {
        "estimated_ult_available_probability": round(probability, 4),
        "rounds_since_last_ult_used": rounds_since,
        "kills_since_last_ult_used": kills_since,
        "agent_ultimate_economy_replacement_score": replacement,
        "availability_certainty": "estimated_not_observed",
    }


def used_ultimate_this_round(round_player_stat: dict[str, Any]) -> bool:
    return _used_ult(round_player_stat)
