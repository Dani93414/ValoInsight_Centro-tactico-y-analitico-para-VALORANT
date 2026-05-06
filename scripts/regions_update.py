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
from shared.stat_formulas import finalize_core_stats

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

_WEAPON_FIELDS = ("rounds", "kills", "deaths", "headshots", "bodyshots", "legshots", "damage_dealt")


def _safe_div(num, den):
    return round(num / den, 4) if den else 0.0


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
        "maps": defaultdict(lambda: {
            "map_name": "Unknown", "match_ids": set(),
            "totals": Counter(),
            "sides": {"attack": Counter(), "defense": Counter()},
        }),
        "weapons": defaultdict(lambda: {"weapon_name": "Unknown", "totals": Counter()}),
    })

    # ── 1. Iterate all ranked matches ──
    cursor = matches_collection.find({"matchInfo.isRanked": True})
    doc_count = 0

    for match_obj in cursor:
        match_info = match_obj.get("matchInfo") or {}
        match_id = str(match_info.get("matchId") or "")
        region = _normalize_region(match_info.get("region"))
        map_id = str(match_info.get("mapId") or "UNKNOWN")

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
            mp["match_ids"].add(match_id)
            for field in _SUM_FIELDS:
                mp["totals"][field] += int(overview.get(field, 0) or 0)

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
            for field in _WEAPON_FIELDS:
                weq["totals"][field] += int(ws.get(field, 0) or 0)

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
            mt = dict(mp["totals"])
            mr = mt.get("rounds", 0)
            map_matches = len(mp["match_ids"])
            total_shots_map = mt.get("headshots", 0) + mt.get("bodyshots", 0) + mt.get("legshots", 0)
            map_doc[map_id] = {
                "map_name": mp["map_name"],
                "matches": map_matches,
                "total_rounds": mr,
                "avg_rounds_per_match": _safe_div(mr, map_matches * 10),
                "averages": {
                    "kd_ratio": _safe_div(mt.get("kills", 0), max(mt.get("deaths", 0), 1)),
                    "acs": _safe_div(mt.get("score", 0), mr),
                    "adr": _safe_div(mt.get("damage_dealt", 0), mr),
                    "headshot_pct": _safe_div(mt.get("headshots", 0) * 100.0, total_shots_map),
                },
                "sides": {
                    s: _side_summary(dict(mp["sides"][s]))
                    for s in ("attack", "defense")
                },
            }

        # ── Weapon stats ──
        weapon_doc = {}
        for weapon_id, weq in rd["weapons"].items():
            wt = dict(weq["totals"])
            whs = wt.get("headshots", 0)
            total_shots_w = whs + wt.get("bodyshots", 0) + wt.get("legshots", 0)
            weapon_doc[weapon_id] = {
                "weapon_name": weq["weapon_name"],
                "rounds_equipped": wt.get("rounds", 0),
                "kills": wt.get("kills", 0),
                "deaths": wt.get("deaths", 0),
                "headshots": whs,
                "headshot_pct": _safe_div(whs * 100.0, total_shots_w),
                "damage_dealt": wt.get("damage_dealt", 0),
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
    Lightweight incremental update after a single match insert.
    Only touches basic counters. Run rebuild_regions() for full stats.
    """
    match_info = match_obj.get("matchInfo") or {}
    match_id = str(match_info.get("matchId") or "").strip()
    if not match_id:
        logger.warning("Skipping region update for match without matchInfo.matchId")
        return

    region = _normalize_region(match_info.get("region"))

    players = match_obj.get("players") or []
    total_kills = sum(int((p.get("stats") or {}).get("kills", 0) or 0) for p in players)
    total_deaths = sum(int((p.get("stats") or {}).get("deaths", 0) or 0) for p in players)

    update = {
        "$inc": {
            "totalMatches": 1,
            "totals.kills": total_kills,
            "totals.deaths": total_deaths,
        },
        "$addToSet": {"processedMatchIds": match_id},
        "$set": {"updatedAt": datetime.now(UTC)},
        "$setOnInsert": {"region": region},
    }

    result = regions_collection.update_one(
        {"region": region, "processedMatchIds": {"$ne": match_id}},
        update,
        upsert=False,
    )
    if result.matched_count:
        return

    if regions_collection.find_one({"region": region}, {"_id": 1}):
        return

    regions_collection.update_one(
        {"region": region},
        update,
        upsert=True,
    )


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
