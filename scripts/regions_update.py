import os
import sys
import logging
import argparse
from collections import Counter, defaultdict
from datetime import datetime, UTC

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_root = os.path.join(project_root, "backend")
for path in (project_root, backend_root):
    if path not in sys.path:
        sys.path.append(path)

from backend.infrastructure.mongo_client import (
    ensure_indexes,
    matches_collection,
    regions_collection,
)
try:
    from modules.analytics.infrastructure.reference_data import resolve_gear_name
    from shared.stat_formulas import finalize_core_stats
except ModuleNotFoundError:
    from backend.modules.analytics.infrastructure.reference_data import resolve_gear_name
    from backend.shared.stat_formulas import finalize_core_stats

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Fields to sum from overview / side scopes
# ──────────────────────────────────────────────
_SUM_FIELDS = (
    "rounds", "wins", "kills", "deaths", "assists", "score",
    "damage_dealt", "damage_received", "headshots", "bodyshots", "legshots",
    "first_kills", "first_deaths", "opening_duel_wins", "opening_duel_losses",
    "trade_kills", "trade_opportunities", "missed_trade_opportunities",
    "traded_deaths", "clutch_opportunities", "clutches_won",
    "survival_rounds", "rounds_with_kill", "rounds_with_assist", "rounds_with_death",
    "rounds_with_kast", "rounds_with_direct_participation",
    "rounds_without_direct_participation", "rounds_only_kill",
    "rounds_only_assist", "rounds_only_death", "rounds_kill_assist",
    "rounds_kill_death", "rounds_assist_death",
    "rounds_kill_assist_death", "rounds_none",
    "rounds_combined_or_none", "rounds_with_multikill",
    "multi_2k", "multi_3k", "multi_4k", "multi_5k",
    "econ_spent", "loadout_value_total",
)

_BUCKET_FIELDS = ("rounds", "wins", "kills", "deaths", "damage_dealt", "spent")

_WEAPON_FIELDS = (
    "rounds", "rounds_purchased", "wins", "kills", "deaths", "headshots",
    "bodyshots", "legshots", "damage_dealt", "damage_received",
    "survival_rounds", "loadout_value_total",
)


def _safe_div(num, den):
    return round(num / den, 4) if den else 0.0


def _progress_label(done: int, total: int) -> str:
    pct = (done / total * 100.0) if total else 100.0
    return f"[{pct:5.1f}%] [{done}/{total}]"


def _normalize_region(raw):
    if not raw:
        return "UNKNOWN"
    return str(raw).strip().upper()


def _derive_ratios(t):
    """Compute derived averages from aggregated totals using the profile formulas."""
    return finalize_core_stats(dict(t))


def _side_summary(side_totals):
    """Build a compact side stats dict from accumulated counters."""
    rounds = side_totals.get("rounds", 0)
    return {
        "rounds": rounds,
        "wins": side_totals.get("wins", 0),
        "win_rate": _safe_div(side_totals.get("wins", 0) * 100.0, rounds),
        "kills": side_totals.get("kills", 0),
        "deaths": side_totals.get("deaths", 0),
        "adr": _safe_div(side_totals.get("damage_dealt", 0), rounds),
        "kills_per_round": _safe_div(side_totals.get("kills", 0), rounds),
    }


def _clamp(value, min_value=0.0, max_value=1.0):
    return max(min_value, min(max_value, value))


def _normalized(value, baseline, spread):
    if value is None or spread <= 0:
        return 0.5
    return _clamp(0.5 + ((value - baseline) / spread))


def _bayesian_adjusted_rate(raw_rate, sample, prior_rate=50.0, prior_weight=15):
    sample = max(0, int(sample or 0))
    raw_rate = float(raw_rate or 0.0)
    prior_rate = float(prior_rate if prior_rate is not None else 50.0)
    return _safe_div(sample * raw_rate + prior_weight * prior_rate, sample + prior_weight)


def _team_rounds(team):
    if not isinstance(team, dict):
        return 0
    return int(team.get("roundsWon") or team.get("numPoints") or 0)


def _match_rounds_from_teams(teams):
    return sum(_team_rounds(team) for team in teams or [] if isinstance(team, dict))


def _team_results(match_obj):
    return {
        str(team.get("teamId") or "").lower(): team
        for team in match_obj.get("teams", []) or []
        if isinstance(team, dict)
    }


