import copy
import logging
from collections import Counter

from backend.db.mongo_client import players_collection, matches_collection
from scripts.regions_update import update_region_from_match, update_regions
from backend.src.api.analytic.service import rebuild_match_player_analytics

logger = logging.getLogger(__name__)


def _normalize_region(raw_region):
    if not raw_region:
        return "UNKNOWN"
    return str(raw_region).strip().upper()


def _safe_match_id(match_obj):
    match_info = match_obj.get("matchInfo") or {}
    return match_info.get("matchId")


def _extract_player_shots(match_obj, puuid):
    hs_count, body_count, leg_count = 0, 0, 0

    for round_result in match_obj.get("roundResults", []) or []:
        for p_stat in round_result.get("playerStats", []) or []:
            if p_stat.get("puuid") != puuid:
                continue
            for dmg in p_stat.get("damage", []) or []:
                hs_count += int(dmg.get("headshots", 0) or 0)
                body_count += int(dmg.get("bodyshots", 0) or 0)
                leg_count += int(dmg.get("legshots", 0) or 0)

    return hs_count, body_count, leg_count


def _extract_player_weapon_stats(match_obj, puuid):
    weapon_uses = Counter()
    weapon_kills = Counter()
    weapon_deaths = Counter()

    for round_result in match_obj.get("roundResults", []) or []:
        for p_stat in round_result.get("playerStats", []) or []:
            if p_stat.get("puuid") == puuid:
                weapon_id = ((p_stat.get("economy") or {}).get("weapon")) or "UNKNOWN"
                weapon_uses[str(weapon_id)] += 1

            for kill_event in p_stat.get("kills", []) or []:
                finishing = kill_event.get("finishingDamage") or {}
                damage_item = str(finishing.get("damageItem") or "UNKNOWN")
                if kill_event.get("killer") == puuid:
                    weapon_kills[damage_item] += 1
                if kill_event.get("victim") == puuid:
                    weapon_deaths[damage_item] += 1

    all_weapons = set(weapon_uses) | set(weapon_kills) | set(weapon_deaths)
    weapon_stats = {}
    for weapon_id in all_weapons:
        weapon_stats[weapon_id] = {
            "uses": weapon_uses.get(weapon_id, 0),
            "kills": weapon_kills.get(weapon_id, 0),
            "deaths": weapon_deaths.get(weapon_id, 0),
        }
    return weapon_stats


def _merge_nested_weapon_stats(existing, incoming):
    merged = copy.deepcopy(existing or {})
    for weapon_id, payload in (incoming or {}).items():
        if weapon_id not in merged:
            merged[weapon_id] = {"uses": 0, "kills": 0, "deaths": 0}
        merged[weapon_id]["uses"] += int(payload.get("uses", 0) or 0)
        merged[weapon_id]["kills"] += int(payload.get("kills", 0) or 0)
        merged[weapon_id]["deaths"] += int(payload.get("deaths", 0) or 0)
    return merged


def _compute_best_weapon_by_kd(weapon_stats, min_uses=10):
    best = None

    for weapon_id, payload in (weapon_stats or {}).items():
        uses = int(payload.get("uses", 0) or 0)
        kills = int(payload.get("kills", 0) or 0)
        deaths = int(payload.get("deaths", 0) or 0)

        if uses < min_uses:
            continue

        kd = round(kills / (deaths if deaths > 0 else 1), 3)
        candidate = {
            "weaponId": weapon_id,
            "kd": kd,
            "uses": uses,
            "kills": kills,
            "deaths": deaths,
        }

        if not best or candidate["kd"] > best["kd"]:
            best = candidate
        elif best and candidate["kd"] == best["kd"] and candidate["kills"] > best["kills"]:
            best = candidate

    return best


def _top_agent_list(agent_stats, top_n=5):
    rows = []
    for agent_id, count in (agent_stats or {}).items():
        rows.append({"agentId": agent_id, "matches": int(count or 0)})
    rows.sort(key=lambda row: row["matches"], reverse=True)
    return rows[:top_n]


