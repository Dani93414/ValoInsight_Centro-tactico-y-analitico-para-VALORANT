from __future__ import annotations

import threading
import time
import unicodedata
import re
from datetime import datetime, timezone
from typing import Any

from modules.players.infrastructure import dashboard_queries


_DASHBOARD_CONTENT_CACHE: dict[str, Any] | None = None
_DASHBOARD_RESPONSE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_DASHBOARD_RESPONSE_CACHE_TTL_SECONDS = 120.0
_CACHE_LOCK = threading.Lock()


def _get_dashboard_content() -> dict[str, Any]:
    global _DASHBOARD_CONTENT_CACHE
    with _CACHE_LOCK:
        if _DASHBOARD_CONTENT_CACHE is None:
            _DASHBOARD_CONTENT_CACHE = dashboard_queries.get_dashboard_content()
        return _DASHBOARD_CONTENT_CACHE


from shared.math_utils import safe_div as _safe_div


def _coerce_positive_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, float):
        ivalue = int(value)
        return ivalue if ivalue > 0 else None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            ivalue = int(float(value))
            return ivalue if ivalue > 0 else None
        except (TypeError, ValueError):
            return None
    return None


def _format_tier_name(tier: int | None) -> str:
    if tier is None or tier < 3:
        return "Sin rango"

    names = {
        3: "Iron 1",
        4: "Iron 2",
        5: "Iron 3",
        6: "Bronze 1",
        7: "Bronze 2",
        8: "Bronze 3",
        9: "Silver 1",
        10: "Silver 2",
        11: "Silver 3",
        12: "Gold 1",
        13: "Gold 2",
        14: "Gold 3",
        15: "Platinum 1",
        16: "Platinum 2",
        17: "Platinum 3",
        18: "Diamond 1",
        19: "Diamond 2",
        20: "Diamond 3",
        21: "Ascendant 1",
        22: "Ascendant 2",
        23: "Ascendant 3",
        24: "Immortal 1",
        25: "Immortal 2",
        26: "Immortal 3",
        27: "Radiant",
    }
    return names.get(tier, f"Tier {tier}")


def _normalize_rank_label(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return " ".join(normalized.split())


def _sanitize_segment(value: Any) -> str:
    text = str(value if value is not None else "item").strip()
    text = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", text)
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"_+", "_", text)
    text = text.strip("._")
    return text[:120] if text else "item"