def _new_map_bucket():
    return {
        "map_name": "Unknown",
        "map_url": None,
        "match_ids": set(),
        "rounds_played": 0,
        "rounds_won": 0,
        "rounds_lost": 0,
        "totals": Counter(),
        "sides": {"attack": Counter(), "defense": Counter()},
        "round_ceremonies": Counter(),
        "agents": defaultdict(lambda: {
            "agent_name": "Unknown",
            "matches_played": 0,
            "wins": 0,
            "totals": Counter(),
        }),
        "weapons": defaultdict(lambda: {"weapon_name": "Unknown", "is_armor": False, "totals": Counter()}),
        "compositions": defaultdict(lambda: {
            "agent_ids": [],
            "agent_names": [],
            "matches_played": 0,
            "wins": 0,
        }),
    }


def _accumulate_round_ceremonies(map_bucket, match_obj):
    for round_obj in match_obj.get("roundResults", []) or []:
        if not isinstance(round_obj, dict):
            continue
        ceremony = str(round_obj.get("roundCeremony") or "").strip()
        if ceremony:
            map_bucket["round_ceremonies"][ceremony] += 1


def _normalize_weapon_stats(weapon_stats):
    if isinstance(weapon_stats, dict):
        return [item for item in weapon_stats.values() if isinstance(item, dict)]
    if isinstance(weapon_stats, list):
        return [item for item in weapon_stats if isinstance(item, dict)]
    return []


def _composition_agents_for_team(players):
    agents = []
    for player in players:
        agent_id = str(player.get("characterId") or "").strip()
        if not agent_id or agent_id == "UNKNOWN":
            continue
        analytics = player.get("analytics") or {}
        agent_name = analytics.get("agent_name") or agent_id
        agents.append((agent_id, agent_name))
    if len(agents) != 5:
        return None
    return sorted(agents, key=lambda item: item[0])


def _finalize_round_ceremonies(counter):
    total = sum(int(value or 0) for value in counter.values())
    return {
        key: {
            "wins": int(value or 0),
            "rounds": int(value or 0),
            "percentage_of_wins": _safe_div(int(value or 0) * 100.0, total),
        }
        for key, value in counter.items()
        if int(value or 0) > 0
    }


def _finalize_map_agent_stats(agents, total_agent_picks, prior_win_rate):
    result = {}
    for agent_id, bucket in agents.items():
        totals = dict(bucket["totals"])
        derived = _derive_ratios(totals)
        matches = int(bucket["matches_played"] or 0)
        wins = int(bucket["wins"] or 0)
        rounds = int(totals.get("rounds", 0) or 0)
        win_rate = _safe_div(wins * 100.0, matches)
        adjusted_win_rate = _bayesian_adjusted_rate(win_rate, matches, prior_win_rate, 15)
        pick_rate = _safe_div(matches * 100.0, total_agent_picks)
        normalized_performance = (
            _normalized(derived.get("kd_ratio"), 1.0, 1.4) * 0.25
            + _normalized(derived.get("kda_ratio"), 1.4, 1.6) * 0.15
            + _normalized(derived.get("adr"), 140, 120) * 0.25
            + _normalized(derived.get("acs"), 210, 180) * 0.2
            + _normalized(derived.get("kast_pct"), 70, 30) * 0.15
        ) * 100.0
        sample_confidence = _clamp(max(matches / 15.0, rounds / 250.0))
        score = (
            adjusted_win_rate * 0.45
            + normalized_performance * 0.35
            + _normalized(pick_rate, 10, 25) * 100.0 * 0.15
            + sample_confidence * 100.0 * 0.05
        )
        result[agent_id] = {
            "agent_name": bucket["agent_name"],
            "matches_played": matches,
            "matches": matches,
            "rounds_played": rounds,
            "rounds": rounds,
            "wins": wins,
            "win_rate": win_rate,
            "pick_count": matches,
            "picks": matches,
            "pick_rate": pick_rate,
            "kills": int(totals.get("kills", 0) or 0),
            "deaths": int(totals.get("deaths", 0) or 0),
            "assists": int(totals.get("assists", 0) or 0),
            "damage_dealt": int(totals.get("damage_dealt", 0) or 0),
            "adr": derived.get("adr", 0.0),
            "avg_adr": derived.get("adr", 0.0),
            "kd": derived.get("kd_ratio", 0.0),
            "avg_kd": derived.get("kd_ratio", 0.0),
            "kda": derived.get("kda_ratio", 0.0),
            "avg_kda": derived.get("kda_ratio", 0.0),
            "acs": derived.get("acs", 0.0),
            "avg_acs": derived.get("acs", 0.0),
            "survived_rounds": int(totals.get("survival_rounds", 0) or 0),
            "survival_rate": derived.get("survival_rate", 0.0),
            "avg_survival_rate": derived.get("survival_rate", 0.0),
            "kast_rounds": int(totals.get("rounds_with_kast", 0) or 0),
            "kast_rate": derived.get("kast_pct", 0.0),
            "kast_pct": derived.get("kast_pct", 0.0),
            "score": round(score, 4),
            "adjusted_win_rate": adjusted_win_rate,
            "sample": matches,
            "sample_confidence": sample_confidence,
        }
    return result


