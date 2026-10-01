"""Stable v2 ValoInsight match adapter for Riot match-details RAW payloads.

It accepts minor Riot spelling/casing variations; unknown source fields are not
given invented semantics and are either retained in explicit raw metadata or
ignored deliberately.
"""
from __future__ import annotations

import copy
from typing import Any

from ingestion.riot_performance_parser import parse_riot_performance


def is_riot_raw_match(value: dict[str, Any] | None) -> bool:
    value = value or {}
    players = value.get("players") or []
    return bool(value.get("matchInfo") and any(isinstance(p, dict) and p.get("subject") for p in players))


def is_legacy_match(value: dict[str, Any] | None) -> bool:
    value = value or {}
    players = value.get("players") or []
    return bool(value.get("matchInfo") and any(isinstance(p, dict) and p.get("puuid") for p in players))


def _get(source: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in source and source[name] is not None:
            return source[name]
    return None


def _puuid(value: Any) -> Any:
    if isinstance(value, dict):
        return _get(value, "subject", "puuid", "playerId", "player", "id")
    return value


def _location(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return {key: value.get(key) for key in ("x", "y", "z") if key in value}


def _player_location(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "puuid": _puuid(_get(value, "subject", "player", "puuid")),
        "viewRadians": _get(value, "viewRadians", "view_radians"),
        "location": _location(value.get("location")),
    }


def _kill(value: dict[str, Any]) -> dict[str, Any]:
    assistants = [_puuid(item) for item in (value.get("assistants") or [])]
    return {
        "timeSinceGameStartMillis": _get(value, "gameTime", "timeSinceGameStartMillis", "time_in_match_in_ms"),
        "timeSinceRoundStartMillis": _get(value, "roundTime", "timeSinceRoundStartMillis", "time_in_round_in_ms"),
        "killer": _puuid(_get(value, "killer", "killerSubject")),
        "victim": _puuid(_get(value, "victim", "victimSubject")),
        "victimLocation": _location(_get(value, "victimLocation", "location")),
        "assistants": [value for value in assistants if value],
        "playerLocations": [_player_location(item) for item in (value.get("playerLocations") or value.get("player_locations") or []) if isinstance(item, dict)],
        "finishingDamage": copy.deepcopy(value.get("finishingDamage") or {}),
    }


def _economy(value: dict[str, Any] | None) -> dict[str, Any]:
    value = value or {}
    spent = _get(value, "spent", "spentCredits")
    return {
        "loadoutValue": _get(value, "loadoutValue", "loadout_value"),
        "weapon": _puuid(_get(value, "weapon", "weaponId")),
        "armor": _puuid(_get(value, "armor", "armorId")),
        "remaining": _get(value, "remaining", "remainingCredits"),
        "spent": spent,
        "spentSource": "riot_raw" if spent is not None else "unknown",
        "economyDataQuality": "riot_observed" if spent is not None else "unknown",
        "observedFields": [key for key, aliases in {
            "loadoutValue": ("loadoutValue", "loadout_value"), "weapon": ("weapon", "weaponId"),
            "armor": ("armor", "armorId"), "remaining": ("remaining", "remainingCredits"),
            "spent": ("spent", "spentCredits"),
        }.items() if _get(value, *aliases) is not None],
    }


def _round_key(value: Any) -> str:
    """Compare Riot round ids without losing a source value's original type."""
    return str(value).strip() if value is not None else ""


def _kill_key(kill: dict[str, Any]) -> tuple[Any, ...]:
    return (
        _get(kill, "gameTime", "timeSinceGameStartMillis", "time_in_match_in_ms"),
        _get(kill, "roundTime", "timeSinceRoundStartMillis", "time_in_round_in_ms"),
        _puuid(_get(kill, "killer", "killerSubject")),
        _puuid(_get(kill, "victim", "victimSubject")),
        tuple(sorted(str(_puuid(item)) for item in (kill.get("assistants") or []) if _puuid(item))),
    )


def _round(raw_round: dict[str, Any], raw_top_kills: list[dict[str, Any]]) -> dict[str, Any]:
    number = _get(raw_round, "roundNum", "round", "id")
    player_economies = raw_round.get("playerEconomies") or raw_round.get("player_economies") or []
    economics = {_puuid(entry): _economy(entry) for entry in player_economies if isinstance(entry, dict) and _puuid(entry)}
    stats = []
    stats_by_puuid: dict[str, dict[str, Any]] = {}
    for raw_stat in (raw_round.get("playerStats") or raw_round.get("player_stats") or raw_round.get("stats") or []):
        if not isinstance(raw_stat, dict):
            continue
        puuid = _puuid(raw_stat)
        if not puuid:
            continue
        stat = {
            "puuid": puuid,
            "kills": [_kill(kill) for kill in (raw_stat.get("kills") or []) if isinstance(kill, dict)],
            "damage": [
                {"receiver": _puuid(_get(item, "receiver", "receiverSubject")), "damage": item.get("damage"), "legshots": item.get("legshots"), "bodyshots": item.get("bodyshots"), "headshots": item.get("headshots")}
                for item in (raw_stat.get("damage") or raw_stat.get("damageEvents") or []) if isinstance(item, dict)
            ],
            "score": _get(raw_stat, "score", "roundScore"),
            "economy": economics.get(puuid, _economy(raw_stat.get("economy"))),
            "ability": copy.deepcopy(raw_stat.get("ability") or {}),
            # Only retain an AFK marker when Riot provides one for this exact
            # player/round.  Aggregate player behavior factors cannot identify
            # a particular round and must never be used to guess one.
            "isAfk": _get(raw_stat, "isAfk", "isAFK", "wasAfk", "was_afk", "afk"),
            "stayedInSpawn": _get(raw_stat, "stayedInSpawn", "stayed_in_spawn"),
        }
        stats.append(stat)
        stats_by_puuid[puuid] = stat
    for kill in raw_top_kills:
        if _round_key(_get(kill, "round", "roundNum")) != _round_key(number):
            continue
        killer = _puuid(_get(kill, "killer", "killerSubject"))
        if not killer:
            continue
        if killer not in stats_by_puuid:
            stats_by_puuid[killer] = {
                "puuid": killer, "kills": [], "damage": [], "score": None,
                "economy": economics.get(killer, _economy(None)), "ability": {},
            }
            stats.append(stats_by_puuid[killer])
        existing_keys = {_kill_key(item) for item in stats_by_puuid[killer]["kills"]}
        if _kill_key(kill) not in existing_keys:
            stats_by_puuid[killer]["kills"].append(_kill(kill))
    return {
        "roundNum": number,
        "roundResult": _get(raw_round, "roundResult", "result"),
        "roundCeremony": _get(raw_round, "roundCeremony", "ceremony"),
        "ceremonyPlayer": _puuid(raw_round.get("ceremonyPlayer")),
        "ceremonyTeam": raw_round.get("ceremonyTeam"),
        "winningTeam": _get(raw_round, "winningTeam", "winning_team"),
        "winningTeamRole": raw_round.get("winningTeamRole"),
        "firstBloodPlayer": _puuid(raw_round.get("firstBloodPlayer")),
        "bombPlanter": _puuid(raw_round.get("bombPlanter")),
        "bombDefuser": _puuid(raw_round.get("bombDefuser")),
        "plantRoundTime": raw_round.get("plantRoundTime"),
        "plantPlayerLocations": [_player_location(x) for x in (raw_round.get("plantPlayerLocations") or []) if isinstance(x, dict)],
        "plantLocation": _location(raw_round.get("plantLocation")),
        "plantSite": raw_round.get("plantSite"),
        "defuseRoundTime": raw_round.get("defuseRoundTime"),
        "defusePlayerLocations": [_player_location(x) for x in (raw_round.get("defusePlayerLocations") or []) if isinstance(x, dict)],
        "defuseLocation": _location(raw_round.get("defuseLocation")),
        "playerEconomies": [{"puuid": key, **value} for key, value in economics.items()],
        "playerScores": [{**copy.deepcopy(item), "puuid": _puuid(item)} for item in (raw_round.get("playerScores") or []) if isinstance(item, dict)],
        "playerStats": stats,
        "roundResultCode": raw_round.get("roundResultCode"),
    }


def adapt_riot_raw_match(raw: dict[str, Any], *, region: str = "eu", platform: str = "pc") -> dict[str, Any]:
    """Convert one RAW response to schema v2 without retaining a blind RAW copy."""
    payload = raw.get("data") if isinstance(raw.get("data"), dict) else raw
    if not is_riot_raw_match(payload):
        raise ValueError("Payload is not a Riot RAW match (matchInfo + players[].subject required)")
    info = payload.get("matchInfo") or {}
    match_id = _get(info, "matchId", "match_id")
    if not isinstance(match_id, str) or not match_id.strip():
        raise ValueError("RAW matchInfo.matchId is required")
    raw_kills = [item for item in (payload.get("kills") or []) if isinstance(item, dict)]
    score_by_puuid = {_puuid(item): item for item in (payload.get("playerScores") or payload.get("scores") or []) if isinstance(item, dict) and _puuid(item)}
    players = []
    for raw_player in payload.get("players") or []:
        if not isinstance(raw_player, dict) or not raw_player.get("subject"):
            continue
        puuid = raw_player["subject"]
        raw_stats = raw_player.get("stats") or raw_player.get("playerStats") or {}
        performance = parse_riot_performance(score_by_puuid.get(puuid) or raw_player.get("scores"), game_version=info.get("gameVersion"))
        players.append({
            "puuid": puuid,
            "gameName": raw_player.get("gameName"), "tagLine": raw_player.get("tagLine"),
            "teamId": _get(raw_player, "teamId", "team"), "partyId": raw_player.get("partyId"),
            "characterId": _get(raw_player, "characterId", "character"),
            "competitiveTier": raw_player.get("competitiveTier"), "playerCard": raw_player.get("playerCard"), "playerTitle": raw_player.get("playerTitle"),
            "accountLevel": raw_player.get("accountLevel"), "isObserver": raw_player.get("isObserver"),
            "platformInfo": copy.deepcopy(raw_player.get("platformInfo") or {}),
            "behaviorFactors": copy.deepcopy(raw_player.get("behaviorFactors")),
            "participationPeriods": copy.deepcopy(raw_player.get("participationPeriods")),
            "clientMetadata": {key: raw_player[key] for key in ("isMouseSensitivityDefault", "isCrosshairDefault") if key in raw_player},
            "stats": {key: _get(raw_stats, key, {"playtimeMillis":"playtime_millis", "abilityCasts":"ability_casts"}.get(key, key)) for key in ("score", "roundsPlayed", "kills", "deaths", "assists", "playtimeMillis", "abilityCasts")},
            "performance": performance,
        })
    return {
        "dataSchema": {"version": 2, "source": "riot_raw", "riotGameVersion": info.get("gameVersion")},
        "rawRefresh": {"status": "success", "source": "riot_raw"},
        "matchInfo": {
            "matchId": match_id, "mapId": _get(info, "mapId", "map"), "rawMapPath": info.get("mapId"),
            "region": region, "platformType": _get(info, "platformType", "platform") or platform,
            **{key: info.get(key) for key in ("gamePodId", "gameLoopZone", "gameServerAddress", "gameVersion", "gameLengthMillis", "gameStartMillis", "provisioningFlowID", "isCompleted", "isEarlyCompletion", "customGameName", "forcePostProcessing", "gameMode", "isRanked", "isMatchSampled", "seasonId", "completionState", "premierMatchInfo", "partyRRPenalties", "shouldMatchDisablePenalties", "newMapLossReductionModifier", "isReplayRecorded") if key in info},
            "queueId": _get(info, "queueId", "queueID"),
        },
        "players": players,
        "coaches": [{**copy.deepcopy(coach), "puuid": _puuid(coach)} for coach in (payload.get("coaches") or []) if isinstance(coach, dict)],
        "teams": [{**copy.deepcopy(team), "mvp": _puuid(team.get("mvp"))} for team in (payload.get("teams") or []) if isinstance(team, dict)],
        "roundResults": [_round(item, raw_kills) for item in (payload.get("roundResults") or payload.get("rounds") or []) if isinstance(item, dict)],
        "riotPerformance": {"hasTempValues": any(player["performance"].get("hasTempValues") for player in players), "matchMvp": _puuid(payload.get("matchMvp"))},
    }
