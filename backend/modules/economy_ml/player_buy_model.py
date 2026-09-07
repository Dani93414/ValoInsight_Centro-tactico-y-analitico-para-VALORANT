"""Outcome-based purchase ranking, with chronological models and no rule scores."""
from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
import hashlib

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from threadpoolctl import threadpool_limits

from .player_buy_dataset import CATEGORICAL, NUMERIC, FEATURES, VERSION, apply_history, number

ARTIFACT_DIR = Path(__file__).parent / "artifacts" / "player_buy_v2"


def feature_frame(frame):
    result = frame.reindex(columns=FEATURES).copy()
    for col in NUMERIC:
        result[col] = pd.to_numeric(result[col], errors="coerce").replace([np.inf, -np.inf], np.nan)
    for col in CATEGORICAL:
        result[col] = result[col].fillna("unknown").astype(str)
    return result


def pipeline(params, conditional=False):
    logistic = params["kind"] == "logistic"
    numerical = Pipeline([("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
                          ("scale", StandardScaler())])
    categorical = OneHotEncoder(handle_unknown="ignore") if logistic else OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    numeric = NUMERIC + (["scenario_won"] if conditional else [])
    prep = ColumnTransformer([("numeric", numerical, numeric), ("categorical", categorical, CATEGORICAL)])
    model = LogisticRegression(C=params.get("C", 1), max_iter=600) if logistic else HistGradientBoostingClassifier(
        learning_rate=params["learning_rate"], max_leaf_nodes=params["max_leaf_nodes"],
        l2_regularization=params["l2_regularization"], max_iter=120, min_samples_leaf=100,
        categorical_features=list(range(len(numeric), len(numeric) + len(CATEGORICAL))), early_stopping=False, random_state=42)
    return Pipeline([("prepare", prep), ("model", model)])


def logits(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p)).reshape(-1, 1)


def predict(model, frame):
    with threadpool_limits(limits=4):
        raw = model["pipeline"].predict_proba(feature_frame(frame))[:, 1]
    return model["calibrator"].predict_proba(logits(raw))[:, 1] if model.get("calibrator") is not None else raw


def metrics(y, p):
    return {"log_loss": float(log_loss(y, p, labels=[0, 1])), "brier": float(brier_score_loss(y, p)),
            "roc_auc": float(roc_auc_score(y, p)) if len(set(y)) == 2 else None}


