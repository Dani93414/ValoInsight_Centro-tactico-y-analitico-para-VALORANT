from pathlib import Path
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("OMP_NUM_THREADS", "4")


def main():
    import joblib
    import pandas as pd
    from modules.economy_ml.player_buy_model import ARTIFACT_DIR, load_bundle
    from modules.economy_ml.player_buy_continuation import fit_continuation
    bundle = load_bundle()
    frame = pd.read_parquet(ARTIFACT_DIR / "decisions.parquet")
    frame = frame[frame.round_won.notna() & frame.credits_before_buy.notna() & frame.weapon_value.notna()
                  & frame.armor_value.notna() & frame.money_source.isin(["observed", "fixed_reset", "calculated_rules"])]
    reports = []
    for model in bundle["models"]:
        before = frame[frame.game_start_millis <= model["cutoff"]]
        ids = before[["match_id", "game_start_millis"]].drop_duplicates().sort_values(["game_start_millis", "match_id"])
        fit_ids = set(ids.head(model["train_matches"]).match_id)
        fitting, calibration = before[before.match_id.isin(fit_ids)], before[~before.match_id.isin(fit_ids)]
        print(f"Continuación: {len(fit_ids)} partidas de ajuste", flush=True)
        reports.append(fit_continuation(model, fitting, calibration, bundle["catalog"]))
    bundle["report"]["continuation_models"] = reports
    bundle["report"]["planning_method"] = "fitted_two_step_value_from_real_transitions"
    bundle["report"]["recommendation_min_value_gap"] = .03
    bundle["report"].pop("recommendation_min_probability_gap", None)
    temporary = ARTIFACT_DIR / "model.joblib.tmp"
    joblib.dump(bundle, temporary)
    temporary.replace(ARTIFACT_DIR / "model.joblib")
    (ARTIFACT_DIR / "report.json").write_text(json.dumps(bundle["report"], indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(reports), flush=True)


if __name__ == "__main__":
    main()
