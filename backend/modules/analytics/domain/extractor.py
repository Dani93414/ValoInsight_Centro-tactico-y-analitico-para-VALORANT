from __future__ import annotations

import copy
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from modules.analytics.domain.constants import (
    SIDE_ATTACK,
    SIDE_DEFENSE,
    SIDE_UNKNOWN,
    TRADE_WINDOW_MS,
)
from modules.analytics.infrastructure.reference_data import (
    resolve_agent_name,
    resolve_agent_role,
    resolve_map_name,
    resolve_weapon_name,
)

from shared.math_utils import safe_div as _safe_div_raw
from shared.stat_formulas import finalize_core_stats


def safe_div(numerator: float, denominator: float) -> float:
    return _safe_div_raw(numerator, denominator, 4)


def clamp_non_negative(value: int | float) -> int | float:
    return value if value >= 0 else 0


def invert_side(side: str) -> str:
    side_norm = str(side).strip().lower()
    if side_norm in {"attack", "attacker", "attackers", "atk"}:
        return SIDE_DEFENSE
    if side_norm in {"defense", "defender", "defenders", "def"}:
        return SIDE_ATTACK
    return SIDE_UNKNOWN


def normalize_side(side: str) -> str:
    side_norm = str(side).strip().lower()
    if side_norm in {"attack", "attacker", "attackers", "atk"}:
        return SIDE_ATTACK
    if side_norm in {"defense", "defender", "defenders", "def"}:
        return SIDE_DEFENSE
    return SIDE_UNKNOWN


def new_scope_stats() -> dict:
    return {
        "matches": 0,
        "rounds": 0,
        "wins": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "score": 0,
        "damage_dealt": 0,
        "damage_received": 0,
        "damage_delta": 0,
        "headshots": 0,
        "bodyshots": 0,
        "legshots": 0,
        "first_kills": 0,
        "first_deaths": 0,
        "opening_duel_wins": 0,
        "opening_duel_losses": 0,
        "trade_kills": 0,
        "traded_deaths": 0,
        "clutch_opportunities": 0,
        "clutches_won": 0,
        "survival_rounds": 0,
        "rounds_with_kill": 0,
        "rounds_with_assist": 0,
        "rounds_with_multikill": 0,
        "multi_2k": 0,
        "multi_3k": 0,
        "multi_4k": 0,
        "multi_5k": 0,
        "econ_spent": 0,
        "loadout_value_total": 0,
        "weapon_stats": {},
        "buy_buckets": {
            "eco": {"rounds": 0, "wins": 0, "kills": 0, "deaths": 0, "damage_dealt": 0, "spent": 0},
            "low_buy": {"rounds": 0, "wins": 0, "kills": 0, "deaths": 0, "damage_dealt": 0, "spent": 0},
            "full_buy": {"rounds": 0, "wins": 0, "kills": 0, "deaths": 0, "damage_dealt": 0, "spent": 0},
        },
    }


def _new_weapon_scope(weapon_id: str, weapon_name: Optional[str] = None) -> dict:
    return {
        "weapon_id": weapon_id,
        "weapon_name": weapon_name or "Unknown",
        "rounds": 0,
        "wins": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "score": 0,
        "damage_dealt": 0,
        "damage_received": 0,
        "damage_delta": 0,
        "headshots": 0,
        "bodyshots": 0,
        "legshots": 0,
        "first_kills": 0,
        "first_deaths": 0,
        "opening_duel_wins": 0,
        "opening_duel_losses": 0,
        "trade_kills": 0,
        "traded_deaths": 0,
        "clutch_opportunities": 0,
        "clutches_won": 0,
        "survival_rounds": 0,
        "rounds_with_kill": 0,
        "rounds_with_assist": 0,
        "rounds_with_multikill": 0,
        "multi_2k": 0,
        "multi_3k": 0,
        "multi_4k": 0,
        "multi_5k": 0,
        "econ_spent": 0,
        "loadout_value_total": 0,
    }


def _bucket_from_spent(spent: int) -> str:
    if spent <= 2400:
        return "eco"
    if spent <= 3900:
        return "low_buy"
    return "full_buy"


