from __future__ import annotations

from typing import Any

from .economy_income_rules import reconciliation_status


def reconcile_expected_vs_observed(expected: float, observed: float | None) -> dict[str, Any]:
    delta, status = reconciliation_status(expected, observed)
    flags: list[str] = []
    warnings: list[str] = []
    if status == "observed_more_than_expected":
        flags.extend([
            "possible_afk_bonus",
            "save_penalty_not_modeled",
            "plant_bonus_mode_wrong",
            "kill_count_missing",
            "economy_api_extra_unknown",
        ])
    elif status == "observed_less_than_expected":
        flags.extend([
            "purchase_or_spent_misread",
            "max_credit_cap",
            "save_penalty_applied_but_not_detected",
        ])
    elif status == "not_observable":
        warnings.append("observed_next_round_credits_not_available")
    return {"delta": delta, "status": status, "flags": flags, "warnings": warnings}


def reconciliation_quality_score(statuses: list[str]) -> float:
    if not statuses:
        return 0.0
    weights = {
        "matched": 1.0,
        "observed_more_than_expected": 0.35,
        "observed_less_than_expected": 0.35,
        "not_observable": 0.0,
    }
    return round(sum(weights.get(status, 0.0) for status in statuses) / len(statuses), 4)
