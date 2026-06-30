from __future__ import annotations

from pathlib import Path
from typing import Any


FEATURE_VERSION = "round-win-loadout-v1"
FORBIDDEN_ROUND_WIN_FEATURES = {
    "current_round_kills", "current_round_damage", "current_round_plant",
    "current_round_defuse", "current_round_result", "post_round_score",
    "enemy_current_postbuy_loadout",
}


class RoundWinLoadoutModel:
    def __init__(self, artifact_path: str | Path | None = None) -> None:
        self.artifact_path = Path(artifact_path) if artifact_path else Path(__file__).with_name("artifacts") / "round_win_loadout.joblib"
        self.model: Any = None
        if self.artifact_path.exists():
            try:
                import joblib
                self.model = joblib.load(self.artifact_path)
            except Exception:
                self.model = None

    def available(self) -> bool:
        return self.model is not None

    @staticmethod
    def validate_features(features: dict[str, Any]) -> list[str]:
        return sorted(FORBIDDEN_ROUND_WIN_FEATURES.intersection(features))

    def predict_round_win(self, features: dict[str, Any]) -> dict[str, Any]:
        leaked = self.validate_features(features)
        if leaked:
            return {"available": False, "round_win_probability": None, "confidence": 0.0,
                    "model_scope": "none", "feature_version": FEATURE_VERSION,
                    "warnings": ["round_win_feature_leakage_blocked"]}
        if not self.available():
            return {"available": False, "round_win_probability": None, "confidence": 0.0,
                    "model_scope": "none", "feature_version": FEATURE_VERSION,
                    "warnings": ["round_win_model_unavailable"]}
        try:
            if hasattr(self.model, "predict_proba"):
                probability = float(self.model.predict_proba([features])[0][-1])
            else:
                probability = float(self.model.predict([features])[0])
            return {"available": True, "round_win_probability": max(0.0, min(1.0, probability)),
                    "confidence": .7, "model_scope": "global", "feature_version": FEATURE_VERSION,
                    "warnings": []}
        except Exception:
            return {"available": False, "round_win_probability": None, "confidence": 0.0,
                    "model_scope": "none", "feature_version": FEATURE_VERSION,
                    "warnings": ["round_win_model_prediction_failed"]}