def _unique_kill_key(kill: dict) -> tuple:
    return (
        kill.get("timeSinceRoundStartMillis"),
        kill.get("killer"),
        kill.get("victim"),
        tuple(sorted(kill.get("assistants", []) or [])),
    )


def _collect_round_kills(round_obj: dict) -> List[dict]:
    seen = set()
    all_kills = []
    for pstat in round_obj.get("playerStats", []):
        for kill in pstat.get("kills", []) or []:
            key = _unique_kill_key(kill)
            if key in seen:
                continue
            seen.add(key)
            all_kills.append(copy.deepcopy(kill))
    all_kills.sort(key=lambda item: item.get("timeSinceRoundStartMillis", 10**12))
    return all_kills


def _player_stats_map(round_obj: dict) -> Dict[str, dict]:
    return {
        pstat.get("puuid"): pstat
        for pstat in round_obj.get("playerStats", [])
        if pstat.get("puuid")
    }


def _infer_winning_side(
    round_obj: dict,
    pstats_map: Dict[str, dict],
    winning_team_id: Optional[str],
    player_team_map: Optional[Dict[str, str]] = None,
    round_num: Optional[int] = None,
    starting_attack_team: Optional[str] = None,
) -> str:
    role = normalize_side(round_obj.get("winningTeamRole"))
    if role in {SIDE_ATTACK, SIDE_DEFENSE}:
        return role

    ptmap = player_team_map or {}

    bomb_planter = round_obj.get("bombPlanter")
    if bomb_planter:
        planter_team_id = ptmap.get(bomb_planter) or (pstats_map.get(bomb_planter) or {}).get("teamId")
        if planter_team_id and winning_team_id:
            return SIDE_ATTACK if planter_team_id == winning_team_id else SIDE_DEFENSE

    bomb_defuser = round_obj.get("bombDefuser")
    if bomb_defuser:
        defuser_team_id = ptmap.get(bomb_defuser) or (pstats_map.get(bomb_defuser) or {}).get("teamId")
        if defuser_team_id and winning_team_id:
            return SIDE_DEFENSE if defuser_team_id == winning_team_id else SIDE_ATTACK

    if round_num is not None and starting_attack_team and winning_team_id:
        attacking_team = _attacking_team_for_round(round_num, starting_attack_team, set(ptmap.values()))
        if attacking_team:
            return SIDE_ATTACK if winning_team_id == attacking_team else SIDE_DEFENSE

    return SIDE_UNKNOWN


def _attacking_team_for_round(
    round_num: int,
    starting_attack_team: str,
    all_team_ids: set,
) -> Optional[str]:
    other_teams = all_team_ids - {starting_attack_team}
    other_team = next(iter(other_teams), None)
    if not other_team:
        return None

    if round_num < 12:
        return starting_attack_team
    if round_num < 24:
        return other_team
    # Overtime: sides alternate every round (AB, AB, AB...)
    return starting_attack_team if (round_num - 24) % 2 == 0 else other_team


def _get_player_damage_dealt_and_shots(round_pstat: dict) -> tuple[int, int, int, int]:
    total_damage = 0
    hs = 0
    body = 0
    leg = 0
    for dmg in round_pstat.get("damage", []) or []:
        total_damage += int(dmg.get("damage", 0) or 0)
        hs += int(dmg.get("headshots", 0) or 0)
        body += int(dmg.get("bodyshots", 0) or 0)
        leg += int(dmg.get("legshots", 0) or 0)
    return total_damage, hs, body, leg


def _get_player_damage_received(round_obj: dict, puuid: str) -> int:
    total_received = 0
    for pstat in round_obj.get("playerStats", []) or []:
        for dmg in pstat.get("damage", []) or []:
            if dmg.get("receiver") == puuid:
                total_received += int(dmg.get("damage", 0) or 0)
    return total_received


def _get_round_assists_from_kills(kills: Iterable[dict], puuid: str) -> int:
    count = 0
    for kill in kills:
        assistants = kill.get("assistants", []) or []
        count += sum(1 for assistant in assistants if assistant == puuid)
    return count


