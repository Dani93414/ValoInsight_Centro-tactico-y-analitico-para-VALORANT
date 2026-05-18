from __future__ import annotations

from typing import Any, Iterable

from modules.analytics.infrastructure.reference_data import (
    resolve_melee_weapon_id,
    resolve_weapon_or_gear_name,
)

from shared.math_utils import safe_div as _safe_div_raw


def _coerce_event_time_ms(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return 0
        try:
            return max(0, int(float(stripped)))
        except (TypeError, ValueError):
            return 0
    return 0


def _normalize_weapon_id(value: Any) -> str:
    text = str(value or "").strip()
    return text or "UNKNOWN"


def _damage_item_weapon_id(kill: dict[str, Any], fallback_weapon_id: str) -> str:
    finishing_damage = kill.get("finishingDamage") or {}
    damage_item = _normalize_weapon_id(finishing_damage.get("damageItem"))
    damage_type = str(finishing_damage.get("damageType") or "").strip().lower()
    if damage_type == "melee" and damage_item == "UNKNOWN":
        return resolve_melee_weapon_id()
    return damage_item if damage_item != "UNKNOWN" else fallback_weapon_id


def _unique_kill_key(kill: dict[str, Any]) -> tuple[Any, Any, Any, tuple[str, ...]]:
    assistants = tuple(sorted(str(item) for item in (kill.get("assistants") or []) if item))
    return (
        kill.get("timeSinceRoundStartMillis"),
        kill.get("killer"),
        kill.get("victim"),
        assistants,
    )


def _collect_sorted_round_kills(round_obj: dict[str, Any]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, Any, Any, tuple[str, ...]]] = set()
    unique_kills: list[dict[str, Any]] = []

    for player_round in round_obj.get("playerStats") or []:
        if not isinstance(player_round, dict):
            continue
        for kill in player_round.get("kills") or []:
            if not isinstance(kill, dict):
                continue
            key = _unique_kill_key(kill)
            if key in seen:
                continue
            seen.add(key)
            unique_kills.append(kill)

    unique_kills.sort(
        key=lambda item: _coerce_event_time_ms(item.get("timeSinceRoundStartMillis"))
    )
    return unique_kills


def _find_player_round_stats(
    round_obj: dict[str, Any],
    puuid: str,
) -> dict[str, Any]:
    for player_round in round_obj.get("playerStats") or []:
        if isinstance(player_round, dict) and player_round.get("puuid") == puuid:
            return player_round
    return {}


def _ensure_weapon_bucket(
    weapon_stats: dict[str, dict[str, Any]],
    weapon_id: str,
) -> dict[str, Any]:
    normalized_weapon_id = _normalize_weapon_id(weapon_id)
    bucket = weapon_stats.get(normalized_weapon_id)
    if bucket is not None:
        return bucket

    bucket = {
        "weapon_id": normalized_weapon_id,
        "weapon_name": resolve_weapon_or_gear_name(normalized_weapon_id),
        "rounds": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "kd_ratio": 0.0,
    }
    weapon_stats[normalized_weapon_id] = bucket
    return bucket


