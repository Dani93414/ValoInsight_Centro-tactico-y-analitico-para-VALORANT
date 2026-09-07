"""Held-out diagnostics for both learned components and real round sequences.

This assesses observational prediction, not the counterfactual benefit of saving.
No parameters or activation settings are selected using these results.
"""
from pathlib import Path
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("OMP_NUM_THREADS", "4")


def main():
    import numpy as np
    import pandas as pd
    from modules.economy_ml.player_buy_model import ARTIFACT_DIR, load_bundle, feature_frame, logits, metrics, predict
    bundle = load_bundle()
    model = bundle["models"][-1]
    frame = pd.read_parquet(ARTIFACT_DIR / "decisions.parquet")
    results = {}
    for split in ("validation", "test"):
        part = frame[(frame.split == split) & frame.round_won.notna() & frame.player_survived.notna()]
        p = predict(model, part)
        raw = model["survival"]["pipeline"].predict_proba(feature_frame(part).assign(scenario_won=part.round_won))[:, 1]
        survival = model["survival"]["calibrator"].predict_proba(logits(raw))[:, 1]
        part = part.copy()
        part["p"] = p
        following = part[["match_id", "puuid", "round_number", "p", "round_won"]].copy()
        following.round_number -= 1
        pairs = part.merge(following, on=["match_id", "puuid", "round_number"], suffixes=("", "_next"))
        pairs = pairs[~pairs.round_number.isin([12, 24]) & (pairs.round_number < 25)]
        expected = (pairs.p + pairs.p_next) / 2
        actual = (pairs.round_won + pairs.round_won_next) / 2
        error = (expected - actual) ** 2
        groups = error.groupby(pairs.match_id).mean().to_numpy()
        rng = np.random.default_rng(42)
        results[split] = {
            "survival_conditional": metrics(part.player_survived.astype(int), survival),
            "sequence_rows": len(pairs), "sequence_matches": int(pairs.match_id.nunique()),
            "observed_sequence_mse": float(error.mean()),
            "constant_half_sequence_mse": float(((.5 - actual) ** 2).mean()),
            "sequence_match_mean_mse_ci95": np.quantile([rng.choice(groups, len(groups)).mean() for _ in range(300)], [.025, .975]).tolist(),
        }
        if "next_value" in model:
            from modules.economy_ml.player_buy_continuation import predict_continuation
            causal_inputs = pairs[(pairs.team_score_before < 12) & (pairs.enemy_score_before < 12)
                                  & pairs.remaining.notna()].copy()
            causal_inputs["candidate_remaining"] = causal_inputs.remaining
            continuation = predict_continuation(model, causal_inputs.to_dict("records"))
            two_step = (causal_inputs.p + continuation) / 2
            observed = (causal_inputs.round_won + causal_inputs.round_won_next) / 2
            errors = pd.DataFrame({"match_id": causal_inputs.match_id,
                "delta": (two_step-observed)**2 - (.5-observed)**2}).groupby("match_id").delta.mean().to_numpy()
            improvement_ci = np.quantile([rng.choice(errors, len(errors)).mean() for _ in range(500)], [.025, .975]).tolist()
            results[split]["fitted_value_before_both_rounds"] = {
                "rows": len(causal_inputs), "mse_against_observed_sequence": float(np.mean((two_step-observed)**2)),
                "constant_half_mse": float(np.mean((.5-observed)**2)),
                "immediate_prediction_as_sequence_mse": float(np.mean((causal_inputs.p-observed)**2)),
                "match_mean_mse_difference_vs_constant_ci95": improvement_ci,
                "note": "Entradas anteriores al resultado actual; contraste observacional, no efecto de cambiar la compra.",
            }
    results["interpretation"] = "Compras y estados observados de ambas rondas; mide predicción en secuencias, no eficacia causal de ahorrar ni calibración de los estados futuros simulados."
    (ARTIFACT_DIR / "sequence_evaluation.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results))


if __name__ == "__main__":
    main()
