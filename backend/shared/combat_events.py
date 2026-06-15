from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any


def build_team_lookup(players: Iterable[dict[str, Any]] | None) -> dict[str, str]:
    teams: dict[str, str] = {}
    for player in players or []:
        puuid = str(player.get("puuid") or "").strip()
        team_id = str(player.get("teamId") or "").strip()
        if puuid and team_id:
            teams[puuid] = team_id
    return teams


def is_valid_kill(
    kill: Mapping[str, Any] | None,
    team_by_puuid: Mapping[str, str] | None = None,
) -> bool:
    if not kill:
        return False
    killer = str(kill.get("killer") or "").strip()
    victim = str(kill.get("victim") or "").strip()
    if not killer or not victim or killer == victim:
        return False

    teams = team_by_puuid or {}
    killer_team = teams.get(killer)
    victim_team = teams.get(victim)
    return not (killer_team and victim_team and killer_team == victim_team)


def valid_kills(
    kills: Iterable[dict[str, Any]] | None,
    team_by_puuid: Mapping[str, str] | None = None,
) -> list[dict[str, Any]]:
    return [kill for kill in kills or [] if is_valid_kill(kill, team_by_puuid)]


def is_enemy_damage(
    attacker_puuid: Any,
    receiver_puuid: Any,
    team_by_puuid: Mapping[str, str] | None = None,
) -> bool:
    attacker = str(attacker_puuid or "").strip()
    receiver = str(receiver_puuid or "").strip()
    if not attacker or not receiver or attacker == receiver:
        return False

    teams = team_by_puuid or {}
    attacker_team = teams.get(attacker)
    receiver_team = teams.get(receiver)
    return not (
        attacker_team
        and receiver_team
        and attacker_team == receiver_team
    )


def valid_assistants(
    kill: Mapping[str, Any] | None,
    team_by_puuid: Mapping[str, str] | None = None,
) -> list[str]:
    if not is_valid_kill(kill, team_by_puuid):
        return []

    killer = str(kill.get("killer") or "").strip()
    victim = str(kill.get("victim") or "").strip()
    teams = team_by_puuid or {}
    killer_team = teams.get(killer)
    result: list[str] = []
    seen: set[str] = set()
    for value in kill.get("assistants") or []:
        assistant = str(value or "").strip()
        if (
            not assistant
            or assistant in seen
            or assistant == killer
            or assistant == victim
        ):
            continue
        assistant_team = teams.get(assistant)
        if killer_team and assistant_team and assistant_team != killer_team:
            continue
        seen.add(assistant)
        result.append(assistant)
    return result