def process_single_match_with_status(match_obj):
    """
    Ingest a single match object and return one of:
    - inserted
    - already_exists
    - failed
    """
    if not match_obj or "matchInfo" not in match_obj:
        logger.error("Invalid match payload: missing matchInfo")
        return "failed"

    match_id = _safe_match_id(match_obj)
    if not match_id:
        logger.error("Invalid match payload: missing matchInfo.matchId")
        return "failed"

    try:
        existing_match = matches_collection.find_one({"matchInfo.matchId": match_id})

        if existing_match:
            logger.info("Match %s already present. Skip insert.", match_id)

            # Intentamos regenerar analytics por si todavía no existían
            # o si se quiere mantener consistencia.
            try:
                rebuild_match_player_analytics(existing_match)
            except Exception as analytics_exc:
                logger.warning(
                    "Analytics rebuild skipped/failed for existing match %s: %s",
                    match_id,
                    analytics_exc,
                )

            return "already_exists"

        matches_collection.insert_one(copy.deepcopy(match_obj))
        logger.info("Match %s stored in MongoDB.", match_id)

    except Exception as exc:
        logger.error("Error storing match %s: %s", match_id, exc)
        return "failed"

    try:
        _update_players_from_match(match_obj)

        try:
            rebuild_match_player_analytics(match_obj)
        except Exception as analytics_exc:
            logger.error("Analytics rebuild failed for match %s: %s", match_id, analytics_exc)

        update_region_from_match(match_obj)
        return "inserted"

    except Exception as exc:
        logger.error("Error updating derived stats for %s: %s", match_id, exc)
        return "failed"


def process_single_match(match_obj):
    """
    Backward-compatible wrapper kept for existing callers.
    """
    status = process_single_match_with_status(match_obj)
    return status in {"inserted", "already_exists"}