def support_key(row):
    budget = min(9, int(float(row["credits_before_buy"]) // 1000))
    return (str(row["weapon_id"]), str(row["armor_id"]), str(row["phase"]), budget)


def support(frame):
    groups = {}
    for row in frame[["weapon_id", "armor_id", "phase", "credits_before_buy", "match_id"]].to_dict("records"):
        groups.setdefault(support_key(row), set()).add(row["match_id"])
    return {key: len(ids) for key, ids in groups.items()}


def fit(fit_rows, calibration, params):
    pipe = pipeline(params)
    pipe.fit(feature_frame(fit_rows), fit_rows.round_won.astype(int))
    calibrator = None
    if calibration.round_won.nunique() == 2:
        raw = pipe.predict_proba(feature_frame(calibration))[:, 1]
        calibrator = LogisticRegression().fit(logits(raw), calibration.round_won.astype(int))
    return {"pipeline": pipe, "calibrator": calibrator,
            "cutoff": float(calibration.game_start_millis.max()), "support": support(fit_rows),
            "params": params, "train_matches": int(fit_rows.match_id.nunique())}


def fit_survival(model, fit_rows, calibration):
    """P(survive | context, equipment, hypothetical round result).

    The result is conditioned on separately in each planning branch, never read
    from the actual current round when ranking a purchase.
    """
    training = fit_rows[fit_rows.player_survived.notna()]
    calibration = calibration[calibration.player_survived.notna()]
    pipe = pipeline({"kind": "boosting", "learning_rate": .05, "max_leaf_nodes": 15, "l2_regularization": 10}, conditional=True)
    pipe.fit(feature_frame(training).assign(scenario_won=training.round_won), training.player_survived.astype(int))
    raw = pipe.predict_proba(feature_frame(calibration).assign(scenario_won=calibration.round_won))[:, 1]
    calibrator = LogisticRegression().fit(logits(raw), calibration.player_survived.astype(int))
    model["survival"] = {"pipeline": pipe, "calibrator": calibrator}
    return model


def train(dataset, catalog, output=ARTIFACT_DIR):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    ordered = dataset[["match_id", "game_start_millis"]].drop_duplicates().sort_values(["game_start_millis", "match_id"])
    if len(ordered) < 40:
        raise ValueError("Se necesitan al menos 40 partidas distintas para separar entrenamiento, validación y test.")
    # Boundaries use timestamps, so simultaneous matches never straddle partitions.
    timestamps = ordered.game_start_millis.to_numpy()
    a, b, c = [timestamps[int(len(timestamps) * fraction)] for fraction in (.55, .70, .85)]
    def split_name(t):
        return "fit" if t < a else "calibration" if t < b else "validation" if t < c else "test"
    dataset = dataset.copy()
    dataset["split"] = dataset.game_start_millis.map(split_name)
    valid = (dataset.round_won.notna() & dataset.credits_before_buy.notna()
             & dataset.weapon_value.notna() & dataset.armor_value.notna()
             & dataset.money_source.isin(["observed", "fixed_reset", "calculated_rules"]))
    clean = dataset[valid].copy()
    blocks = {name: clean[clean.split == name] for name in ("fit", "calibration", "validation", "test")}
    if any(frame.empty or frame.round_won.nunique() < 2 for frame in blocks.values()):
        raise ValueError("Algún bloque temporal carece de ejemplos o de ambas clases.")
    # Save the exact full dataset and split before any estimator is fitted.
    dataset.to_parquet(output / "decisions.parquet", index=False)
    manifest = {name: ordered[ordered.game_start_millis.map(split_name) == name].match_id.tolist() for name in blocks}
    (output / "splits.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    configs = [{"kind": "logistic", "C": c} for c in (.1, 1)] + [
        {"kind": "boosting", "learning_rate": lr, "max_leaf_nodes": leaves, "l2_regularization": l2}
        for lr, leaves, l2 in ((.05, 15, 1), (.1, 15, 10), (.05, 31, 10), (.1, 31, 1))]
    trials, winner, best = [], None, float("inf")
    for params in configs:
        print(f"Entrenando candidato: {params}", flush=True)
        candidate = fit(blocks["fit"], blocks["calibration"], params)
        score = metrics(blocks["validation"].round_won, predict(candidate, blocks["validation"]))
        trials.append({"params": params, "validation": score})
        if score["log_loss"] < best:
            best, winner = score["log_loss"], candidate
    prevalence = float(blocks["fit"].round_won.mean())
    baseline_validation = metrics(blocks["validation"].round_won, np.full(len(blocks["validation"]), prevalence))
    ablations = {}
    for scope, excluded in (
        ("without_personal_history", [c for c in FEATURES if c.startswith("history_") or c == "prior_rank"]),
        ("without_agent_specific_history", [c for c in FEATURES if c.startswith("history_agent_")]),
    ):
        print(f"Comprobando aporte del historial: {scope}", flush=True)
        ablated = {name: frame.assign(**{col: 0 for col in excluded}) for name, frame in blocks.items() if name != "test"}
        reference = fit(ablated["fit"], ablated["calibration"], winner["params"])
        ablations[scope] = metrics(ablated["validation"].round_won, predict(reference, ablated["validation"]))
    # Selection is frozen before touching the final test. Test never activates a model.
    available = best < baseline_validation["log_loss"]
    fit_survival(winner, blocks["fit"], blocks["calibration"])
    from .player_buy_continuation import fit_continuation
    fit_continuation(winner, blocks["fit"], blocks["calibration"], catalog)
    final_p = predict(winner, blocks["test"])
    test_metrics = metrics(blocks["test"].round_won, final_p)
    baseline_test = metrics(blocks["test"].round_won, np.full(len(blocks["test"]), prevalence))
    segments = {}
    test_frame = blocks["test"].copy()
    test_frame["probability"] = final_p
    test_frame["has_personal_history"] = test_frame.history_player_rounds > 0
    for col in ("weapon_id", "agent_id", "phase", "has_personal_history"):
        segments[col] = {str(key): {"rows": len(group), "matches": int(group.match_id.nunique()),
                                  **metrics(group.round_won, group.probability)}
                         for key, group in test_frame.groupby(col) if len(group) >= 30}
    losses = -(blocks["test"].round_won.to_numpy() * np.log(np.clip(final_p, 1e-8, 1))
               + (1 - blocks["test"].round_won.to_numpy()) * np.log(np.clip(1-final_p, 1e-8, 1)))
    grouped = pd.DataFrame({"match": blocks["test"].match_id.to_numpy(), "loss": losses}).groupby("match").loss.mean().to_numpy()
    rng = np.random.default_rng(42)
    ci = np.quantile([rng.choice(grouped, len(grouped)).mean() for _ in range(500)], [.025, .975]).tolist()
    snapshots = []
    # Historical grading uses strictly earlier models, never the model fitted on
    # that match. Earliest matches remain visible but have no invented grade.
    for fraction in (.25, .45):
        cutoff = timestamps[int(len(timestamps) * fraction)]
        earlier = clean[clean.game_start_millis < cutoff]
        unique_times = sorted(earlier.game_start_millis.unique())
        boundary = unique_times[int(len(unique_times) * .8)]
        print(f"Modelo histórico anterior a {cutoff}", flush=True)
        # Fixed reference configuration avoids selecting historical parameters on future outcomes.
        snapshot = fit(earlier[earlier.game_start_millis < boundary], earlier[earlier.game_start_millis >= boundary],
                       {"kind": "boosting", "learning_rate": .05, "max_leaf_nodes": 15, "l2_regularization": 10})
        snapshot["selection_cutoff"] = snapshot["cutoff"]
        fit_survival(snapshot, earlier[earlier.game_start_millis < boundary], earlier[earlier.game_start_millis >= boundary])
        fit_continuation(snapshot, earlier[earlier.game_start_millis < boundary], earlier[earlier.game_start_millis >= boundary], catalog)
        snapshots.append(snapshot)
    # Hyperparameters were chosen on validation: for historical validation matches
    # use an earlier fixed snapshot, not the future-selected final estimator.
    winner["selection_cutoff"] = float(blocks["validation"].game_start_millis.max())
    snapshots.append(winner)
    report = {
        "version": VERSION, "available": available, "rows": len(dataset), "usable_rows": len(clean),
        "matches": len(ordered), "features": FEATURES, "selected_parameters": winner["params"],
        "trials": trials, "baseline_validation": baseline_validation, "test": test_metrics,
        "history_ablations_validation": ablations, "test_segments": segments,
        "dataset_sha256": hashlib.sha256((output / "decisions.parquet").read_bytes()).hexdigest(),
        "baseline_test": baseline_test, "test_match_mean_log_loss_ci95": ci,
        "splits": {k: {"matches": len(manifest[k]), "rows": len(v)} for k, v in blocks.items()},
        "history_coverage": {s: float((dataset[f"history_{s}_rounds"] > 0).mean()) for s in ("player", "agent", "weapon", "agent_weapon")},
        "money_sources": dataset.money_source.value_counts().to_dict(),
        "missing_rates": {col: float(dataset[col].isna().mean()) for col in NUMERIC},
        "grade": "round(100 * observed_two_round_value / best_supported_two_round_value)",
        "planning_horizon": 2,
        "planning_method": "fitted_two_step_value_from_real_transitions",
        "continuation_models": [m.get("next_value", {}).get("report") for m in snapshots],
        "recommendation_min_value_gap": .03,
        "planning_assumptions": [
            "Dos decisiones; la segunda compra se selecciona con el estimador aprendido y soporte histórico.",
            "Créditos calculados por escenario sin bajas ni bonus futuros; pérdida sobreviviendo usa 1000 conservadores.",
            "Probabilidad de supervivencia condicionada al resultado hipotético, aprendida y calibrada.",
            "Contexto monetario de aliados y enemigos mantenido fijo; no simula sus compras futuras.",
            "Arma conservada en la rama de supervivencia; escudo presupuestado de nuevo por durabilidad desconocida.",
            "Horizonte inmediato en reinicios, prórroga, punto de partido o falta de soporte futuro.",
        ],
        "limitations": ["Evaluación observacional, no demuestra mejora causal por cambiar la compra.",
                        "Daño histórico por arma asociado al equipamiento inicial, no atribución balística.",
                        "Habilidades y origen exacto de las compras no observables; presupuesto conservador.",
                        "Catálogo de precios congelado; no reconstruye cambios históricos de precio.",
                        "300 por defensor al desactivar es una regla configurada por el usuario.",
                        "Las primeras partidas no tienen modelo temporal anterior para puntuarlas."],
    }
    bundle = {"version": VERSION, "catalog": catalog, "models": snapshots, "available": available, "report": report}
    temporary = output / "model.joblib.tmp"
    joblib.dump(bundle, temporary)
    temporary.replace(output / "model.joblib")
    (output / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def alternatives(row, catalog, supported):
    credit, remaining = number(row.get("credits_before_buy")), number(row.get("remaining"))
    if credit is None or remaining is None:
        return []
    original_w = catalog["weapons"].get(row["weapon_id"])
    original_a = catalog["armors"].get(row["armor_id"])
    if not original_w or not original_a:
        return []
    spent = credit - remaining
    # When fresh inventory and expenditure support a complete self-purchase,
    # compare replacement bundles while preserving unexplained spending.
    # Otherwise do not refund an unproven purchase/drop or sell carried items.
    fresh = row.get("phase") in ("pistol", "overtime") or row.get("previous_survived") is False
    full_cost = original_w["cost"] + original_a["cost"]
    replacement = fresh and spent >= full_cost
    reserve = max(0, spent - full_cost) if replacement else 0
    profiles = json.loads(row.get("history_profiles") or "{}")
    candidates = []
    for wid, weapon in catalog["weapons"].items():
        for aid, armor in catalog["armors"].items():
            unchanged = wid == row["weapon_id"] and aid == row["armor_id"]
            if not replacement and aid == "none" and row["armor_id"] != "none":
                # A carried shield cannot be sold/removed to recreate a no-shield buy.
                continue
            cost = weapon["cost"] + armor["cost"] if replacement else (
                (weapon["cost"] if wid != row["weapon_id"] else 0) + (armor["cost"] if aid != row["armor_id"] else 0))
            budget = credit - reserve if replacement else remaining
            if not unchanged and cost > budget:
                continue
            candidate = dict(row, weapon_id=wid, armor_id=aid, weapon_value=weapon["cost"], armor_value=armor["cost"])
            n = supported.get(support_key(candidate), 0)
            if n < 5:
                continue
            apply_history(candidate, profiles, wid)
            candidate.update(support_matches=n, candidate_cost=cost, candidate_budget=budget)
            candidate["candidate_remaining"] = remaining if unchanged else max(0, budget - cost)
            candidate["other_spend_reserve"] = reserve
            candidate["decision_type"] = "buy"
            if cost == 0 and replacement:
                candidate["decision_type"] = "save"
            elif cost == 0 and unchanged:
                candidate["decision_type"] = "keep"
            candidates.append(candidate)
    return candidates


def grade_rows(rows, bundle):
    if len(rows) > 24:
        return [out for start in range(0, len(rows), 24) for out in grade_rows(rows[start:start+24], bundle)]
    catalog = bundle["catalog"]
    result, batches = [], {}
    for row in rows:
        weapon = catalog["weapons"].get(row["weapon_id"], {"name": "Arma desconocida"})
        armor = catalog["armors"].get(row["armor_id"], {"name": "Escudo desconocido"})
        out = {k: row.get(k) for k in ("round_number", "weapon_id", "armor_id", "loadout_value", "remaining", "credits_before_buy", "money_source")}
        out.update(weapon_name=weapon["name"], armor_name=armor["name"], quality=None, recommendation=None,
                   status="insufficient_history", history_rounds=row.get("history_player_rounds", 0),
                   agent_history_rounds=row.get("history_agent_rounds", 0))
        result.append(out)
        if row.get("money_source") not in ("fixed_reset", "observed", "calculated_rules"):
            out["status"] = "incomplete_money"
            continue
        eligible = [m for m in bundle.get("models", []) if m["selection_cutoff"] < row["game_start_millis"]]
        if not bundle.get("available") or not eligible:
            continue
        model = eligible[-1]
        options = alternatives(row, catalog, model["support"])
        if len(options) < 2:
            out["status"] = "unsupported_purchase"
            continue
        if not any(c["weapon_id"] == row["weapon_id"] and c["armor_id"] == row["armor_id"] for c in options):
            out["status"] = "unsupported_purchase"
            continue
        batch = batches.setdefault(id(model), {"model": model, "candidates": [], "entries": []})
        start = len(batch["candidates"])
        batch["candidates"].extend(options)
        batch["entries"].append((out, row, options, start))
    for batch in batches.values():
        probabilities = predict(batch["model"], pd.DataFrame(batch["candidates"]))
        from .player_buy_horizon import two_round_values
        values, horizons = two_round_values(batch["model"], batch["candidates"], probabilities, catalog)
        for out, row, options, start in batch["entries"]:
            p = probabilities[start:start+len(options)]
            q = values[start:start+len(options)]
            h = horizons[start:start+len(options)]
            # If any alternative lacks future support, compare every option on
            # the same immediate horizon instead of favoring partial rollouts.
            if not np.all(h == h[0]):
                q, h = p, np.ones(len(p), dtype=int)
            observed = next(i for i, c in enumerate(options) if c["weapon_id"] == row["weapon_id"] and c["armor_id"] == row["armor_id"])
            best = int(np.argmax(q))
            out.update(quality=int(round(100 * q[observed] / max(q[best], 1e-8))), status="evaluated",
                       observed_probability=float(p[observed]), best_probability=float(p[best]),
                       observed_value=float(q[observed]), best_value=float(q[best]), planning_horizon=int(h[best]))
            if q[best] - q[observed] >= .03:
                choice = options[best]
                wc, ac = choice["weapon_id"] != row["weapon_id"], choice["armor_id"] != row["armor_id"]
                out["recommendation"] = {
                    "weapon_id": choice["weapon_id"] if wc else None,
                    "weapon_name": catalog["weapons"][choice["weapon_id"]]["name"] if wc else None,
                    "armor_id": choice["armor_id"] if ac else None,
                    "armor_name": catalog["armors"][choice["armor_id"]]["name"] if ac else None,
                    "support_matches": choice["support_matches"],
                    "decision_type": choice["decision_type"] if h[best] == 2 else "buy",
                    "remaining_after_choice": choice["candidate_remaining"],
                    "next_credits_after_loss": min(9000, choice["candidate_remaining"] + min(2900, 1900 + 500 * row["loss_streak"])),
                    "next_credits_after_save_loss": min(9000, choice["candidate_remaining"] + 1000),
                }
    return result


@lru_cache(maxsize=2)
def _load(path, modified):
    bundle = joblib.load(path)
    if bundle.get("version") != VERSION:
        raise ValueError("Versión incompatible del modelo de compras")
    return bundle


def load_bundle():
    path = ARTIFACT_DIR / "model.joblib"
    return _load(str(path), path.stat().st_mtime_ns) if path.exists() else None
