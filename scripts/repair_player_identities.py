"""Recover blank RAW player identities from another recorded match.

Riot's RAW match-details endpoint can omit gameName/tagLine for opponents.  We
never fabricate an identity: only an already-recorded non-empty name for the
same PUUID is copied into blank match/player-profile fields.
"""
from __future__ import annotations

import argparse
from collections.abc import Iterable
from typing import Any

from pymongo import UpdateOne

from infrastructure.mongo_client import matches_collection, players_collection


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _timestamp(match: dict[str, Any]) -> int:
    value = (match.get("matchInfo") or {}).get("gameStartMillis")
    return int(value) if isinstance(value, (int, float)) else 0


def _known_identities(matches: Iterable[dict[str, Any]]) -> dict[str, tuple[int, str, str | None]]:
    identities: dict[str, tuple[int, str, str | None]] = {}
    for match in matches:
        stamp = _timestamp(match)
        for player in match.get("players") or []:
            if not isinstance(player, dict):
                continue
            puuid = _text(player.get("puuid"))
            game_name = _text(player.get("gameName"))
            if not puuid or not game_name:
                continue
            tag_line = _text(player.get("tagLine"))
            previous = identities.get(puuid)
            if previous is None or stamp >= previous[0]:
                identities[puuid] = (stamp, game_name, tag_line)
    return identities


def repair(*, apply: bool, batch_size: int = 250) -> dict[str, int]:
    matches = list(matches_collection.find({}, {"players": 1, "matchInfo.gameStartMillis": 1}))
    identities = _known_identities(matches)
    changed_matches = changed_players = repaired_match_entries = repaired_profiles = 0
    match_updates: list[UpdateOne] = []
    profile_updates: list[UpdateOne] = []

    def flush() -> None:
        if not apply:
            return
        if match_updates:
            matches_collection.bulk_write(match_updates, ordered=False)
            match_updates.clear()
        if profile_updates:
            players_collection.bulk_write(profile_updates, ordered=False)
            profile_updates.clear()

    for match in matches:
        players = match.get("players") or []
        changed = False
        repaired = 0
        for player in players:
            if not isinstance(player, dict):
                continue
            known = identities.get(_text(player.get("puuid")) or "")
            if not known:
                continue
            _, game_name, tag_line = known
            if not _text(player.get("gameName")):
                player["gameName"] = game_name
                changed = True
                repaired += 1
            if not _text(player.get("tagLine")) and tag_line:
                player["tagLine"] = tag_line
                changed = True
        if changed:
            changed_matches += 1
            repaired_match_entries += repaired
            match_updates.append(UpdateOne({"_id": match["_id"]}, {"$set": {"players": players}}))
            if len(match_updates) >= batch_size:
                flush()

    for profile in players_collection.find({}, {"puuid": 1, "gameName": 1, "tagLine": 1}):
        known = identities.get(_text(profile.get("puuid")) or "")
        if not known:
            continue
        _, game_name, tag_line = known
        update: dict[str, str] = {}
        if not _text(profile.get("gameName")):
            update["gameName"] = game_name
        if not _text(profile.get("tagLine")) and tag_line:
            update["tagLine"] = tag_line
        if update:
            changed_players += 1
            repaired_profiles += 1
            profile_updates.append(UpdateOne({"_id": profile["_id"]}, {"$set": update}))
            if len(profile_updates) >= batch_size:
                flush()
    flush()
    return {
        "known_identities": len(identities),
        "changed_matches": changed_matches,
        "repaired_match_entries": repaired_match_entries,
        "changed_profiles": changed_players,
        "repaired_profiles": repaired_profiles,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write the repair (default is dry-run).")
    parser.add_argument("--batch-size", type=int, default=250)
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    result = repair(apply=args.apply, batch_size=args.batch_size)
    print(("APPLIED" if args.apply else "DRY-RUN"), result)


if __name__ == "__main__":
    main()