def _normalize_weapon_stats(
    weapon_stats: dict[str, dict[str, Any]] | list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if not weapon_stats:
        return []

    if isinstance(weapon_stats, list):
        normalized: list[dict[str, Any]] = []
        for idx, entry in enumerate(weapon_stats):
            if not isinstance(entry, dict):
                continue
            key = entry.get("weapon_id") or f"weapon-{idx}"
            normalized.append({**entry, "key": key})
        return normalized

    if not isinstance(weapon_stats, dict):
        return []

    normalized: list[dict[str, Any]] = []
    for key, entry in weapon_stats.items():
        if not isinstance(entry, dict):
            continue
        normalized.append({**entry, "key": key})
    return normalized


def _build_competitive_tier_maps(
    content_doc: dict[str, Any],
) -> tuple[dict[int, str], dict[str, str]]:
    tier_by_number: dict[int, str] = {}
    tier_by_name: dict[str, str] = {}

    tier_docs = (
        content_doc.get("competitiveTiers")
        or content_doc.get("competitive_tiers")
        or []
    )

    docs_to_process: list[dict[str, Any]] = []
    if isinstance(tier_docs, list) and tier_docs:
        docs_to_process = [tier_docs[-1]]
    elif isinstance(tier_docs, dict):
        docs_to_process = [tier_docs]

    for doc in docs_to_process:
        tiers = doc.get("tiers") or {}
        entries: list[dict[str, Any]]
        if isinstance(tiers, list):
            entries = [entry for entry in tiers if isinstance(entry, dict)]
        elif isinstance(tiers, dict):
            entries = [x for x in tiers.values() if isinstance(x, dict)]
        else:
            entries = []

        for entry in entries:
            tier_raw = entry.get("tier")
            tier = None
            if isinstance(tier_raw, bool):
                tier = None
            elif isinstance(tier_raw, int):
                tier = tier_raw if tier_raw >= 0 else None
            elif isinstance(tier_raw, float):
                tier_value = int(tier_raw)
                tier = tier_value if tier_value >= 0 else None
            elif isinstance(tier_raw, str):
                try:
                    tier_value = int(float(tier_raw.strip()))
                    tier = tier_value if tier_value >= 0 else None
                except (TypeError, ValueError):
                    tier = None

            tier_set_uuid = doc.get("uuid") or doc.get("id")
            tier_name_sanitized = _sanitize_segment(entry.get("tierName"))
            icon = None
            if tier_set_uuid and tier_name_sanitized:
                icon = (
                    f"/content/competitive_tiers/{tier_set_uuid}/tiers/"
                    f"{tier_name_sanitized}/smallIcon.png"
                )
            tier_name = _normalize_rank_label(entry.get("tierName"))
            division_name = _normalize_rank_label(entry.get("divisionName"))
            if tier_name and icon and tier_name not in tier_by_name:
                tier_by_name[tier_name] = icon

            if tier is not None and icon and tier not in tier_by_number:
                tier_by_number[tier] = icon

            if tier is not None and division_name and icon and tier >= 3:
                division_level = ((tier - 3) % 3) + 1
                division_key = f"{division_name} {division_level}"
                if division_key not in tier_by_name:
                    tier_by_name[division_key] = icon

                english_key = _normalize_rank_label(_format_tier_name(tier))
                if english_key and english_key not in tier_by_name:
                    tier_by_name[english_key] = icon

    return tier_by_number, tier_by_name


def _build_act_label_map(content_doc: dict[str, Any]) -> dict[str, str]:
    acts = content_doc.get("acts", []) or []
    name_by_id: dict[str, str] = {}

    for act in acts:
        act_id = act.get("id")
        act_name = act.get("name")
        if act_id and act_name:
            name_by_id[act_id] = act_name

    label_map: dict[str, str] = {}
    for act in acts:
        act_id = act.get("id")
        if not act_id:
            continue

        own_name = act.get("name") or act_id
        parent_id = act.get("parentId") or act.get("parent_id")
        parent = act.get("parent") or {}
        parent_name = (
            act.get("parentName") or parent.get("name") or name_by_id.get(parent_id)
        )

        is_root = True
        if parent_id:
            parent_norm = str(parent_id).strip().lower()
            is_root = parent_norm in {
                "00000000-0000-0000-0000-000000000000",
                "00000000-0000-0000-0000-00000000000",
            }

        if (not is_root) and parent_name:
            label_map[act_id] = f"{own_name} - {parent_name}"
        else:
            label_map[act_id] = own_name

    return label_map


def _resolve_current_act_id(content_doc: dict[str, Any]) -> str | None:
    acts = content_doc.get("acts", []) or []
    if not acts:
        return None

    active_act = next(
        (
            act
            for act in acts
            if str(act.get("type") or "").strip().lower() == "act"
            and bool(act.get("isActive"))
        ),
        None,
    )
    if active_act and active_act.get("id"):
        return str(active_act["id"])

    active_episode = next(
        (
            act
            for act in acts
            if str(act.get("type") or "").strip().lower() == "episode"
            and bool(act.get("isActive"))
        ),
        None,
    )
    if not active_episode:
        return None

    parent_id = active_episode.get("id")
    if not parent_id:
        return None

    episode_acts = [
        act
        for act in acts
        if str(act.get("type") or "").strip().lower() == "act"
        and (act.get("parentId") or act.get("parent_id")) == parent_id
    ]

    if not episode_acts:
        return None

    # Se asume que el contenido viene ordenado del acto más reciente al más antiguo
    first_act = episode_acts[0]
    return str(first_act.get("id")) if first_act.get("id") else None


def _build_agent_maps(
    content_doc: dict[str, Any],
) -> tuple[dict[str, str], dict[str, dict[str, str | None]]]:
    name_map: dict[str, str] = {}
    media_map: dict[str, dict[str, str | None]] = {}

    for agent in content_doc.get("agents", []) or []:
        agent_id = agent.get("uuid") or agent.get("id")
        agent_name = agent.get("displayName") or agent.get("name")
        if not agent_id:
            continue

        if agent_name:
            name_map[agent_id] = agent_name

        media_map[agent_id] = {
            "name": agent_name or "Agente desconocido",
            "image": f"/content/agents/{agent_id}/fullPortrait.png",
            "displayIcon": f"/content/agents/{agent_id}/displayIcon.png",
        }

    return name_map, media_map


def _build_map_icon_map(content_doc: dict[str, Any]) -> dict[str, str]:
    map_icon_by_name: dict[str, str] = {}
    for map_entry in content_doc.get("maps", []) or []:
        map_name = _normalize_rank_label(
            map_entry.get("displayName") or map_entry.get("name")
        )
        map_uuid = map_entry.get("uuid") or map_entry.get("id")
        icon = f"/content/maps/{map_uuid}/splash.png" if map_uuid else None
        if map_name and icon and map_name not in map_icon_by_name:
            map_icon_by_name[map_name] = icon
    return map_icon_by_name


def _build_weapon_icon_map(content_doc: dict[str, Any]) -> dict[str, str]:
    weapon_icon_by_name: dict[str, str] = {}
    for weapon_entry in content_doc.get("weapons", []) or []:
        weapon_name = _normalize_rank_label(weapon_entry.get("displayName"))
        weapon_uuid = weapon_entry.get("uuid") or weapon_entry.get("id")
        icon = f"/content/weapons/{weapon_uuid}/displayIcon.png" if weapon_uuid else None
        if weapon_name and icon and weapon_name not in weapon_icon_by_name:
            weapon_icon_by_name[weapon_name] = icon
    return weapon_icon_by_name


def _latest_rank_from_matches(puuid: str) -> dict[str, Any]:
    if not puuid:
        return {}

    cursor = dashboard_queries.find_recent_matches_with_rank(puuid, limit=50)

    for match in cursor:
        for player in match.get("players") or []:
            if player.get("puuid") != puuid:
                continue

            tier = _coerce_positive_int(
                player.get("competitiveTier", player.get("competitive_tier"))
            )
            if tier is not None:
                return {"tier": tier}

    return {}


def _load_match_duration_map(match_ids: list[str]) -> dict[str, int]:
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids:
        return {}

    duration_map: dict[str, int] = {}
    cursor = dashboard_queries.find_match_durations(clean_ids)

    for doc in cursor:
        match_info = doc.get("matchInfo") or {}
        raw_duration = match_info.get("gameLengthMillis")
        try:
            duration = int(raw_duration or 0)
        except (TypeError, ValueError):
            duration = 0
        if duration <= 0:
            continue

        match_id_candidates = [
            str((doc.get("metadata") or {}).get("match_id") or "").strip(),
            str(match_info.get("matchId") or "").strip(),
        ]
        for match_id in match_id_candidates:
            if match_id and match_id not in duration_map:
                duration_map[match_id] = duration

    return duration_map


def _extract_side_stats(side_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "rounds": int(side_data.get("rounds") or 0),
        "wins": int(side_data.get("wins") or 0),
        "kills": int(side_data.get("kills") or 0),
        "deaths": int(side_data.get("deaths") or 0),
        "assists": int(side_data.get("assists") or 0),
        "score": int(side_data.get("score") or 0),
        "damage_dealt": int(side_data.get("damage_dealt") or 0),
        "damage_received": int(side_data.get("damage_received") or 0),
        "headshots": int(side_data.get("headshots") or 0),
        "bodyshots": int(side_data.get("bodyshots") or 0),
        "legshots": int(side_data.get("legshots") or 0),
    }


def _extract_sides_summary(doc: dict[str, Any]) -> dict[str, Any] | None:
    sides = doc.get("sides")
    if not sides or not isinstance(sides, dict):
        return None
    result: dict[str, Any] = {}
    if "attack" in sides and isinstance(sides["attack"], dict):
        result["attack"] = _extract_side_stats(sides["attack"])
    if "defense" in sides and isinstance(sides["defense"], dict):
        result["defense"] = _extract_side_stats(sides["defense"])
    return result if result else None


def _load_party_size_map(match_ids: list[str], puuid: str) -> dict[str, int]:
    """Batch-query matches to compute party size for the given player."""
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids or not puuid:
        return {}

    party_map: dict[str, int] = {}
    cursor = dashboard_queries.find_match_parties(clean_ids)

    for doc in cursor:
        match_info = doc.get("matchInfo") or {}
        mid = (
            str(match_info.get("matchId") or "").strip()
            or str((doc.get("metadata") or {}).get("match_id") or "").strip()
        )
        if not mid:
            continue

        players = doc.get("players") or []
        target_party_id = None
        for p in players:
            if p.get("puuid") == puuid:
                target_party_id = p.get("partyId")
                break

        if not target_party_id:
            party_map[mid] = 1
            continue

        count = sum(1 for p in players if p.get("partyId") == target_party_id)
        party_map[mid] = max(count, 1)

    return party_map


def _load_weapon_usage_summary(
    puuid: str,
    season_id: str | None = None,
) -> list[dict[str, Any]]:
    """Compute top weapon usage server-side from embedded analytics in matches."""
    if not puuid:
        return []

    match_stage: dict[str, Any] = {
        "players.puuid": puuid,
        "matchInfo.isRanked": True,
    }
    if season_id:
        match_stage["matchInfo.seasonId"] = season_id

    pipeline: list[dict[str, Any]] = [
        {"$match": match_stage},
        {"$unwind": "$players"},
        {"$match": {"players.puuid": puuid, "players.analytics": {"$exists": True}}},
        {
            "$project": {
                "_id": 0,
                "won_match": "$players.analytics.won_match",
                "ws": {"$objectToArray": {"$ifNull": ["$players.analytics.overview.weapon_stats", {}]}},
            }
        },
        {"$unwind": "$ws"},
        {
            "$project": {
                "weapon_id": "$ws.k",
                "weapon_name": {"$ifNull": ["$ws.v.weapon_name", "Arma desconocida"]},
                "kills": {
                    "$convert": {
                        "input": "$ws.v.kills",
                        "to": "int",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "deaths": {
                    "$convert": {
                        "input": "$ws.v.deaths",
                        "to": "int",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "won_match": 1,
            }
        },
        {
            "$group": {
                "_id": "$weapon_id",
                "name": {"$first": "$weapon_name"},
                "kills": {"$sum": "$kills"},
                "matches": {
                    "$sum": {
                        "$cond": [
                            {"$gt": [{"$add": ["$kills", "$deaths"]}, 0]},
                            1,
                            0,
                        ]
                    }
                },
                "wins": {
                    "$sum": {
                        "$cond": [
                            {
                                "$and": [
                                    {"$gt": [{"$add": ["$kills", "$deaths"]}, 0]},
                                    {"$eq": ["$won_match", True]},
                                ]
                            },
                            1,
                            0,
                        ]
                    }
                },
            }
        },
        {"$sort": {"kills": -1, "matches": -1}},
        {"$limit": 20},
    ]

    return dashboard_queries.aggregate_weapon_usage(pipeline)


def _build_match_card_id(doc: dict[str, Any]) -> str:
    raw_match_id = doc.get("match_id")
    if raw_match_id:
        return str(raw_match_id)

    timestamp = int(doc.get("game_start_millis") or 0)
    map_name = str(doc.get("map_name") or "match").strip() or "match"
    agent_id = str(doc.get("agent_id") or "agent").strip() or "agent"
    season_id = str(doc.get("season_id") or "season").strip() or "season"
    return f"{timestamp}-{season_id}-{map_name}-{agent_id}"


def _build_light_analytics_list(
    analytics_docs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    light_docs: list[dict[str, Any]] = []

    for doc in analytics_docs:
        overview = doc.get("overview") or {}
        player_totals = doc.get("player_totals_from_match") or {}

        light_docs.append(
            {
                "id": _build_match_card_id(doc),
                "match_id": doc.get("match_id"),
                "won_match": doc.get("won_match"),
                "map_name": doc.get("map_name"),
                "game_start_millis": doc.get("game_start_millis"),
                "agent_id": doc.get("agent_id"),
                "agent_name": doc.get("agent_name"),
                "role": doc.get("role"),
                "overview": {
                    "kills": overview.get("kills"),
                    "deaths": overview.get("deaths"),
                    "assists": overview.get("assists"),
                    "acs": overview.get("acs"),
                    "adr": overview.get("adr"),
                    "headshot_pct": overview.get("headshot_pct"),
                    "rounds": overview.get("rounds"),
                    "wins": overview.get("wins"),
                    "headshots": overview.get("headshots"),
                    "bodyshots": overview.get("bodyshots"),
                    "legshots": overview.get("legshots"),
                    "weapon_stats": _normalize_weapon_stats(overview.get("weapon_stats")),
                    # Tactical / advanced fields
                    "first_kills": overview.get("first_kills"),
                    "first_deaths": overview.get("first_deaths"),
                    "opening_duel_win_pct": overview.get("opening_duel_win_pct"),
                    "trade_kills": overview.get("trade_kills"),
                    "traded_deaths": overview.get("traded_deaths"),
                    "clutch_opportunities": overview.get("clutch_opportunities"),
                    "clutches_won": overview.get("clutches_won"),
                    "clutch_win_rate": overview.get("clutch_win_rate"),
                    "survival_rate": overview.get("survival_rate"),
                    "multikill_rate": overview.get("multikill_rate"),
                    "multi_2k": overview.get("multi_2k"),
                    "multi_3k": overview.get("multi_3k"),
                    "multi_4k": overview.get("multi_4k"),
                    "multi_5k": overview.get("multi_5k"),
                    "damage_delta": overview.get("damage_delta"),
                    "damage_delta_per_round": overview.get("damage_delta_per_round"),
                    "kd_ratio": overview.get("kd_ratio"),
                },
                "sides": doc.get("sides"),
                "player_totals_from_match": {
                    "kills": player_totals.get("kills"),
                    "deaths": player_totals.get("deaths"),
                    "assists": player_totals.get("assists"),
                    "score": player_totals.get("score"),
                    "rounds_played": player_totals.get("rounds_played"),
                },
            }
        )

    return light_docs


def _map_analytics_to_match_card(
    doc: dict[str, Any],
    agent_name_map: dict[str, str],
    duration_by_match_id: dict[str, int] | None = None,
    party_size_map: dict[str, int] | None = None,
) -> dict[str, Any]:
    totals = doc.get("player_totals_from_match") or {}
    overview = doc.get("overview") or {}

    kills = int(totals.get("kills") or overview.get("kills") or 0)
    deaths = int(totals.get("deaths") or overview.get("deaths") or 0)
    assists = int(totals.get("assists") or overview.get("assists") or 0)
    rounds = int(totals.get("rounds_played") or overview.get("rounds") or 0)
    match_id = str(doc.get("match_id") or "").strip()

    stored_duration_millis = int(totals.get("match_duration_millis") or 0)
    fallback_duration_millis = 0
    if duration_by_match_id and match_id:
        fallback_duration_millis = int(duration_by_match_id.get(match_id) or 0)

    # Prefer total match duration; keep legacy playtime as last fallback.
    playtime_millis = (
        stored_duration_millis
        or fallback_duration_millis
        or int(totals.get("playtime_millis") or 0)
    )
    score = int(totals.get("score") or overview.get("score") or 0)
    acs = float(overview.get("acs") or _safe_div(score, max(rounds, 1)))
    adr = float(overview.get("adr") or 0)

    rounds_won = int(overview.get("wins") or 0)
    rounds_lost = rounds - rounds_won
    round_score = f"{rounds_won}-{rounds_lost}" if rounds > 0 else "-"

    headshots = int(overview.get("headshots") or 0)
    bodyshots = int(overview.get("bodyshots") or 0)
    legshots = int(overview.get("legshots") or 0)

    hs = overview.get("headshot_pct")
    if hs is None:
        hs = _safe_div(
            headshots * 100.0,
            headshots + bodyshots + legshots,
        )

    timestamp = int(doc.get("game_start_millis") or 0)
    date_label = "Fecha desconocida"
    if timestamp > 0:
        date_label = datetime.fromtimestamp(
            timestamp / 1000, tz=timezone.utc
        ).strftime("%d/%m/%Y %H:%M UTC")

    agent_id = doc.get("agent_id")
    weapon_stats = _normalize_weapon_stats(overview.get("weapon_stats"))

    return {
        "id": _build_match_card_id(doc),
        "seasonId": doc.get("season_id") or "unknown",
        "dateLabel": date_label,
        "timestamp": timestamp,
        "map": doc.get("map_name") or "-",
        "agent": doc.get("agent_name")
        or agent_name_map.get(agent_id or "", "Agente desconocido"),
        "agentId": agent_id,
        "role": doc.get("role") or "-",
        "queue": doc.get("queue_id") or "-",
        "mode": doc.get("game_mode") or "-",
        "result": (
            "Victoria" if doc.get("won_match")
            else "Empate" if doc.get("is_draw")
            or (
                not doc.get("won_match")
                and overview.get("wins") is not None
                and overview.get("rounds") is not None
                and int(overview.get("wins") or 0) > 0
                and int(overview.get("wins") or 0) * 2 == int(overview.get("rounds") or 0)
            )
            else "Derrota"
        ),
        "ranked": bool(doc.get("is_ranked")),
        "roundScore": round_score,
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "rounds": rounds,
        "playtimeMillis": playtime_millis,
        "score": score,
        "acs": round(acs, 2),
        "adr": round(adr, 2),
        "hs": round(float(hs or 0), 2),
        "kd": round(_safe_div(kills, max(deaths, 1)), 3),
        "headshots": headshots,
        "bodyshots": bodyshots,
        "legshots": legshots,
        "weaponStats": [
            {
                "weaponId": item.get("weapon_id") or item.get("key") or "unknown",
                "weaponName": item.get("weapon_name") or "Arma desconocida",
                "kills": int(float(item.get("kills") or 0)),
                "deaths": int(float(item.get("deaths") or 0)),
                "kdRatio": float(item.get("kd_ratio") or 0),
            }
            for item in weapon_stats
        ],
        "competitiveTier": _coerce_positive_int(doc.get("competitive_tier") or doc.get("competitiveTier")),
        "competitiveTierImage": None,
        "accountLevel": _coerce_positive_int(doc.get("account_level")) or 0,
        "sides": _extract_sides_summary(doc),
        "partySize": (party_size_map or {}).get(match_id, 0),
    }


def _build_act_summary(matches: list[dict[str, Any]]) -> dict[str, float | int]:
    total_matches = len(matches)
    total_wins = sum(1 for m in matches if m.get("result") == "Victoria")
    total_kills = sum(int(m.get("kills") or 0) for m in matches)
    total_deaths = sum(int(m.get("deaths") or 0) for m in matches)
    total_assists = sum(int(m.get("assists") or 0) for m in matches)
    total_rounds = sum(int(m.get("rounds") or 0) for m in matches)
    total_score = sum(int(m.get("score") or 0) for m in matches)
    total_hs = sum(float(m.get("hs") or 0) for m in matches)

    return {
        "matches": total_matches,
        "wins": total_wins,
        "winRate": round(_safe_div(total_wins * 100.0, total_matches), 2),
        "kd": round(_safe_div(total_kills, max(total_deaths, 1)), 3),
        "kda": round(_safe_div(total_kills + total_assists, max(total_deaths, 1)), 3),
        "acs": round(_safe_div(total_score, max(total_rounds, 1)), 2),
        "killsPerMatch": round(_safe_div(total_kills, max(total_matches, 1)), 3),
        "hsAvg": round(_safe_div(total_hs, max(total_matches, 1)), 2),
    }


def build_player_dashboard(
    player: dict[str, Any],
    player_docs: list[dict[str, Any]],
    total_matches_in_db: int = 0,
) -> dict[str, Any]:
    content_doc = _get_dashboard_content()

    agent_name_map, agent_media_map = _build_agent_maps(content_doc)
    map_icon_by_name = _build_map_icon_map(content_doc)
    weapon_icon_by_name = _build_weapon_icon_map(content_doc)
    act_label_map = _build_act_label_map(content_doc)
    current_act_id_from_content = _resolve_current_act_id(content_doc)
    rank_icon_map, rank_icon_by_name_map = _build_competitive_tier_maps(content_doc)

    analytics_sorted = sorted(
        player_docs,
        key=lambda item: int(item.get("game_start_millis") or 0),
        reverse=True,
    )

    match_ids = [str(doc.get("match_id") or "").strip() for doc in analytics_sorted]
    duration_by_match_id = _load_match_duration_map(match_ids)
    party_size_map = _load_party_size_map(match_ids, str(player.get("puuid") or ""))

    mapped_matches = [
        _map_analytics_to_match_card(doc, agent_name_map, duration_by_match_id, party_size_map)
        for doc in analytics_sorted
    ]

    matches_by_act: dict[str, list[dict[str, Any]]] = {}
    latest_timestamp_by_act: dict[str, int] = {}
    for match in mapped_matches:
        act_id = match.get("seasonId") or "unknown"
        matches_by_act.setdefault(act_id, []).append(match)
        latest_timestamp_by_act[act_id] = max(
            latest_timestamp_by_act.get(act_id, 0),
            int(match.get("timestamp") or 0),
        )

    act_sections: dict[str, dict[str, Any]] = {}
    for act_id, section_matches in matches_by_act.items():
        sorted_section = sorted(
            section_matches,
            key=lambda m: int(m.get("timestamp") or 0),
            reverse=True,
        )
        act_sections[act_id] = {
            "summary": _build_act_summary(sorted_section),
            "matches": sorted_section,
        }

    act_options = [
        {
            "id": act_id,
            "label": act_label_map.get(act_id, act_id),
            "latestTimestamp": latest_timestamp_by_act.get(act_id, 0),
        }
        for act_id in matches_by_act.keys()
    ]
    act_options.sort(
        key=lambda option: (
            -int(option.get("latestTimestamp") or 0),
            str(option["label"]).lower(),
        )
    )

    act_options_public = [
        {"id": option["id"], "label": option["label"]} for option in act_options
    ]

    current_act_id = current_act_id_from_content or (
        act_options_public[0]["id"] if act_options_public else None
    )

    current_act_matches = (
        act_sections.get(current_act_id, {}).get("matches", []) if current_act_id else []
    )

    current_act_docs = (
        [
            doc
            for doc in analytics_sorted
            if (doc.get("season_id") or "unknown") == current_act_id
        ]
        if current_act_id
        else []
    )

    # Use all matches as fallback only for global overview computations
    overview_matches = current_act_matches if current_act_matches else mapped_matches
    overview_docs = current_act_docs if current_act_docs else analytics_sorted

    total_matches = len(overview_matches)
    total_wins = sum(1 for match in overview_matches if match.get("result") == "Victoria")
    total_kills = sum(int(match.get("kills") or 0) for match in overview_matches)
    total_deaths = sum(int(match.get("deaths") or 0) for match in overview_matches)
    total_assists = sum(int(match.get("assists") or 0) for match in overview_matches)
    total_score = sum(int(match.get("score") or 0) for match in overview_matches)
    total_rounds = sum(int(match.get("rounds") or 0) for match in overview_matches)
    total_headshots = sum(int(match.get("headshots") or 0) for match in overview_matches)
    total_bodyshots = sum(int(match.get("bodyshots") or 0) for match in overview_matches)
    total_legshots = sum(int(match.get("legshots") or 0) for match in overview_matches)

    global_win_rate = _safe_div(total_wins * 100.0, max(total_matches, 1))
    global_kd = _safe_div(total_kills, max(total_deaths, 1))
    global_acs = _safe_div(total_score, max(total_rounds, 1))
    global_hs_pct = _safe_div(
        total_headshots * 100.0,
        total_headshots + total_bodyshots + total_legshots,
    )

    if global_hs_pct >= 25:
        primary_insight = "Precision alta"
    elif global_kd >= 1.1:
        primary_insight = "Buen impacto ofensivo"
    elif global_win_rate >= 50:
        primary_insight = "Rendimiento competitivo"
    else:
        primary_insight = "Progresion constante"

    agent_buckets: dict[str, dict[str, Any]] = {}
    for match in overview_matches:
        agent_id = str(match.get("agentId") or "unknown")
        bucket = agent_buckets.setdefault(
            agent_id,
            {
                "id": agent_id,
                "name": match.get("agent")
                or agent_name_map.get(agent_id, "Agente desconocido"),
                "matches": 0,
            },
        )
        bucket["matches"] = int(bucket["matches"]) + 1

    most_played_agents = sorted(
        agent_buckets.values(),
        key=lambda item: int(item.get("matches") or 0),
        reverse=True,
    )[:5]

    for agent in most_played_agents:
        agent_id = str(agent.get("id") or "")
        agent["image"] = (agent_media_map.get(agent_id) or {}).get("image")

    best_map: dict[str, Any] | None = None
    map_buckets: dict[str, dict[str, int]] = {}
    for match in overview_matches:
        map_name = str(match.get("map") or "").strip()
        if not map_name or map_name == "-":
            continue
        bucket = map_buckets.setdefault(map_name, {"matches": 0, "wins": 0})
        bucket["matches"] += 1
        if match.get("result") == "Victoria":
            bucket["wins"] += 1

    for map_name, bucket in map_buckets.items():
        win_rate = _safe_div(bucket["wins"] * 100.0, max(bucket["matches"], 1))
        candidate = {
            "map": map_name,
            "matches": bucket["matches"],
            "wins": bucket["wins"],
            "winRate": round(win_rate, 2),
        }
        if not best_map:
            best_map = candidate
            continue
        if candidate["winRate"] > best_map["winRate"] or (
            candidate["winRate"] == best_map["winRate"]
            and candidate["matches"] > best_map["matches"]
        ):
            best_map = candidate

    # Keep weapon insights fast by aggregating weapon_stats server-side.
    weapon_summary_rows = _load_weapon_usage_summary(
        puuid=str(player.get("puuid") or ""),
        season_id=current_act_id if current_act_matches else None,
    )

    most_played_weapons: list[dict[str, Any]] = []
    for row in weapon_summary_rows:
        name = str(row.get("name") or "Arma desconocida")
        most_played_weapons.append(
            {
                "id": str(row.get("_id") or "unknown"),
                "name": name,
                "kills": int(row.get("kills") or 0),
                "matches": int(row.get("matches") or 0),
                "image": weapon_icon_by_name.get(_normalize_rank_label(name)),
            }
        )

    best_weapon: dict[str, Any] | None = None
    if weapon_summary_rows:
        top = weapon_summary_rows[0]
        best_weapon = {
            "name": str(top.get("name") or "Arma desconocida"),
            "matches": int(top.get("matches") or 0),
            "wins": int(top.get("wins") or 0),
            "kills": int(top.get("kills") or 0),
            "winRate": round(
                _safe_div(
                    int(top.get("wins") or 0) * 100.0,
                    max(int(top.get("matches") or 0), 1),
                ),
                2,
            ),
        }

    latest_analytics = overview_docs[0] if overview_docs else (analytics_sorted[0] if analytics_sorted else {})

    tier = _coerce_positive_int(latest_analytics.get("competitive_tier"))
    latest_raw_rank = _latest_rank_from_matches(str(player.get("puuid") or ""))
    if tier is None:
        tier = _coerce_positive_int(latest_raw_rank.get("tier"))
    if tier is None:
        tier = _coerce_positive_int(
            player.get("competitiveTier", player.get("competitive_tier"))
        )

    rank_name = _format_tier_name(tier)
    rank_name_candidates = [
        rank_name,
        player.get("competitiveTierName"),
        player.get("competitive_tier_name"),
        latest_analytics.get("competitive_tier_name"),
        latest_analytics.get("competitiveTierName"),
    ]
    rank_icon_by_name = None
    for candidate in rank_name_candidates:
        normalized_candidate = _normalize_rank_label(candidate)
        if not normalized_candidate:
            continue
        rank_icon_by_name = rank_icon_by_name_map.get(normalized_candidate)
        if rank_icon_by_name:
            break

    rank_image = (
        (rank_icon_map.get(tier) if tier is not None else None)
        or rank_icon_by_name
        or latest_raw_rank.get("image")
        or player.get("competitiveTierImage")
        or player.get("competitive_tier_image")
        or latest_analytics.get("competitive_tier_image")
        or latest_analytics.get("competitiveTierImage")
        or latest_analytics.get("rankImage")
    )
    rank_small_icon = (rank_icon_map.get(tier) if tier is not None else None) or rank_icon_by_name

    top_agent = most_played_agents[0] if most_played_agents else None
    best_map_name = (best_map or {}).get("map")
    best_weapon_name = (best_weapon or {}).get("name")
    best_map_image = map_icon_by_name.get(_normalize_rank_label(best_map_name))
    best_weapon_image = weapon_icon_by_name.get(_normalize_rank_label(best_weapon_name))
    header_showcase = [
        {
            "title": (top_agent or {}).get("name") or "Agente",
            "subtitle": "Agente mas jugado",
            "image": (top_agent or {}).get("image"),
        },
        {
            "title": best_map_name or "Mapa destacado",
            "subtitle": "Mapa con mejor winrate",
            "image": best_map_image,
        },
        {
            "title": best_weapon_name or "Arma destacada",
            "subtitle": "Arma con mas kills",
            "image": best_weapon_image,
        },
    ]

    overview_metrics = {
        "globalWinRate": round(global_win_rate, 2),
        "globalKd": round(global_kd, 3),
        "globalAcs": round(global_acs, 2),
        "globalHeadshotPct": round(global_hs_pct, 2),
        "kdaOverall": round(
            _safe_div(total_kills + total_assists, max(total_deaths, 1)), 3
        ),
        "avgDeathsPerMatch": round(_safe_div(total_deaths, max(total_matches, 1)), 3),
        "avgAssistsPerMatch": round(_safe_div(total_assists, max(total_matches, 1)), 3),
        "avgRoundsPerMatch": round(_safe_div(total_rounds, max(total_matches, 1)), 3),
        "killsPerRound": round(_safe_div(total_kills, max(total_rounds, 1)), 3),
        "killsPerMatch": round(_safe_div(total_kills, max(total_matches, 1)), 3),
    }

    total_shots = total_headshots + total_bodyshots + total_legshots
    shot_chart = [
        {
            "name": "Headshots",
            "value": total_headshots,
            "percentage": round(_safe_div(total_headshots * 100.0, total_shots), 2),
            "color": "#ff4655",
        },
        {
            "name": "Bodyshots",
            "value": total_bodyshots,
            "percentage": round(_safe_div(total_bodyshots * 100.0, total_shots), 2),
            "color": "#ff7a85",
        },
        {
            "name": "Legshots",
            "value": total_legshots,
            "percentage": round(_safe_div(total_legshots * 100.0, total_shots), 2),
            "color": "#7f2c33",
        },
    ]
    shot_chart = [item for item in shot_chart if item["value"] > 0]

    performance_metrics = [
        {
            "label": "KD",
            "value": round(global_kd, 2),
            "percent": min(global_kd * 50.0, 100.0),
            "helper": "1.00 es equilibrio",
        },
        {
            "label": "Win Rate",
            "value": round(global_win_rate, 2),
            "percent": min(global_win_rate, 100.0),
            "helper": "porcentaje de victorias",
        },
        {
            "label": "Headshot %",
            "value": round(global_hs_pct, 2),
            "percent": min(global_hs_pct, 100.0),
            "helper": "precision a la cabeza",
        },
        {
            "label": "ACS",
            "value": round(global_acs, 2),
            "percent": min(_safe_div(global_acs, 300.0) * 100.0, 100.0),
            "helper": "impacto medio por ronda",
        },
        {
            "label": "Kills / partida",
            "value": round(_safe_div(total_kills, max(total_matches, 1)), 2),
            "percent": min(
                _safe_div(total_kills, max(total_matches, 1)) * 4.0,
                100.0,
            ),
            "helper": "media global",
        },
        {
            "label": "KDA",
            "value": round(
                _safe_div(total_kills + total_assists, max(total_deaths, 1)), 2
            ),
            "percent": min(
                _safe_div(total_kills + total_assists, max(total_deaths, 1)) * 33.33,
                100.0,
            ),
            "helper": "kills + assists / deaths",
        },
    ]

    # Override player name with data from the latest match
    latest_name_doc = analytics_sorted[0] if analytics_sorted else {}
    latest_game_name = latest_name_doc.get("game_name")
    latest_tag_line = latest_name_doc.get("tag_line")
    player_out = dict(player)
    if latest_game_name:
        player_out["gameName"] = latest_game_name
    if latest_tag_line:
        player_out["tagLine"] = latest_tag_line

    return {
        "player": player_out,
        "totalMatchesInDb": total_matches_in_db,
        "agentNameMap": agent_name_map,
        "agentMediaMap": agent_media_map,
        "mapMediaMap": map_icon_by_name,
        "analyticsList": _build_light_analytics_list(analytics_sorted),
        "currentActId": current_act_id,
        "currentRank": {
            "tier": tier,
            "name": rank_name,
            "image": rank_image,
            "smallIcon": rank_small_icon,
        },
        "headerShowcase": header_showcase,
        "mostPlayedAgents": most_played_agents,
        "mostPlayedWeapons": most_played_weapons,
        "metrics": overview_metrics,
        "shotChart": shot_chart,
        "performanceMetrics": performance_metrics,
        "insights": {
            "primary": primary_insight,
            "mostPlayedAgent": top_agent,
            "bestMap": best_map,
            "bestWeapon": best_weapon,
        },
        "actOptions": act_options_public,
        "actSections": act_sections,
    }


def _extract_flat_analytics_docs(puuid: str, matches_cursor) -> list[dict[str, Any]]:
    """
    Convert embedded analytics from match documents into the flat analytics doc format
    that build_player_dashboard() expects.
    """
    docs: list[dict[str, Any]] = []
    for match_obj in matches_cursor:
        match_info = match_obj.get("matchInfo") or {}
        for player in match_obj.get("players", []) or []:
            if player.get("puuid") != puuid:
                continue
            analytics = player.get("analytics")
            if not analytics:
                continue
            player_stats = player.get("stats") or {}
            docs.append({
                "match_id": str(match_info.get("matchId") or ""),
                "puuid": puuid,
                "game_name": player.get("gameName"),
                "tag_line": player.get("tagLine"),
                "team_id": player.get("teamId"),
                "won_match": analytics.get("won_match"),
                "is_draw": analytics.get("is_draw"),
                "is_ranked": match_info.get("isRanked", True),
                "queue_id": match_info.get("queueId"),
                "game_mode": match_info.get("gameMode"),
                "region": match_info.get("region"),
                "game_start_millis": match_info.get("gameStartMillis"),
                "season_id": str(match_info.get("seasonId") or "UNKNOWN"),
                "map_id": str(match_info.get("mapId") or "UNKNOWN"),
                "map_name": analytics.get("map_name"),
                "agent_id": str(player.get("characterId") or "UNKNOWN"),
                "agent_name": analytics.get("agent_name"),
                "role": analytics.get("role"),
                "competitive_tier": player.get("competitiveTier"),
                "account_level": player.get("accountLevel"),
                "player_totals_from_match": {
                    "kills": int(player_stats.get("kills", 0) or 0),
                    "deaths": int(player_stats.get("deaths", 0) or 0),
                    "assists": int(player_stats.get("assists", 0) or 0),
                    "score": int(player_stats.get("score", 0) or 0),
                    "rounds_played": int(player_stats.get("roundsPlayed", 0) or 0),
                    "match_duration_millis": int(match_info.get("gameLengthMillis", 0) or 0),
                    "playtime_millis": int(player_stats.get("playtimeMillis", 0) or 0),
                },
                "overview": analytics.get("overview"),
                "sides": analytics.get("sides"),
            })
            break  # Only one entry per match for this puuid
    return docs


def get_player_dashboard(
    puuid: str,
    player: dict[str, Any],
) -> dict[str, Any]:
    total_matches_in_db = dashboard_queries.count_player_matches(puuid)

    cache_key = f"{puuid}:{total_matches_in_db}"
    now = time.monotonic()

    with _CACHE_LOCK:
        cached = _DASHBOARD_RESPONSE_CACHE.get(cache_key)
        if cached and (now - cached[0]) <= _DASHBOARD_RESPONSE_CACHE_TTL_SECONDS:
            return cached[1]

    matches_cursor = dashboard_queries.find_ranked_matches_cursor(puuid)

    player_docs = _extract_flat_analytics_docs(puuid, matches_cursor)

    dashboard = build_player_dashboard(
        player=player,
        player_docs=player_docs,
        total_matches_in_db=total_matches_in_db,
    )

    with _CACHE_LOCK:
        if len(_DASHBOARD_RESPONSE_CACHE) > 500:
            _DASHBOARD_RESPONSE_CACHE.clear()
        _DASHBOARD_RESPONSE_CACHE[cache_key] = (now, dashboard)

    return dashboard