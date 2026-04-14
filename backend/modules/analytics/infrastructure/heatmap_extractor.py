"""
Extracts spatial events from raw match documents for heatmap generation.

Reads roundResults → playerStats → kills (with victimLocation, playerLocations)
and plant/defuse locations, transforms game coordinates to normalised 0-1 values
using Valorant-API map multipliers.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict, List, Optional

from infrastructure.mongo_client import content_collection
from modules.analytics.domain.heatmap_transformer import transform_coords

# ── Round-phase thresholds (milliseconds since round start) ──────────
EARLY_ROUND_MS = 30_000
MID_ROUND_MS = 60_000

# ── Event-type constants ─────────────────────────────────────────────
EVENT_KILL = "kill"
EVENT_KILL_ENEMY_POSITION = "kill_enemy_position"
EVENT_DEATH = "death"
EVENT_FIRST_BLOOD = "first_blood"
EVENT_PLANT = "plant"
EVENT_DEFUSE = "defuse"

ALL_EVENT_TYPES = {
    EVENT_KILL,
    EVENT_KILL_ENEMY_POSITION,
    EVENT_DEATH,
    EVENT_FIRST_BLOOD,
    EVENT_PLANT,
    EVENT_DEFUSE,
}

# ── Event weights ────────────────────────────────────────────────────
DEFAULT_WEIGHT = 1.0
FIRST_BLOOD_WEIGHT = 2.0
COORD_EPSILON = 1e-6


def _as_list(value: Any) -> list[Any]:
    """Return value when it is a list, otherwise an empty list."""
    return value if isinstance(value, list) else []


# ─────────────────────────────────────────────────────────────────────
# Coordinate transform
# ─────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _map_transforms_by_uuid() -> Dict[str, Dict[str, float]]:
    """Load only transform data required by heatmap extraction."""
    doc = content_collection.find_one(
        {"type": "valorant_content"},
        sort=[("_id", -1)],
        projection={
            "_id": 0,
            "maps.uuid": 1,
            "maps.xMultiplier": 1,
            "maps.xScalarToAdd": 1,
            "maps.yMultiplier": 1,
            "maps.yScalarToAdd": 1,
        },
    )
    maps_raw = (doc or {}).get("maps") or []

    result: Dict[str, Dict[str, float]] = {}
    for item in maps_raw:
        if not isinstance(item, dict):
            continue

        map_uuid = str(item.get("uuid") or "").strip()
        if not map_uuid:
            continue

        x_mult = item.get("xMultiplier")
        x_add = item.get("xScalarToAdd")
        y_mult = item.get("yMultiplier")
        y_add = item.get("yScalarToAdd")
        if x_mult is None or x_add is None or y_mult is None or y_add is None:
            continue

        result[map_uuid] = {
            "x_mult": float(x_mult),
            "x_add": float(x_add),
            "y_mult": float(y_mult),
            "y_add": float(y_add),
        }

    return result


def _get_map_transform(map_id: str) -> Optional[Dict[str, float]]:
    """Return coordinate-transform parameters for *map_id*, or ``None``."""
    return _map_transforms_by_uuid().get(str(map_id))


def _transform_point(
    location: Optional[Dict[str, Any]],
    tf: Dict[str, float],
) -> Optional[tuple[float, float]]:
    """
    Transform and validate a location dict.

    Discard points outside [0, 1] (with a tiny epsilon for float noise)
    so invalid coordinates do not create artificial edge hotspots.
    """
    if not isinstance(location, dict):
        return None

    gx = location.get("x")
    gy = location.get("y")
    if gx is None or gy is None:
        return None

    nx, ny = transform_coords(float(gx), float(gy), tf)
    if (
        nx < -COORD_EPSILON
        or nx > 1.0 + COORD_EPSILON
        or ny < -COORD_EPSILON
        or ny > 1.0 + COORD_EPSILON
    ):
        return None

    nx = min(max(nx, 0.0), 1.0)
    ny = min(max(ny, 0.0), 1.0)
    return (nx, ny)


# ─────────────────────────────────────────────────────────────────────
# Round-phase helper
# ─────────────────────────────────────────────────────────────────────

def _classify_round_phase(
    time_since_round_start_ms: int,
    plant_round_time_ms: Optional[int],
) -> str:
    if plant_round_time_ms and plant_round_time_ms > 0:
        if time_since_round_start_ms > plant_round_time_ms:
            return "post_plant"
    if time_since_round_start_ms <= EARLY_ROUND_MS:
        return "early"
    if time_since_round_start_ms <= MID_ROUND_MS:
        return "mid"
    return "late"


# ─────────────────────────────────────────────────────────────────────
# Side resolution helpers
# ─────────────────────────────────────────────────────────────────────

def _determine_side(
    team_id: str,
    round_num: int,
    total_rounds: int,
) -> str:
    """
    Determine if a team is on attack or defense for a given round.
    Standard Valorant: first 12 rounds the team roles stay,
    after round 12 they swap.  In overtime they alternate every 2 rounds.
    The attacking team in the first half is always 'Red' (convention from Riot API).
    """
    first_half = round_num < 12
    is_red = str(team_id).lower() == "red"

    if first_half:
        return "attack" if is_red else "defense"
    elif round_num < 24:
        return "defense" if is_red else "attack"
    else:
        ot_set = (round_num - 24) // 2
        if ot_set % 2 == 0:
            return "attack" if is_red else "defense"
        else:
            return "defense" if is_red else "attack"


# ─────────────────────────────────────────────────────────────────────
# Player lookup helpers
# ─────────────────────────────────────────────────────────────────────

def _build_player_index(match: dict) -> Dict[str, Dict[str, str]]:
    """Map puuid → { teamId, characterId (agent), gameName }."""
    idx: Dict[str, Dict[str, str]] = {}
    for p in _as_list(match.get("players")):
        puuid = p.get("puuid")
        if puuid:
            idx[puuid] = {
                "teamId": p.get("teamId", ""),
                "characterId": p.get("characterId", ""),
                "gameName": p.get("gameName", ""),
            }
    return idx


def _find_killer_location(
    killer_puuid: str,
    player_locations: Optional[list],
) -> Optional[Dict[str, int]]:
    """Find the killer's own position from the playerLocations snapshot."""
    for loc in _as_list(player_locations):
        if loc.get("puuid") == killer_puuid:
            return loc.get("location")
    return None