def _finalize_map_weapon_stats(weapons, player_rounds):
    raw_rates = []
    for bucket in weapons.values():
        totals = dict(bucket["totals"])
        rounds = int(totals.get("rounds", totals.get("rounds_equipped", 0)) or 0)
        if rounds > 0:
            raw_rates.append(_safe_div(int(totals.get("wins", 0) or 0) * 100.0, rounds))
    prior_win_rate = sum(raw_rates) / len(raw_rates) if raw_rates else 50.0

    result = {}
    for weapon_id, bucket in weapons.items():
        totals = dict(bucket["totals"])
        rounds = int(totals.get("rounds", totals.get("rounds_equipped", 0)) or 0)
        rounds_purchased = int(totals.get("rounds_purchased", 0) or 0)
        wins = int(totals.get("wins", 0) or 0)
        kills = int(totals.get("kills", 0) or 0)
        deaths = int(totals.get("deaths", 0) or 0)
        headshots = int(totals.get("headshots", 0) or 0)
        damage_dealt = int(totals.get("damage_dealt", 0) or 0)
        round_win_rate = _safe_div(wins * 100.0, rounds)
        adjusted_round_win_rate = _bayesian_adjusted_rate(round_win_rate, rounds, prior_win_rate, 70)
        kills_per_round = _safe_div(kills, rounds)
        use_rate = _safe_div(rounds * 100.0, player_rounds)
        combat_score = (
            _normalized(kills_per_round, 0.7, 1.4) * 0.55
            + _normalized(_safe_div(damage_dealt, rounds), 140, 120) * 0.25
            + _normalized(_safe_div(headshots * 100.0, kills), 22, 40) * 0.20
        ) * 100.0
        sample_confidence = _clamp(rounds / 80.0)
        score = (
            adjusted_round_win_rate * 0.35
            + combat_score * 0.35
            + _normalized(use_rate, 8, 20) * 100.0 * 0.20
            + sample_confidence * 100.0 * 0.10
        )
        result[weapon_id] = {
            "weapon_name": bucket["weapon_name"],
            "is_armor": bool(bucket.get("is_armor")),
            "rounds_equipped": rounds,
            "rounds_purchased": rounds_purchased,
            "rounds_won_with_weapon": wins,
            "wins": wins,
            "round_win_rate": round_win_rate,
            "win_rate": round_win_rate,
            "kills": kills,
            "deaths": deaths,
            "headshots": headshots,
            "bodyshots": int(totals.get("bodyshots", 0) or 0),
            "legshots": int(totals.get("legshots", 0) or 0),
            "headshot_pct": _safe_div(headshots * 100.0, kills),
            "damage_dealt": damage_dealt,
            "adr": _safe_div(damage_dealt, rounds),
            "kills_per_round": kills_per_round,
            "use_rate": use_rate,
            "pick_rate_per_round": use_rate,
            "score": round(score, 4),
            "adjusted_round_win_rate": adjusted_round_win_rate,
            "sample": rounds,
            "sample_confidence": sample_confidence,
        }
    return result


def _finalize_map_composition_stats(compositions, total_team_compositions):
    raw_rates = []
    for row in compositions.values():
        matches = int(row["matches_played"] or 0)
        if matches > 0:
            raw_rates.append(_safe_div(int(row["wins"] or 0) * 100.0, matches))
    prior_win_rate = sum(raw_rates) / len(raw_rates) if raw_rates else 50.0

    result = {}
    for key, row in compositions.items():
        matches = int(row["matches_played"] or 0)
        wins = int(row["wins"] or 0)
        losses = max(0, matches - wins)
        win_rate = _safe_div(wins * 100.0, matches)
        adjusted_win_rate = _bayesian_adjusted_rate(win_rate, matches, prior_win_rate, 15)
        pick_rate = _safe_div(matches * 100.0, total_team_compositions)
        sample_confidence = _clamp(matches / 15.0)
        score = (
            adjusted_win_rate * 0.65
            + _normalized(pick_rate, 5, 15) * 100.0 * 0.20
            + sample_confidence * 100.0 * 0.15
        )
        result[key] = {
            "key": key,
            "agent_ids": row["agent_ids"],
            "agent_names": row["agent_names"],
            "agents": row["agent_names"],
            "matches_played": matches,
            "matches": matches,
            "wins": wins,
            "losses": losses,
            "win_rate": win_rate,
            "adjusted_win_rate": adjusted_win_rate,
            "pick_rate": pick_rate,
            "score": round(score, 4),
            "sample": matches,
            "sample_confidence": sample_confidence,
        }
    return result