def _update_players_from_match(match_obj):
    """
    Lógica interna (Privada) para extraer estadísticas y actualizar los perfiles
    vitalicios de los jugadores en la base de datos.
    """
    match_info = match_obj.get("matchInfo") or {}
    match_region = _normalize_region(match_info.get("region"))
    match_id = match_info.get("matchId")
    if not match_id:
        return

    winning_team = next(
        (t.get("teamId") for t in (match_obj.get("teams", []) or []) if t.get("won")),
        None,
    )
    match_players = match_obj.get("players", []) or []

    for p in match_players:
        puuid = p.get("puuid")
        if not puuid:
            continue

        party_id = p.get("partyId", puuid)
        team_id = p.get("teamId")
        character_id = str(p.get("characterId") or "UNKNOWN")
        s = p.get("stats", {}) or {}

        kills = int(s.get("kills", 0) or 0)
        deaths = int(s.get("deaths", 0) or 0)
        assists = int(s.get("assists", 0) or 0)
        score = int(s.get("score", 0) or 0)
        playtime = int(s.get("playtimeMillis", 0) or 0)
        rounds_played = int(s.get("roundsPlayed", 0) or 0)
        account_level = int(p.get("accountLevel", 20) or 20)
        is_win = 1 if team_id == winning_team else 0

        hs_count, body_count, leg_count = _extract_player_shots(match_obj, puuid)
        total_shots = hs_count + body_count + leg_count
        weapon_stats_delta = _extract_player_weapon_stats(match_obj, puuid)

        teammates_delta = {}
        opponents_delta = {}

        for other in match_players:
            other_puuid = other.get("puuid")
            if not other_puuid or other_puuid == puuid:
                continue

            if other.get("teamId") == team_id:
                teammates_delta[other_puuid] = teammates_delta.get(other_puuid, 0) + 1
            else:
                opponents_delta[other_puuid] = opponents_delta.get(other_puuid, 0) + 1

        agent_stats_delta = {character_id: 1}

        player = players_collection.find_one({"puuid": puuid})

        if not player:
            merged_weapon_stats = _merge_nested_weapon_stats({}, weapon_stats_delta)
            best_weapon = _compute_best_weapon_by_kd(merged_weapon_stats)

            players_collection.insert_one({
                "puuid": puuid,
                "gameName": p.get("gameName"),
                "tagLine": p.get("tagLine"),
                "region": match_region,
                "accountLevel": account_level,
                "totalMatches": 1,
                "totalWins": is_win,
                "totalKills": kills,
                "totalDeaths": deaths,
                "totalAssists": assists,
                "totalScore": score,
                "totalPlaytimeMillis": playtime,
                "totalRoundsPlayed": rounds_played,
                "totalHeadshots": hs_count,
                "totalBodyshots": body_count,
                "totalLegshots": leg_count,
                "kdRatio": round(kills / (deaths if deaths > 0 else 1), 2),
                "winRatePercentage": round((is_win / 1) * 100, 1),
                "averageCombatScore": round(score / rounds_played, 1) if rounds_played > 0 else 0,
                "headshotPercentage": round((hs_count / total_shots) * 100, 1) if total_shots > 0 else 0,
                "matches": [match_id],
                "partyStats": {
                    party_id: {
                        "matchesTogether": 1,
                        "winsTogether": is_win,
                    }
                },
                "teammates": teammates_delta,
                "opponents": opponents_delta,
                "agentStats": agent_stats_delta,
                "mostPlayedAgents": _top_agent_list(agent_stats_delta),
                "weaponStats": merged_weapon_stats,
                "bestWeaponByKD": best_weapon,
            })
            continue

        if match_id in (player.get("matches", []) or []):
            continue

        new_matches = int(player.get("totalMatches", 0) or 0) + 1
        new_wins = int(player.get("totalWins", 0) or 0) + is_win
        new_kills = int(player.get("totalKills", 0) or 0) + kills
        new_deaths = int(player.get("totalDeaths", 0) or 0) + deaths
        new_assists = int(player.get("totalAssists", 0) or 0) + assists
        new_score = int(player.get("totalScore", 0) or 0) + score
        new_playtime = int(player.get("totalPlaytimeMillis", 0) or 0) + playtime
        new_rounds = int(player.get("totalRoundsPlayed", 0) or 0) + rounds_played

        new_hs = int(player.get("totalHeadshots", 0) or 0) + hs_count
        new_body = int(player.get("totalBodyshots", 0) or 0) + body_count
        new_leg = int(player.get("totalLegshots", 0) or 0) + leg_count
        new_total_shots = new_hs + new_body + new_leg

        party_stats = copy.deepcopy(player.get("partyStats", {}) or {})
        if party_id not in party_stats:
            party_stats[party_id] = {"matchesTogether": 0, "winsTogether": 0}
        party_stats[party_id]["matchesTogether"] += 1
        party_stats[party_id]["winsTogether"] += is_win

        teammates = copy.deepcopy(player.get("teammates", {}) or {})
        for other_puuid, count in teammates_delta.items():
            teammates[other_puuid] = teammates.get(other_puuid, 0) + count

        opponents = copy.deepcopy(player.get("opponents", {}) or {})
        for other_puuid, count in opponents_delta.items():
            opponents[other_puuid] = opponents.get(other_puuid, 0) + count

        agent_stats = copy.deepcopy(player.get("agentStats", {}) or {})
        for agent_id, count in agent_stats_delta.items():
            agent_stats[agent_id] = agent_stats.get(agent_id, 0) + count

        merged_weapon_stats = _merge_nested_weapon_stats(
            player.get("weaponStats", {}),
            weapon_stats_delta,
        )
        best_weapon = _compute_best_weapon_by_kd(merged_weapon_stats)

        matches = list(player.get("matches", []) or [])
        matches.append(match_id)

        update = {
            "accountLevel": account_level,
            "region": match_region,
            "totalMatches": new_matches,
            "totalWins": new_wins,
            "totalKills": new_kills,
            "totalDeaths": new_deaths,
            "totalAssists": new_assists,
            "totalScore": new_score,
            "totalPlaytimeMillis": new_playtime,
            "totalRoundsPlayed": new_rounds,
            "totalHeadshots": new_hs,
            "totalBodyshots": new_body,
            "totalLegshots": new_leg,
            "kdRatio": round(new_kills / (new_deaths if new_deaths > 0 else 1), 2),
            "winRatePercentage": round((new_wins / new_matches) * 100, 1),
            "averageCombatScore": round(new_score / new_rounds, 1) if new_rounds > 0 else 0,
            "headshotPercentage": round((new_hs / new_total_shots) * 100, 1) if new_total_shots > 0 else 0,
            "matches": matches,
            "partyStats": party_stats,
            "teammates": teammates,
            "opponents": opponents,
            "agentStats": agent_stats,
            "mostPlayedAgents": _top_agent_list(agent_stats),
            "weaponStats": merged_weapon_stats,
            "bestWeaponByKD": best_weapon,
        }

        players_collection.update_one({"puuid": puuid}, {"$set": update})


def recalculate_global_stats():
    """Rebuild region aggregates from all matches."""
    logger.info("Requesting global regions recalculation.")
    update_regions()