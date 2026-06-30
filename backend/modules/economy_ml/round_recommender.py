from __future__ import annotations

from dataclasses import replace
from typing import Any

from .inventory import PlayerInventoryState
from .economy_ledger import infer_player_survived_round
from .ability_catalog import agent_abilities, get_agent_ability_catalog
from .purchase_inference import PurchaseInferenceEngine
from .recommendation_explainer import RecommendationExplainer
from .team_buy_solver import TeamBuySolver
from .display_normalizer import normalize_observed_economy
from .ability_usage import build_ability_usage_state
from .armor_durability import build_armor_durability_state
from .enemy_economy import build_enemy_economy_context
from .map_context import build_map_context
from .player_profile import build_player_profile
from .site_tendencies import build_site_tendencies
from .ultimate_state import build_ultimate_state


class RoundEconomyRecommender:
    """Player-first facade used by API/UI code and post-match analysis."""
    def __init__(self) -> None:
        self.inference = PurchaseInferenceEngine()
        self.solver = TeamBuySolver()
        self.explainer = RecommendationExplainer()

    def recommend(self, *, round_number: int, team_id: str, side: str,
                  inventories: list[PlayerInventoryState], observed: dict[str, dict],
                  player_meta: dict[str, dict] | None = None, context: dict | None = None,
                  score_before: Any = None) -> dict:
        context = {**(context or {}), "round_number": round_number}
        if is_inventory_reset_round(context, round_number):
            inventories = [replace(
                item, weapon_before_buy=None, armor_before_buy=None,
                survived_previous_round=None, died_previous_round=None,
                weapon_source="unknown", armor_source="unknown",
            ) for item in inventories]
        inferred = self.inference.infer_team(inventories, observed, context=context)
        meta = player_meta or {}
        plan = self.solver.solve(
            inventories,
            agents={puuid: str(data.get("agent") or "") for puuid, data in meta.items()},
            context=context,
        )
        return self.explainer.explain(
            round_number=round_number, team_id=team_id, side=side, score_before=score_before,
            observed=observed, inferred=inferred, plan=plan, player_meta=meta,
            context=context,
        )


def is_inventory_reset_round(context: dict, round_number: int) -> bool:
    return (
        bool(context.get("is_pistol_round"))
        or round_number in {1, 13}
        or bool(context.get("is_overtime"))
        or bool(context.get("is_half_reset"))
    )


def recommend_round_economy(**kwargs: Any) -> dict:
    return RoundEconomyRecommender().recommend(**kwargs)


def recommend_match_economy(match: dict) -> dict:
    """Return legal recommendations even when no trained ML artifact exists."""
    from .state_extractor import extract_match_round_states

    rounds = match.get("roundResults") or []
    players = match.get("players") or []
    output = []
    all_states = list(extract_match_round_states(match))
    for state in all_states:
        index = int(state.get("round_number") or 1) - 1
        round_obj = rounds[index] if 0 <= index < len(rounds) else {}
        stats = {str(s.get("puuid")): s for s in round_obj.get("playerStats") or [] if s.get("puuid")}
        previous = rounds[index-1] if index > 0 else None
        reset_inventory = is_inventory_reset_round(state, int(state.get("round_number") or 1))
        credit_map = state.get("team_player_credit_estimates") or {}
        team_players = [p for p in players if p.get("teamId") == state.get("team_id") and p.get("puuid")]
        enemy_state = next((item for item in all_states
                            if item.get("round_number") == state.get("round_number")
                            and item.get("team_id") != state.get("team_id")), None)
        advanced_context = {
            "map_context": build_map_context(match, round_number=int(state.get("round_number") or 1),
                                             side=state.get("side")).to_dict(),
            "site_tendencies": build_site_tendencies(match, round_number=int(state.get("round_number") or 1),
                                                     team_id=str(state.get("team_id") or "")).to_dict(),
            "enemy_economy": build_enemy_economy_context(enemy_state, previous_round=previous).to_dict(),
            "player_profiles": {}, "ultimates": {}, "armor_durability": {}, "ability_usage": {},
        }
        inventories: list[PlayerInventoryState] = []
        observed: dict[str, dict] = {}
        meta: dict[str, dict] = {}
        for player in team_players:
            puuid = str(player["puuid"])
            economy = (stats.get(puuid) or {}).get("economy") or {}
            previous_stat = next((s for s in (previous or {}).get("playerStats") or [] if str(s.get("puuid")) == puuid), {})
            previous_economy = previous_stat.get("economy") or {}
            normalized = normalize_observed_economy(economy)
            previous_normalized = normalize_observed_economy(previous_economy)
            survived = infer_player_survived_round(previous, puuid) if previous else None
            if reset_inventory:
                survived = None
            agent = str(player.get("characterName") or player.get("agentName") or player.get("characterId") or "")
            free_abilities = {
                str(ability.get("name")): int(ability.get("free_charges_at_round_start") or 0)
                for ability in agent_abilities(agent)
                if int(ability.get("free_charges_at_round_start") or 0) > 0
            }
            inventories.append(PlayerInventoryState(
                puuid=puuid, credits_before_buy=float(credit_map.get(puuid) or 0),
                weapon_before_buy=None if reset_inventory else previous_normalized["weapon"] if survived else None,
                weapon_after_buy=normalized["weapon"],
                armor_before_buy=None if reset_inventory else previous_normalized["armor"] if survived else None,
                armor_after_buy=normalized["armor"],
                survived_previous_round=survived,
                died_previous_round=None if survived is None else not survived,
                free_abilities_granted=free_abilities,
            ))
            advanced_context["player_profiles"][puuid] = build_player_profile(
                match, puuid, round_number=int(state.get("round_number") or 1),
            ).to_dict()
            advanced_context["ultimates"][puuid] = build_ultimate_state(
                previous, puuid=puuid, agent=agent, round_number=int(state.get("round_number") or 1),
            ).to_dict()
            advanced_context["ability_usage"][puuid] = build_ability_usage_state(
                previous, puuid=puuid, agent=agent, round_number=int(state.get("round_number") or 1),
            ).to_dict()
            advanced_context["armor_durability"][puuid] = build_armor_durability_state(
                previous, puuid=puuid, round_number=int(state.get("round_number") or 1),
                armor_name=None if reset_inventory else previous_normalized["armor"] if survived else None,
                survived=survived, reset=reset_inventory,
            ).to_dict()
            observed[puuid] = normalized
            agent_payload = get_agent_ability_catalog(agent) or {}
            meta[puuid] = {"player_name": player.get("gameName"),
                           "agent": agent,
                           "role": agent_payload.get("role"),
                           "credits_before_buy": credit_map.get(puuid)}
        output.append(recommend_round_economy(
            round_number=state["round_number"], team_id=state["team_id"], side=state.get("side") or "unknown",
            score_before={"team": state.get("team_score_before"), "enemy": state.get("enemy_score_before")},
            inventories=inventories, observed=observed, player_meta=meta,
            context={**state, "side": state.get("side"), "advanced_context": advanced_context},
        ))
    match_id = str((match.get("matchInfo") or {}).get("matchId") or "UNKNOWN")
    return {"available": True, "engine": "player_first_v10", "advanced_engine": "player_first_v11_contextual",
            "match_id": match_id, "rounds": output,
            "limitations": ["Reglas activas; ML auxiliar no cargado."],
            "debug_limitations": ["ml_auxiliary_unavailable_rules_only"]}