def _finalize_map_stats(map_id, map_bucket):
    totals = dict(map_bucket["totals"])
    derived = _derive_ratios(totals)
    player_rounds = int(totals.get("rounds", 0) or 0)
    rounds_played = int(map_bucket["rounds_played"] or 0)
    rounds_won = int(map_bucket["rounds_won"] or 0)
    rounds_lost = int(map_bucket["rounds_lost"] or 0)
    attack = _side_summary(dict(map_bucket["sides"]["attack"]))
    defense = _side_summary(dict(map_bucket["sides"]["defense"]))
    total_agent_picks = sum(int(agent["matches_played"]) for agent in map_bucket["agents"].values())
    agent_raw_rates = [
        _safe_div(int(agent["wins"]) * 100.0, int(agent["matches_played"]))
        for agent in map_bucket["agents"].values()
        if int(agent["matches_played"]) > 0
    ]
    agent_prior = sum(agent_raw_rates) / len(agent_raw_rates) if agent_raw_rates else 50.0
    total_team_compositions = sum(int(row["matches_played"]) for row in map_bucket["compositions"].values())
    return {
        "map_name": map_bucket["map_name"],
        "map_url": map_bucket.get("map_url"),
        "matches_played": len(map_bucket["match_ids"]),
        "matches": len(map_bucket["match_ids"]),
        "rounds_played": rounds_played,
        "total_rounds": rounds_played,
        "map_rounds": rounds_played,
        "rounds_won": rounds_won,
        "team_round_wins": rounds_won,
        "rounds_lost": rounds_lost,
        "team_round_losses": rounds_lost,
        "win_rate": _safe_div(rounds_won * 100.0, rounds_won + rounds_lost),
        "team_round_win_rate": _safe_div(rounds_won * 100.0, rounds_won + rounds_lost),
        "attack_rounds": attack["rounds"],
        "attack_wins": attack["wins"],
        "attack_win_rate": attack["win_rate"],
        "defense_rounds": defense["rounds"],
        "defense_wins": defense["wins"],
        "defense_win_rate": defense["win_rate"],
        "round_differential": rounds_won - rounds_lost,
        "player_rounds": player_rounds,
        "player_matches": total_agent_picks,
        "kills": int(totals.get("kills", 0) or 0),
        "deaths": int(totals.get("deaths", 0) or 0),
        "assists": int(totals.get("assists", 0) or 0),
        "damage_dealt": int(totals.get("damage_dealt", 0) or 0),
        "damage_received": int(totals.get("damage_received", 0) or 0),
        "survived_rounds": int(totals.get("survival_rounds", 0) or 0),
        "survival_rounds": int(totals.get("survival_rounds", 0) or 0),
        "survival_rate": derived.get("survival_rate", 0.0),
        "kast_rounds": int(totals.get("rounds_with_kast", 0) or 0),
        "rounds_with_kast": int(totals.get("rounds_with_kast", 0) or 0),
        "kast_rate": derived.get("kast_pct", 0.0),
        "kast_pct": derived.get("kast_pct", 0.0),
        "kast_has_trade_component": int(totals.get("traded_deaths", 0) or 0) > 0,
        "clutch_opportunities": int(totals.get("clutch_opportunities", 0) or 0),
        "clutches_won": int(totals.get("clutches_won", 0) or 0),
        "clutch_rate": derived.get("clutch_win_rate", 0.0) if int(totals.get("clutch_opportunities", 0) or 0) > 0 else None,
        "clutch_win_rate": derived.get("clutch_win_rate", 0.0) if int(totals.get("clutch_opportunities", 0) or 0) > 0 else None,
        "round_ceremonies": _finalize_round_ceremonies(map_bucket["round_ceremonies"]),
        "agent_stats": _finalize_map_agent_stats(map_bucket["agents"], total_agent_picks, agent_prior),
        "weapon_stats": _finalize_map_weapon_stats(map_bucket["weapons"], player_rounds),
        "composition_stats": _finalize_map_composition_stats(map_bucket["compositions"], total_team_compositions),
        "averages": {
            "kd_ratio": derived.get("kd_ratio", 0.0),
            "kda_ratio": derived.get("kda_ratio", 0.0),
            "acs": derived.get("acs", 0.0),
            "adr": derived.get("adr", 0.0),
            "headshot_pct": derived.get("headshot_pct", 0.0),
            "kast_pct": derived.get("kast_pct", 0.0),
            "survival_rate": derived.get("survival_rate", 0.0),
            "clutch_win_rate": derived.get("clutch_win_rate", 0.0) if int(totals.get("clutch_opportunities", 0) or 0) > 0 else None,
            "kills_per_round": derived.get("kills_per_round", 0.0),
            "deaths_per_round": derived.get("deaths_per_round", 0.0),
            "assists_per_round": derived.get("assists_per_round", 0.0),
        },
        "sides": {"attack": attack, "defense": defense},
        "totals": {k: int(totals.get(k, 0) or 0) for k in _SUM_FIELDS},
    }


