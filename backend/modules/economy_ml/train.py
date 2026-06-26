from __future__ import annotations

import argparse
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .dataset_builder import DEFAULT_DATASET_PATH
from .metrics import classification_metrics, evaluate_slices
from . import model_registry
from .schemas import (
    CATEGORICAL_FEATURES, FORBIDDEN_FEATURES, MODEL_FEATURES, NUMERIC_FEATURES,
    AGENT_UTILITY_NUMERIC_FEATURES,
    PREBUY_CATEGORICAL_FEATURES, PREBUY_NUMERIC_FEATURES, PROPENSITY_FEATURES,
    SCHEMA_VERSION, validate_no_feature_leakage,
)
from .ability_catalog import ability_costs_available
from .config import PLAN_VALUE_WEIGHTS
from .data_availability import build_data_availability_report

MIN_SAMPLES_GLOBAL = 1000
MIN_SAMPLES_RANK_GROUP = 700
MIN_SAMPLES_RANK_NAME = 500
MIN_ACTION_SUPPORT = 25
MAX_IPW_WEIGHT = 10.0


def _preprocessor(numeric: list[str], categorical: list[str], scale: bool) -> ColumnTransformer:
    numeric_steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy="median"))]
    if scale:
        numeric_steps.append(("scaler", StandardScaler()))
    return ColumnTransformer([
        ("numeric", Pipeline(numeric_steps), numeric),
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), categorical),
    ])


def _temporal_split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None:
    if (pd.to_numeric(frame["game_start_millis"], errors="coerce").fillna(0) <= 0).mean() > 0.1:
        return None
    matches = (
        frame[["match_id", "game_start_millis"]]
        .drop_duplicates("match_id")
        .sort_values(["game_start_millis", "match_id"])
    )
    if len(matches) < 5:
        return None
    train_end = max(1, int(len(matches) * 0.6))
    calibration_end = max(train_end + 1, int(len(matches) * 0.8))
    train_ids = set(matches.iloc[:train_end]["match_id"])
    calibration_ids = set(matches.iloc[train_end:calibration_end]["match_id"])
    test_ids = set(matches.iloc[calibration_end:]["match_id"])
    return (
        frame[frame["match_id"].isin(train_ids)].copy(),
        frame[frame["match_id"].isin(calibration_ids)].copy(),
        frame[frame["match_id"].isin(test_ids)].copy(),
    )


def _propensity_weights(train: pd.DataFrame) -> tuple[Pipeline | None, np.ndarray, dict]:
    actions = train["real_buy_action"].astype(str)
    if actions.nunique() < 2:
        return None, np.ones(len(train)), {"available": False, "reason": "single_action"}
    propensity = Pipeline([
        ("prepare", _preprocessor(PREBUY_NUMERIC_FEATURES, PREBUY_CATEGORICAL_FEATURES, True)),
        ("model", LogisticRegression(max_iter=1500, class_weight="balanced")),
    ])
    propensity.fit(train[PROPENSITY_FEATURES], actions)
    probabilities = propensity.predict_proba(train[PROPENSITY_FEATURES])
    classes = list(propensity.named_steps["model"].classes_)
    observed = np.array([probabilities[index, classes.index(action)] for index, action in enumerate(actions)])
    marginal = actions.value_counts(normalize=True).to_dict()
    stabilized = np.array([marginal[action] / max(observed[index], 0.01) for index, action in enumerate(actions)])
    weights = np.clip(stabilized, 0.1, MAX_IPW_WEIGHT)
    action_support = actions.value_counts().astype(int).to_dict()
    clipping_rate = float((stabilized > MAX_IPW_WEIGHT).mean())
    effective_sample_size = float((weights.sum() ** 2) / np.square(weights).sum()) if len(weights) else 0.0
    propensity_by_action = {
        str(action): {
            "samples": int((actions == action).sum()),
            "mean_observed_probability": float(observed[actions.to_numpy() == action].mean()),
            "min_observed_probability": float(observed[actions.to_numpy() == action].min()),
        }
        for action in classes
        if (actions == action).any()
    }
    return propensity, weights, {
        "available": True, "classes": classes,
        "min_observed_probability": float(observed.min()),
        "max_weight": float(weights.max()),
        "clipping_rate": clipping_rate,
        "effective_sample_size": effective_sample_size,
        "propensity_by_action": propensity_by_action,
        "low_support_actions": {
            action: count for action, count in action_support.items()
            if count < MIN_ACTION_SUPPORT
        },
        "aipw_status": "not_implemented_experimental_placeholder",
    }


