"""Observed player-round decisions. Money is calculated, never predicted.

Histories are committed only after a complete match (and after tied timestamps).
No post-round outcome, remaining balance or observed loadout is a state feature.
"""
from __future__ import annotations

from collections import defaultdict
from itertools import groupby
import json
import math

import pandas as pd

from .content_catalog import load_weapon_catalog, load_gear_catalog

VERSION = "player-buy-v2-two-rounds-defuse-team-300"
EMPTY = {"", "string", "none", "null", "unknown"}
HISTORY_SCOPES = ("player", "agent", "weapon", "agent_weapon")
HISTORY_FIELDS = ("rounds", "win_rate", "kills_per_round", "damage_per_round")
CATEGORICAL = ["map_id", "side", "agent_id", "phase", "weapon_id", "armor_id"]
NUMERIC = [
    "credits_before_buy", "team_credits_mean", "enemy_credits_mean", "round_number",
    "score_diff", "loss_streak", "prior_rank", "weapon_value", "armor_value",
] + [f"history_{scope}_{field}" for scope in HISTORY_SCOPES for field in HISTORY_FIELDS]
FEATURES = NUMERIC + CATEGORICAL


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def text_id(value):
    value = str(value or "").strip()
    return "" if value.lower() in EMPTY else value


def catalog_snapshot():
    weapons = {key: {"id": key, "name": item.get("displayName") or key,
                     "cost": number(item.get("cost")), "icon": item.get("displayIcon")}
               for key, item in load_weapon_catalog().items()
               if number(item.get("cost")) is not None and item.get("weapon_role") != "melee"}
    armors = {key: {"id": key, "name": item.get("displayName") or key,
                    "cost": number(item.get("cost")), "icon": item.get("displayIcon")}
              for key, item in load_gear_catalog().items() if number(item.get("cost")) is not None}
    armors["none"] = {"id": "none", "name": "Sin escudo", "cost": 0, "icon": None}
    return {"weapons": weapons, "armors": armors}


def events(round_obj):
    unique = {}
    for stat in round_obj.get("playerStats") or []:
        raw_kills = stat.get("kills")
        if not isinstance(raw_kills, list):
            continue
        for kill in raw_kills:
            if not isinstance(kill, dict):
                continue
            key = (kill.get("killer"), kill.get("victim"), kill.get("timeSinceRoundStartMillis"))
            unique[key] = kill
    return list(unique.values())


def side_for(team, round_number, attacking_team):
    if not attacking_team:
        return "unknown"
    attack = team == attacking_team
    if 13 <= round_number <= 24 or (round_number >= 25 and round_number % 2 == 0):
        attack = not attack
    return "attack" if attack else "defense"