# ──────────────────────────────────────────────
# COMPREHENSIVE REBUILD (from embedded analytics in matches)
# ──────────────────────────────────────────────

def rebuild_regions(*, force: bool = False):
    """
    Full rebuild of regions collection using embedded analytics in matches.
    Produces one document per region with:
      - global totals + averages
      - side breakdown (attack / defense)
      - economy breakdown (eco / low_buy / full_buy)
      - per-agent stats (picks, wins, KD, ACS, ADR, HS%)
      - per-map stats (matches, sides, averages)
      - per-weapon stats (kills, HS%)
      - top lists for quick display
    """
    if not force:
        logger.error(
            "Este script borra la colección regions. "
            "Usa --force para confirmar."
        )
        raise RuntimeError("Refusing to rebuild regions without --force")

    logger.info("Rebuilding regions from embedded analytics in matches...")

    # ── Accumulators keyed by region ──
    regions = defaultdict(lambda: {
        "match_ids": set(),
        "puuids": set(),
        "totals": Counter(),
        "sides": {"attack": Counter(), "defense": Counter()},
        "economy": {"eco": Counter(), "low_buy": Counter(), "full_buy": Counter()},
        "agents": defaultdict(lambda: {
            "agent_name": "Unknown", "role": "Desconocido",
            "picks": 0, "wins": 0, "totals": Counter(),
        }),
        "maps": defaultdict(_new_map_bucket),
        "weapons": defaultdict(lambda: {"weapon_name": "Unknown", "totals": Counter()}),
    })

    # ── 1. Iterate all ranked matches ──
    ranked_query = {"matchInfo.isRanked": True}
    total_ranked_matches = matches_collection.count_documents(ranked_query)
    cursor = matches_collection.find(ranked_query)
    doc_count = 0
    match_count = 0

    for match_obj in cursor:
        match_count += 1
        match_info = match_obj.get("matchInfo") or {}
        match_id = str(match_info.get("matchId") or "")
        region = _normalize_region(match_info.get("region"))
        map_id = str(match_info.get("mapId") or "UNKNOWN")
        teams_by_id = _team_results(match_obj)
        team_values = list(teams_by_id.values())
        match_rounds = _match_rounds_from_teams(team_values)
        players_by_team = defaultdict(list)
        for player in match_obj.get("players", []) or []:
            players_by_team[str(player.get("teamId") or "").lower()].append(player)

        rd_for_match = regions[region]
        mp_for_match = rd_for_match["maps"][map_id]
        mp_for_match["match_ids"].add(match_id)
        mp_for_match["rounds_played"] += match_rounds
        _accumulate_round_ceremonies(mp_for_match, match_obj)
        if len(team_values) == 2:
            first_rounds = _team_rounds(team_values[0])
            second_rounds = _team_rounds(team_values[1])
            mp_for_match["rounds_won"] += first_rounds + second_rounds
            mp_for_match["rounds_lost"] += second_rounds + first_rounds

        for team_id, team_players in players_by_team.items():
            composition = _composition_agents_for_team(team_players)
            if not composition:
                continue
            composition_key = "|".join(agent_id for agent_id, _ in composition)
            comp = mp_for_match["compositions"][composition_key]
            comp["agent_ids"] = [agent_id for agent_id, _ in composition]
            comp["agent_names"] = [agent_name for _, agent_name in composition]
            comp["matches_played"] += 1
            team_doc = teams_by_id.get(team_id)
            comp["wins"] += 1 if isinstance(team_doc, dict) and bool(team_doc.get("won")) else 0

        for player in match_obj.get("players", []) or []:
            analytics = player.get("analytics")
            if not analytics:
                continue

            doc_count += 1
            rd = regions[region]
            rd["match_ids"].add(match_id)
            rd["puuids"].add(player.get("puuid"))

            overview = analytics.get("overview") or {}

            # Global totals
            for field in _SUM_FIELDS:
                rd["totals"][field] += int(overview.get(field, 0) or 0)

            # ── Agent ──
            agent_id = str(player.get("characterId") or "UNKNOWN")
            ag = rd["agents"][agent_id]
            ag["agent_name"] = analytics.get("agent_name") or "Unknown"
            ag["role"] = analytics.get("role") or "Desconocido"
            ag["picks"] += 1
            ag["wins"] += 1 if analytics.get("won_match") else 0
            for field in _SUM_FIELDS:
                ag["totals"][field] += int(overview.get(field, 0) or 0)

            # ── Map ──
            mp = rd["maps"][map_id]
            mp["map_name"] = analytics.get("map_name") or "Unknown"
            mp["map_url"] = match_info.get("mapId") or map_id
            mp["match_ids"].add(match_id)
            for field in _SUM_FIELDS:
                mp["totals"][field] += int(overview.get(field, 0) or 0)

            mag = mp["agents"][agent_id]
            mag["agent_name"] = analytics.get("agent_name") or "Unknown"
            mag["matches_played"] += 1
            mag["wins"] += 1 if analytics.get("won_match") else 0
            for field in _SUM_FIELDS:
                mag["totals"][field] += int(overview.get(field, 0) or 0)

            # ── Sides (global + per-map) ──
            sides = analytics.get("sides") or {}
            for side_name in ("attack", "defense"):
                side = sides.get(side_name) or {}
                for field in _SUM_FIELDS:
                    val = int(side.get(field, 0) or 0)
                    rd["sides"][side_name][field] += val
                    mp["sides"][side_name][field] += val

        # ── Economy (buy buckets) ──
            for bucket_name in ("eco", "low_buy", "full_buy"):
                bucket = (overview.get("buy_buckets") or {}).get(bucket_name) or {}
                for field in _BUCKET_FIELDS:
                    rd["economy"][bucket_name][field] += int(bucket.get(field, 0) or 0)

        # ── Weapon stats (equipped weapon) ──
            for weapon_id, ws in (overview.get("weapon_stats") or {}).items():
                weq = rd["weapons"][weapon_id]
                weq["weapon_name"] = ws.get("weapon_name") or "Unknown"
                weq["is_armor"] = bool(ws.get("is_armor"))
                for field in _WEAPON_FIELDS:
                    weq["totals"][field] += int(ws.get(field, 0) or 0)

            for ws in _normalize_weapon_stats(overview.get("weapon_stats")):
                weapon_id = _valid_equipment_id(ws.get("weapon_id") or ws.get("weaponId") or ws.get("id"))
                if not weapon_id:
                    continue
                mw = mp["weapons"][weapon_id]
                mw["weapon_name"] = ws.get("weapon_name") or ws.get("displayName") or resolve_gear_name(weapon_id)
                mw["is_armor"] = bool(ws.get("is_armor"))
                for field in _WEAPON_FIELDS:
                    mw["totals"][field] += int(ws.get(field, 0) or 0)

            if not _has_embedded_armor_stats(overview):
                _accumulate_raw_armor_stats(rd, match_obj, player)

        if match_count == total_ranked_matches or match_count % 25 == 0:
            print(f"{_progress_label(match_count, total_ranked_matches)} [REBUILD_REGIONS]")

    logger.info("Processed %d analytics documents.", doc_count)

    # ── 2. Build and save documents ──
    regions_collection.delete_many({})

    for region, rd in regions.items():
        totals = dict(rd["totals"])
        total_picks = sum(a["picks"] for a in rd["agents"].values())

        # ── Agent stats ──
        agent_doc = {}
        for agent_id, ag in rd["agents"].items():
            at = dict(ag["totals"])
            ar = at.get("rounds", 0)
            derived = _derive_ratios(at)
            agent_doc[agent_id] = {
                "agent_name": ag["agent_name"],
                "role": ag["role"],
                "picks": ag["picks"],
                "wins": ag["wins"],
                "matches": ag["picks"],
                "rounds": ar,
                "totals": {k: at.get(k, 0) for k in _SUM_FIELDS},
                "pick_rate": _safe_div(ag["picks"] * 100.0, total_picks),
                "win_rate": _safe_div(ag["wins"] * 100.0, ag["picks"]),
                "avg_kd": derived["kd_ratio"],
                "avg_kda": derived["kda_ratio"],
                "avg_acs": derived["acs"],
                "avg_adr": derived["adr"],
                "avg_headshot_pct": derived["headshot_pct"],
                # avg_fk_rate is first_kills / rounds, not opening_duel_win_pct.
                "avg_fk_rate": derived["fk_rate"],
                "avg_fd_rate": derived["fd_rate"],
                "avg_survival_rate": derived["survival_rate"],
                "avg_clutch_win_rate": derived["clutch_win_rate"],
                "deaths_per_round": derived["deaths_per_round"],
                "assist_rate": derived["rounds_with_assist_pct"],
                "kast_pct": derived.get("kast_pct", 0.0),
                "trade_rate": derived["trade_conversion_rate"],
                "trade_kills_per_round": derived["trade_kills_per_round"],
                "opening_duel_win_pct": derived["opening_duel_win_pct"],
                # utilityImpact and mapCoverage are intentionally absent: the current
                # region aggregation has no true ability-event or positional coverage data.
            }

        # ── Map stats ──
        map_doc = {}
        for map_id, mp in rd["maps"].items():
            map_doc[map_id] = _finalize_map_stats(map_id, mp)

        # ── Weapon stats ──
        weapon_doc = {}
        for weapon_id, weq in rd["weapons"].items():
            wt = dict(weq["totals"])
            whs = wt.get("headshots", 0)
            total_shots_w = whs + wt.get("bodyshots", 0) + wt.get("legshots", 0)
            weapon_doc[weapon_id] = {
                "weapon_name": weq["weapon_name"],
                "is_armor": bool(weq.get("is_armor")),
                "rounds_equipped": wt.get("rounds", 0),
                "rounds_purchased": wt.get("rounds_purchased", 0),
                "wins": wt.get("wins", 0),
                "win_rate": _safe_div(wt.get("wins", 0) * 100.0, wt.get("rounds", 0)),
                "kills": wt.get("kills", 0),
                "deaths": wt.get("deaths", 0),
                "headshots": whs,
                "headshot_pct": _safe_div(whs * 100.0, total_shots_w),
                "damage_dealt": wt.get("damage_dealt", 0),
                "damage_received": wt.get("damage_received", 0),
                "survival_rounds": wt.get("survival_rounds", 0),
                "survival_rate": _safe_div(wt.get("survival_rounds", 0) * 100.0, wt.get("rounds", 0)),
                "damage_received_per_round": _safe_div(wt.get("damage_received", 0), wt.get("rounds", 0)),
                "loadout_value_total": wt.get("loadout_value_total", 0),
                "average_loadout_value": _safe_div(wt.get("loadout_value_total", 0), wt.get("rounds", 0)),
            }

        # ── Economy ──
        econ_doc = {}
        for bucket_name in ("eco", "low_buy", "full_buy"):
            b = dict(rd["economy"][bucket_name])
            br = b.get("rounds", 0)
            econ_doc[bucket_name] = {
                "rounds": br,
                "wins": b.get("wins", 0),
                "win_rate": _safe_div(b.get("wins", 0) * 100.0, br),
                "kd_ratio": _safe_div(b.get("kills", 0), max(b.get("deaths", 0), 1)),
                "adr": _safe_div(b.get("damage_dealt", 0), br),
            }

        # ── Top lists ──
        most_played_agents = sorted(
            [
                {
                    "agentId": aid,
                    "agent_name": a["agent_name"],
                    "role": a["role"],
                    "picks": a["picks"],
                    "win_rate": _safe_div(a["wins"] * 100.0, a["picks"]),
                }
                for aid, a in rd["agents"].items()
            ],
            key=lambda x: x["picks"],
            reverse=True,
        )[:10]

        most_played_maps = sorted(
            [
                {"mapId": mid, "map_name": m["map_name"], "matches": len(m["match_ids"])}
                for mid, m in rd["maps"].items()
            ],
            key=lambda x: x["matches"],
            reverse=True,
        )[:5]

        most_lethal_weapons = sorted(
            [
                {
                    "weaponId": wid,
                    "weapon_name": w["weapon_name"],
                    "kills": dict(w["totals"]).get("kills", 0),
                    "headshot_pct": weapon_doc[wid]["headshot_pct"],
                }
                for wid, w in rd["weapons"].items()
            ],
            key=lambda x: x["kills"],
            reverse=True,
        )[:10]

        # ── Final document ──
        region_doc = {
            "region": region,
            "processedMatchIds": sorted(mid for mid in rd["match_ids"] if mid),
            "totalMatches": len(rd["match_ids"]),
            "uniquePlayers": len(rd["puuids"]),
            "totalRounds": totals.get("rounds", 0),
            "avgRoundsPerMatch": _safe_div(totals.get("rounds", 0), len(rd["match_ids"]) * 10),
            "totals": {k: totals.get(k, 0) for k in _SUM_FIELDS},
            "averages": _derive_ratios(totals),
            "sides": {
                s: _side_summary(dict(rd["sides"][s]))
                for s in ("attack", "defense")
            },
            "economy": econ_doc,
            "agentStats": agent_doc,
            "mapStats": map_doc,
            "weaponStats": weapon_doc,
            "mostPlayedAgents": most_played_agents,
            "mostPlayedMaps": most_played_maps,
            "mostLethalWeapons": most_lethal_weapons,
            "updatedAt": datetime.now(UTC),
        }

        regions_collection.insert_one(region_doc)
        logger.info(
            "Region %s: %d matches, %d players, %d rounds",
            region, len(rd["match_ids"]), len(rd["puuids"]), totals.get("rounds", 0),
        )

    logger.info("Regions rebuild complete.")


