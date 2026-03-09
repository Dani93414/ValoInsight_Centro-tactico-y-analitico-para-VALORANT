from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from db.mongo_client import (
    content_collection,
    matches_collection,
    player_match_analytics_collection,
)


_DASHBOARD_CONTENT_PROJECTION = {
    "_id": 0,
    "agents.uuid": 1,
    "agents.id": 1,
    "agents.displayName": 1,
    "agents.name": 1,
    "agents.fullPortrait": 1,
    "agents.bustPortrait": 1,
    "agents.displayIcon": 1,
    "acts.id": 1,
    "acts.name": 1,
    "acts.parentId": 1,
    "acts.parent_id": 1,
    "acts.parentName": 1,
    "acts.parent.name": 1,
    "competitiveTiers.tiers": 1,
}
_DASHBOARD_CONTENT_CACHE: dict[str, Any] | None = None
_DASHBOARD_RESPONSE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_DASHBOARD_RESPONSE_CACHE_TTL_SECONDS = 120.0


def _get_dashboard_content() -> dict[str, Any]:
    global _DASHBOARD_CONTENT_CACHE
    if _DASHBOARD_CONTENT_CACHE is None:
        _DASHBOARD_CONTENT_CACHE = (
            content_collection.find_one(
                {"type": "valorant_content"},
                sort=[("_id", -1)],
                projection=_DASHBOARD_CONTENT_PROJECTION,
            )
            or {}
        )
    return _DASHBOARD_CONTENT_CACHE


def _safe_div(a: float, b: float) -> float:
    return a / b if b > 0 else 0.0


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

    for doc in content_doc.get("competitiveTiers", []) or []:
        tiers = doc.get("tiers") or {}
        entries: list[dict[str, Any]]
        if isinstance(tiers, list):
            entries = [entry for entry in tiers if isinstance(entry, dict)]
        elif isinstance(tiers, dict):
            entries = [x for x in tiers.values() if isinstance(x, dict)]
        else:
            entries = []

        for entry in entries:
            tier = entry.get("tier")
            icon = (
                entry.get("smallIcon")
                or entry.get("largeIcon")
                or entry.get("rankTriangleUpIcon")
                or entry.get("rankTriangleDownIcon")
            )
            tier_name = (entry.get("tierName") or "").strip().lower()

            if isinstance(tier, int) and icon and tier not in tier_by_number:
                tier_by_number[tier] = icon

            if tier_name and icon and tier_name not in tier_by_name:
                tier_by_name[tier_name] = icon

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
            "image": agent.get("fullPortrait")
            or agent.get("bustPortrait")
            or agent.get("displayIcon"),
        }

    return name_map, media_map


