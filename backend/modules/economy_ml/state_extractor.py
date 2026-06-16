from __future__ import annotations

from collections import defaultdict
from statistics import median
from typing import Any

from .action_profiles import observed_action_features
from .buy_classifier import classify_team_buy_action
from .rank_mapping import get_rank_group, get_rank_name, normalize_rank_tier


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _display_round(raw_round: Any, index: int) -> int:
    try:
        value = int(raw_round)
        return value + 1 if value == index else value
    except (TypeError, ValueError):
        return index + 1


def _normalize_side(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"attack", "attacker", "attackers", "atk"}:
        return "attack"
    if normalized in {"defense", "defender", "defenders", "def"}:
        return "defense"
    return "unknown"


def _opposite_side(side: str) -> str:
    return {"attack": "defense", "defense": "attack"}.get(side, "unknown")


def _starting_attack_team(
    rounds: list[dict], player_team: dict[str, str], team_ids: list[str]
) -> str | None:
    for index, round_obj in enumerate(rounds[:12]):
        planter_team = player_team.get(str(round_obj.get("bombPlanter")))
        if planter_team:
            return planter_team
        winner = str(round_obj.get("winningTeam") or "")
        winner_role = _normalize_side(round_obj.get("winningTeamRole"))
        if winner and winner_role != "unknown":
            if winner_role == "attack":
                return winner
            return next((team_id for team_id in team_ids if team_id != winner), None)
    return None


def _team_side(team_id: str, round_number: int, starting_attack_team: str | None) -> str:
    if not starting_attack_team:
        return "unknown"
    starts_attack = team_id == starting_attack_team
    if round_number <= 12:
        attack = starts_attack
    elif round_number <= 24:
        attack = not starts_attack
    else:
        # Competitive overtime swaps sides every round.
        attack = starts_attack if (round_number - 25) % 2 == 0 else not starts_attack
    return "attack" if attack else "defense"


def _credits_summary(values: list[float]) -> dict[str, float | int]:
    total = sum(values)
    return {
        "estimated_credits_before_buy": total,
        "players_can_full_buy_estimate": sum(value >= 3900 for value in values),
        "players_low_money": sum(value < 2000 for value in values),
    }


def _income_per_player(team_id: str, round_obj: dict, streaks: dict) -> float:
    winner = str(round_obj.get("winningTeam") or "")
    won = winner == team_id
    current_loss_streak = 0 if won else int(streaks[team_id]["loss"]) + 1
    return 3000 if won else 1900 if current_loss_streak == 1 else 2400 if current_loss_streak == 2 else 2900


def _update_player_credit_estimates(
    round_obj: dict, players: list[dict], economy_by_player: dict[str, dict],
    streaks: dict, player_team: dict[str, str], player_credits: dict[str, float],
    credit_quality: dict[str, str],
) -> None:
    planter_team = player_team.get(str(round_obj.get("bombPlanter")))
    for player in players:
        puuid, team_id = str(player["puuid"]), str(player["teamId"])
        economy = economy_by_player.get(puuid)
        income = _income_per_player(team_id, round_obj, streaks)
        plant_bonus = 300 if planter_team == team_id else 0
        if economy is None:
            player_credits[puuid] = min(9000.0, income + plant_bonus)
            credit_quality[team_id] = "low"
        else:
            player_credits[puuid] = min(9000.0, _number(economy.get("remaining")) + income + plant_bonus)


def _advance_round_context(
    round_obj: dict, team_ids: list[str], scores: defaultdict[str, int], streaks: dict
) -> None:
    winner = str(round_obj.get("winningTeam") or "")
    if winner in team_ids:
        scores[winner] += 1
    for team_id in team_ids:
        won = winner == team_id
        streaks[team_id]["previous_won"] = won
        streaks[team_id]["win"] = streaks[team_id]["win"] + 1 if won else 0
        streaks[team_id]["loss"] = 0 if won else streaks[team_id]["loss"] + 1


