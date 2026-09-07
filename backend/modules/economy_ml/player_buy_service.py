from __future__ import annotations

from functools import lru_cache
import json

import pandas as pd

from .player_buy_dataset import VERSION, build_dataset, catalog_snapshot, match_rows, apply_history
from .player_buy_model import ARTIFACT_DIR, grade_rows, load_bundle


@lru_cache(maxsize=128)
def _dataset_rows(match_id, puuid, modified):
    path = ARTIFACT_DIR / "decisions.parquet"
    frame = pd.read_parquet(path, filters=[("match_id", "==", match_id), ("puuid", "==", puuid)])
    return json.loads(frame.to_json(orient="records"))


def player_purchase_analysis(match, puuid):
    info = match.get("matchInfo") or {}
    match_id = str(info.get("matchId"))
    bundle = load_bundle()
    path = ARTIFACT_DIR / "decisions.parquet"
    rows = _dataset_rows(match_id, puuid, path.stat().st_mtime_ns) if path.exists() else []
    if rows:
        # Display the current source document, even if its economy was corrected
        # since training. Only strictly historical profiles come from the snapshot.
        saved = {r["round_number"]: r for r in rows}
        current = match_rows(match, bundle["catalog"] if bundle else catalog_snapshot())
        rows = []
        for row in current:
            if row["puuid"] != puuid:
                continue
            historic = saved.get(row["round_number"], next(iter(saved.values())))
            row["history_profiles"] = historic.get("history_profiles", "{}")
            row["prior_rank"] = historic.get("prior_rank")
            apply_history(row, json.loads(row["history_profiles"]))
            rows.append(row)
    if not rows:
        from infrastructure.mongo_client import matches_collection
        # Bounded history, strictly before this match. Never use the player's
        # current dashboard aggregates (which can contain future matches).
        past = list(matches_collection.find({"players.puuid": puuid, "matchInfo.isRanked": True,
                    "matchInfo.gameStartMillis": {"$lt": info.get("gameStartMillis", 0)}},
                    {"_id": 0, "matchInfo": 1, "players": 1, "roundResults": 1})
                    .sort("matchInfo.gameStartMillis", -1).limit(1000))
        catalog = bundle["catalog"] if bundle else catalog_snapshot()
        target = dict(match, matchInfo=dict(info, isRanked=True))
        frame = build_dataset(past + [target], catalog)
        if not frame.empty:
            frame = frame[(frame.match_id == match_id) & (frame.puuid == puuid)]
            rows = json.loads(frame.to_json(orient="records"))
    effective_bundle = bundle or {"catalog": catalog_snapshot(), "models": [], "available": False}
    if not info.get("isRanked"):
        effective_bundle = dict(effective_bundle, available=False)
    return {"version": VERSION, "match_id": match_id, "puuid": puuid,
            "planning_method": (bundle or {}).get("report", {}).get("planning_method", "one_round"),
            "model_available": bool(bundle and bundle.get("available")),
            "rounds": grade_rows(rows, effective_bundle),
            "grade_description": "Calidad relativa al valor de esta ronda y la siguiente; ahorrar compite con comprar. No es probabilidad de victoria.",
            "money_description": "Créditos calculados con las reglas configuradas, incluidos 300 por defensor al desactivar.",
            "history_scope": "Partidas anteriores; hasta 1000 para partidas nuevas."}