def match_rows(match, catalog):
    """Reconstruct each round independently from the previous observed remaining.

    `string` armor is the provider's absent-armor sentinel; an absent key remains
    unknown. Costs are a frozen content snapshot, not historical price claims.
    """
    info = match.get("matchInfo") or {}
    players = {p["puuid"]: p for p in match.get("players") or [] if p.get("puuid")}
    teams = {p: str(v.get("teamId")) for p, v in players.items()}
    team_ids = set(teams.values())
    rounds = sorted(match.get("roundResults") or [], key=lambda r: r.get("roundNum", 0))
    starts_zero = bool(rounds and rounds[0].get("roundNum") == 0)
    attacking_team = None
    # Side is static match metadata, inferred from objective actors, not outcomes.
    for rnd in rounds[:12]:
        planter = teams.get(text_id(rnd.get("bombPlanter")))
        defuser = teams.get(text_id(rnd.get("bombDefuser")))
        if planter or defuser:
            attacking_team = planter or next((t for t in team_ids if t != defuser), None)
            break
        role = str(rnd.get("winningTeamRole", "")).lower()
        if role in {"attack", "attacker", "attackers", "defense", "defender", "defenders"}:
            winner = str(rnd.get("winningTeam"))
            attacking_team = winner if role.startswith("attack") else next((t for t in team_ids if t != winner), None)
            break
    previous, score, losses = {}, defaultdict(int), defaultdict(int)
    result = []
    for index, rnd in enumerate(rounds):
        rn = int(rnd.get("roundNum", index)) + int(starts_zero)
        reset = rn in (1, 13) or rn >= 25
        if reset:
            losses.clear()
        stats = {s.get("puuid"): s for s in rnd.get("playerStats") or []}
        money, quality = {}, {}
        for pid in players:
            eco = (stats.get(pid) or {}).get("economy") or {}
            direct = next((number(eco.get(k)) for k in ("creditsBeforeBuy", "credits_before_buy", "startingCredits")
                           if number(eco.get(k)) is not None), None)
            if reset:
                money[pid], quality[pid] = (5000 if rn >= 25 else 800), "fixed_reset"
            elif direct is not None:
                money[pid], quality[pid] = direct, "observed"
            elif previous.get(pid, {}).get("round_number") == rn - 1:
                money[pid] = previous[pid].get("next_credits")
                quality[pid] = previous[pid].get("next_quality", "incomplete")
            else:
                money[pid], quality[pid] = None, "incomplete"
        kills = events(rnd)
        death_ids = {k.get("victim") for k in kills}
        winner = text_id(rnd.get("winningTeam"))
        planter_team = teams.get(text_id(rnd.get("bombPlanter")))
        defuser_team = teams.get(text_id(rnd.get("bombDefuser")))
        objective = str(rnd.get("roundResult", "")).lower()
        detonated = "detonat" in objective or "explod" in objective
        defused = bool(defuser_team) or "defus" in objective
        for pid, player in players.items():
            stat = stats.get(pid) or {}
            eco = stat.get("economy") or {}
            team = teams[pid]
            side = side_for(team, rn, attacking_team)
            won = int(winner == team) if winner in team_ids else None
            remaining = number(eco.get("remaining"))
            credit = money[pid]
            if remaining is not None and not 0 <= remaining <= 9000:
                remaining = None
            if credit is not None and remaining is not None and credit < remaining:
                quality[pid] = "inconsistent"
            own_kills = [k for k in kills if k.get("killer") == pid and teams.get(k.get("victim")) not in (None, team)]
            kill_fields_complete = bool(stats) and all(isinstance(s.get("kills"), list) for s in stats.values())
            survived = pid not in death_ids if kill_fields_complete else None
            base = 3000 if won else min(2900, 1900 + 500 * losses[team])
            if won == 0 and survived:
                if (side == "attack" and not planter_team and not defused) or (side == "defense" and detonated):
                    base = 1000
            bonus = (300 if planter_team == team else 0) + (300 if defused and winner == team else 0)
            income_known = won is not None and kill_fields_complete and (won or survived is False or side != "unknown")
            next_credits = min(9000, remaining + base + 200 * len(own_kills) + bonus) if remaining is not None and income_known else None
            weapon_id = text_id(eco.get("weapon")) or "unknown"
            armor_id = (text_id(eco.get("armor")) or "none") if "armor" in eco else "unknown"
            weapon = catalog["weapons"].get(weapon_id, {})
            armor = catalog["armors"].get(armor_id, {})
            prev = previous.get(pid, {}) if not reset else {}
            phase = "pistol" if rn in (1, 13) else "overtime" if rn >= 25 else "last_half" if rn in (12, 24) else "normal"
            def mean_money(ids):
                values = [money[p] for p in ids]
                return sum(values) / len(values) if values and all(v is not None for v in values) else None
            row = {
                "match_id": str(info.get("matchId")), "game_start_millis": number(info.get("gameStartMillis")),
                "game_version": info.get("gameVersion"), "puuid": pid, "team_id": team,
                "agent_id": text_id(player.get("characterId")) or "unknown", "map_id": text_id(info.get("mapId")) or "unknown",
                "round_number": rn, "side": side, "phase": phase, "score_diff": score[team] - sum(v for t, v in score.items() if t != team),
                "loss_streak": losses[team], "credits_before_buy": credit, "money_source": quality[pid],
                "team_score_before": score[team], "enemy_score_before": sum(v for t, v in score.items() if t != team),
                "remaining": remaining, "spent_calculated": max(0, credit - remaining) if credit is not None and remaining is not None else None,
                "loadout_value": number(eco.get("loadoutValue")), "weapon_id": weapon_id, "armor_id": armor_id,
                "weapon_value": weapon.get("cost"), "armor_value": armor.get("cost"),
                "team_credits_mean": mean_money([p for p in players if teams[p] == team and p != pid]),
                "enemy_credits_mean": mean_money([p for p in players if teams[p] != team]),
                "previous_survived": prev.get("survived"), "previous_weapon": prev.get("weapon_id"),
                "player_survived": survived,
                "round_won": won, "round_kills": len(own_kills),
                "round_damage": sum(number(d.get("damage")) or 0 for d in stat.get("damage") or [] if teams.get(d.get("receiver")) not in (None, team)),
                "rank_observed": number(player.get("competitiveTier")),
                "weapon_kills_observed": sum(1 for k in own_kills if (k.get("finishingDamage") or {}).get("damageItem") == weapon_id),
                "inventory_source": "observed_loadout_purchase_origin_unresolved",
            }
            result.append(row)
            previous[pid] = {"round_number": rn, "next_credits": next_credits,
                             "next_quality": "calculated_rules" if next_credits is not None else "incomplete",
                             "survived": survived, "weapon_id": weapon_id}
        if winner in team_ids:
            score[winner] += 1
            for team in team_ids:
                losses[team] = 0 if team == winner else losses[team] + 1
    by_round = {(r["puuid"], r["round_number"]): r for r in result}
    for row in result:
        successor = by_round.get((row["puuid"], row["round_number"] + 1))
        # Sequence outcomes are labels/audit columns only; never model features.
        row["next_round_won"] = successor["round_won"] if successor else None
        row["next_weapon_observed"] = successor["weapon_id"] if successor else None
        row["next_armor_observed"] = successor["armor_id"] if successor else None
    return result