def _latest_rank_from_matches(puuid: str) -> dict[str, Any]:
    """Fallback de rango desde la colección de matches cuando analytics no trae tier."""
    if not puuid:
        return {}

    projection = {
        "_id": 0,
        "players.puuid": 1,
        "players.competitiveTier": 1,
        "players.competitive_tier": 1,
        "players.competitiveTierImage": 1,
        "players.competitive_tier_image": 1,
        "matchInfo.gameStartMillis": 1,
    }

    cursor = (
        matches_collection.find({"players.puuid": puuid}, projection)
        .sort("matchInfo.gameStartMillis", -1)
        .limit(50)
    )

    for match in cursor:
        for player in match.get("players") or []:
            if player.get("puuid") != puuid:
                continue

            tier = _coerce_positive_int(
                player.get("competitiveTier", player.get("competitive_tier"))
            )
            if tier is not None:
                return {
                    "tier": tier,
                    "image": player.get("competitiveTierImage")
                    or player.get("competitive_tier_image"),
                }

    return {}


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
    """Recorta analytics para frontend y evita transferir bloques pesados."""
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
                },
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
) -> dict[str, Any]:
    totals = doc.get("player_totals_from_match") or {}
    overview = doc.get("overview") or {}

    kills = int(totals.get("kills") or overview.get("kills") or 0)
    deaths = int(totals.get("deaths") or overview.get("deaths") or 0)
    assists = int(totals.get("assists") or overview.get("assists") or 0)
    rounds = int(totals.get("rounds_played") or overview.get("rounds") or 0)
    score = int(totals.get("score") or overview.get("score") or 0)
    acs = float(overview.get("acs") or _safe_div(score, max(rounds, 1)))
    adr = float(overview.get("adr") or 0)

    hs = overview.get("headshot_pct")
    if hs is None:
        hs = _safe_div(
            float(overview.get("headshots") or 0) * 100.0,
            float(overview.get("headshots") or 0)
            + float(overview.get("bodyshots") or 0)
            + float(overview.get("legshots") or 0),
        )

    timestamp = int(doc.get("game_start_millis") or 0)
    date_label = "Fecha desconocida"
    if timestamp > 0:
        date_label = datetime.fromtimestamp(
            timestamp / 1000, tz=timezone.utc
        ).strftime("%d/%m/%Y %H:%M UTC")

    agent_id = doc.get("agent_id")

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
        "result": "Victoria" if doc.get("won_match") else "Derrota",
        "ranked": bool(doc.get("is_ranked")),
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "rounds": rounds,
        "score": score,
        "acs": round(acs, 2),
        "adr": round(adr, 2),
        "hs": round(float(hs or 0), 2),
        "kd": round(_safe_div(kills, max(deaths, 1)), 3),
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
) -> dict[str, Any]:
    content_doc = _get_dashboard_content()

    agent_name_map, agent_media_map = _build_agent_maps(content_doc)
    act_label_map = _build_act_label_map(content_doc)
    rank_icon_map, rank_icon_by_name_map = _build_competitive_tier_maps(content_doc)

    analytics_sorted = sorted(
        player_docs,
        key=lambda item: int(item.get("game_start_millis") or 0),
        reverse=True,
    )

    mapped_matches = [
        _map_analytics_to_match_card(doc, agent_name_map) for doc in analytics_sorted
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

    total_matches = int(player.get("totalMatches") or 0)
    total_wins = int(player.get("totalWins") or 0)
    total_kills = int(player.get("totalKills") or 0)
    total_deaths = int(player.get("totalDeaths") or 0)
    total_assists = int(player.get("totalAssists") or 0)
    total_score = int(player.get("totalScore") or 0)
    total_rounds = int(player.get("totalRoundsPlayed") or 0)
    total_headshots = int(player.get("totalHeadshots") or 0)
    total_bodyshots = int(player.get("totalBodyshots") or 0)
    total_legshots = int(player.get("totalLegshots") or 0)

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

    most_played_agents = []
    for item in (player.get("mostPlayedAgents") or [])[:5]:
        agent_id = item.get("agentId")
        matches = int(item.get("matches") or 0)
        most_played_agents.append(
            {
                "id": agent_id,
                "name": agent_name_map.get(agent_id, "Agente desconocido"),
                "matches": matches,
                "image": (agent_media_map.get(agent_id) or {}).get("image"),
            }
        )

    best_map: dict[str, Any] | None = None
    map_buckets: dict[str, dict[str, int]] = {}
    for match in mapped_matches:
        map_name = str(match.get("map") or "").strip()
        if not map_name or map_name == "-":
            continue
        bucket = map_buckets.setdefault(map_name, {"matches": 0, "wins": 0})
        bucket["matches"] += 1
        if match.get("result") == "Victoria":
            bucket["wins"] += 1

    min_samples_for_best_map = 3
    for map_name, bucket in map_buckets.items():
        if bucket["matches"] < min_samples_for_best_map:
            continue

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

    if best_map is None and map_buckets:
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

    best_weapon: dict[str, Any] | None = None
    weapon_buckets: dict[str, dict[str, int | str]] = {}
    for doc in analytics_sorted:
        overview = doc.get("overview") or {}
        weapon_stats = _normalize_weapon_stats(overview.get("weapon_stats"))
        for weapon in weapon_stats:
            has_usage = (
                float(weapon.get("kills") or 0) > 0
                or float(weapon.get("deaths") or 0) > 0
                or float(weapon.get("kd_ratio") or 0) > 0
            )
            if not has_usage:
                continue

            key = str(weapon.get("weapon_id") or weapon.get("key") or "unknown")
            name = str(weapon.get("weapon_name") or "Arma desconocida")
            bucket = weapon_buckets.setdefault(key, {"name": name, "matches": 0, "wins": 0})
            bucket["matches"] = int(bucket["matches"]) + 1
            if doc.get("won_match"):
                bucket["wins"] = int(bucket["wins"]) + 1

    min_samples_for_best_weapon = 3
    for bucket in weapon_buckets.values():
        matches = int(bucket["matches"])
        if matches < min_samples_for_best_weapon:
            continue

        wins = int(bucket["wins"])
        win_rate = _safe_div(wins * 100.0, max(matches, 1))
        candidate = {
            "name": str(bucket["name"]),
            "matches": matches,
            "wins": wins,
            "winRate": round(win_rate, 2),
        }
        if not best_weapon:
            best_weapon = candidate
            continue
        if candidate["winRate"] > best_weapon["winRate"] or (
            candidate["winRate"] == best_weapon["winRate"]
            and candidate["matches"] > best_weapon["matches"]
        ):
            best_weapon = candidate

    if best_weapon is None and weapon_buckets:
        for bucket in weapon_buckets.values():
            matches = int(bucket["matches"])
            wins = int(bucket["wins"])
            win_rate = _safe_div(wins * 100.0, max(matches, 1))
            candidate = {
                "name": str(bucket["name"]),
                "matches": matches,
                "wins": wins,
                "winRate": round(win_rate, 2),
            }
            if not best_weapon:
                best_weapon = candidate
                continue
            if candidate["winRate"] > best_weapon["winRate"] or (
                candidate["winRate"] == best_weapon["winRate"]
                and candidate["matches"] > best_weapon["matches"]
            ):
                best_weapon = candidate

    latest_match = mapped_matches[0] if mapped_matches else None
    latest_analytics = analytics_sorted[0] if analytics_sorted else {}

    tier = _coerce_positive_int(latest_analytics.get("competitive_tier"))
    latest_raw_rank = _latest_rank_from_matches(str(player.get("puuid") or ""))
    if tier is None:
        tier = _coerce_positive_int(latest_raw_rank.get("tier"))

    rank_name = _format_tier_name(tier)
    rank_image = (
        (rank_icon_map.get(tier) if tier is not None else None)
        or rank_icon_by_name_map.get(rank_name.lower())
        or latest_raw_rank.get("image")
        or latest_analytics.get("competitive_tier_image")
        or latest_analytics.get("competitiveTierImage")
        or latest_analytics.get("rankImage")
    )

    top_agent = most_played_agents[0] if most_played_agents else None
    latest_match_agent_id = (latest_match or {}).get("agentId")
    header_showcase = [
        {
            "title": (latest_match or {}).get("agent")
            or (top_agent or {}).get("name")
            or "Agente",
            "subtitle": "Agente destacado",
            "image": (
                (agent_media_map.get(latest_match_agent_id) or {}).get("image")
                if latest_match_agent_id
                else (top_agent or {}).get("image")
            ),
        },
        {
            "title": (best_map or {}).get("map")
            or (latest_match or {}).get("map")
            or "Mapa destacado",
            "subtitle": "Mapa referencia",
            "image": None,
        },
        {
            "title": (best_weapon or {}).get("name") or "Arma destacada",
            "subtitle": "Arma con mejor WR",
            "image": None,
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

    return {
        "player": player,
        "agentNameMap": agent_name_map,
        "agentMediaMap": agent_media_map,
        "analyticsList": _build_light_analytics_list(analytics_sorted),
        "currentRank": {
            "tier": tier,
            "name": rank_name,
            "image": rank_image,
        },
        "headerShowcase": header_showcase,
        "mostPlayedAgents": most_played_agents,
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


def get_player_dashboard(
    puuid: str,
    player: dict[str, Any],
    limit: int = 500,
) -> dict[str, Any]:
    projection = {
        "_id": 0,
        "match_id": 1,
        "won_match": 1,
        "is_ranked": 1,
        "queue_id": 1,
        "game_mode": 1,
        "region": 1,
        "game_start_millis": 1,
        "season_id": 1,
        "map_id": 1,
        "map_name": 1,
        "agent_id": 1,
        "agent_name": 1,
        "overview": 1,
        "role": 1,
        "competitive_tier": 1,
        "competitive_tier_image": 1,
        "competitiveTierImage": 1,
        "rankImage": 1,
        "account_level": 1,
        "player_totals_from_match": 1,
    }

    safe_limit = max(1, min(limit, 2000))
    cache_key = f"{puuid}:{safe_limit}:{int(player.get('totalMatches') or 0)}"
    now = time.monotonic()

    cached = _DASHBOARD_RESPONSE_CACHE.get(cache_key)
    if cached and (now - cached[0]) <= _DASHBOARD_RESPONSE_CACHE_TTL_SECONDS:
        return cached[1]

    # Keep cache bounded and drop expired entries opportunistically.
    if len(_DASHBOARD_RESPONSE_CACHE) > 500:
        _DASHBOARD_RESPONSE_CACHE.clear()

    player_docs = list(
        player_match_analytics_collection.find({"puuid": puuid}, projection)
        .sort("game_start_millis", -1)
        .limit(safe_limit)
    )
    dashboard = build_player_dashboard(player=player, player_docs=player_docs)
    _DASHBOARD_RESPONSE_CACHE[cache_key] = (now, dashboard)
    return dashboard