"""Check trained artifacts, temporal boundaries and legal recommendation outputs."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import argparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("OMP_NUM_THREADS", "4")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--matches", type=int, default=20)
    args = parser.parse_args()
    import pandas as pd
    from modules.economy_ml.player_buy_model import ARTIFACT_DIR, load_bundle, grade_rows, alternatives
    bundle = load_bundle()
    frame = pd.read_parquet(ARTIFACT_DIR / "decisions.parquet")
    manifest = json.loads((ARTIFACT_DIR / "splits.json").read_text(encoding="utf-8"))
    sets = [set(ids) for ids in manifest.values()]
    assert sum(map(len, sets)) == len(set.union(*sets)), "Partidas compartidas entre splits"
    ordered = [frame[frame.match_id.isin(ids)].game_start_millis for ids in manifest.values()]
    assert all(a.max() < b.min() for a, b in zip(ordered, ordered[1:])), "Solapamiento temporal"
    recent_ids = frame[["match_id", "game_start_millis"]].drop_duplicates().sort_values("game_start_millis").tail(args.matches).match_id
    sample = frame[frame.match_id.isin(recent_ids)]
    rows = json.loads(sample.to_json(orient="records"))
    outputs = []
    for start in range(0, len(rows), 100):
        outputs.extend(grade_rows(rows[start:start+100], bundle))
        print(f"Auditadas {len(outputs)}/{len(rows)} filas", flush=True)
    recommendation_types, evaluated = {}, 0
    saving_examples = []
    for row, out in zip(rows, outputs):
        if out["quality"] is not None:
            evaluated += 1
            assert 0 <= out["quality"] <= 100
        if not out["recommendation"]:
            continue
        rec = out["recommendation"]
        models = [m for m in bundle["models"] if m["selection_cutoff"] < row["game_start_millis"]]
        options = alternatives(row, bundle["catalog"], models[-1]["support"])
        wid, aid = rec["weapon_id"] or row["weapon_id"], rec["armor_id"] or row["armor_id"]
        chosen = next(c for c in options if c["weapon_id"] == wid and c["armor_id"] == aid)
        assert chosen["candidate_cost"] <= chosen["candidate_budget"], "Recomendación fuera de presupuesto"
        kind = rec["decision_type"] if rec.get("decision_type") in ("save", "keep") else "both" if rec["weapon_id"] and rec["armor_id"] else "weapon" if rec["weapon_id"] else "armor"
        recommendation_types[kind] = recommendation_types.get(kind, 0) + 1
        if chosen["candidate_remaining"] > row["remaining"] and out.get("planning_horizon") == 2:
            saving_examples.append({"match_id": row["match_id"], "puuid": row["puuid"],
                "round_number": row["round_number"], "decision_type": kind,
                "credits_before_buy": row["credits_before_buy"], "remaining_observed": row["remaining"],
                "remaining_recommended": chosen["candidate_remaining"],
                "observed_weapon": out["weapon_name"], "observed_armor": out["armor_name"],
                "recommended_weapon": bundle["catalog"]["weapons"][wid]["name"],
                "recommended_armor": bundle["catalog"]["armors"][aid]["name"],
                "observed_probability": out["observed_probability"], "recommended_probability": out["best_probability"],
                "observed_value": out["observed_value"], "recommended_value": out["best_value"],
                "quality": out["quality"], "support_matches": rec["support_matches"]})
    result = {"checked_rows": len(rows), "checked_matches": len(recent_ids), "evaluated_rows": evaluated,
              "recommendations": recommendation_types, "budget_violations": 0, "split_overlap": 0,
              "two_round_evaluations": sum(o.get("planning_horizon") == 2 for o in outputs),
              "grade_range": [min(o["quality"] for o in outputs if o["quality"] is not None),
                              max(o["quality"] for o in outputs if o["quality"] is not None)]}
    result["lower_spend_recommendations"] = len(saving_examples)
    result["future_value_reverses_immediate_choice"] = sum(e["recommended_probability"] < e["observed_probability"] for e in saving_examples)
    (ARTIFACT_DIR / "saving_examples.json").write_text(json.dumps({"checked_matches": len(recent_ids),
        "examples": saving_examples}, indent=2), encoding="utf-8")
    (ARTIFACT_DIR / "recommendation_audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
