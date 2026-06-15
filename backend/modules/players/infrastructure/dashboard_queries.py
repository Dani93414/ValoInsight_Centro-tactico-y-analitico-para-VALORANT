"""MongoDB queries used by the player dashboard service."""
from __future__ import annotations

from typing import Any

from infrastructure.mongo_client import content_collection, matches_collection

QUERY_MAX_TIME_MS = 5_000


_DASHBOARD_CONTENT_PROJECTION = {
    "_id": 0,
    "agents.uuid": 1,
    "agents.id": 1,
    "agents.displayName": 1,
    "agents.name": 1,
    "agents.displayIcon": 1,
    "agents.fullPortrait": 1,
    "agents.bustPortrait": 1,
    "agents.role.displayName": 1,
    "maps.uuid": 1,
    "maps.id": 1,
    "maps.displayName": 1,
    "maps.name": 1,
    "maps.splash": 1,
    "maps.listViewIcon": 1,
    "maps.listViewIconTall": 1,
    "maps.displayIcon": 1,
    "weapons.uuid": 1,
    "weapons.id": 1,
    "weapons.displayName": 1,
    "weapons.displayIcon": 1,
    "acts.id": 1,
    "acts.name": 1,
    "acts.parentId": 1,
    "acts.parent_id": 1,
    "acts.parentName": 1,
    "acts.parent.name": 1,
    "acts.type": 1,
    "acts.isActive": 1,
    "competitiveTiers.uuid": 1,
    "competitiveTiers.id": 1,
    "competitiveTiers.tiers": 1,
    "competitive_tiers.uuid": 1,
    "competitive_tiers.id": 1,
    "competitive_tiers.tiers": 1,
}


def get_dashboard_content() -> dict[str, Any]:
    return (
        content_collection.find_one(
            {"type": "valorant_content"},
            sort=[("_id", -1)],
            projection=_DASHBOARD_CONTENT_PROJECTION,
        )
        or {}
    )


def find_ranked_matches_cursor(puuid: str, projection: dict | None = None):
    """Return a cursor of ranked matches for a player, newest first."""
    query = {"players.puuid": puuid, "matchInfo.isRanked": True}
    cursor = matches_collection.find(query, projection).sort(
        "matchInfo.gameStartMillis", -1
    ).max_time_ms(QUERY_MAX_TIME_MS)
    return cursor


def find_recent_matches_with_rank(puuid: str, limit: int = 50):
    projection = {
        "_id": 0,
        "players.puuid": 1,
        "players.competitiveTier": 1,
        "players.competitive_tier": 1,
        "matchInfo.gameStartMillis": 1,
    }
    return (
        matches_collection.find({"players.puuid": puuid}, projection)
        .sort("matchInfo.gameStartMillis", -1)
        .limit(limit)
        .max_time_ms(QUERY_MAX_TIME_MS)
    )


def find_match_durations(match_ids: list[str]):
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids:
        return []
    return matches_collection.find(
        {
            "$or": [
                {"metadata.match_id": {"$in": clean_ids}},
                {"matchInfo.matchId": {"$in": clean_ids}},
            ]
        },
        {
            "_id": 0,
            "metadata.match_id": 1,
            "matchInfo.matchId": 1,
            "matchInfo.gameLengthMillis": 1,
        },
    ).max_time_ms(QUERY_MAX_TIME_MS)


def find_match_parties(match_ids: list[str]):
    clean_ids = [mid for mid in match_ids if mid]
    if not clean_ids:
        return []
    return matches_collection.find(
        {
            "$or": [
                {"matchInfo.matchId": {"$in": clean_ids}},
                {"metadata.match_id": {"$in": clean_ids}},
            ]
        },
        {
            "_id": 0,
            "matchInfo.matchId": 1,
            "metadata.match_id": 1,
            "players.puuid": 1,
            "players.partyId": 1,
        },
    ).max_time_ms(QUERY_MAX_TIME_MS)


