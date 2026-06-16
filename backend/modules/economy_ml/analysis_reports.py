from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from .dataset_builder import DEFAULT_DATASET_PATH


def _rate(series: pd.Series) -> float:
    return float(series.mean()) if len(series) else 0.0


def build_map_rank_report(dataset_path: str | Path = DEFAULT_DATASET_PATH, limit: int = 5) -> dict[str, Any]:
    path = Path(dataset_path)
    if not path.exists():
        return {"available": False, "reason": "No hay dataset de economia construido"}
    frame = pd.read_parquet(path)
    if frame.empty:
        return {"available": False, "reason": "El dataset de economia esta vacio"}

    group_columns = [
        column for column in ("map_id", "map_name", "rank_group", "side", "real_buy_action")
        if column in frame
    ]
    action_rows: list[dict[str, Any]] = []
    if group_columns:
        grouped = (
            frame.groupby(group_columns, dropna=False)
            .agg(
                samples=("match_won", "size"),
                match_win_rate=("match_won", "mean"),
                round_win_rate=("round_won", "mean"),
            )
            .reset_index()
        )
        grouped = grouped[grouped["samples"] >= 25]
        sort_columns = [
            column for column in ("map_name", "map_id", "rank_group", "side", "match_win_rate")
            if column in grouped
        ]
        ascending = [column != "match_win_rate" for column in sort_columns]
        for row in grouped.sort_values(sort_columns, ascending=ascending).to_dict("records"):
            action_rows.append({
                "map_id": row.get("map_id"),
                "map_name": row.get("map_name"),
                "rank_group": row.get("rank_group"),
                "side": row.get("side"),
                "action": row.get("real_buy_action"),
                "samples": int(row.get("samples") or 0),
                "match_win_rate": float(row.get("match_win_rate") or 0),
                "round_win_rate": float(row.get("round_win_rate") or 0),
            })

    by_map: dict[str, dict[str, Any]] = {}
    for row in action_rows:
        key = str(row.get("map_id") or "UNKNOWN")
        bucket = by_map.setdefault(key, {
            "map_id": row.get("map_id"),
            "map_name": row.get("map_name"),
            "best_team_buy_actions": [],
        })
        if len(bucket["best_team_buy_actions"]) < limit:
            bucket["best_team_buy_actions"].append(row)

    return {
        "available": True,
        "dataset_rows": len(frame),
        "maps": list(by_map.values()),
        "global_action_summary": {
            action: {
                "samples": int(len(group)),
                "match_win_rate": _rate(group["match_won"]),
                "round_win_rate": _rate(group["round_won"]),
            }
            for action, group in frame.groupby("real_buy_action")
        } if "real_buy_action" in frame else {},
    }