def _get_player_kills_count(round_pstat: dict, puuid: str) -> int:
    count = 0
    for kill in round_pstat.get("kills", []) or []:
        if kill.get("killer") == puuid:
            count += 1
    return count


def _did_player_die(kills: Iterable[dict], puuid: str) -> bool:
    return any(kill.get("victim") == puuid for kill in kills)


def _find_first_kill(kills: List[dict]) -> Optional[dict]:
    return kills[0] if kills else None


def _find_trade_kill_count(
    kills: List[dict],
    puuid: str,
    player_team: Set[str],
    enemy_team: Set[str],
) -> tuple[int, int]:
    """
    trade_kills: el jugador mata a alguien que mató a su compañero hace <= TRADE_WINDOW_MS
    traded_deaths: el jugador muere y un compañero mata a su killer en <= TRADE_WINDOW_MS
    """
    trade_kills = 0
    traded_deaths = 0

    for idx, kill in enumerate(kills):
        kill_time = int(kill.get("timeSinceRoundStartMillis", 0) or 0)
        killer = kill.get("killer")
        victim = kill.get("victim")

        if killer == puuid:
            for prev in kills[:idx]:
                prev_time = int(prev.get("timeSinceRoundStartMillis", 0) or 0)
                if kill_time - prev_time > TRADE_WINDOW_MS:
                    continue
                if prev.get("killer") == victim and prev.get("victim") in player_team:
                    trade_kills += 1
                    break

        if victim == puuid:
            for nxt in kills[idx + 1 :]:
                next_time = int(nxt.get("timeSinceRoundStartMillis", 0) or 0)
                if next_time - kill_time > TRADE_WINDOW_MS:
                    break
                if nxt.get("killer") in player_team and nxt.get("victim") == killer:
                    traded_deaths += 1
                    break

    return trade_kills, traded_deaths


def _find_clutch_for_player(
    kills: List[dict],
    puuid: str,
    player_team: Set[str],
    enemy_team: Set[str],
    player_team_won_round: bool,
) -> tuple[int, int]:
    """
    clutch opportunity:
      en algún momento el jugador queda como único superviviente de su equipo
      frente a 1+ enemigos.
    clutch won:
      si además su equipo gana la ronda.
    """
    alive_player_team = set(player_team)
    alive_enemy_team = set(enemy_team)

    clutch_enemy_count = None
    player_alive = puuid in alive_player_team

    for kill in kills:
        victim = kill.get("victim")
        if victim in alive_player_team:
            alive_player_team.remove(victim)
        elif victim in alive_enemy_team:
            alive_enemy_team.remove(victim)

        player_alive = puuid in alive_player_team

        if player_alive and len(alive_player_team) == 1 and len(alive_enemy_team) >= 1:
            clutch_enemy_count = len(alive_enemy_team)
            break

    if clutch_enemy_count is None:
        return 0, 0

    return 1, 1 if player_team_won_round else 0


def _upsert_weapon_stats(scope: dict, weapon_id: str) -> dict:
    weapon_id = str(weapon_id or "UNKNOWN")
    if weapon_id not in scope["weapon_stats"]:
        scope["weapon_stats"][weapon_id] = _new_weapon_scope(
            weapon_id=weapon_id,
            weapon_name=resolve_weapon_name(weapon_id),
        )
    return scope["weapon_stats"][weapon_id]


def _update_weapon_scope(weapon_scope: dict, round_payload: dict) -> None:
    for key in (
        "rounds",
        "wins",
        "kills",
        "deaths",
        "assists",
        "score",
        "damage_dealt",
        "damage_received",
        "damage_delta",
        "headshots",
        "bodyshots",
        "legshots",
        "first_kills",
        "first_deaths",
        "opening_duel_wins",
        "opening_duel_losses",
        "trade_kills",
        "traded_deaths",
        "clutch_opportunities",
        "clutches_won",
        "survival_rounds",
        "rounds_with_kill",
        "rounds_with_assist",
        "rounds_with_multikill",
        "multi_2k",
        "multi_3k",
        "multi_4k",
        "multi_5k",
        "econ_spent",
        "loadout_value_total",
    ):
        weapon_scope[key] += round_payload.get(key, 0)