def aggregate_weapon_usage(pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return list(
        matches_collection.aggregate(
            pipeline,
            allowDiskUse=True,
            maxTimeMS=QUERY_MAX_TIME_MS,
        )
    )


def _party_size_match_condition(party_size: str | None) -> dict[str, Any] | None:
    if not party_size:
        return None

    normalized = str(party_size).strip().lower()
    if normalized == "solo":
        return {"partySize": 1}
    if normalized == "duo":
        return {"partySize": 2}
    if normalized == "trio":
        return {"partySize": 3}
    if normalized == "team":
        return {"partySize": {"$gte": 4}}
    return None


def _has_non_null_aggregation_value(expression: Any) -> dict[str, Any]:
    return {
        "$not": [
            {
                "$in": [
                    {"$type": expression},
                    ["missing", "null"],
                ]
            }
        ]
    }


def _build_rank_comparison_player_match_stages(
    *,
    puuid: str | None = None,
    queue_id: str | None = None,
    agent_id: str | None = None,
    map_name: str | None = None,
    season_id: str | None = None,
    party_size: str | None = None,
) -> list[dict[str, Any]]:
    match_stage: dict[str, Any] = {"matchInfo.isRanked": True}
    if season_id:
        match_stage["matchInfo.seasonId"] = season_id
    if queue_id:
        match_stage["matchInfo.queueId"] = queue_id

    player_conditions: list[dict[str, Any]] = [
        {
            "$or": [
                {"players.analytics.overview": {"$exists": True}},
                {"players.stats": {"$exists": True}},
            ]
        }
    ]
    if puuid:
        player_conditions.append({"players.puuid": puuid})
    if agent_id:
        player_conditions.append({"players.characterId": agent_id})

    raw_kast_source = {
        "$ifNull": [
            "$players.analytics.overview.kast",
            "$players.analytics.overview.kast_pct",
            "$players.analytics.overview.kill_assist_survive_trade_pct",
        ]
    }

    stages: list[dict[str, Any]] = [
        {"$match": match_stage},
        {"$addFields": {"allPlayersForParty": "$players"}},
        {"$unwind": "$players"},
        {"$match": {"$and": player_conditions}},
        {
            "$project": {
                "_id": 0,
                "puuid": "$players.puuid",
                "timestamp": {
                    "$convert": {
                        "input": "$matchInfo.gameStartMillis",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "tier": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.competitiveTier",
                                "$players.competitive_tier",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "mapNameLower": {
                    "$toLower": {"$ifNull": ["$players.analytics.map_name", ""]}
                },
                "partySize": {
                    "$let": {
                        "vars": {"partyId": "$players.partyId"},
                        "in": {
                            "$cond": [
                                {
                                    "$or": [
                                        {"$eq": ["$$partyId", None]},
                                        {"$eq": ["$$partyId", ""]},
                                    ]
                                },
                                1,
                                {
                                    "$max": [
                                        1,
                                        {
                                            "$size": {
                                                "$filter": {
                                                    "input": "$allPlayersForParty",
                                                    "as": "partyMember",
                                                    "cond": {
                                                        "$eq": [
                                                            "$$partyMember.partyId",
                                                            "$$partyId",
                                                        ]
                                                    },
                                                }
                                            }
                                        },
                                    ]
                                },
                            ]
                        },
                    }
                },
                "wins": {
                    "$let": {
                        "vars": {
                            "winningTeam": {
                                "$first": {
                                    "$filter": {
                                        "input": "$teams",
                                        "as": "team",
                                        "cond": {"$eq": ["$$team.won", True]},
                                    }
                                }
                            },
                            "wonMatch": "$players.analytics.won_match",
                        },
                        "in": {
                            "$cond": [
                                {"$ne": ["$$wonMatch", None]},
                                {
                                    "$cond": [
                                        {"$eq": ["$$wonMatch", True]},
                                        1,
                                        0,
                                    ]
                                },
                                {
                                    "$cond": [
                                        {
                                            "$eq": [
                                                "$players.teamId",
                                                {"$ifNull": ["$$winningTeam.teamId", ""]},
                                            ]
                                        },
                                        1,
                                        0,
                                    ]
                                },
                            ]
                        },
                    }
                },
                "kills": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.analytics.overview.kills",
                                "$players.stats.kills",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "deaths": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.analytics.overview.deaths",
                                "$players.stats.deaths",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "assists": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.analytics.overview.assists",
                                "$players.stats.assists",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "rounds": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.analytics.overview.rounds",
                                "$players.stats.roundsPlayed",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "score": {
                    "$convert": {
                        "input": {
                            "$ifNull": [
                                "$players.analytics.overview.score",
                                "$players.stats.score",
                            ]
                        },
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "headshots": {
                    "$convert": {
                        "input": "$players.analytics.overview.headshots",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "bodyshots": {
                    "$convert": {
                        "input": "$players.analytics.overview.bodyshots",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "legshots": {
                    "$convert": {
                        "input": "$players.analytics.overview.legshots",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "roundsWithKastRaw": {
                    "$convert": {
                        "input": "$players.analytics.overview.rounds_with_kast",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "hasExactKastField": _has_non_null_aggregation_value(
                    "$players.analytics.overview.rounds_with_kast"
                ),
                "survivalRoundsRaw": {
                    "$convert": {
                        "input": "$players.analytics.overview.survival_rounds",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "roundsWithKillRaw": {
                    "$convert": {
                        "input": "$players.analytics.overview.rounds_with_kill",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "roundsWithAssistRaw": {
                    "$convert": {
                        "input": "$players.analytics.overview.rounds_with_assist",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
                "hasApproxKastFields": {
                    "$and": [
                        _has_non_null_aggregation_value(
                            "$players.analytics.overview.survival_rounds"
                        ),
                        _has_non_null_aggregation_value(
                            "$players.analytics.overview.rounds_with_kill"
                        ),
                        _has_non_null_aggregation_value(
                            "$players.analytics.overview.rounds_with_assist"
                        ),
                    ]
                },
                "rawKastValue": {
                    "$let": {
                        "vars": {
                            "rawKast": {
                                "$convert": {
                                    "input": raw_kast_source,
                                    "to": "double",
                                    "onError": 0,
                                    "onNull": 0,
                                }
                            }
                        },
                        "in": {
                            "$cond": [
                                {"$lte": ["$$rawKast", 1]},
                                {"$multiply": ["$$rawKast", 100]},
                                "$$rawKast",
                            ]
                        },
                    }
                },
                "hasRawKast": _has_non_null_aggregation_value(raw_kast_source),
                "damageDelta": {
                    "$convert": {
                        "input": "$players.analytics.overview.damage_delta",
                        "to": "double",
                        "onError": 0,
                        "onNull": 0,
                    }
                },
            }
        },
        {
            "$addFields": {
                "safeRounds": {"$max": ["$rounds", 0]},
                "roundsWithKast": {"$min": ["$roundsWithKastRaw", {"$max": ["$rounds", 0]}]},
                "survivalRounds": {"$min": ["$survivalRoundsRaw", {"$max": ["$rounds", 0]}]},
                "roundsWithKill": {"$min": ["$roundsWithKillRaw", {"$max": ["$rounds", 0]}]},
                "roundsWithAssist": {"$min": ["$roundsWithAssistRaw", {"$max": ["$rounds", 0]}]},
                "useExactKast": {
                    "$and": ["$hasExactKastField", {"$gt": ["$rounds", 0]}]
                },
            }
        },
        {
            "$addFields": {
                "useApproxKast": {
                    "$and": [
                        {"$not": ["$useExactKast"]},
                        "$hasApproxKastFields",
                        {"$gt": ["$rounds", 0]},
                    ]
                },
            }
        },
        {
            "$addFields": {
                "roundBasedKastRounds": {
                    "$cond": [
                        "$useExactKast",
                        "$roundsWithKast",
                        {
                            "$cond": [
                                "$useApproxKast",
                                {
                                    "$multiply": [
                                        {
                                            "$subtract": [
                                                1,
                                                {
                                                    "$multiply": [
                                                        {
                                                            "$subtract": [
                                                                1,
                                                                {
                                                                    "$cond": [
                                                                        {"$gt": ["$safeRounds", 0]},
                                                                        {"$divide": ["$survivalRounds", "$safeRounds"]},
                                                                        0,
                                                                    ]
                                                                },
                                                            ]
                                                        },
                                                        {
                                                            "$subtract": [
                                                                1,
                                                                {
                                                                    "$cond": [
                                                                        {"$gt": ["$safeRounds", 0]},
                                                                        {"$divide": ["$roundsWithKill", "$safeRounds"]},
                                                                        0,
                                                                    ]
                                                                },
                                                            ]
                                                        },
                                                        {
                                                            "$subtract": [
                                                                1,
                                                                {
                                                                    "$cond": [
                                                                        {"$gt": ["$safeRounds", 0]},
                                                                        {"$divide": ["$roundsWithAssist", "$safeRounds"]},
                                                                        0,
                                                                    ]
                                                                },
                                                            ]
                                                        },
                                                    ]
                                                },
                                            ]
                                        },
                                        "$safeRounds",
                                    ]
                                },
                                0,
                            ]
                        },
                    ]
                },
                "roundBasedKastSourceRounds": {
                    "$cond": [
                        {"$or": ["$useExactKast", "$useApproxKast"]},
                        "$safeRounds",
                        0,
                    ]
                },
                "rawKastFallbackValue": {
                    "$cond": [
                        {
                            "$or": [
                                "$useExactKast",
                                "$useApproxKast",
                                {"$not": ["$hasRawKast"]},
                            ]
                        },
                        0,
                        "$rawKastValue",
                    ]
                },
                "rawKastFallbackCount": {
                    "$cond": [
                        {
                            "$and": [
                                {"$not": ["$useExactKast"]},
                                {"$not": ["$useApproxKast"]},
                                "$hasRawKast",
                            ]
                        },
                        1,
                        0,
                    ]
                },
            }
        },
    ]

    post_project_conditions: list[dict[str, Any]] = []
    normalized_map_name = str(map_name or "").strip().lower()
    if normalized_map_name:
        post_project_conditions.append({"mapNameLower": normalized_map_name})

    party_size_condition = _party_size_match_condition(party_size)
    if party_size_condition:
        post_project_conditions.append(party_size_condition)

    if post_project_conditions:
        stages.append({"$match": {"$and": post_project_conditions}})

    return stages


def find_player_latest_rank_reference(
    puuid: str,
    *,
    queue_id: str | None = None,
    agent_id: str | None = None,
    map_name: str | None = None,
    season_id: str | None = None,
    party_size: str | None = None,
) -> dict[str, Any]:
    if not puuid:
        return {}

    pipeline = _build_rank_comparison_player_match_stages(
        puuid=puuid,
        queue_id=queue_id,
        agent_id=agent_id,
        map_name=map_name,
        season_id=season_id,
        party_size=party_size,
    )
    pipeline.extend(
        [
            {"$sort": {"timestamp": -1}},
            {"$limit": 1},
            {"$project": {"_id": 0, "puuid": 1, "timestamp": 1, "latestTier": "$tier"}},
        ]
    )

    rows = list(
        matches_collection.aggregate(
            pipeline,
            allowDiskUse=True,
            maxTimeMS=QUERY_MAX_TIME_MS,
        )
    )
    return rows[0] if rows else {}


def aggregate_rank_cohort_players(
    cohort_tiers: list[int],
    *,
    queue_id: str | None = None,
    agent_id: str | None = None,
    map_name: str | None = None,
    season_id: str | None = None,
    party_size: str | None = None,
) -> list[dict[str, Any]]:
    clean_tiers = sorted(
        {
            int(tier)
            for tier in cohort_tiers
            if isinstance(tier, (int, float)) and int(tier) >= 3
        }
    )
    if not clean_tiers:
        return []

    pipeline = _build_rank_comparison_player_match_stages(
        queue_id=queue_id,
        agent_id=agent_id,
        map_name=map_name,
        season_id=season_id,
        party_size=party_size,
    )
    pipeline.extend(
        [
            {"$sort": {"puuid": 1, "timestamp": -1}},
            {
                "$group": {
                    "_id": "$puuid",
                    "latestTier": {"$first": "$tier"},
                    "latestTimestamp": {"$first": "$timestamp"},
                    "matchCount": {"$sum": 1},
                    "wins": {"$sum": "$wins"},
                    "kills": {"$sum": "$kills"},
                    "deaths": {"$sum": "$deaths"},
                    "assists": {"$sum": "$assists"},
                    "rounds": {"$sum": "$rounds"},
                    "score": {"$sum": "$score"},
                    "headshots": {"$sum": "$headshots"},
                    "bodyshots": {"$sum": "$bodyshots"},
                    "legshots": {"$sum": "$legshots"},
                    "roundBasedKastRounds": {"$sum": "$roundBasedKastRounds"},
                    "roundBasedKastSourceRounds": {"$sum": "$roundBasedKastSourceRounds"},
                    "rawKastFallbackSum": {"$sum": "$rawKastFallbackValue"},
                    "rawKastFallbackCount": {"$sum": "$rawKastFallbackCount"},
                    "damageDelta": {"$sum": "$damageDelta"},
                }
            },
            {"$match": {"latestTier": {"$in": clean_tiers}}},
            {
                "$project": {
                    "_id": 0,
                    "puuid": "$_id",
                    "latestTier": 1,
                    "latestTimestamp": 1,
                    "matchCount": 1,
                    "wins": 1,
                    "kills": 1,
                    "deaths": 1,
                    "assists": 1,
                    "rounds": 1,
                    "score": 1,
                    "headshots": 1,
                    "bodyshots": 1,
                    "legshots": 1,
                    "roundBasedKastRounds": 1,
                    "roundBasedKastSourceRounds": 1,
                    "rawKastFallbackSum": 1,
                    "rawKastFallbackCount": 1,
                    "damageDelta": 1,
                }
            },
        ]
    )

    return list(
        matches_collection.aggregate(
            pipeline,
            allowDiskUse=True,
            maxTimeMS=QUERY_MAX_TIME_MS,
        )
    )


def count_player_matches(puuid: str) -> int:
    return matches_collection.count_documents({"players.puuid": puuid})
