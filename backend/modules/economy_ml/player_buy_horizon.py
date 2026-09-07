"""Two-decision lookahead over learned round values, not a spending penalty.

Money is arithmetic in each scenario. Win and survival probabilities are ML.
Future kills/objective bonuses are not assumed. Teammate/enemy money context is
held fixed: this is a partial player rollout, not an exact team simulation.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from threadpoolctl import threadpool_limits

from .player_buy_dataset import apply_history


def credit_scenario(row, won, survived):
    income = 3000 if won else 1000 if survived else min(2900, 1900 + 500 * row["loss_streak"])
    return min(9000, row["candidate_remaining"] + income)


def two_round_values(model, candidates, probabilities, catalog):
    from .player_buy_model import feature_frame, logits, predict, support_key

    values = np.asarray(probabilities, dtype=float).copy()
    horizons = np.ones(len(candidates), dtype=int)
    if "next_value" in model and candidates:
        from .player_buy_continuation import predict_continuation
        active = [i for i, r in enumerate(candidates) if r["round_number"] not in (12, 24)
                  and r["round_number"] < 25 and r.get("team_score_before", 0) < 12
                  and r.get("enemy_score_before", 0) < 12]
        if active:
            future = predict_continuation(model, [candidates[i] for i in active])
            values[active] = (values[active] + future) / 2
            horizons[active] = 2
        return values, horizons
    if "survival" not in model or not candidates:
        return values, horizons
    state = feature_frame(pd.DataFrame(candidates))
    survival = {}
    for won in (0, 1):
        with threadpool_limits(limits=4):
            raw = model["survival"]["pipeline"].predict_proba(state.assign(scenario_won=won))[:, 1]
        survival[won] = model["survival"]["calibrator"].predict_proba(logits(raw))[:, 1]
    classic = next((wid for wid, item in catalog["weapons"].items() if item["cost"] == 0), None)
    if classic is None:
        return values, horizons
    # Cache duplicate future states within each player/round. Flush prediction
    # batches to keep a multi-match audit from retaining millions of rows.
    next_states, next_options = {}, []
    references, branch_constants = {}, {}
    for i, row in enumerate(candidates):
        rn = int(row["round_number"])
        if (rn in (12, 24) or rn >= 25 or row.get("team_score_before", 0) >= 12
                or row.get("enemy_score_before", 0) >= 12):
            continue
        references[i], branch_constants[i] = [], 0.0
        for won in (0, 1):
            outcome_weight = probabilities[i] if won else 1 - probabilities[i]
            # Absorbing result: winning a match has value 1 thereafter; losing
            # has value 0. Never reward a fictitious round after the match ends.
            if won and row.get("team_score_before", 0) >= 12:
                branch_constants[i] += outcome_weight
                continue
            if not won and row.get("enemy_score_before", 0) >= 12:
                continue
            for survived in (False, True):
                weight = outcome_weight * (survival[won][i] if survived else 1 - survival[won][i])
                if weight <= 1e-8:
                    continue
                money = credit_scenario(row, won, survived)
                carried = row["weapon_id"] if survived else classic
                reserve = min(money, row.get("other_spend_reserve", 0))
                key = (row.get("match_id"), row.get("puuid"), rn, won, money, carried, reserve)
                if key not in next_states:
                    future = dict(row, round_number=rn+1, credits_before_buy=money,
                                  score_diff=row["score_diff"] + (1 if won else -1),
                                  loss_streak=0 if won else row["loss_streak"] + 1,
                                  phase="last_half" if rn+1 in (12, 24) else "normal")
                    profiles = json.loads(row.get("history_profiles") or "{}")
                    start = len(next_options)
                    for wid, weapon in catalog["weapons"].items():
                        for aid, armor in catalog["armors"].items():
                            # Armor durability is unknown: budget replacement,
                            # not a fictional full-strength carried shield.
                            cost = (0 if wid == carried else weapon["cost"]) + armor["cost"]
                            if cost > money - reserve:
                                continue
                            option = dict(future, weapon_id=wid, armor_id=aid,
                                          weapon_value=weapon["cost"], armor_value=armor["cost"])
                            if model["support"].get(support_key(option), 0) < 5:
                                continue
                            apply_history(option, profiles, wid)
                            # Retain features only; no duplicate history JSON or labels.
                            next_options.append({name: option.get(name) for name in state.columns})
                    next_states[key] = (start, len(next_options))
                references[i].append((weight, key))
    future_predictions = []
    for start in range(0, len(next_options), 20000):
        future_predictions.extend(predict(model, pd.DataFrame(next_options[start:start+20000])))
    future_predictions = np.asarray(future_predictions)
    maxima = {key: float(future_predictions[a:b].max()) if b > a else None for key, (a, b) in next_states.items()}
    for i, refs in references.items():
        if any(maxima[key] is None for _, key in refs):
            continue
        next_value = branch_constants[i] + sum(weight * maxima[key] for weight, key in refs)
        values[i] = (probabilities[i] + next_value) / 2
        horizons[i] = 2
    return values, horizons