def _update_scope(scope: dict, weapon_id: str, round_payload: dict, spent: int) -> None:
    for key in (
        "rounds",
        "wins",
        "kills",
        "deaths",
        "assists",
        "score",
        "damage_dealt",
        "damage_received",
        "damage_delta",
        "headshots",
        "bodyshots",
        "legshots",
        "first_kills",
        "first_deaths",
        "opening_duel_wins",
        "opening_duel_losses",
        "trade_kills",
        "traded_deaths",
        "clutch_opportunities",
        "clutches_won",
        "survival_rounds",
        "rounds_with_kill",
        "rounds_with_assist",
        "rounds_with_multikill",
        "multi_2k",
        "multi_3k",
        "multi_4k",
        "multi_5k",
        "econ_spent",
        "loadout_value_total",
    ):
        scope[key] += round_payload.get(key, 0)

    bucket_name = _bucket_from_spent(spent)
    bucket = scope["buy_buckets"][bucket_name]
    bucket["rounds"] += 1
    bucket["wins"] += round_payload.get("wins", 0)
    bucket["kills"] += round_payload.get("kills", 0)
    bucket["deaths"] += round_payload.get("deaths", 0)
    bucket["damage_dealt"] += round_payload.get("damage_dealt", 0)
    bucket["spent"] += spent

    weapon_scope = _upsert_weapon_stats(scope, weapon_id)
    _update_weapon_scope(weapon_scope, round_payload)


def _finalize_stats_block(stats: dict) -> dict:
    finalize_core_stats(stats)

    for bucket_name, bucket in stats.get("buy_buckets", {}).items():
        bucket_rounds = bucket.get("rounds", 0)
        bucket["win_rate"] = safe_div(bucket.get("wins", 0) * 100.0, bucket_rounds)
        bucket["kd_ratio"] = safe_div(bucket.get("kills", 0), max(bucket.get("deaths", 0), 1))
        bucket["adr"] = safe_div(bucket.get("damage_dealt", 0), bucket_rounds)
        bucket["damage_per_1000_credits"] = safe_div(bucket.get("damage_dealt", 0) * 1000.0, bucket.get("spent", 0))

    for weapon_id, weapon_stats in stats.get("weapon_stats", {}).items():
        finalize_core_stats(weapon_stats)

    return stats


def _detect_starting_attack_team(
    round_results: List[dict],
    player_team_map: Dict[str, str],
) -> Optional[str]:
    """Scan rounds 0-11 for a bombPlanter to determine which team started on attack."""
    for r in round_results:
        rnum = r.get("roundNum")
        if not isinstance(rnum, int) or rnum >= 12:
            continue
        planter = r.get("bombPlanter")
        if planter and planter in player_team_map:
            return player_team_map[planter]
    return None


def build_player_match_analytics_docs(match_obj: dict) -> List[dict]:
    """Legacy wrapper — returns list of standalone analytics docs (for compatibility)."""
    embedded = build_player_analytics_embedded(match_obj)
    if not embedded:
        return []

    match_info = match_obj.get("matchInfo") or {}
    players = match_obj.get("players", []) or []
    teams = match_obj.get("teams", []) or []
    team_winner_map = {team["teamId"]: bool(team.get("won")) for team in teams if team.get("teamId")}

    docs: List[dict] = []
    for player in players:
        puuid = player.get("puuid")
        if not puuid or puuid not in embedded:
            continue
        analytics = embedded[puuid]
        player_stats = player.get("stats", {}) or {}
        docs.append({
            "match_id": str(match_info.get("matchId")),
            "puuid": puuid,
            "game_name": player.get("gameName"),
            "tag_line": player.get("tagLine"),
            "team_id": player.get("teamId"),
            "won_match": analytics["won_match"],
            "is_draw": analytics["is_draw"],
            "is_ranked": True,
            "queue_id": match_info.get("queueId"),
            "game_mode": match_info.get("gameMode"),
            "region": match_info.get("region"),
            "game_start_millis": match_info.get("gameStartMillis"),
            "season_id": str(match_info.get("seasonId") or "UNKNOWN"),
            "map_id": str(match_info.get("mapId") or "UNKNOWN"),
            "map_name": analytics["map_name"],
            "agent_id": str(player.get("characterId") or "UNKNOWN"),
            "agent_name": analytics["agent_name"],
            "role": analytics["role"],
            "competitive_tier": player.get("competitiveTier"),
            "competitive_tier_image": player.get("competitiveTierImage"),
            "account_level": player.get("accountLevel"),
            "player_totals_from_match": {
                "kills": int(player_stats.get("kills", 0) or 0),
                "deaths": int(player_stats.get("deaths", 0) or 0),
                "assists": int(player_stats.get("assists", 0) or 0),
                "score": int(player_stats.get("score", 0) or 0),
                "rounds_played": int(player_stats.get("roundsPlayed", 0) or 0),
                "match_duration_millis": int(match_info.get("gameLengthMillis", 0) or 0),
                "playtime_millis": int(player_stats.get("playtimeMillis", 0) or 0),
            },
            "overview": analytics["overview"],
            "sides": analytics["sides"],
        })
    return docs


