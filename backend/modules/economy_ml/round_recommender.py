from __future__ import annotations

from typing import Any

from .inventory import PlayerInventoryState
from .economy_ledger import infer_player_survived_round
from .purchase_inference import PurchaseInferenceEngine
from .recommendation_explainer import RecommendationExplainer
from .team_buy_solver import TeamBuySolver


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
        inferred = {
            inv.puuid: self.inference.infer(inv, observed_spent=(observed.get(inv.puuid) or {}).get("spent"))
            for inv in inventories
        }
        meta = player_meta or {}
        plan = self.solver.solve(
            inventories,
            agents={puuid: str(data.get("agent") or "") for puuid, data in meta.items()},
            context=context or {},
        )
        return self.explainer.explain(
            round_number=round_number, team_id=team_id, side=side, score_before=score_before,
            observed=observed, inferred=inferred, plan=plan, player_meta=meta,
        )


def recommend_round_economy(**kwargs: Any) -> dict:
    return RoundEconomyRecommender().recommend(**kwargs)


def recommend_match_economy(match: dict) -> dict:
    """Return legal recommendations even when no trained ML artifact exists."""
    from .state_extractor import extract_match_round_states

    rounds = match.get("roundResults") or []
    players = match.get("players") or []
    player_by_id = {str(p.get("puuid")): p for p in players if p.get("puuid")}
    output = []
    for state in extract_match_round_states(match):
        index = int(state.get("round_number") or 1) - 1
        round_obj = rounds[index] if 0 <= index < len(rounds) else {}
        stats = {str(s.get("puuid")): s for s in round_obj.get("playerStats") or [] if s.get("puuid")}
        previous = rounds[index-1] if index > 0 else None
        credit_map = state.get("team_player_credit_estimates") or {}
        team_players = [p for p in players if p.get("teamId") == state.get("team_id") and p.get("puuid")]
        inventories: list[PlayerInventoryState] = []
        observed: dict[str, dict] = {}
        meta: dict[str, dict] = {}
        for player in team_players:
            puuid = str(player["puuid"])
            economy = (stats.get(puuid) or {}).get("economy") or {}
            previous_stat = next((s for s in (previous or {}).get("playerStats") or [] if str(s.get("puuid")) == puuid), {})
            previous_economy = previous_stat.get("economy") or {}
            survived = infer_player_survived_round(previous, puuid) if previous else None
            inventories.append(PlayerInventoryState(
                puuid=puuid, credits_before_buy=float(credit_map.get(puuid) or 0),
                weapon_before_buy=previous_economy.get("weapon") if survived else None,
                weapon_after_buy=economy.get("weapon"),
                armor_before_buy=previous_economy.get("armor") if survived else None,
                armor_after_buy=economy.get("armor"),
                survived_previous_round=survived,
                died_previous_round=None if survived is None else not survived,
            ))
            observed[puuid] = {"weapon": economy.get("weapon"), "armor": economy.get("armor"),
                               "loadoutValue": economy.get("loadoutValue"), "spent": economy.get("spent"),
                               "remaining": economy.get("remaining")}
            meta[puuid] = {"player_name": player.get("gameName"),
                           "agent": player.get("characterName") or player.get("agentName") or player.get("characterId"),
                           "credits_before_buy": credit_map.get(puuid)}
        output.append(recommend_round_economy(
            round_number=state["round_number"], team_id=state["team_id"], side=state.get("side") or "unknown",
            score_before={"team": state.get("team_score_before"), "enemy": state.get("enemy_score_before")},
            inventories=inventories, observed=observed, player_meta=meta, context=state,
        ))
    match_id = str((match.get("matchInfo") or {}).get("matchId") or "UNKNOWN")
    return {"available": True, "engine": "player_first_v10", "match_id": match_id, "rounds": output,
            "limitations": ["ML is auxiliary; when unavailable the rules scorer remains active."]}