MODEL_LABELS = {
    "match_win_model": "match_won",
    "round_win_model": "round_won",
    "fullbuy_next_round_model": "next_round_fullbuy_possible",
}


def _calibrate(raw_pipeline: Pipeline, calibration: pd.DataFrame, label: str) -> LogisticRegression | None:
    if calibration.empty or calibration[label].nunique() < 2:
        return None
    raw = raw_pipeline.predict_proba(calibration[MODEL_FEATURES])[:, 1].reshape(-1, 1)
    calibrator = LogisticRegression()
    calibrator.fit(raw, calibration[label])
    return calibrator


def _predict(bundle: dict, frame: pd.DataFrame, model_key: str = "match_win_model") -> np.ndarray:
    model_bundle = (bundle.get("models") or {}).get(model_key) or bundle
    raw = model_bundle["pipeline"].predict_proba(frame[MODEL_FEATURES])[:, 1]
    calibrator = model_bundle.get("calibrator")
    return calibrator.predict_proba(raw.reshape(-1, 1))[:, 1] if calibrator else raw


def _fit_binary_model(
    train: pd.DataFrame,
    calibration: pd.DataFrame,
    test: pd.DataFrame,
    weights: np.ndarray,
    label: str,
) -> tuple[dict | None, dict | None]:
    if train[label].nunique() < 2 or test.empty or test[label].nunique() < 1:
        return None, None
    baseline = Pipeline([
        ("prepare", _preprocessor(NUMERIC_FEATURES, CATEGORICAL_FEATURES, True)),
        ("model", LogisticRegression(max_iter=1500)),
    ])
    baseline.fit(train[MODEL_FEATURES], train[label], model__sample_weight=weights)
    pipeline = Pipeline([
        ("prepare", _preprocessor(NUMERIC_FEATURES, CATEGORICAL_FEATURES, False)),
        ("model", HistGradientBoostingClassifier(random_state=42)),
    ])
    pipeline.fit(train[MODEL_FEATURES], train[label], model__sample_weight=weights)
    calibrator = _calibrate(pipeline, calibration, label)
    raw_bundle = {"pipeline": pipeline, "calibrator": calibrator}
    probabilities = _predict(raw_bundle, test, "match_win_model")
    baseline_probabilities = baseline.predict_proba(test[MODEL_FEATURES])[:, 1]
    metrics = classification_metrics(test[label], probabilities)
    metrics["baseline_global"] = classification_metrics(test[label], baseline_probabilities)
    metrics["calibrated"] = calibrator is not None
    return raw_bundle, metrics


def _fit_scope(
    frame: pd.DataFrame, scope: str, value: str | None, artifacts_dir: Path
) -> dict | None:
    if frame["match_won"].nunique() < 2:
        return None
    frame = frame.copy()
    frame["buy_action"] = frame["real_buy_action"]
    split = _temporal_split(frame)
    if split is None:
        return None
    train, calibration, test = split
    if train["match_won"].nunique() < 2 or test.empty:
        return None
    propensity, weights, propensity_metadata = _propensity_weights(train)
    fitted_models: dict[str, dict] = {}
    model_metrics: dict[str, dict] = {}
    for model_key, label in MODEL_LABELS.items():
        if label not in train:
            continue
        model_bundle, metrics = _fit_binary_model(train, calibration, test, weights, label)
        if model_bundle:
            fitted_models[model_key] = model_bundle
            model_metrics[model_key] = metrics or {}
    if "match_win_model" not in fitted_models:
        return None
    action_support = train["real_buy_action"].value_counts().astype(int).to_dict()
    bundle = {
        "pipeline": fitted_models["match_win_model"]["pipeline"],
        "calibrator": fitted_models["match_win_model"].get("calibrator"),
        "models": fitted_models,
        "propensity_pipeline": propensity,
        "scope": scope, "value": value, "features": MODEL_FEATURES,
        "schema_version": SCHEMA_VERSION, "action_support": action_support,
        "min_action_support": MIN_ACTION_SUPPORT,
    }
    probabilities = _predict(bundle, test, "match_win_model")
    metrics = evaluate_slices(test, probabilities)
    metrics["models"] = model_metrics
    model_registry.save_model(bundle, scope, value, artifacts_dir)
    return {
        "samples": len(frame), "train_samples": len(train), "calibration_samples": len(calibration),
        "test_samples": len(test), "action_support": action_support,
        "propensity": propensity_metadata, "metrics": metrics,
        "labels": {key: label for key, label in MODEL_LABELS.items() if key in fitted_models},
    }