# ──────────────────────────────────────────────
# LIGHTWEIGHT INCREMENTAL (called by match_processor)
# ──────────────────────────────────────────────

def update_region_from_match(match_obj):
    """
    Idempotent update after a single match insert.

    The previous lightweight path only incremented basic region counters and
    left map/agent/weapon aggregates stale. A full rebuild is more expensive,
    but keeps the compatibility document and the extended map stats coherent
    until we introduce persisted per-match deltas.
    """
    match_info = match_obj.get("matchInfo") or {}
    match_id = str(match_info.get("matchId") or "").strip()
    if not match_id:
        logger.warning("Skipping region update for match without matchInfo.matchId")
        return

    region = _normalize_region(match_info.get("region"))
    if regions_collection.find_one({"region": region, "processedMatchIds": match_id}, {"_id": 1}):
        return

    logger.info(
        "Rebuilding regions after new match %s in %s to refresh extended map stats.",
        match_id,
        region,
    )
    rebuild_regions(force=True)


def _valid_equipment_id(value):
    text = str(value or "").strip()
    if not text or text in {"UNKNOWN", "None", "none", "null", "string"}:
        return None
    return text


def _player_stats_map(round_obj):
    return {
        pstat.get("puuid"): pstat
        for pstat in round_obj.get("playerStats", []) or []
        if isinstance(pstat, dict) and pstat.get("puuid")
    }


