import os
import sys
import logging
from collections import Counter
from datetime import datetime, UTC

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.db.mongo_client import matches_collection, regions_collection

logger = logging.getLogger(__name__)


def _normalize_region(raw_region):
    if not raw_region:
        return "UNKNOWN"
    return str(raw_region).strip().upper()


def _collect_region_delta(match_obj):
    players = match_obj.get("players", [])

    total_kills = 0
    total_deaths = 0
    agent_usage = Counter()
    weapon_usage = Counter()

    for player in players:
        stats = player.get("stats") or {}
        total_kills += int(stats.get("kills", 0) or 0)
        total_deaths += int(stats.get("deaths", 0) or 0)

        agent_id = str(player.get("characterId") or "UNKNOWN")
        agent_usage[agent_id] += 1

    for round_result in match_obj.get("roundResults", []):
        for p_stat in round_result.get("playerStats", []):
            weapon_id = str(((p_stat.get("economy") or {}).get("weapon")) or "UNKNOWN")
            weapon_usage[weapon_id] += 1

    return {
        "totalMatches": 1,
        "totalKills": total_kills,
        "totalDeaths": total_deaths,
        "agentUsage": dict(agent_usage),
        "weaponUsage": dict(weapon_usage),
    }


def _merge_counter_dict(base_map, delta_map):
    merged = dict(base_map or {})
    for key, value in (delta_map or {}).items():
        merged[key] = merged.get(key, 0) + int(value or 0)
    return merged


def _top_items(counter_map, key_name, top_n=5):
    rows = [{key_name: key, "count": value} for key, value in (counter_map or {}).items()]
    rows.sort(key=lambda row: row["count"], reverse=True)
    return rows[:top_n]


def _most_used_weapon(counter_map):
    if not counter_map:
        return None
    top_weapon = max(counter_map.items(), key=lambda kv: kv[1])
    return {"weaponId": top_weapon[0], "uses": top_weapon[1]}


def _build_region_document(existing_doc, region, delta):
    current_matches = int((existing_doc or {}).get("totalMatches", 0))
    current_kills = int((existing_doc or {}).get("totalKills", 0))
    current_deaths = int((existing_doc or {}).get("totalDeaths", 0))

    total_matches = current_matches + delta.get("totalMatches", 0)
    total_kills = current_kills + delta.get("totalKills", 0)
    total_deaths = current_deaths + delta.get("totalDeaths", 0)

    weapon_usage = _merge_counter_dict((existing_doc or {}).get("weaponUsage", {}), delta.get("weaponUsage", {}))
    agent_usage = _merge_counter_dict((existing_doc or {}).get("agentUsage", {}), delta.get("agentUsage", {}))

    avg_kd = round(total_kills / (total_deaths if total_deaths > 0 else 1), 4)

    return {
        "region": region,
        "totalMatches": total_matches,
        "totalKills": total_kills,
        "totalDeaths": total_deaths,
        "avgKD": avg_kd,
        "weaponUsage": weapon_usage,
        "mostUsedWeapon": _most_used_weapon(weapon_usage),
        "agentUsage": agent_usage,
        "mostPlayedAgents": _top_items(agent_usage, "agentId"),
        "updatedAt": datetime.now(UTC),
    }


def update_region_from_match(match_obj):
    match_info = match_obj.get("matchInfo") or {}
    region = _normalize_region(match_info.get("region"))

    delta = _collect_region_delta(match_obj)
    existing = regions_collection.find_one({"region": region})
    next_doc = _build_region_document(existing, region, delta)

    regions_collection.update_one({"region": region}, {"$set": next_doc}, upsert=True)


def update_regions():
    """Rebuild region stats from all matches in MongoDB."""
    logger.info("Rebuilding regions collection from matches...")
    regions_collection.delete_many({})

    cursor = matches_collection.find({}, {"_id": 0})
    processed = 0

    for match_obj in cursor:
        update_region_from_match(match_obj)
        processed += 1

    logger.info("Regions rebuild complete. Matches processed: %s", processed)