def _resolve_kill_location(kill: dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Resolve the killer position for kill-side events.

    For kill/first-blood layers we want the position where the killer was,
    not where the victim died. Use the killer snapshot from playerLocations.
    """
    killer = str(kill.get("killer") or "")
    if killer:
        killer_loc = _find_killer_location(killer, kill.get("playerLocations"))
        if isinstance(killer_loc, dict):
            if killer_loc.get("x") is not None and killer_loc.get("y") is not None:
                return killer_loc
    return None


def _resolve_victim_location(kill: dict[str, Any]) -> Optional[Dict[str, Any]]:
    victim_loc = kill.get("victimLocation")
    if isinstance(victim_loc, dict):
        if victim_loc.get("x") is not None and victim_loc.get("y") is not None:
            return victim_loc
    return None


# ─────────────────────────────────────────────────────────────────────
# Main extraction
# ─────────────────────────────────────────────────────────────────────

def extract_spatial_events(
    matches: List[dict],
    puuid: str,
    *,
    map_transform: Dict[str, float],
    event_types: Optional[set] = None,
    agent_id: Optional[str] = None,
    side_filter: Optional[str] = None,
    round_phase_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Extract spatial events from raw Riot match documents for *puuid*.

    Parameters
    ----------
    matches : list of raw match dicts
    puuid : target player UUID
    map_transform : dict with x_mult, x_add, y_mult, y_add
    event_types : subset of ALL_EVENT_TYPES (None = all)
    agent_id : optional filter – only events when player used this agent
    side_filter : "attack" | "defense" | None
    round_phase_filter : "early" | "mid" | "post_plant" | "late" | None

    Returns list of event dicts with normalised 0-1 x/y.
    """
    wanted = event_types or ALL_EVENT_TYPES
    events: List[Dict[str, Any]] = []

    for match in matches:
        match_id = match.get("matchInfo", {}).get("matchId", "")
        player_index = _build_player_index(match)
        player_info = player_index.get(puuid)
        if not player_info:
            continue

        player_team = player_info["teamId"]
        player_agent = player_info["characterId"]

        if agent_id and player_agent != agent_id:
            continue

        rounds = _as_list(match.get("roundResults"))
        total_rounds = len(rounds)

        for rnd in rounds:
            round_num = int(rnd.get("roundNum") or 0)
            plant_round_time = int(rnd.get("plantRoundTime") or 0)
            side = _determine_side(player_team, round_num, total_rounds)

            if side_filter and side != side_filter:
                continue

            # ── Collect round kills and earliest kill (first blood) in one pass ──
            round_kills: list[dict[str, Any]] = []
            first_blood_kill: Optional[dict[str, Any]] = None
            first_blood_ts = float("inf")
            for ps in _as_list(rnd.get("playerStats")):
                for kill in _as_list(ps.get("kills")):
                    round_kills.append(kill)
                    kill_ts = int(kill.get("timeSinceRoundStartMillis") or 0)
                    if kill_ts < first_blood_ts:
                        first_blood_ts = kill_ts
                        first_blood_kill = kill

            # ── Process only kills involving the target player ──
            for kill in round_kills:
                killer = kill.get("killer", "")
                victim = kill.get("victim", "")
                if killer != puuid and victim != puuid:
                    continue

                ts = int(kill.get("timeSinceRoundStartMillis") or 0)
                phase = _classify_round_phase(ts, plant_round_time)

                if round_phase_filter and phase != round_phase_filter:
                    continue

                base = {
                    "round_num": round_num,
                    "round_phase": phase,
                    "side": side,
                    "match_id": match_id,
                    "timestamp_ms": int(kill.get("timeSinceGameStartMillis") or 0),
                }

                is_first_blood = first_blood_kill is kill

                # KILL event – where the player killed someone
                if killer == puuid and EVENT_KILL in wanted:
                    loc = _resolve_kill_location(kill)
                    transformed = _transform_point(loc, map_transform)
                    if transformed:
                        nx, ny = transformed
                        events.append({
                            **base,
                            "event_type": EVENT_KILL,
                            "x": nx,
                            "y": ny,
                            "weight": FIRST_BLOOD_WEIGHT if is_first_blood else DEFAULT_WEIGHT,
                            "agent_id": player_agent,
                        })

                # KILL (enemy position) event – where the enemy died
                if killer == puuid and EVENT_KILL_ENEMY_POSITION in wanted:
                    vloc = _resolve_victim_location(kill)
                    transformed = _transform_point(vloc, map_transform)
                    if transformed:
                        nx, ny = transformed
                        events.append({
                            **base,
                            "event_type": EVENT_KILL_ENEMY_POSITION,
                            "x": nx,
                            "y": ny,
                            "weight": FIRST_BLOOD_WEIGHT if is_first_blood else DEFAULT_WEIGHT,
                            "agent_id": player_agent,
                        })

                # DEATH event – where the player died
                if victim == puuid and EVENT_DEATH in wanted:
                    vloc = _resolve_victim_location(kill)
                    transformed = _transform_point(vloc, map_transform)
                    if transformed:
                        nx, ny = transformed
                        events.append({
                            **base,
                            "event_type": EVENT_DEATH,
                            "x": nx,
                            "y": ny,
                            "weight": FIRST_BLOOD_WEIGHT if is_first_blood else DEFAULT_WEIGHT,
                            "agent_id": player_agent,
                        })

                # FIRST BLOOD event (separate layer)
                if is_first_blood and EVENT_FIRST_BLOOD in wanted:
                    if killer == puuid:
                        loc = _resolve_kill_location(kill)
                        transformed = _transform_point(loc, map_transform)
                        if transformed:
                            nx, ny = transformed
                            events.append({
                                **base,
                                "event_type": EVENT_FIRST_BLOOD,
                                "x": nx,
                                "y": ny,
                                "weight": FIRST_BLOOD_WEIGHT,
                                "agent_id": player_agent,
                                "fb_role": "killer",
                            })
                    if victim == puuid:
                        vloc = _resolve_victim_location(kill)
                        transformed = _transform_point(vloc, map_transform)
                        if transformed:
                            nx, ny = transformed
                            events.append({
                                **base,
                                "event_type": EVENT_FIRST_BLOOD,
                                "x": nx,
                                "y": ny,
                                "weight": FIRST_BLOOD_WEIGHT,
                                "agent_id": player_agent,
                                "fb_role": "victim",
                            })

            # ── Plant event ──────────────────────────────────
            if EVENT_PLANT in wanted:
                planter = rnd.get("bombPlanter", "")
                plant_loc = rnd.get("plantLocation")
                if (
                    planter == puuid
                    and plant_loc
                    and (plant_loc.get("x", 0) != 0 or plant_loc.get("y", 0) != 0)
                ):
                    phase = _classify_round_phase(plant_round_time, plant_round_time)
                    if not round_phase_filter or phase == round_phase_filter:
                        transformed = _transform_point(plant_loc, map_transform)
                        if transformed:
                            nx, ny = transformed
                            events.append({
                                "event_type": EVENT_PLANT,
                                "x": nx,
                                "y": ny,
                                "weight": DEFAULT_WEIGHT,
                                "round_num": round_num,
                                "round_phase": "plant",
                                "side": side,
                                "match_id": match_id,
                                "agent_id": player_agent,
                                "plant_site": rnd.get("plantSite", ""),
                                "timestamp_ms": 0,
                            })

            # ── Defuse event ─────────────────────────────────
            if EVENT_DEFUSE in wanted:
                defuser = rnd.get("bombDefuser", "")
                defuse_loc = rnd.get("defuseLocation")
                if (
                    defuser == puuid
                    and defuse_loc
                    and (defuse_loc.get("x", 0) != 0 or defuse_loc.get("y", 0) != 0)
                ):
                    defuse_rt = rnd.get("defuseRoundTime") or 0
                    phase = _classify_round_phase(defuse_rt, plant_round_time)
                    if not round_phase_filter or phase == round_phase_filter:
                        transformed = _transform_point(defuse_loc, map_transform)
                        if transformed:
                            nx, ny = transformed
                            events.append({
                                "event_type": EVENT_DEFUSE,
                                "x": nx,
                                "y": ny,
                                "weight": DEFAULT_WEIGHT,
                                "round_num": round_num,
                                "round_phase": "defuse",
                                "side": side,
                                "match_id": match_id,
                                "agent_id": player_agent,
                                "timestamp_ms": 0,
                            })

    return events
