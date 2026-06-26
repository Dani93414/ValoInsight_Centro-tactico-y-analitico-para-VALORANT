from __future__ import annotations

from collections import Counter
from typing import Any

from .economy_income_rules import (
    AFK_BONUS_MIN_CONFIDENCE,
    AFK_BONUS_MIN_SAMPLES,
    AFK_BONUS_ROUNDING,
    RECONCILIATION_TOLERANCE,
)


def _round_bonus(value: float) -> int:
    rounding = max(1, int(AFK_BONUS_ROUNDING))
    return int(round(float(value) / rounding) * rounding)


def infer_afk_compensation_from_reconciliation(ledgers: list[dict[str, Any]]) -> dict[str, Any]:
    residuals: list[int] = []
    warnings: list[str] = []
    for ledger in ledgers:
        delta = ledger.get("reconciliation_delta")
        if delta is None:
            continue
        try:
            numeric = float(delta)
        except (TypeError, ValueError):
            continue
        if numeric > RECONCILIATION_TOLERANCE:
            residuals.append(_round_bonus(numeric))

    samples = len(residuals)
    counts = Counter(residuals)
    candidates = [
        {
            "value": value,
            "count": count,
            "confidence": round(count / samples, 4) if samples else 0.0,
        }
        for value, count in counts.most_common()
    ]
    most_likely = candidates[0]["value"] if candidates else None
    confidence = candidates[0]["confidence"] if candidates else 0.0
    if samples and samples < AFK_BONUS_MIN_SAMPLES:
        warnings.append("afk_bonus_low_sample_count")
    if samples and confidence < AFK_BONUS_MIN_CONFIDENCE:
        warnings.append("afk_bonus_low_confidence")
    return {
        "candidate_bonus_values": candidates,
        "most_likely_bonus": most_likely if confidence >= AFK_BONUS_MIN_CONFIDENCE else None,
        "confidence": confidence,
        "samples": samples,
        "warnings": warnings,
    }