def build_player_analytics_embedded(match_obj: dict) -> Dict[str, dict]:
    """
    Compute per-player analytics and return a dict keyed by puuid.
    Each value is the analytics subdocument to embed in matches.players[].analytics.
    Only processes ranked matches; returns empty dict otherwise.
    """
    match_info = match_obj.get("matchInfo") or {}
    if not match_info.get("isRanked"):
        return {}

    match_id = match_info.get("matchId")
    if not match_id:
        return []

    players = match_obj.get("players", []) or []
    teams = match_obj.get("teams", []) or []
    round_results = match_obj.get("roundResults", []) or []

    team_winner_map = {team["teamId"]: bool(team.get("won")) for team in teams if team.get("teamId")}
    winning_team_id = next((team_id for team_id, won in team_winner_map.items() if won), None)
    is_draw = bool(teams) and not any(team.get("won") for team in teams)

    player_team = {p["puuid"]: p.get("teamId") for p in players if p.get("puuid")}
    team_members: Dict[str, Set[str]] = defaultdict(set)
    for player in players:
        puuid = player.get("puuid")
        team_id = player.get("teamId")
        if puuid and team_id:
            team_members[team_id].add(puuid)

    starting_attack_team = _detect_starting_attack_team(round_results, player_team)

    result: Dict[str, dict] = {}

    for player in players:
        puuid = player.get("puuid")
        if not puuid:
            continue

        team_id = player.get("teamId")
        enemy_team_ids = [tid for tid in team_members.keys() if tid != team_id]
        enemy_team_id = enemy_team_ids[0] if enemy_team_ids else None

        player_stats = player.get("stats", {}) or {}
        agent_id = str(player.get("characterId") or "UNKNOWN")
        role = resolve_agent_role(agent_id)
        map_id = str(match_info.get("mapId") or "UNKNOWN")
        season_id = str(match_info.get("seasonId") or "UNKNOWN")

        overview = new_scope_stats()
        overview["matches"] = 1

        sides = {
            SIDE_ATTACK: new_scope_stats(),
            SIDE_DEFENSE: new_scope_stats(),
        }

        for round_obj in round_results:
            pstats_map = _player_stats_map(round_obj)
            round_pstat = pstats_map.get(puuid, {})
            all_kills = _collect_round_kills(round_obj)

            round_num = round_obj.get("roundNum")
            if not isinstance(round_num, int):
                round_num = None

            own_team_won_round = round_obj.get("winningTeam") == team_id
            winning_team_role = _infer_winning_side(
                round_obj=round_obj,
                pstats_map=pstats_map,
                winning_team_id=round_obj.get("winningTeam"),
                player_team_map=player_team,
                round_num=round_num,
                starting_attack_team=starting_attack_team,
            )
            if own_team_won_round:
                round_side = winning_team_role
            else:
                round_side = invert_side(winning_team_role)

            if round_side not in {SIDE_ATTACK, SIDE_DEFENSE}:
                round_side = SIDE_UNKNOWN

            player_team_set = team_members.get(team_id, set())
            enemy_team_set = team_members.get(enemy_team_id, set()) if enemy_team_id else set()

            dealt_damage, hs, body, leg = _get_player_damage_dealt_and_shots(round_pstat)
            received_damage = _get_player_damage_received(round_obj, puuid)
            assists_round = _get_round_assists_from_kills(all_kills, puuid)
            kills_round = _get_player_kills_count(round_pstat, puuid)
            died = _did_player_die(all_kills, puuid)
            deaths_round = 1 if died else 0

            score_round = int(round_pstat.get("score", 0) or 0)
            economy = round_pstat.get("economy", {}) or {}
            spent = int(economy.get("spent", 0) or 0)
            loadout_value = int(economy.get("loadoutValue", 0) or 0)
            equipped_weapon_id = str(economy.get("weapon") or "UNKNOWN")

            first_kill = _find_first_kill(all_kills)
            first_kills = 0
            first_deaths = 0
            opening_duel_wins = 0
            opening_duel_losses = 0

            if first_kill:
                if first_kill.get("killer") == puuid:
                    first_kills = 1
                    opening_duel_wins = 1
                elif first_kill.get("victim") == puuid:
                    first_deaths = 1
                    opening_duel_losses = 1

            trade_kills, traded_deaths = _find_trade_kill_count(
                kills=all_kills,
                puuid=puuid,
                player_team=player_team_set,
                enemy_team=enemy_team_set,
            )

            clutch_opportunities, clutches_won = _find_clutch_for_player(
                kills=all_kills,
                puuid=puuid,
                player_team=player_team_set,
                enemy_team=enemy_team_set,
                player_team_won_round=own_team_won_round,
            )

            survival_rounds = 0 if died else 1
            rounds_with_kill = 1 if kills_round > 0 else 0
            rounds_with_assist = 1 if assists_round > 0 else 0
            rounds_with_multikill = 1 if kills_round >= 2 else 0
            multi_2k = 1 if kills_round == 2 else 0
            multi_3k = 1 if kills_round == 3 else 0
            multi_4k = 1 if kills_round == 4 else 0
            multi_5k = 1 if kills_round >= 5 else 0

            round_payload = {
                "rounds": 1,
                "wins": 1 if own_team_won_round else 0,
                "kills": kills_round,
                "deaths": deaths_round,
                "assists": assists_round,
                "score": score_round,
                "damage_dealt": dealt_damage,
                "damage_received": received_damage,
                "damage_delta": dealt_damage - received_damage,
                "headshots": hs,
                "bodyshots": body,
                "legshots": leg,
                "first_kills": first_kills,
                "first_deaths": first_deaths,
                "opening_duel_wins": opening_duel_wins,
                "opening_duel_losses": opening_duel_losses,
                "trade_kills": trade_kills,
                "traded_deaths": traded_deaths,
                "clutch_opportunities": clutch_opportunities,
                "clutches_won": clutches_won,
                "survival_rounds": survival_rounds,
                "rounds_with_kill": rounds_with_kill,
                "rounds_with_assist": rounds_with_assist,
                "rounds_with_multikill": rounds_with_multikill,
                "multi_2k": multi_2k,
                "multi_3k": multi_3k,
                "multi_4k": multi_4k,
                "multi_5k": multi_5k,
                "econ_spent": spent,
                "loadout_value_total": loadout_value,
            }

            _update_scope(overview, equipped_weapon_id, round_payload, spent)

            if round_side in {SIDE_ATTACK, SIDE_DEFENSE}:
                _update_scope(sides[round_side], equipped_weapon_id, round_payload, spent)

        _finalize_stats_block(overview)
        if sides[SIDE_ATTACK].get("rounds", 0) > 0:
            sides[SIDE_ATTACK]["matches"] = 1
        if sides[SIDE_DEFENSE].get("rounds", 0) > 0:
            sides[SIDE_DEFENSE]["matches"] = 1
        _finalize_stats_block(sides[SIDE_ATTACK])
        _finalize_stats_block(sides[SIDE_DEFENSE])

        result[puuid] = {
            "won_match": bool(team_winner_map.get(team_id, False)),
            "is_draw": is_draw,
            "map_name": resolve_map_name(map_id),
            "agent_name": resolve_agent_name(agent_id),
            "role": role,
            "overview": overview,
            "sides": sides,
        }

    return result