def compute_precise_weapon_stats_core(
    round_results: Iterable[dict[str, Any]] | None,
    puuid: str,
) -> dict[str, dict[str, Any]]:
    weapon_stats: dict[str, dict[str, Any]] = {}

    for round_obj in round_results or []:
        if not isinstance(round_obj, dict):
            continue

        round_pstat = _find_player_round_stats(round_obj, puuid)
        economy = (round_pstat.get("economy") or {}) if round_pstat else {}
        purchased_weapon_id = _normalize_weapon_id(economy.get("weapon"))
        all_kills = _collect_sorted_round_kills(round_obj)

        assist_count = sum(
            1
            for kill in all_kills
            if puuid in (kill.get("assistants") or [])
        )
        own_kills = [kill for kill in all_kills if kill.get("killer") == puuid]

        death_time_ms: int | None = None
        for kill in all_kills:
            if kill.get("victim") == puuid:
                death_time_ms = _coerce_event_time_ms(
                    kill.get("timeSinceRoundStartMillis")
                )
                break

        current_known_weapon_id = purchased_weapon_id
        used_weapon_ids: set[str] = set()
        kill_weapon_ids: list[str] = []

        for kill in own_kills:
            kill_time_ms = _coerce_event_time_ms(kill.get("timeSinceRoundStartMillis"))
            if death_time_ms is not None and kill_time_ms > death_time_ms:
                continue

            kill_weapon_id = _damage_item_weapon_id(kill, current_known_weapon_id)
            _ensure_weapon_bucket(weapon_stats, kill_weapon_id)["kills"] += 1
            kill_weapon_ids.append(kill_weapon_id)
            current_known_weapon_id = kill_weapon_id

        death_weapon_id: str | None = None
        if death_time_ms is not None:
            death_weapon_id = current_known_weapon_id
            _ensure_weapon_bucket(weapon_stats, death_weapon_id)["deaths"] += 1

        assist_weapon_id: str | None = None
        if assist_count > 0:
            assist_weapon_id = current_known_weapon_id
            _ensure_weapon_bucket(weapon_stats, assist_weapon_id)["assists"] += assist_count

        if purchased_weapon_id:
            used_weapon_ids.add(purchased_weapon_id)
        used_weapon_ids.update(kill_weapon_ids)
        if death_weapon_id:
            used_weapon_ids.add(death_weapon_id)
        if assist_weapon_id:
            used_weapon_ids.add(assist_weapon_id)
        if not used_weapon_ids:
            used_weapon_ids.add(purchased_weapon_id)

        for weapon_id in used_weapon_ids:
            _ensure_weapon_bucket(weapon_stats, weapon_id)["rounds"] += 1

    for bucket in weapon_stats.values():
        bucket["kd_ratio"] = _safe_div_raw(
            float(bucket.get("kills", 0) or 0),
            max(float(bucket.get("deaths", 0) or 0), 1.0),
            4,
        )

    return weapon_stats


def _iter_existing_weapon_entries(
    existing_weapon_stats: dict[str, dict[str, Any]] | list[dict[str, Any]] | None,
) -> list[tuple[str, dict[str, Any]]]:
    if not existing_weapon_stats:
        return []

    if isinstance(existing_weapon_stats, list):
        entries: list[tuple[str, dict[str, Any]]] = []
        for idx, entry in enumerate(existing_weapon_stats):
            if not isinstance(entry, dict):
                continue
            key = _normalize_weapon_id(entry.get("weapon_id") or entry.get("key") or f"weapon-{idx}")
            entries.append((key, entry))
        return entries

    if isinstance(existing_weapon_stats, dict):
        entries = []
        for key, entry in existing_weapon_stats.items():
            if not isinstance(entry, dict):
                continue
            entries.append((_normalize_weapon_id(key), entry))
        return entries

    return []


def merge_precise_weapon_core_stats(
    existing_weapon_stats: dict[str, dict[str, Any]] | list[dict[str, Any]] | None,
    precise_core_stats: dict[str, dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}

    for weapon_id, entry in _iter_existing_weapon_entries(existing_weapon_stats):
        merged[weapon_id] = {**entry}
        merged[weapon_id]["weapon_id"] = entry.get("weapon_id") or weapon_id
        merged[weapon_id]["weapon_name"] = entry.get("weapon_name") or resolve_weapon_or_gear_name(weapon_id)

    for weapon_id, bucket in (precise_core_stats or {}).items():
        if weapon_id not in merged:
            merged[weapon_id] = {
                "weapon_id": weapon_id,
                "weapon_name": bucket.get("weapon_name") or resolve_weapon_or_gear_name(weapon_id),
            }

    for weapon_id, entry in merged.items():
        bucket = (precise_core_stats or {}).get(weapon_id) or {}
        entry["weapon_id"] = entry.get("weapon_id") or weapon_id
        entry["weapon_name"] = entry.get("weapon_name") or resolve_weapon_or_gear_name(weapon_id)
        entry["rounds"] = int(bucket.get("rounds", 0) or 0)
        entry["kills"] = int(bucket.get("kills", 0) or 0)
        entry["deaths"] = int(bucket.get("deaths", 0) or 0)
        entry["assists"] = int(bucket.get("assists", 0) or 0)
        entry["kd_ratio"] = float(bucket.get("kd_ratio", 0) or 0)

    return merged
