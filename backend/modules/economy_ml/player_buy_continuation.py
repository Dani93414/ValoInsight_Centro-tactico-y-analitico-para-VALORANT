"""Fitted two-step continuation from real transitions, without future inputs.

Targets evaluate next-state legal purchases with the learned one-round model.
The regressor learns that target from current context/action/remaining only.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder
from threadpoolctl import threadpool_limits

from .player_buy_dataset import NUMERIC, CATEGORICAL

VALUE_NUMERIC = NUMERIC + ["candidate_remaining", "team_score_before", "enemy_score_before"]


def value_frame(frame):
    from .player_buy_model import feature_frame
    result = feature_frame(frame)
    for col in ("candidate_remaining", "team_score_before", "enemy_score_before"):
        result[col] = pd.to_numeric(frame[col], errors="coerce")
    return result


def predict_continuation(model, rows):
    with threadpool_limits(limits=4):
        return np.clip(model["next_value"]["pipeline"].predict(value_frame(pd.DataFrame(rows))), 0, 1)


def transition_targets(frame, model, catalog):
    from .player_buy_model import alternatives, predict
    rows = json.loads(frame.to_json(orient="records"))
    next_values = {}
    for start in range(0, len(rows), 1000):
        candidates, offsets = [], []
        for row in rows[start:start+1000]:
            options = alternatives(row, catalog, model["support"])
            if not options:
                continue
            a = len(candidates)
            # A one-step target: no recursive lookahead or actual next result.
            candidates.extend(options)
            offsets.append(((row["match_id"], row["puuid"], row["round_number"]), a, len(candidates)))
        if candidates:
            p = predict(model, pd.DataFrame(candidates))
            for key, a, b in offsets:
                next_values[key] = float(p[a:b].max())
    targets = [next_values.get((r["match_id"], r["puuid"], r["round_number"] + 1), np.nan) for r in rows]
    result = frame.copy()
    result["continuation_target"] = targets
    result["candidate_remaining"] = result.remaining
    return result[(result.round_number < 24) & ~result.round_number.isin([12])
                  & (result.team_score_before < 12) & (result.enemy_score_before < 12)
                  & result.continuation_target.notna() & result.candidate_remaining.notna()]


def fit_continuation(model, fitting, calibration, catalog):
    print("Calculando objetivos de continuación en transiciones reales...", flush=True)
    fit_rows = transition_targets(fitting, model, catalog)
    calibration_rows = transition_targets(calibration, model, catalog)
    if len(fit_rows) < 1000 or len(calibration_rows) < 100:
        return {"available": False, "reason": "insufficient_transitions"}
    trials, best, chosen = [], float("inf"), None
    for leaves, regularization in ((15, 10), (31, 10), (15, 50)):
        prep = ColumnTransformer([
            ("numeric", SimpleImputer(strategy="median", keep_empty_features=True), VALUE_NUMERIC),
            ("categorical", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), CATEGORICAL),
        ])
        pipe = Pipeline([("prepare", prep), ("value", HistGradientBoostingRegressor(
            max_iter=120, learning_rate=.05, max_leaf_nodes=leaves, l2_regularization=regularization,
            min_samples_leaf=100, early_stopping=False, random_state=42,
            categorical_features=list(range(len(VALUE_NUMERIC), len(VALUE_NUMERIC)+len(CATEGORICAL)))))])
        with threadpool_limits(limits=4):
            pipe.fit(value_frame(fit_rows), fit_rows.continuation_target)
            p = pipe.predict(value_frame(calibration_rows))
        error = float(np.mean((p - calibration_rows.continuation_target) ** 2))
        trials.append({"leaves": leaves, "l2": regularization, "calibration_target_mse": error})
        if error < best:
            best, chosen = error, pipe
    report = {"available": True, "fit_transitions": len(fit_rows), "calibration_transitions": len(calibration_rows),
              "trials": trials, "target_mse": best,
              "constant_target_mse": float(np.mean((fit_rows.continuation_target.mean() - calibration_rows.continuation_target) ** 2)),
              "target": "max supported one-round model value at observed next state",
              "features": VALUE_NUMERIC + CATEGORICAL,
              "limitation": "Fitted value from observational transitions; no causal guarantee or logged exploration propensities."}
    model["next_value"] = {"pipeline": chosen, "report": report}
    return report
