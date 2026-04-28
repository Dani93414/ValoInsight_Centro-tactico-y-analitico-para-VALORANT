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
    trade_opportunities = max(
        0,
        int(
            stats.get(
                "trade_opportunities",
                stats.get("trade_kills", 0)
                + stats.get("missed_trade_opportunities", 0),
            )
            or 0
        ),
    )
    stats["trade_kills_per_round"] = _sd(stats.get("trade_kills", 0), rounds)
    stats["traded_deaths_per_round"] = _sd(
        stats.get("traded_deaths", 0), rounds
    )
    stats["trade_conversion_rate"] = _sd(
        stats.get("trade_kills", 0) * 100.0,
        trade_opportunities,
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

    rounds_with_kill = max(0, int(stats.get("rounds_with_kill", 0) or 0))
    rounds_with_assist = max(0, int(stats.get("rounds_with_assist", 0) or 0))
    rounds_with_death = max(
        0,
        int(stats.get("rounds_with_death", stats.get("deaths", 0)) or 0),
    )
    has_exact_kast = "rounds_with_kast" in stats and stats.get("rounds_with_kast") is not None
    rounds_with_kast = 0
    if has_exact_kast:
        rounds_with_kast = max(
            0,
            int(stats.get("rounds_with_kast", 0) or 0),
        )
    rounds_with_direct = max(
        0,
        int(
            stats.get(
                "rounds_with_direct_participation",
                max(rounds_with_kill, rounds_with_assist),
            )
            or 0
        ),
    )

    rounds_with_kill = min(rounds_with_kill, rounds)
    rounds_with_assist = min(rounds_with_assist, rounds)
    rounds_with_death = min(rounds_with_death, rounds)
    rounds_with_kast = min(rounds_with_kast, rounds)
    rounds_with_direct = min(rounds_with_direct, rounds)

    rounds_without_direct_raw = stats.get("rounds_without_direct_participation")
    if rounds_without_direct_raw is None:
        rounds_without_direct = max(0, rounds - rounds_with_direct)
    else:
        rounds_without_direct = max(0, int(rounds_without_direct_raw or 0))
        rounds_without_direct = min(rounds_without_direct, rounds)
        if rounds_with_direct + rounds_without_direct != rounds:
            rounds_without_direct = max(0, rounds - rounds_with_direct)

    rounds_only_kill = min(
        max(0, int(stats.get("rounds_only_kill", 0) or 0)),
        rounds,
    )
    remaining = max(0, rounds - rounds_only_kill)

    rounds_only_assist = min(
        max(0, int(stats.get("rounds_only_assist", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_only_assist)

    rounds_only_death = min(
        max(0, int(stats.get("rounds_only_death", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_only_death)

    rounds_kill_assist = min(
        max(0, int(stats.get("rounds_kill_assist", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_kill_assist)

    rounds_kill_death = min(
        max(0, int(stats.get("rounds_kill_death", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_kill_death)

    rounds_assist_death = min(
        max(0, int(stats.get("rounds_assist_death", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_assist_death)

    rounds_kill_assist_death = min(
        max(0, int(stats.get("rounds_kill_assist_death", 0) or 0)),
        remaining,
    )
    remaining = max(0, remaining - rounds_kill_assist_death)

    rounds_none_raw = stats.get("rounds_none")
    if rounds_none_raw is None:
        rounds_none = remaining
    else:
        rounds_none = min(max(0, int(rounds_none_raw or 0)), remaining)

    # Backward-compat fallback for old docs that only exposed combined_or_none.
    if (
        rounds_kill_assist == 0
        and rounds_kill_death == 0
        and rounds_assist_death == 0
        and rounds_kill_assist_death == 0
        and rounds_none == 0
    ):
        combined_legacy = min(
            max(0, int(stats.get("rounds_combined_or_none", 0) or 0)),
            remaining,
        )
        rounds_none = combined_legacy

    rounds_combined_or_none = (
        rounds_kill_assist
        + rounds_kill_death
        + rounds_assist_death
        + rounds_kill_assist_death
        + rounds_none
    )

    stats["rounds_with_kill"] = rounds_with_kill
    stats["rounds_with_assist"] = rounds_with_assist
    stats["rounds_with_death"] = rounds_with_death
    if has_exact_kast:
        stats["rounds_with_kast"] = rounds_with_kast
    stats["rounds_with_direct_participation"] = rounds_with_direct
    stats["rounds_without_direct_participation"] = rounds_without_direct
    stats["rounds_only_kill"] = rounds_only_kill
    stats["rounds_only_assist"] = rounds_only_assist
    stats["rounds_only_death"] = rounds_only_death
    stats["rounds_kill_assist"] = rounds_kill_assist
    stats["rounds_kill_death"] = rounds_kill_death
    stats["rounds_assist_death"] = rounds_assist_death
    stats["rounds_kill_assist_death"] = rounds_kill_assist_death
    stats["rounds_none"] = rounds_none
    stats["rounds_combined_or_none"] = rounds_combined_or_none

    stats["rounds_with_kill_pct"] = _sd(rounds_with_kill * 100.0, rounds)
    stats["rounds_with_assist_pct"] = _sd(rounds_with_assist * 100.0, rounds)
    stats["rounds_with_death_pct"] = _sd(rounds_with_death * 100.0, rounds)
    if has_exact_kast:
        kast_pct = _sd(rounds_with_kast * 100.0, rounds)
        stats["rounds_with_kast_pct"] = kast_pct
        stats["kast"] = kast_pct
        stats["kast_pct"] = kast_pct
        stats["kill_assist_survive_trade_pct"] = kast_pct
    stats["rounds_with_direct_participation_pct"] = _sd(
        rounds_with_direct * 100.0,
        rounds,
    )
    stats["rounds_without_direct_participation_pct"] = _sd(
        rounds_without_direct * 100.0,
        rounds,
    )
    stats["rounds_only_kill_pct"] = _sd(rounds_only_kill * 100.0, rounds)
    stats["rounds_only_assist_pct"] = _sd(rounds_only_assist * 100.0, rounds)
    stats["rounds_only_death_pct"] = _sd(rounds_only_death * 100.0, rounds)
    stats["rounds_kill_assist_pct"] = _sd(rounds_kill_assist * 100.0, rounds)
    stats["rounds_kill_death_pct"] = _sd(rounds_kill_death * 100.0, rounds)
    stats["rounds_assist_death_pct"] = _sd(rounds_assist_death * 100.0, rounds)
    stats["rounds_kill_assist_death_pct"] = _sd(
        rounds_kill_assist_death * 100.0,
        rounds,
    )
    stats["rounds_none_pct"] = _sd(rounds_none * 100.0, rounds)
    stats["rounds_combined_or_none_pct"] = _sd(
        rounds_combined_or_none * 100.0,
        rounds,
    )

    return stats
