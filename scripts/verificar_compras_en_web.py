"""Verify the active artifact and player API through the frontend proxy."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("OMP_NUM_THREADS", "4")


def main():
    import pandas as pd
    from modules.economy_ml.player_buy_model import ARTIFACT_DIR, load_bundle, grade_rows
    bundle = load_bundle()
    digest = hashlib.sha256((ARTIFACT_DIR / "decisions.parquet").read_bytes()).hexdigest()
    assert digest == bundle["report"]["dataset_sha256"]
    assert all("next_value" in model for model in bundle["models"])
    frame = pd.read_parquet(ARTIFACT_DIR / "decisions.parquet")
    latest = frame.sort_values("game_start_millis").iloc[-1].match_id
    part = frame[frame.match_id == latest]
    sample = json.loads(part.head(20).to_json(orient="records"))
    original = grade_rows(sample, bundle)
    altered = [dict(r, round_won=1-r["round_won"], player_survived=not r["player_survived"],
                    next_round_won=1, next_weapon_observed="invented", next_armor_observed="invented") for r in sample]
    assert original == grade_rows(altered, bundle), "Future outcomes changed recommendations"
    checks = []
    for player in part.puuid.unique()[:2]:
        start = time.perf_counter()
        url = f"http://127.0.0.1:5173/api/economy-ml/matches/{latest}/players/{player}/purchases"
        data = json.load(urllib.request.urlopen(url, timeout=60))
        assert data["puuid"] == player
        assert data["version"] == bundle["version"]
        assert data["planning_method"] == "fitted_two_step_value_from_real_transitions"
        assert data["model_available"]
        assert len({r["round_number"] for r in data["rounds"]}) == len(data["rounds"])
        checks.append({"seconds": round(time.perf_counter()-start, 2), "rounds": len(data["rounds"]),
                       "evaluated": sum(r["quality"] is not None for r in data["rounds"])})
    report = {"artifact_sha256": hashlib.sha256((ARTIFACT_DIR / "model.joblib").read_bytes()).hexdigest(),
              "dataset_hash_matches": True, "future_outcome_invariance_rows": len(sample),
              "frontend_proxy": "http://127.0.0.1:5173", "planning_method": data["planning_method"],
              "version": data["version"], "players_checked": len(checks), "results": checks}
    (ARTIFACT_DIR / "runtime_validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
