from __future__ import annotations

from typing import Any


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def add_future_economy_labels(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_team: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        by_team.setdefault((str(row.get("match_id")), str(row.get("team_id"))), []).append(row)
    for team_rows in by_team.values():
        team_rows.sort(key=lambda item: int(item.get("round_number") or 0))
        for index, row in enumerate(team_rows):
            next_row = team_rows[index + 1] if index + 1 < len(team_rows) else None
            next2 = team_rows[index + 1:index + 3]
            next3 = team_rows[index + 1:index + 4]
            if next_row:
                row["next_round_team_estimated_credits"] = next_row.get("team_estimated_credits_before_buy")
                row["next_round_players_can_fullbuy"] = next_row.get("team_players_can_full_buy_estimate")
                row["next_round_players_low_money"] = next_row.get("team_players_low_money")
                row["next_round_fullbuy_possible"] = int(_num(next_row.get("team_players_can_full_buy_estimate")) >= 4)
                row["economy_recovered_next_round"] = int(
                    _num(next_row.get("team_players_can_full_buy_estimate")) > _num(row.get("team_players_can_full_buy_estimate"))
                )
                row["team_economy_desync_next_round"] = int(
                    _num(next_row.get("team_players_can_full_buy_estimate")) >= 1
                    and _num(next_row.get("team_players_low_money")) >= 2
                )
            else:
                row["next_round_team_estimated_credits"] = None
                row["next_round_players_can_fullbuy"] = None
                row["next_round_players_low_money"] = None
                row["next_round_fullbuy_possible"] = 0
                row["economy_recovered_next_round"] = 0
                row["team_economy_desync_next_round"] = 0
            row["won_next_2_rounds"] = int(sum(int(item.get("round_won") or 0) for item in next2) == len(next2) and len(next2) == 2)
            row["won_next_3_rounds"] = int(sum(int(item.get("round_won") or 0) for item in next3) == len(next3) and len(next3) == 3)
            if next2:
                row["score_diff_after_2_rounds"] = next2[-1].get("score_diff")
            else:
                row["score_diff_after_2_rounds"] = row.get("score_diff")
            if next3:
                row["score_diff_after_3_rounds"] = next3[-1].get("score_diff")
            else:
                row["score_diff_after_3_rounds"] = row.get("score_diff")
    return rows


def simulate_next_round_economy(state: dict[str, Any], team_plan: dict[str, Any]) -> dict[str, Any]:
    if state.get("is_last_round_before_switch"):
        return {"next_round_fullbuy_probability": 0.0, "reason": "last_round_before_switch"}
    if state.get("is_overtime"):
        return {"expected_next_round_credits": 25000.0, "next_round_fullbuy_probability": 1.0, "reason": "overtime_reset"}
    remaining = _num(team_plan.get("expected_remaining") or team_plan.get("expected_remaining_after_buy"))
    loss_streak = int(_num(state.get("loss_streak")))
    loss_income = 1900 if loss_streak == 0 else 2400 if loss_streak == 1 else 2900
    win_income = 3000
    expected_income = 0.5 * win_income + 0.5 * loss_income + 150
    expected_next = min(45000.0, remaining + expected_income * 5)
    per_player = expected_next / 5
    probability = 0.85 if per_player >= 3900 else 0.6 if per_player >= 3000 else 0.35 if per_player >= 2000 else 0.12
    return {
        "expected_next_round_credits": round(expected_next, 2),
        "next_round_fullbuy_probability": round(probability, 4),
        "expected_next_round_players_can_fullbuy": int(per_player >= 3900) * 5,
        "plant_bonus_mode": "probabilistic_not_observed",
    }