def _collect_unique_round_kills(round_obj):
    seen = set()
    kills = []
    for pstat in round_obj.get("playerStats", []) or []:
        if not isinstance(pstat, dict):
            continue
        for kill in pstat.get("kills", []) or []:
            if not isinstance(kill, dict):
                continue
            key = (
                kill.get("timeSinceRoundStartMillis"),
                kill.get("killer"),
                kill.get("victim"),
                tuple(sorted(kill.get("assistants", []) or [])),
            )
            if key in seen:
                continue
            seen.add(key)
            kills.append(kill)
    return kills


def _player_damage_received(round_obj, puuid):
    total = 0
    for pstat in round_obj.get("playerStats", []) or []:
        if not isinstance(pstat, dict):
            continue
        for damage in pstat.get("damage", []) or []:
            if isinstance(damage, dict) and damage.get("receiver") == puuid:
                total += int(damage.get("damage", 0) or 0)
    return total


def _has_embedded_armor_stats(overview):
    weapon_stats = overview.get("weapon_stats") or {}
    if isinstance(weapon_stats, dict):
        return any(bool(item.get("is_armor")) for item in weapon_stats.values() if isinstance(item, dict))
    if isinstance(weapon_stats, list):
        return any(bool(item.get("is_armor")) for item in weapon_stats if isinstance(item, dict))
    return False