def train_models(dataset: pd.DataFrame, *, enforce_minimums: bool = True) -> dict:
    required = [column for column in MODEL_FEATURES if column != "buy_action"]
    required += ["match_id", "game_start_millis", "match_won", "round_won", "real_buy_action"]
    missing = [column for column in required if column not in dataset]
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")
    invalid_timestamp_rate = (
        pd.to_numeric(dataset["game_start_millis"], errors="coerce").fillna(0) <= 0
    ).mean()
    if invalid_timestamp_rate > 0.1:
        raise ValueError("Dataset lacks enough valid timestamps for temporal evaluation")
    if (dataset["real_buy_action"] == "UNKNOWN").any():
        raise ValueError("Dataset contains UNKNOWN buy actions")
    leakage = validate_no_feature_leakage(MODEL_FEATURES)
    if not leakage["valid"]:
        raise ValueError(f"Forbidden or post-round model features: {leakage}")
    availability = build_data_availability_report()
    training_match_ids = sorted(str(value) for value in dataset["match_id"].dropna().unique())
    metadata = {
        "schema_version": SCHEMA_VERSION, "created_at": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": len(dataset), "features": MODEL_FEATURES,
        "training_match_ids": training_match_ids,
        "categorical_features": CATEGORICAL_FEATURES, "numeric_features": NUMERIC_FEATURES,
        "includes_agent_utility": True,
        "agent_utility_features": AGENT_UTILITY_NUMERIC_FEATURES,
        "labels": MODEL_LABELS,
        "available_data_report_hash": availability.get("report_hash"),
        "ability_cost_available": ability_costs_available(),
        "prebuy_credit_source": "selected_from_observed_rules_reconciliation",
        "supports_regen_shield": True,
        "weapon_taxonomy_version": "valorant-content-taxonomy-v2",
        "planned_cashflow_available": True,
        "agent_utility_available": True,
        "player_style_available": "fallback_or_embedded_analytics",
        "player_form_available": True,
        "ultimate_inference_available": True,
        "plan_value_weights": PLAN_VALUE_WEIGHTS,
        "estimation_type": "observational_off_policy_ipw",
        "limitations": [
            "Las estimaciones no prueban causalidad.",
            "Solo se recomiendan acciones con soporte histórico suficiente.",
            "Las alternativas usan perfiles de compra simulados y auditables.",
            "No se conoce compra real de habilidades; se estima utilidad potencial por composición de agentes.",
        ],
        "models": {"global": None, "rank_groups": {}, "rank_names": {}},
    }
    model_registry.ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".training_", dir=model_registry.ARTIFACTS_DIR
    ) as staging:
        staging_dir = Path(staging)
        global_minimum = MIN_SAMPLES_GLOBAL if enforce_minimums else 1
        if len(dataset) >= global_minimum:
            metadata["models"]["global"] = _fit_scope(dataset, "global", None, staging_dir)
        for column, scope, minimum, target in (
            ("rank_group", "rank_group", MIN_SAMPLES_RANK_GROUP, "rank_groups"),
            ("rank_name", "rank_name", MIN_SAMPLES_RANK_NAME, "rank_names"),
        ):
            for value, frame in dataset.groupby(column):
                if len(frame) >= (minimum if enforce_minimums else 1):
                    result = _fit_scope(frame, scope, str(value), staging_dir)
                    if result:
                        metadata["models"][target][str(value)] = result
        if not list(staging_dir.glob("*.joblib")):
            raise ValueError(
                "No se pudo entrenar ningun modelo: faltan muestras, clases, "
                "partidas temporales suficientes o variacion en match_won"
            )
        model_registry.save_metadata(metadata, staging_dir)
        model_registry.publish_model_artifacts(staging_dir)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train conservative off-policy economy models.")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET_PATH))
    args = parser.parse_args()
    metadata = train_models(pd.read_parquet(Path(args.dataset)))
    print(f"Training complete: {metadata['dataset_rows']} rows")


if __name__ == "__main__":
    main()