def extract_match_round_states(match: dict) -> list[dict]:
    match_info = match.get("matchInfo") or {}
    players = [p for p in (match.get("players") or []) if p.get("puuid") and p.get("teamId")]
    teams = [t for t in (match.get("teams") or []) if t.get("teamId")]
    rounds = match.get("roundResults") or []
    team_ids = [str(team["teamId"]) for team in teams]
    if len(team_ids) != 2 or not rounds:
        return []
    player_team = {str(player["puuid"]): str(player["teamId"]) for player in players}
    team_players = {
        team_id: [player for player in players if str(player["teamId"]) == team_id]
        for team_id in team_ids
    }
    team_won_match = {str(team["teamId"]): bool(team.get("won")) for team in teams}
    starting_attack_team = _starting_attack_team(rounds, player_team, team_ids)
    scores: defaultdict[str, int] = defaultdict(int)
    streaks = {team_id: {"win": 0, "loss": 0, "previous_won": None} for team_id in team_ids}
    player_credits = {str(player["puuid"]): 800.0 for player in players}
    credit_quality = {team_id: "rules_based" for team_id in team_ids}
    rows: list[dict] = []

    for index, round_obj in enumerate(rounds):
        round_number = _display_round(round_obj.get("roundNum"), index)
        if round_number in {1, 13}:
            player_credits = {str(player["puuid"]): 800.0 for player in players}
            credit_quality = {team_id: "rules_based" for team_id in team_ids}
        elif round_number >= 25:
            player_credits = {str(player["puuid"]): 5000.0 for player in players}
            credit_quality = {team_id: "rules_based" for team_id in team_ids}
        stats_by_team: dict[str, list[dict]] = {team_id: [] for team_id in team_ids}
        economy_by_player: dict[str, dict] = {}
        for stat in round_obj.get("playerStats") or []:
            puuid = str(stat.get("puuid"))
            team_id = player_team.get(puuid)
            economy = stat.get("economy")
            if team_id in stats_by_team and isinstance(economy, dict):
                stats_by_team[team_id].append(economy)
                economy_by_player[puuid] = economy

        # Even unusable rounds must advance score/streak context for later rows.
        if any(len(stats_by_team[team_id]) < 3 for team_id in team_ids):
            _update_player_credit_estimates(
                round_obj, players, economy_by_player, streaks, player_team,
                player_credits, credit_quality,
            )
            _advance_round_context(round_obj, team_ids, scores, streaks)
            continue

        credits = {
            team_id: _credits_summary([
                player_credits[str(player["puuid"])] for player in team_players[team_id]
            ])
            for team_id in team_ids
        }
        for team_id in team_ids:
            enemy_id = next(value for value in team_ids if value != team_id)
            tiers = [normalize_rank_tier(player.get("competitiveTier")) for player in team_players[team_id]]
            valid_tiers = [tier for tier in tiers if tier is not None]
            avg_tier = sum(valid_tiers) / len(valid_tiers) if valid_tiers else 0
            median_tier = median(valid_tiers) if valid_tiers else 0
            rounded_tier = int(round(avg_tier)) if valid_tiers else None
            own_credits, enemy_credits = credits[team_id], credits[enemy_id]
            row = {
                "match_id": str(match_info.get("matchId") or "UNKNOWN"),
                "game_start_millis": int(_number(match_info.get("gameStartMillis"))),
                "round_number": round_number, "team_id": team_id, "enemy_team_id": enemy_id,
                "map_id": str(match_info.get("mapId") or "UNKNOWN"),
                "season_id": str(match_info.get("seasonId") or "UNKNOWN"),
                "queue_id": str(match_info.get("queueId") or "UNKNOWN"),
                "is_ranked": int(bool(match_info.get("isRanked"))),
                "rank_tier_avg": avg_tier, "rank_tier_median": median_tier,
                "rank_name": get_rank_name(rounded_tier), "rank_group": get_rank_group(rounded_tier),
                "side": _team_side(team_id, round_number, starting_attack_team),
                "team_credit_estimate_quality": credit_quality[team_id],
                "enemy_credit_estimate_quality": credit_quality[enemy_id],
                "team_score_before": scores[team_id], "enemy_score_before": scores[enemy_id],
                "score_diff": scores[team_id] - scores[enemy_id],
                "previous_round_won": int(bool(streaks[team_id]["previous_won"])),
                "win_streak": streaks[team_id]["win"], "loss_streak": streaks[team_id]["loss"],
                "enemy_win_streak": streaks[enemy_id]["win"], "enemy_loss_streak": streaks[enemy_id]["loss"],
                "is_pistol_round": int(round_number in {1, 13}), "is_second_round": int(round_number in {2, 14}),
                "is_bonus_candidate": int(round_number in {3, 15} and streaks[team_id]["win"] >= 2),
                "is_last_round_before_switch": int(round_number in {12, 24}),
                "is_match_point": int(max(scores.values()) >= 12), "is_overtime": int(round_number >= 25),
                "team_estimated_credits_before_buy": own_credits["estimated_credits_before_buy"],
                "enemy_estimated_credits_before_buy": enemy_credits["estimated_credits_before_buy"],
                "credits_before_buy_diff": own_credits["estimated_credits_before_buy"] - enemy_credits["estimated_credits_before_buy"],
                "team_players_can_full_buy_estimate": own_credits["players_can_full_buy_estimate"],
                "enemy_players_can_full_buy_estimate": enemy_credits["players_can_full_buy_estimate"],
                "team_players_low_money": own_credits["players_low_money"],
                "enemy_players_low_money": enemy_credits["players_low_money"],
                "real_buy_action": classify_team_buy_action(
                    stats_by_team[team_id], {"won": streaks[team_id]["previous_won"]}
                ),
                "round_won": int(str(round_obj.get("winningTeam")) == team_id),
                "match_won": int(team_won_match.get(team_id, False)),
                **observed_action_features(stats_by_team[team_id]),
            }
            rows.append(row)
        _update_player_credit_estimates(
            round_obj, players, economy_by_player, streaks, player_team,
            player_credits, credit_quality,
        )
        _advance_round_context(round_obj, team_ids, scores, streaks)
    return rows
