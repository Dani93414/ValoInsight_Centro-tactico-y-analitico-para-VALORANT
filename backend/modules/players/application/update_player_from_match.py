"""Update lifetime player profiles from a single match document."""
from __future__ import annotations

import copy
import logging
from typing import Any

from modules.players.infrastructure import mongo_player_repo
from shared.combat_events import (
    build_team_lookup,
    is_enemy_damage,
    is_valid_kill,
    valid_assistants,
)
from shared.weapon_attribution import compute_precise_weapon_stats_core

logger = logging.getLogger(__name__)


def _extract_player_combat_stats(
    match_obj: dict,
    puuid: str,
) -> tuple[int, int, int] | None:
    rounds = match_obj.get("roundResults") or []
    if not rounds:
        return None

    team_by_puuid = build_team_lookup(match_obj.get("players") or [])
    kills = 0
    deaths = 0
    assists = 0
    for round_obj in rounds:
        seen: set[tuple[Any, Any, Any, tuple[str, ...]]] = set()
        for player_stat in round_obj.get("playerStats") or []:
            for kill in player_stat.get("kills") or []:
                key = (
                    kill.get("timeSinceRoundStartMillis"),
                    kill.get("killer"),
                    kill.get("victim"),
                    tuple(sorted(kill.get("assistants") or [])),
                )
                if key in seen:
                    continue
                seen.add(key)

                if kill.get("victim") == puuid:
                    deaths += 1
                if is_valid_kill(kill, team_by_puuid):
                    if kill.get("killer") == puuid:
                        kills += 1
                    if puuid in valid_assistants(kill, team_by_puuid):
                        assists += 1
    return kills, deaths, assists


def _normalize_region(raw_region: Any) -> str:
    if not raw_region:
        return "UNKNOWN"
    return str(raw_region).strip().upper()


def _extract_player_shots(match_obj: dict, puuid: str) -> tuple[int, int, int]:
    hs_count, body_count, leg_count = 0, 0, 0
    team_by_puuid = build_team_lookup(match_obj.get("players") or [])
    for round_result in match_obj.get("roundResults", []) or []:
        for p_stat in round_result.get("playerStats", []) or []:
            if p_stat.get("puuid") != puuid:
                continue
            for dmg in p_stat.get("damage", []) or []:
                if not is_enemy_damage(puuid, dmg.get("receiver"), team_by_puuid):
                    continue
                hs_count += int(dmg.get("headshots", 0) or 0)
                body_count += int(dmg.get("bodyshots", 0) or 0)
                leg_count += int(dmg.get("legshots", 0) or 0)
    return hs_count, body_count, leg_count


def _extract_player_weapon_stats(match_obj: dict, puuid: str) -> dict[str, dict[str, int]]:
    precise_weapon_stats = compute_precise_weapon_stats_core(
        match_obj.get("roundResults") or [],
        puuid,
        build_team_lookup(match_obj.get("players") or []),
    )

    weapon_stats: dict[str, dict[str, int]] = {}
    for weapon_id, payload in precise_weapon_stats.items():
        weapon_stats[weapon_id] = {
            "uses": int(payload.get("rounds", 0) or 0),
            "kills": int(payload.get("kills", 0) or 0),
            "deaths": int(payload.get("deaths", 0) or 0),
        }
    return weapon_stats


def _merge_nested_weapon_stats(
    existing: dict | None, incoming: dict | None
) -> dict:
    merged = copy.deepcopy(existing or {})
    for weapon_id, payload in (incoming or {}).items():
        if weapon_id not in merged:
            merged[weapon_id] = {"uses": 0, "kills": 0, "deaths": 0}
        merged[weapon_id]["uses"] += int(payload.get("uses", 0) or 0)
        merged[weapon_id]["kills"] += int(payload.get("kills", 0) or 0)
        merged[weapon_id]["deaths"] += int(payload.get("deaths", 0) or 0)
    return merged