def summary(values):
    n, wins, kills, damage = values or (0, 0, 0, 0)
    return {"rounds": n, "win_rate": (wins + 10) / (n + 20),
            "kills_per_round": (kills + 10) / (n + 20), "damage_per_round": (damage + 2400) / (n + 20)}


def apply_history(row, profiles, weapon_id=None):
    weapon_id = weapon_id or row["weapon_id"]
    for scope, values in (("player", profiles.get("player")), ("agent", profiles.get("agent")),
                          ("weapon", profiles.get("weapons", {}).get(weapon_id)),
                          ("agent_weapon", profiles.get("agent_weapons", {}).get(weapon_id))):
        for field, value in summary(values).items():
            row[f"history_{scope}_{field}"] = value
    return row


def build_dataset(matches, catalog=None):
    catalog = catalog or catalog_snapshot()
    unique = {str((m.get("matchInfo") or {}).get("matchId")): m for m in matches
              if (m.get("matchInfo") or {}).get("isRanked") and text_id((m.get("matchInfo") or {}).get("matchId"))
              and (number((m.get("matchInfo") or {}).get("gameStartMillis")) or 0) > 0}
    ordered = sorted(unique.values(), key=lambda m: (m["matchInfo"]["gameStartMillis"], m["matchInfo"]["matchId"]))
    histories = defaultdict(lambda: defaultdict(lambda: [0, 0, 0, 0]))
    ranks = {}
    output = []
    for _, group in groupby(ordered, key=lambda m: m["matchInfo"]["gameStartMillis"]):
        pending = []
        for match in group:
            rows = match_rows(match, catalog)
            for row in rows:
                pid, agent = row["puuid"], row["agent_id"]
                h = histories[pid]
                profiles = {"player": h.get(("player",)), "agent": h.get(("agent", agent)),
                            "weapons": {k[1]: v for k, v in h.items() if k[0] == "weapon"},
                            "agent_weapons": {k[2]: v for k, v in h.items() if k[:2] == ("agent_weapon", agent)}}
                row["history_profiles"] = json.dumps(profiles, separators=(",", ":"))
                row["prior_rank"] = ranks.get(pid)
                apply_history(row, profiles)
            pending.extend(rows)
        for row in pending:
            if row["round_won"] is None:
                continue
            pid, agent, weapon = row["puuid"], row["agent_id"], row["weapon_id"]
            for key in (("player",), ("agent", agent), ("weapon", weapon), ("agent_weapon", agent, weapon)):
                values = histories[pid][key]
                # Weapon performance is explicitly associated with the starting loadout,
                # not falsely presented as damage attributed to that weapon.
                for i, value in enumerate((1, row["round_won"], row["round_kills"], row["round_damage"])):
                    values[i] += value
            if row["rank_observed"] is not None:
                ranks[pid] = row["rank_observed"]
        output.extend(pending)
    return pd.DataFrame(output)
