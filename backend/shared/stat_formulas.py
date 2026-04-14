"""Shared stat‑finalization formulas used by the analytics pipeline.

Both ``extractor._finalize_stats_block`` and ``service._finalize_aggregate``
compute the same derived metrics from accumulated counter dicts.  This module
provides a single canonical implementation so the logic stays in sync.
"""

from __future__ import annotations

from shared.math_utils import safe_div as _safe_div_raw


def _sd(numerator: float, denominator: float) -> float:
    return _safe_div_raw(numerator, denominator, 4)


def finalize_core_stats(stats: dict) -> dict:
    """Compute all derived ratio / percentage fields on *stats* **in‑place**.

    The dict is expected to contain raw accumulator keys such as ``kills``,
    ``deaths``, ``rounds``, ``score``, ``damage_dealt``, etc.  Missing keys
    default to ``0``.

    Returns the same dict for convenience.
    """
    rounds = stats.get("rounds", 0)
    kills = stats.get("kills", 0)
    deaths = stats.get("deaths", 0)
    assists = stats.get("assists", 0)
    total_shots = (
        stats.get("headshots", 0)
        + stats.get("bodyshots", 0)
        + stats.get("legshots", 0)
    )

    stats["kd_ratio"] = _sd(kills, max(deaths, 1))
    stats["kda_ratio"] = _sd(kills + assists, max(deaths, 1))
    stats["acs"] = _sd(stats.get("score", 0), rounds)
    stats["adr"] = _sd(stats.get("damage_dealt", 0), rounds)
    stats["damage_delta_per_round"] = _sd(stats.get("damage_delta", 0), rounds)
    stats["kills_per_round"] = _sd(kills, rounds)
    stats["deaths_per_round"] = _sd(deaths, rounds)
    stats["assists_per_round"] = _sd(assists, rounds)
    stats["headshot_pct"] = _sd(stats.get("headshots", 0) * 100.0, total_shots)
    stats["win_rate"] = _sd(stats.get("wins", 0) * 100.0, rounds)
    stats["survival_rate"] = _sd(
        stats.get("survival_rounds", 0) * 100.0, rounds
    )
    stats["fk_rate"] = _sd(stats.get("first_kills", 0) * 100.0, rounds)
    stats["fd_rate"] = _sd(stats.get("first_deaths", 0) * 100.0, rounds)
    stats["fkfd_diff_per_round"] = _sd(
        stats.get("first_kills", 0) - stats.get("first_deaths", 0),
        rounds,
    )

    opening_total = (
        stats.get("opening_duel_wins", 0)
        + stats.get("opening_duel_losses", 0)
    )
    stats["opening_duel_win_pct"] = _sd(
        stats.get("opening_duel_wins", 0) * 100.0, opening_total
    )
    stats["trade_kills_per_round"] = _sd(stats.get("trade_kills", 0), rounds)
    stats["traded_deaths_per_round"] = _sd(
        stats.get("traded_deaths", 0), rounds
    )
    stats["clutch_win_rate"] = _sd(
        stats.get("clutches_won", 0) * 100.0,
        stats.get("clutch_opportunities", 0),
    )
    stats["multikill_rate"] = _sd(
        stats.get("rounds_with_multikill", 0) * 100.0, rounds
    )
    stats["damage_per_1000_credits"] = _sd(
        stats.get("damage_dealt", 0) * 1000.0,
        stats.get("econ_spent", 0),
    )
    stats["average_loadout_value"] = _sd(
        stats.get("loadout_value_total", 0), rounds
    )

    return stats