def _compute_best_weapon_by_kd(
    weapon_stats: dict | None, min_uses: int = 10
) -> dict | None:
    best = None
    for weapon_id, payload in (weapon_stats or {}).items():
        uses = int(payload.get("uses", 0) or 0)
        kills = int(payload.get("kills", 0) or 0)
        deaths = int(payload.get("deaths", 0) or 0)
        if uses < min_uses:
            continue
        kd = round(kills / (deaths if deaths > 0 else 1), 3)
        candidate = {
            "weaponId": weapon_id,
            "kd": kd,
            "uses": uses,
            "kills": kills,
            "deaths": deaths,
        }
        if not best or candidate["kd"] > best["kd"]:
            best = candidate
        elif best and candidate["kd"] == best["kd"] and candidate["kills"] > best["kills"]:
            best = candidate
    return best


def _top_agent_list(agent_stats: dict | None, top_n: int = 5) -> list[dict]:
    rows = []
    for agent_id, count in (agent_stats or {}).items():
        rows.append({"agentId": agent_id, "matches": int(count or 0)})
    rows.sort(key=lambda row: row["matches"], reverse=True)
    return rows[:top_n]


def update_players_from_match(match_obj: dict) -> None:
    """Extract per-player stats from a match and upsert lifetime player profiles."""
    match_info = match_obj.get("matchInfo") or {}
    match_region = _normalize_region(match_info.get("region"))
    match_id = match_info.get("matchId")
    if not match_id:
        return

    winning_team = next(
        (t.get("teamId") for t in (match_obj.get("teams", []) or []) if t.get("won")),
        None,
    )
    match_players = match_obj.get("players", []) or []

    for p in match_players:
        puuid = p.get("puuid")
        if not puuid:
            continue

        party_id = p.get("partyId", puuid)
        team_id = p.get("teamId")
        character_id = str(p.get("characterId") or "UNKNOWN")
        s = p.get("stats", {}) or {}

        combat_stats = _extract_player_combat_stats(match_obj, puuid)
        kills, deaths, assists = combat_stats or (
            int(s.get("kills", 0) or 0),
            int(s.get("deaths", 0) or 0),
            int(s.get("assists", 0) or 0),
        )
        score = int(s.get("score", 0) or 0)
        playtime = int(s.get("playtimeMillis", 0) or 0)
        rounds_played = int(s.get("roundsPlayed", 0) or 0)
        account_level = int(p.get("accountLevel", 20) or 20)
        is_win = 1 if team_id == winning_team else 0

        hs_count, body_count, leg_count = _extract_player_shots(match_obj, puuid)
        total_shots = hs_count + body_count + leg_count
        weapon_stats_delta = _extract_player_weapon_stats(match_obj, puuid)

        teammates_delta: dict[str, int] = {}
        opponents_delta: dict[str, int] = {}
        for other in match_players:
            other_puuid = other.get("puuid")
            if not other_puuid or other_puuid == puuid:
                continue
            if other.get("teamId") == team_id:
                teammates_delta[other_puuid] = teammates_delta.get(other_puuid, 0) + 1
            else:
                opponents_delta[other_puuid] = opponents_delta.get(other_puuid, 0) + 1

        agent_stats_delta = {character_id: 1}

        player = mongo_player_repo.find_raw_by_puuid(puuid)

        if not player:
            merged_weapon_stats = _merge_nested_weapon_stats({}, weapon_stats_delta)
            best_weapon = _compute_best_weapon_by_kd(merged_weapon_stats)
            mongo_player_repo.insert_player({
                "puuid": puuid,
                "gameName": p.get("gameName"),
                "tagLine": p.get("tagLine"),
                "region": match_region,
                "accountLevel": account_level,
                "totalMatches": 1,
                "totalWins": is_win,
                "totalKills": kills,
                "totalDeaths": deaths,
                "totalAssists": assists,
                "totalScore": score,
                "totalPlaytimeMillis": playtime,
                "totalRoundsPlayed": rounds_played,
                "totalHeadshots": hs_count,
                "totalBodyshots": body_count,
                "totalLegshots": leg_count,
                "kdRatio": round(kills / (deaths if deaths > 0 else 1), 2),
                "winRatePercentage": round((is_win / 1) * 100, 1),
                "averageCombatScore": round(score / rounds_played, 1) if rounds_played > 0 else 0,
                "headshotPercentage": round((hs_count / total_shots) * 100, 1) if total_shots > 0 else 0,
                "matches": [match_id],
                "partyStats": {party_id: {"matchesTogether": 1, "winsTogether": is_win}},
                "teammates": teammates_delta,
                "opponents": opponents_delta,
                "agentStats": agent_stats_delta,
                "mostPlayedAgents": _top_agent_list(agent_stats_delta),
                "weaponStats": merged_weapon_stats,
                "bestWeaponByKD": best_weapon,
            })
            continue

        if match_id in (player.get("matches", []) or []):
            continue

        new_matches = int(player.get("totalMatches", 0) or 0) + 1
        new_wins = int(player.get("totalWins", 0) or 0) + is_win
        new_kills = int(player.get("totalKills", 0) or 0) + kills
        new_deaths = int(player.get("totalDeaths", 0) or 0) + deaths
        new_assists = int(player.get("totalAssists", 0) or 0) + assists
        new_score = int(player.get("totalScore", 0) or 0) + score
        new_playtime = int(player.get("totalPlaytimeMillis", 0) or 0) + playtime
        new_rounds = int(player.get("totalRoundsPlayed", 0) or 0) + rounds_played

        new_hs = int(player.get("totalHeadshots", 0) or 0) + hs_count
        new_body = int(player.get("totalBodyshots", 0) or 0) + body_count
        new_leg = int(player.get("totalLegshots", 0) or 0) + leg_count
        new_total_shots = new_hs + new_body + new_leg

        party_stats = copy.deepcopy(player.get("partyStats", {}) or {})
        if party_id not in party_stats:
            party_stats[party_id] = {"matchesTogether": 0, "winsTogether": 0}
        party_stats[party_id]["matchesTogether"] += 1
        party_stats[party_id]["winsTogether"] += is_win

        teammates = copy.deepcopy(player.get("teammates", {}) or {})
        for other_puuid, count in teammates_delta.items():
            teammates[other_puuid] = teammates.get(other_puuid, 0) + count

        opponents = copy.deepcopy(player.get("opponents", {}) or {})
        for other_puuid, count in opponents_delta.items():
            opponents[other_puuid] = opponents.get(other_puuid, 0) + count

        agent_stats = copy.deepcopy(player.get("agentStats", {}) or {})
        for agent_id, count in agent_stats_delta.items():
            agent_stats[agent_id] = agent_stats.get(agent_id, 0) + count

        merged_weapon_stats = _merge_nested_weapon_stats(
            player.get("weaponStats", {}),
            weapon_stats_delta,
        )
        best_weapon = _compute_best_weapon_by_kd(merged_weapon_stats)

        matches = list(player.get("matches", []) or [])
        matches.append(match_id)

        mongo_player_repo.update_player(puuid, {
            "gameName": p.get("gameName"),
            "tagLine": p.get("tagLine"),
            "accountLevel": account_level,
            "region": match_region,
            "totalMatches": new_matches,
            "totalWins": new_wins,
            "totalKills": new_kills,
            "totalDeaths": new_deaths,
            "totalAssists": new_assists,
            "totalScore": new_score,
            "totalPlaytimeMillis": new_playtime,
            "totalRoundsPlayed": new_rounds,
            "totalHeadshots": new_hs,
            "totalBodyshots": new_body,
            "totalLegshots": new_leg,
            "kdRatio": round(new_kills / (new_deaths if new_deaths > 0 else 1), 2),
            "winRatePercentage": round((new_wins / new_matches) * 100, 1),
            "averageCombatScore": round(new_score / new_rounds, 1) if new_rounds > 0 else 0,
            "headshotPercentage": round((new_hs / new_total_shots) * 100, 1) if new_total_shots > 0 else 0,
            "matches": matches,
            "partyStats": party_stats,
            "teammates": teammates,
            "opponents": opponents,
            "agentStats": agent_stats,
            "mostPlayedAgents": _top_agent_list(agent_stats),
            "weaponStats": merged_weapon_stats,
            "bestWeaponByKD": best_weapon,
        })