def _accumulate_raw_armor_stats(region_data, match_obj, player):
    puuid = player.get("puuid")
    team_id = player.get("teamId")
    if not puuid:
        return

    for round_obj in match_obj.get("roundResults", []) or []:
        pstats = _player_stats_map(round_obj)
        round_pstat = pstats.get(puuid)
        if not round_pstat:
            continue
        economy = round_pstat.get("economy") or {}
        armor_id = _valid_equipment_id(economy.get("armor"))
        if not armor_id:
            continue

        kills = _collect_unique_round_kills(round_obj)
        died = any(kill.get("victim") == puuid for kill in kills)
        armor_stats = region_data["weapons"][armor_id]
        armor_stats["weapon_name"] = resolve_gear_name(armor_id)
        armor_stats["is_armor"] = True
        armor_stats["totals"]["rounds"] += 1
        armor_stats["totals"]["rounds_purchased"] += 1
        armor_stats["totals"]["wins"] += 1 if round_obj.get("winningTeam") == team_id else 0
        armor_stats["totals"]["deaths"] += 1 if died else 0
        armor_stats["totals"]["survival_rounds"] += 0 if died else 1
        armor_stats["totals"]["damage_received"] += _player_damage_received(round_obj, puuid)
        armor_stats["totals"]["loadout_value_total"] += int(economy.get("loadoutValue", 0) or 0)


def update_regions():
    """Backward-compatible alias. Runs the comprehensive rebuild."""
    rebuild_regions(force=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild regions collection from analytics data")
    parser.add_argument(
        "--mode",
        choices=["rebuild"],
        default="rebuild",
        help="Execution mode (default: rebuild)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Confirma el borrado de la colección regions antes de reconstruir.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    ensure_indexes()

    if args.mode == "rebuild":
        if not args.force:
            parser.error("Debes indicar --force para reconstruir la colección regions")
        rebuild_regions(force=args.force)


if __name__ == "__main__":
    main()
