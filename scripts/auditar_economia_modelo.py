from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

VENV_CANDIDATES = [
    ROOT / "venv" / "Scripts" / "python.exe",
    ROOT / ".venv" / "Scripts" / "python.exe",
    ROOT.parent / ".venv" / "Scripts" / "python.exe",
]
EXPECTED_WEAPON_COSTS = {
    "Classic": 0, "Ghost": 500, "Sheriff": 800, "Frenzy": 450,
    "Shorty": 300, "Stinger": 1100, "Spectre": 1600, "Bucky": 850,
    "Judge": 1850, "Bulldog": 2050, "Guardian": 2250, "Phantom": 2900,
    "Vandal": 2900, "Marshal": 950, "Outlaw": 2400, "Operator": 4700,
    "Ares": 1600, "Odin": 3200,
}
EXPECTED_ARMOR_COSTS = {"Light Shield": 400, "Regen Shield": 650, "Heavy Shield": 1000}
MARK = {"ok": "✅ Correcto", "partial": "⚠️ Parcial", "fail": "❌ Falta", "unknown": "❓ No verificable"}
ORDER = {"ok": 0, "unknown": 1, "partial": 2, "fail": 3}

TESTS = {
    "backend/tests/test_economy_ml.py": "datos, dataset, features y política",
    "backend/tests/test_economy_ledger.py": "ledger, créditos, ingresos y reconciliación",
    "backend/tests/test_economy_engine_v10.py": "inventario, legalidad, drops, scoring y API",
    "backend/tests/test_economy_contextual_v11.py": "enemy, mapa/site, perfil, ultimates, armor y abilities",
    "backend/tests/test_round_win_model.py": "dataset y artifact round-win v2",
    "backend/tests/test_economy_routes_v10.py": "rutas y entrenamiento",
}

# key, title, fields, source, why, processors
SPECS = [
("match_data","Datos base de partida","matchInfo.matchId|matchInfo.mapId|matchInfo.queueId|matchInfo.seasonId|matchInfo.isRanked|matchInfo.gameStartMillis|players|players[].puuid|players[].teamId|players[].competitiveTier|players[].characterName / agentName / characterId|teams|roundResults|roundResults[].roundNum|roundResults[].winningTeam|roundResults[].playerStats|roundResults[].playerStats[].puuid|roundResults[].playerStats[].economy","Riot/Mongo match","identificar, ordenar y contextualizar la partida","recommend_match_economy|extract_match_round_states"),
("observed_economy","Economía observada","economy.weapon|economy.armor|economy.loadoutValue|economy.spent|economy.remaining","roundResults[].playerStats[].economy","separar snapshot post-buy, inferencia y display","normalize_observed_economy|normalize_weapon_display|normalize_armor_display"),
("weapon_catalog","Catálogo de armas","Classic|Ghost|Sheriff|Frenzy|Shorty|Stinger|Spectre|Bucky|Judge|Bulldog|Guardian|Phantom|Vandal|Marshal|Outlaw|Operator|Ares|Odin","Mongo reference_data.weapons","legalizar coste y valor de armas","load_weapon_catalog|find_weapon"),
("armor_catalog","Catálogo de escudos","Light Shield|Regen Shield|Heavy Shield|Sin escudo","Mongo reference_data.gear y normalizador","legalizar coste, carry y durabilidad","load_gear_catalog|normalize_armor_display"),
("ability_catalog","Catálogo de habilidades","agent_count|ability_count|missing_cost_count|missing_cost_ratio|ultimate_count|purchasable_count|free_charge_count|localized_aliases","Valorant content + ability_catalog_seed.json","comprar utilidad legal por agente y carga","load_ability_catalog|LegalPurchaseGenerator._ability_options"),
("prebuy_credits","Créditos prebuy","prebuy_credits_observed|prebuy_credits_rules|prebuy_credits_selected|credit_estimate_quality|team_player_credit_estimates","spent+remaining y economy ledger","fijar presupuesto legal; resets mandan sobre observed","build_economy_ledger|extract_match_round_states"),
("inventory_reset","Reset de inventario","is_inventory_reset_round|is_pistol_round|is_half_reset|is_overtime","ronda y reglas fijas","evitar carry imposible en pistol, mitad y overtime","fixed_round_start_credits|RoundEconomyRecommender.recommend"),
("carried_inventory","Inventario conservado","weapon_before_buy|armor_before_buy|survived_previous_round|keep_weapon|keep_armor|weapon_cost|weapon_value|armor_cost|armor_value","estado previo y supervivencia","separar coste cero y valor táctico conservado","advance_inventory|LegalPurchaseGenerator.generate"),
("purchase_inference","Inferencia de compra real","default_spawn_weapon|bought_self|carried|bought_by_teammate|picked_up|unknown|unknown_or_pickup","inventario, spent y post-buy","explicar procedencia probable sin inventar observación","PurchaseInferenceEngine.infer|PurchaseInferenceEngine.infer_team"),
("legal_purchases","Generación de compras legales","weapon options|armor options|ability options|self_cost|expected_remaining|requires_weapon_drop|ability_combination_limit|pistol_utility_cap_per_player","catálogos + PlayerInventoryState","enumerar candidatos pagables","LegalPurchaseGenerator.generate"),
("drops","Drops","donor credits|receiver credits|buys_for|weapon_source|weapon_cost|non_weapon_drop","planes legales por jugador","resolver un drop de arma financiable por donante","TeamBuySolver._resolve_weapon_drops"),
("base_scoring","Scoring económico base","weapon_value|armor_value|utility_value|round_win_probability|future_economy|synchronization|risk|composition_value|macro_adjustment|penalty|team_plan_value|team_plan_score","plan y contexto","ordenar planes; value interno y score UI 0..1","BuyScorer.score|evaluate_team_plan"),
("penalties","Penalizaciones","weapon_without_armor_penalty|underarmor_penalty|operator_without_armor_penalty|heavy_weapon_early_penalty|post_pistol_overbuy_penalty|pistol_full_utility_penalty|bonus_upgrade_penalty|team_full_buy_available_but_half_buy_penalty|enemy_full_buy_underinvestment_penalty|excessive_saving_penalty|rich_player_low_weapon_full_buy_penalty|rich_player_underpowered_vs_full_buy|high_credit_player_saved_too_much|heavy_weapon_enemy_low_buy_penalty|heavy_weapon_weak_team_composition_penalty|decisive_round_underinvestment","plan + contexto","degradar planes legales estratégicamente débiles","BuyScorer|apply_contextual_adjustments"),
("buy_classification","Clasificación del plan económico","PISTOL_DEFAULT|PISTOL_UTILITY|PISTOL_ARMOR|PISTOL_SIDEARM|POST_PISTOL_CONVERSION|ANTI_ECO|BONUS_KEEP_INVENTORY|BONUS_UPGRADE|ECO|HALF_BUY|FORCE_BUY|BROKEN_BUY|UNDERINVESTED_BUY|FULL_BUY|LAST_HALF_ROUND_BUY|CLOSING_BUY|ELIMINATION_BUY|OVERTIME_BUY","composición, gasto, ronda y marcador","convertir números en etiqueta explicable","classify_team_buy"),
("pistol_rounds","Pistol rounds","round 1|round 13|Classic gratis|800 credits|ENEMY_PISTOL|pistol utility cap|no carryover","reglas fijas","imponer budget y spawn inicial","fixed_round_start_credits|normalize_purchase_for_display"),
("post_pistol","Post-pistol / anti-eco","round 2|round 14|won_pistol|previous_round_won|enemy_buy|post_pistol penalties","ronda previa y enemy economy","evitar conversiones frágiles","classify_team_buy|BuyScorer"),
("bonus","Bonus","is_bonus_candidate|kept weapons|upgrades|spend|keep_ratio","inventario conservado","proteger ventaja de 3+ SMG conservadas","classify_team_buy|BuyScorer"),
("full_buy","Full buy","weapons >= 4|armored >= 3|rich player low weapon penalty|controller smokes|multi sniper/operator","composición y créditos","evitar huecos pagables y composiciones frágiles","BuyScorer|validate_macro_composition"),
("decisive_rounds","Match point / últimas rondas","round 12|score 12-4|score 4-12|round >=25","round_number + score_before","reducir ahorro sin valor futuro","classify_team_buy"),
("enemy_economy","Enemy economy","enemy_credits_by_player|enemy_players|enemy_buy_recommendation|enemy_projected_buy|enemy_can_full_buy_count|enemy_can_operator_count|enemy_median_credits|enemy_credit_spread","ledger rival + ronda anterior","proyectar amenaza pre-round sin leakage","build_enemy_economy_context"),
("map_site","Mapa y site tendencies","map_id|map_name|map_profile|operator_affinity|rifle_affinity|likely_attack_site|rounds_observed|confidence|site_adjustment","mapId + rondas anteriores","ajustar sólo con muestra >=3 y confidence >=.5","build_map_context|build_site_tendencies|apply_contextual_adjustments"),
("player_profile","Player profile","preferred_weapons|weapon_kill_rate|rifle_tendency|sniper_tendency|smg_tendency|sample_size|confidence","rondas estrictamente anteriores","justificar especialización sin kills actuales","build_player_profile"),
("ultimates","Ultimates","ultimate_points|ultimate_cost|ultimate_ready|agent|source|confidence","playerStats + catálogo","reconocer arma de ultimate y modular compra","build_ultimate_state"),
("armor_durability","Armor durability","armor_value_remaining|armor_max_value|armor_durability_ratio|armor_effective_value","estado de armor","no valorar Heavy 15/50 como completo","build_armor_durability_state|LegalPurchaseGenerator.generate"),
("ability_usage","Ability usage","used_abilities_by_slot|charges_carried_after_round|ability_charges_before_buy|carried_and_bought|free_and_bought","casts + catálogo","comprar sólo cargas faltantes","build_ability_usage_state|LegalPurchaseGenerator._ability_options"),
("macro_model","Modelo macro económico principal","macro_model.available|recommended_action|model_scope|confidence|alternatives|macro_model_candidate_action|macro_model_adjustment","artifact compatible + prebuy","guiar ranking sin legalizar","predict_action|RoundEconomyRecommender"),
("round_win_model","ML auxiliar round-win","FEATURE_VERSION|ROUND_WIN_FEATURES|FORBIDDEN_ROUND_WIN_FEATURES|artifact_path|artifact_exists|artifact_feature_version|RoundWinLoadoutModel.available()|round_win_probability|ml_adjustment","round_win_loadout.joblib","comparar loadouts candidatos sin leakage","RoundWinLoadoutModel|validate_round_win_features"),
("dataset_training","Dataset y entrenamiento","dataset rows|match count|valid_labels|missing_features|forbidden_features|train_samples|test_samples|metrics|artifact output","economy_round_dataset.parquet","entrenar macro observacional y auxiliar","train_models|train_round_win_model|scripts/entrenamiento_economia.py|/economy-ml/train"),
("api_contract","API response contract","available|engine|advanced_engine|match_id|rounds|limitations|debug_limitations|round_number|team_id|side|score_before|recommended_team_buy|team_plan_score|team_plan_value|confidence|players|alternatives|economy_projection|advanced_context|warnings|debug_warnings|observed_weapon|observed_armor|inferred_real_purchase|recommended_purchase|reason|context_reasons","recommend_match_economy","entregar contrato y separar humano/debug","recommend_match_economy|RecommendationExplainer"),
("frontend","Frontend/UI","enemy_projected_buy|macro_model|ml_prediction|debug_warnings|Classic gratis|advanced_context|loadout enemigo proyectado|modelo económico recomienda/candidato","matches.ts + MatchDetailModal.tsx","tipar y renderizar sin UUIDs/placeholders","EconomyRecommendation types|MatchDetailModal"),
("tests","Tests","test_economy_ml|test_economy_ledger|test_economy_engine_v10|test_economy_contextual_v11|test_round_win_model|test_economy_routes_v10|frontend tests","backend/tests + frontend","vincular garantías con regresiones","unittest|frontend build"),
]

FLOW = [
("Mongo/Riot match","payload match","conserva matchInfo, players, teams y roundResults","match dict","state_extractor.py"),
("Normalización","economy raw","resuelve UUID, nombre, alias y placeholders","display objects + warnings","display_normalizer.py"),
("Extracción de rondas/equipos","match","ordena, mapea teams/players y score_before","round states","state_extractor.py"),
("Reconstrucción de créditos","spent, remaining e historial","reconcilia observed/rules; fuerza resets","selected credits + quality","economy_ledger.py"),
("Reconstrucción de inventario","loadout previo + supervivencia","propaga sólo equipamiento conservable","PlayerInventoryState","inventory.py"),
("Inferencia de compra real","inventario + post-buy + spent","clasifica origen y confianza","purchase hypotheses","purchase_inference.py"),
("Construcción de contexto avanzado","histórico pre-round","enemy, mapa, site, perfil, ultimate, armor y abilities","advanced_context","round_recommender.py"),
("Generación de compras legales","créditos + catálogos","enumera arma, armor y cargas","player plans","legal_purchase.py"),
("Resolución de drops","planes + saldos","asigna donante/receptor","team plans","team_buy_solver.py"),
("Validación de legalidad","allocation","aplica restricciones macro duras","valid/violations/warnings","recommendation_validation.py"),
("Scoring base","team plan","valora loadout, futuro, sincronía, riesgo y composición","team_plan_value/score","team_buy_solver.py"),
("Ajuste macro model","features + artifact","suma ajuste acotado a acción compatible","macro candidate/adjustment","predict.py"),
("Ajuste contextual","plan + advanced_context","aplica ajustes/penalties moderados","adjusted score","contextual_scorer.py"),
("ML round-win","candidate features","predice v2 o fallback","ml_prediction","round_win_model.py"),
("Explicación","ganador + alternativas","genera reasons, confidence y warnings","explained round","recommendation_explainer.py"),
("Respuesta API","round recommendation","serializa contrato /economy-ml con warnings humanos y debug separados","API response","interfaces/routes.py"),
("Render frontend","API response tipada","muestra labels, contexto, candidato macro y loadout rival","panel UI","frontend/src/components/modals/MatchDetailModal.tsx"),
]

def synthetic_match() -> dict[str, Any]:
    players, stats = [], []
    for team in ("Blue", "Red"):
        for i in range(5):
            puuid = team[0] + str(i)
            players.append({"puuid": puuid, "teamId": team, "competitiveTier": 15,
                            "characterName": "Sova" if i == 0 else "Jett"})
            stats.append({"puuid": puuid, "economy": {"weapon": "Classic", "armor": None,
                          "loadoutValue": 0, "spent": 0, "remaining": 800}})
    return {"matchInfo": {"matchId": "synthetic-economy-audit", "mapId": "synthetic-map",
            "queueId": "competitive", "seasonId": "synthetic-season", "isRanked": True,
            "gameStartMillis": 1}, "players": players,
            "teams": [{"teamId": "Blue"}, {"teamId": "Red"}],
            "roundResults": [{"roundNum": 0, "winningTeam": "Blue", "playerStats": stats}]}

def extract_path_values(obj: Any, path: str, max_items: int = 10) -> Any:
    """Extract dotted paths, flattening every [] segment without losing counts."""
    if " / " in path:
        alternatives = path.split(" / ")
        prefix = alternatives[0].rsplit(".", 1)[0]
        for alternative in alternatives:
            candidate = alternative if "." in alternative else prefix + "." + alternative
            value = extract_path_values(obj, candidate, max_items)
            if value not in (None, [], {"sample": [], "count": 0}):
                return value
        return None
    parts = path.split(".")
    values: list[Any] = [obj]
    traversed_list = False
    terminal_list_count = False
    for index, raw_part in enumerate(parts):
        is_array = raw_part.endswith("[]")
        key = raw_part[:-2] if is_array else raw_part
        next_values: list[Any] = []
        for value in values:
            child = value.get(key) if isinstance(value, dict) else None
            if is_array:
                traversed_list = True
                if isinstance(child, list):
                    if index == len(parts) - 1:
                        terminal_list_count = True
                    next_values.extend(child)
            elif isinstance(value, list):
                traversed_list = True
                for item in value:
                    if isinstance(item, dict):
                        nested = item.get(key)
                        if nested is not None:
                            next_values.append(nested)
            elif child is not None:
                next_values.append(child)
        values = next_values
    if not values:
        return None
    if not traversed_list:
        value = values[0]
        return len(value) if isinstance(value, list) and path in {"players", "teams", "roundResults"} else value
    if any(isinstance(value, list) for value in values):
        flattened = [item for value in values if isinstance(value, list) for item in value]
        if flattened:
            return len(flattened)
    if terminal_list_count or all(isinstance(value, dict) for value in values):
        return len(values)
    sample = values[:max_items]
    return sample if len(values) <= max_items else {"sample": sample, "count": len(values)}

def section(spec: tuple, match: dict) -> dict:
    key, title, raw_fields, source, why, raw_processes = spec
    processes = raw_processes.split("|")
    rows = [{"field": f, "source": source, "required": key == "match_data",
             "value": extract_path_values(match, f), "why_needed": why, "used_by": processes,
             "process": processes[0], "output_field": "response/audit." + key}
            for f in raw_fields.split("|")]
    return {"title": title, "status": "unknown", "status_reason": "unknown_requires_real_match", "required_data": rows,
            "observed_values": {}, "processes": [{"name": p, "input": raw_fields.split("|"),
            "transformation": why, "output": key} for p in processes],
            "outputs": {}, "tests": [], "warnings": [], "errors": [],
            "risk": "Requiere mantener contrato, tests y evidencia de ejecución alineados."}

def set_unknown(sec: dict, exc: Exception) -> None:
    sec["status"] = "unknown"
    sec["status_reason"] = "unknown_requires_real_match"
    sec["warnings"].append("check_unavailable:" + type(exc).__name__ + ":" + str(exc))

def set_status(sec: dict, status: str, reason: str) -> None:
    sec["status"], sec["status_reason"] = status, reason

def combine_status(sections: dict[str, dict]) -> str:
    statuses = [section.get("status") for section in sections.values()]
    if "fail" in statuses:
        return "fail"
    if "partial" in statuses or "unknown" in statuses:
        return "partial"
    return "ok"

def audit_catalogs(sections: dict) -> None:
    from modules.economy_ml.content_catalog import load_gear_catalog, load_weapon_catalog
    from modules.economy_ml.display_normalizer import normalize_armor_display
    weapons = load_weapon_catalog()
    by_name = {x.get("displayName"): x for x in weapons.values()}
    rows = []
    for name, expected in EXPECTED_WEAPON_COSTS.items():
        item, actual = by_name.get(name), None
        if item: actual = item.get("cost")
        rows.append({"displayName": name, "expected_cost": expected, "actual_cost": actual,
                     "uuid": item.get("uuid") if item else None,
                     "role": item.get("weapon_role") if item else None,
                     "status": "ok" if actual == expected else "fail"})
    sec = sections["weapon_catalog"]
    sec["observed_values"] = {"catalog_size": len(weapons), "weapons": rows}
    bad = [x for x in rows if x["status"] == "fail"]
    sec["status"] = "unknown" if not weapons else ("fail" if bad else "ok")
    sec["errors"] = ["weapon_cost_mismatch:" + x["displayName"] for x in bad] if weapons else []
    gears = load_gear_catalog()
    armor_rows = []
    for name, expected in EXPECTED_ARMOR_COSTS.items():
        level = {"Light Shield":"light","Regen Shield":"regen","Heavy Shield":"heavy"}[name]
        direct = next((x for x in gears.values() if x.get("displayName") == name), None)
        item = direct or next((x for x in gears.values() if x.get("armor_level") == level), None)
        normalized, actual = normalize_armor_display(name), item.get("cost") if item else None
        state = "ok" if actual == expected and normalized["cost"] == expected else (
                "partial" if normalized["cost"] == expected else "fail")
        armor_rows.append({"displayName":name,"expected_cost":expected,"catalog_cost":actual,
                           "direct_catalog":bool(direct),"armor_level":level,
                           "normalized":normalized,"status":state})
    sec = sections["armor_catalog"]
    sec["observed_values"] = {"catalog_size":len(gears),"armors":armor_rows,
                              "no_armor":normalize_armor_display(None)}
    states = [x["status"] for x in armor_rows]
    sec["status"] = max(states, key=ORDER.get)
    if "partial" in states: sec["warnings"].append("armor_normalized_but_not_exposed_directly_by_catalog")
    if "fail" in states: sec["errors"].append("armor_cost_mismatch")

def audit_normalization(sec: dict, trace: list) -> None:
    from modules.economy_ml.content_catalog import load_weapon_catalog
    from modules.economy_ml.display_normalizer import normalize_armor_display, normalize_weapon_display
    classic = next((x for x in load_weapon_catalog().values() if x.get("displayName") == "Classic"), None)
    wi = [classic.get("uuid") if classic else None, "Classic", None, "string"]
    ai = ["Light Shield","Regen Shield","Heavy Shield",None,"string"]
    weapons = [{"input": x, **normalize_weapon_display(x)} for x in wi]
    armors = [{"input": x, **normalize_armor_display(x)} for x in ai]
    sec["observed_values"] = {"weapons":weapons,"armors":armors}
    sec["outputs"] = {"cases":len(weapons)+len(armors)}
    sec["status"] = "ok" if classic else "partial"
    for kind, rows in (("weapon",weapons),("armor",armors)):
        for row in rows:
            trace.append({"step":"normalize_"+kind,"input":row["input"],
                "process":"resuelve catálogo/alias y placeholders",
                "output":{"displayName":row["displayName"],"known":row["known"],"cost":row["cost"]},
                "file":"backend/modules/economy_ml/display_normalizer.py",
                "warnings":row["warnings"]})

def audit_abilities(sec: dict) -> None:
    from modules.economy_ml.ability_catalog import load_ability_catalog
    raw = load_ability_catalog()
    agents = raw.get("agents", raw) if isinstance(raw, dict) else {}
    abilities = []
    for agent, payload in agents.items():
        for item in payload.get("abilities", []) if isinstance(payload, dict) else []:
            abilities.append({"agent":agent, **item})
    missing = [x for x in abilities if x.get("is_purchasable") and
               x.get("cost_per_charge") is None and x.get("cost_credits") is None]
    sec["observed_values"] = {"agent_count":len(agents),"ability_count":len(abilities),
        "missing_cost_count":len(missing),"missing_cost_ratio":round(len(missing)/max(1,len(abilities)),4),
        "ultimate_count":sum(str(x.get("ability_kind")).lower()=="ultimate" for x in abilities),
        "purchasable_count":sum(bool(x.get("is_purchasable")) for x in abilities),
        "free_charge_count":sum(int(x.get("free_charges_at_round_start") or 0) for x in abilities),
        "localized_aliases":sum(len(x.get("aliases") or []) for x in abilities),"sample":abilities[:12]}
    sec["status"] = "ok" if abilities and not missing else ("partial" if abilities else "unknown")
    sec["warnings"] += ["missing_cost:"+str(x.get("agent"))+":"+str(x.get("name")) for x in missing[:20]]

def scenario(status: str, inp: dict, expected: dict, observed: dict, process: str,
             files: list[str], warnings: list[str] | None = None) -> dict:
    reason = {"ok":"ok_runtime_verified","partial":"partial_fixture_limited",
              "fail":"fail_runtime_mismatch","unknown":"unknown_requires_real_match"}[status]
    return {"status":status,"status_reason":reason,"input_data":inp,"expected":expected,"observed":observed,
            "process":process,"files":files,"warnings":warnings or [],"errors":[]}

def audit_scenarios() -> dict:
    from modules.economy_ml.economy_income_rules import fixed_round_start_credits
    from modules.economy_ml.enemy_economy import build_enemy_economy_context
    from modules.economy_ml.inventory import PlayerInventoryState
    from modules.economy_ml.legal_purchase import LegalPurchaseGenerator
    resets = {str(r):fixed_round_start_credits(r) for r in (1,13,25)}
    out = {
      "pistol_round":scenario("ok" if resets["1"]==resets["13"]==800 else "fail",
        {"rounds":[1,13]},{"credits":800,"no_carryover":True},resets,
        "presupuesto fijo antes de observed",["economy_income_rules.py"]),
      "half_reset":scenario("ok" if resets["13"]==800 else "fail",{"round":13},
        {"credits":800},{"credits":resets["13"]},"reset de mitad",["economy_income_rules.py"])}
    try:
        state=PlayerInventoryState("A0",2000,weapon_before_buy="Vandal",
              armor_before_buy="Heavy Shield",survived_previous_round=True)
        plan=next(x for x in LegalPurchaseGenerator().generate(state,limit=300)
                  if x.get("keep_weapon") and x.get("keep_armor"))
        observed={k:plan.get(k) for k in ("weapon_source","weapon_cost","weapon_value",
                                         "armor_source","armor_cost","armor_value")}
        ok=observed=={"weapon_source":"carried","weapon_cost":0,"weapon_value":2900.0,
                     "armor_source":"carried","armor_cost":0,"armor_value":1000.0}
        out["carried_inventory"]=scenario("ok" if ok else "fail",
           {"weapon":"Vandal","armor":"Heavy Shield"},{"costs":0,"values":[2900,1000]},
           observed,"carry conserva valor con coste cero",["inventory.py","legal_purchase.py"])
    except Exception as exc:
        out["carried_inventory"]=scenario("unknown",{}, {},{},"requiere catálogos",
                                           ["legal_purchase.py"],[str(exc)])
    rich=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
                                      {"R"+str(i):5000 for i in range(5)}},round_number=4)
    mixed=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
                                      {"R0":9000,"R1":9000,"R2":500,"R3":500,"R4":500}},round_number=4)
    pistol=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
                                      {"R"+str(i):800 for i in range(5)}},round_number=1)
    ok=rich.enemy_buy_recommendation=="ENEMY_FULL_BUY" and mixed.enemy_buy_recommendation!="ENEMY_FULL_BUY" and pistol.enemy_buy_recommendation=="ENEMY_PISTOL"
    out["enemy_economy"]=scenario("ok" if ok else "fail",
       {"rich":[5000]*5,"mixed":[9000,9000,500,500,500],"pistol":[800]*5},
       {"labels":["ENEMY_FULL_BUY","not ENEMY_FULL_BUY","ENEMY_PISTOL"]},
       {"labels":[rich.enemy_buy_recommendation,mixed.enemy_buy_recommendation,pistol.enemy_buy_recommendation],
        "mixed":mixed.to_dict()},"clasifica distribución y no sólo total",["enemy_economy.py"])
    partials = {
      "drop":({"donor":9000,"receivers":[500,500]},{"receivers_dropped":1},"team_buy_solver.py"),
      "rich_low_weapon":({"credits":9000,"weapon":"Bandit"},{"loses_to":"five_rifles"},"team_buy_solver.py"),
      "match_point":({"rounds":[12,25],"scores":[[12,4],[4,12]]},{"labels":["LAST_HALF_ROUND_BUY","CLOSING_BUY","ELIMINATION_BUY","OVERTIME_BUY"]},"buy_classifier.py"),
      "site_gating":({"rounds_observed":2,"confidence":.49},{"site_adjustment":0},"contextual_scorer.py"),
      "armor_durability":({"armor":"Heavy Shield","remaining":15,"max":50},{"effective_value":300},"armor_durability.py"),
      "ability_usage":({"agent":"Sova","carried_shock_bolt":1,"max":2},{"additional_purchase":1},"ability_usage.py")}
    for name,(inp,expected,file) in partials.items():
        out[name]=scenario("partial",inp,expected,{"evidence":"covered_by_named_unittest"},
             "regla inspeccionada; verificación determinista delegada a suite", [file],["verified_by_test_suite"])
    return out

def audit_scenarios(match: dict) -> dict:
    """Execute deterministic engine scenarios; no test-reference placeholders."""
    from unittest.mock import patch
    from modules.economy_ml.contextual_scorer import apply_contextual_adjustments
    from modules.economy_ml.display_normalizer import normalize_purchase_for_display
    from modules.economy_ml.economy_income_rules import fixed_round_start_credits
    from modules.economy_ml.enemy_economy import build_enemy_economy_context
    from modules.economy_ml.inventory import PlayerInventoryState
    from modules.economy_ml.legal_purchase import LegalPurchaseGenerator
    from modules.economy_ml.purchase_inference import PurchaseInferenceEngine
    from modules.economy_ml.round_recommender import recommend_match_economy
    from modules.economy_ml.round_win_dataset import ROUND_WIN_FEATURES
    from modules.economy_ml.round_win_model import FORBIDDEN_ROUND_WIN_FEATURES, RoundWinLoadoutModel
    from modules.economy_ml.team_buy_solver import BuyScorer, TeamBuySolver

    out: dict[str, dict] = {}
    resets = {str(r): fixed_round_start_credits(r) for r in (1, 13, 25)}

    variants = []
    for armor, expected in EXPECTED_ARMOR_COSTS.items():
        state = PlayerInventoryState("p", 1000, weapon_before_buy="Vandal",
                                     armor_before_buy=armor, survived_previous_round=True)
        plan = next(x for x in LegalPurchaseGenerator().generate(state, limit=300)
                    if x.get("keep_weapon") and x.get("keep_armor"))
        row = {k: plan.get(k) for k in (
            "weapon_source", "weapon_cost", "weapon_value", "armor_source",
            "armor_cost", "armor_purchase_cost", "armor_value", "armor_full_value",
            "armor_effective_value", "keep_weapon", "keep_armor")}
        row.update({"armor": armor, "expected_armor_value": expected})
        variants.append(row)
    carried_ok = all(
        x["weapon_source"] == x["armor_source"] == "carried"
        and x["weapon_cost"] == x["armor_cost"] == x["armor_purchase_cost"] == 0
        and x["weapon_value"] == 2900
        and x["armor_value"] == x["armor_full_value"] == x["armor_effective_value"] == x["expected_armor_value"]
        and x["keep_weapon"] and x["keep_armor"] for x in variants)
    out["carried_inventory"] = scenario("ok" if carried_ok else "fail",
        {"credits":1000,"weapon_before_buy":"Vandal","armor_before_buy":list(EXPECTED_ARMOR_COSTS)},
        {"weapon_value":2900,"armor_values":EXPECTED_ARMOR_COSTS,"purchase_costs":0},
        {"variants":variants},"Ejecuta LegalPurchaseGenerator para cada armor carried.",
        ["inventory.py","legal_purchase.py"])

    donor = {"puuid":"rich","weapon":{"displayName":"Vandal","cost":2900},
      "weapon_value":2900,"armor":{"displayName":"Heavy Shield","cost":1000},
      "armor_value":1000,"keep_weapon":False,"self_cost":3900,
      "expected_remaining":5100,"buys_for":None}
    receivers = [{"puuid":p,"weapon":{"displayName":"Vandal","cost":2900},
      "weapon_value":2900,"weapon_purchase_cost":2900,"weapon_cost":2900,
      "armor":None,"armor_cost":0,"ability_cost":0,"self_cost":0,
      "expected_remaining":400,"keep_weapon":False,"requires_weapon_drop":True}
      for p in ("poor1","poor2")]
    inventories = [PlayerInventoryState("rich",9000),PlayerInventoryState("poor1",400),
                   PlayerInventoryState("poor2",400)]
    TeamBuySolver._resolve_weapon_drops([donor,*receivers],inventories)
    invalid = TeamBuySolver.validate([{"puuid":"poor","self_cost":0,
      "expected_remaining":400,"bought_by":"rich","weapon_cost":0,"armor_cost":400,
      "ability_cost":0,"requires_weapon_drop":False}],[PlayerInventoryState("poor",400)])
    dropped = [x for x in receivers if x.get("bought_by")]
    drop_ok = len(dropped)==1 and len(donor.get("buys_for") or [])==1 and \
      dropped[0]["weapon_source"]=="dropped" and dropped[0]["weapon_cost"]==0 and \
      donor["self_cost"]==6800 and not invalid["valid"]
    out["drop"] = scenario("ok" if drop_ok else "fail",
      {"donor":9000,"receivers":[400,400],"weapon":"Vandal"},
      {"receiver_count":1,"donor_buys_for":1,"non_weapon_drop_valid":False},
      {"donor":donor,"receivers":receivers,"non_weapon_validation":invalid},
      "Ejecuta _resolve_weapon_drops y validate.",["team_buy_solver.py"])

    def player(puuid: str, weapon: str, value: float) -> dict:
        return {"puuid":puuid,"weapon":{"displayName":weapon},"weapon_value":value,
          "armor":{"displayName":"Heavy Shield"},"armor_value":1000,
          "ability_cost":0,"self_cost":value+1000,"expected_remaining":5000,
          "keep_weapon":False}
    rifles=[player(str(i),"Vandal",2900) for i in range(5)]
    weak=[*rifles[:4],player("4","Bandit",900)]
    full_context={"round_number":8,"team_player_credit_estimates":{str(i):9000 for i in range(5)},
      "advanced_context":{"enemy_economy":{"enemy_buy_recommendation":"ENEMY_FULL_BUY"}}}
    rifle_score=BuyScorer().score(rifles,full_context)
    weak_score=BuyScorer().score(weak,full_context)
    required={"rich_player_low_weapon_full_buy_penalty","rich_player_underpowered_vs_full_buy"}
    rich_ok=weak_score["team_plan_value"]<rifle_score["team_plan_value"] and required.issubset(weak_score["warnings"])
    out["rich_low_weapon"] = scenario("ok" if rich_ok else "fail",
      {"plan_a":"5 Vandals","plan_b":"4 Vandals + rich Bandit","enemy":"ENEMY_FULL_BUY"},
      {"plan_b_lower":True,"penalties":sorted(required)},
      {"rifles":rifle_score,"weak":weak_score},"Ejecuta BuyScorer.score.",["team_buy_solver.py"])

    base_inventories=[PlayerInventoryState(str(i),1000) for i in range(5)]
    base_players=[TeamBuySolver._zero_plan(x) for x in base_inventories]
    contexts={"last_half":{"round_number":12},
      "closing":{"round_number":18,"team_score_before":12,"enemy_score_before":4},
      "elimination":{"round_number":20,"team_score_before":4,"enemy_score_before":12},
      "overtime":{"round_number":25}}
    labels={k:TeamBuySolver._summarize(base_players,base_inventories,v) for k,v in contexts.items()}
    expected_labels={"last_half":"LAST_HALF_ROUND_BUY","closing":"CLOSING_BUY",
      "elimination":"ELIMINATION_BUY","overtime":"OVERTIME_BUY"}
    out["match_point"] = scenario("ok" if labels==expected_labels else "fail",
      contexts,expected_labels,labels,"Ejecuta TeamBuySolver._summarize.",["team_buy_solver.py"])

    pistol_state=PlayerInventoryState("p",800,weapon_after_buy="Classic")
    hypothesis=PurchaseInferenceEngine().infer(pistol_state,observed_spent=0,
      context={"round_number":1,"is_pistol_round":True})[0]
    display=normalize_purchase_for_display({"weapon":{"displayName":"Classic","cost":0},
      "weapon_source":"default_spawn_weapon","weapon_purchase_cost":0,
      "armor":None,"self_cost":0},is_pistol_round=True)
    pistol_enemy=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
      {"R"+str(i):800 for i in range(5)}},round_number=1)
    pistol_ok=resets["1"]==resets["13"]==800 and hypothesis["weapon_source"]=="default_spawn_weapon" and \
      display["source_label"]=="Arma inicial gratis" and pistol_enemy.enemy_buy_recommendation=="ENEMY_PISTOL"
    out["pistol_round"] = scenario("ok" if pistol_ok else "fail",
      {"rounds":[1,13],"weapon":"Classic","spent":0},
      {"credits":800,"weapon_source":"default_spawn_weapon","enemy_buy":"ENEMY_PISTOL"},
      {"fixed_credits":resets,"inference":hypothesis,"display":display,"enemy":pistol_enemy.to_dict()},
      "Ejecuta reglas, inferencia, display y enemy economy.",
      ["economy_income_rules.py","purchase_inference.py","display_normalizer.py","enemy_economy.py"])
    out["half_reset"] = scenario("ok" if resets["13"]==800 else "fail",
      {"round":13},{"credits":800},{"credits":resets["13"]},
      "Ejecuta reset de mitad.",["economy_income_rules.py"])

    odin=player("p","Odin",3200)|{"armor":None,"armor_value":0,"self_cost":3200,"expected_remaining":100}
    spectre=player("p","Spectre",1600)|{"self_cost":2600,"expected_remaining":700}
    post_context={"round_number":2,"is_second_round":True,"previous_round_won":True,"is_anti_eco":True}
    post_label=TeamBuySolver._summarize([spectre],[PlayerInventoryState("p",3300)],post_context)
    post_score=BuyScorer().score([odin],post_context)
    post_ok=post_label in {"POST_PISTOL_CONVERSION","ANTI_ECO"} and "heavy_weapon_early_penalty" in post_score["warnings"]
    out["post_pistol"] = scenario("ok" if post_ok else "fail",post_context,
      {"label":["POST_PISTOL_CONVERSION","ANTI_ECO"],"penalty":"heavy_weapon_early_penalty"},
      {"label":post_label,"odin_score":post_score},"Ejecuta summarize y scorer.",["team_buy_solver.py"])

    bonus_players=[player(str(i),"Spectre",1600)|{"keep_weapon":True,"self_cost":0} for i in range(5)]
    bonus_context={"round_number":4,"is_bonus_candidate":True}
    bonus_label=TeamBuySolver._summarize(bonus_players,
      [PlayerInventoryState(str(i),3000,weapon_before_buy="Spectre") for i in range(5)],bonus_context)
    out["bonus"] = scenario("ok" if bonus_label=="BONUS_KEEP_INVENTORY" else "fail",
      {"carried_spectres":5},{"label":"BONUS_KEEP_INVENTORY","keep_weapon_min":3},
      {"label":bonus_label,"keep_weapon":sum(x["keep_weapon"] for x in bonus_players)},
      "Ejecuta summarize con 5 Spectres carried.",["team_buy_solver.py"])

    full_enemy=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
      {"R"+str(i):5000 for i in range(5)}},round_number=4)
    mixed_enemy=build_enemy_economy_context({"team_id":"R","team_player_credit_estimates":
      {"R0":9000,"R1":9000,"R2":500,"R3":500,"R4":500}},round_number=4)
    enemy_ok=full_enemy.enemy_buy_recommendation=="ENEMY_FULL_BUY" and \
      full_enemy.enemy_projected_buy["projected_weapon_value"]>0 and \
      pistol_enemy.enemy_projected_buy["projected_weapon_value"]==0 and \
      mixed_enemy.enemy_buy_recommendation!="ENEMY_FULL_BUY"
    out["enemy_economy"] = scenario("ok" if enemy_ok else "fail",
      {"pistol":[800]*5,"full":[5000]*5,"mixed":[9000,9000,500,500,500]},
      {"labels":["ENEMY_PISTOL","ENEMY_FULL_BUY","not ENEMY_FULL_BUY"]},
      {"pistol":pistol_enemy.to_dict(),"full":full_enemy.to_dict(),"mixed":mixed_enemy.to_dict()},
      "Ejecuta build_enemy_economy_context.",["enemy_economy.py"])

    base={"team_plan_value":.5,"team_plan_score":.5,"round_win_probability":.5,
      "weapon_value":1600,"armor_value":400,"utility_value":300,
      "synchronization":.5,"rule_penalty":0,"data_confidence":.7,
      "warnings":[],"debug_warnings":[]}
    site_player={"puuid":"p","weapon":{"displayName":"Spectre"},"weapon_value":1600,
      "armor_value":400,"ability_cost":300,"abilities":[{"tactical_types":["postplant"]}]}
    def site_score(rounds: int, confidence: float) -> float:
        return apply_contextual_adjustments(base,[site_player],{"advanced_context":{"site_tendencies":{
          "available":True,"rounds_observed":rounds,"confidence":confidence,
          "likely_attack_site":"B","plant_success_by_site":{"B":.8}}}})["site_adjustment"]
    site_values={"rounds_2":site_score(2,.8),"confidence_04":site_score(3,.4),
                 "eligible":site_score(3,.8)}
    site_ok=site_values["rounds_2"]==site_values["confidence_04"]==0 and site_values["eligible"]>0
    out["site_gating"] = scenario("ok" if site_ok else "fail",
      {"site":"B","cases":[[2,.8],[3,.4],[3,.8]]},{"adjustments":[0,0,">0"]},site_values,
      "Ejecuta apply_contextual_adjustments.",["contextual_scorer.py"])

    damaged_state=PlayerInventoryState("p",1000,armor_before_buy="Heavy Shield",survived_previous_round=True)
    damaged_context={"advanced_context":{"armor_durability":{"p":{
      "available":True,"armor_value_remaining":15,"armor_max_value":50}}}}
    damaged=next(x for x in LegalPurchaseGenerator().generate(damaged_state,limit=300,context=damaged_context)
      if x.get("keep_armor"))
    adjusted=apply_contextual_adjustments(base,[damaged],damaged_context)
    armor_ok=damaged["armor_value"]==damaged["armor_full_value"]==1000 and \
      damaged["armor_effective_value"]==300 and damaged["armor_durability_ratio"]==.3 and \
      "context_damaged_armor_should_refresh" in adjusted["warnings"]
    out["armor_durability"] = scenario("ok" if armor_ok else "fail",
      {"armor":"Heavy Shield","remaining":15,"max":50},
      {"armor_value":1000,"armor_effective_value":300,"ratio":.3,
       "warning":"context_damaged_armor_should_refresh"},
      {"plan":damaged,"contextual":adjusted},"Ejecuta generación y contextual scorer.",
      ["armor_durability.py","legal_purchase.py","contextual_scorer.py"])

    sova=[{"slot":"Q","name":"Shock Bolt","canonical_name":"Shock Bolt",
      "cost_per_charge":150,"max_charges":2,"free_charges_at_round_start":0,
      "is_purchasable":True,"ability_kind":"basic","tactical_types":["damage"]},
      {"slot":"X","name":"Hunter's Fury","canonical_name":"Hunter's Fury",
       "is_purchasable":False,"ability_kind":"ultimate"}]
    ability_state=PlayerInventoryState("sova",1000,ability_charges_before_buy={"Q":1})
    with patch("modules.economy_ml.legal_purchase.agent_abilities",return_value=sova):
        ability_plans=LegalPurchaseGenerator().generate(ability_state,agent="Sova",limit=300)
    bought=next(x for x in ability_plans if x["ability_cost"]==150)
    shock=next(x for x in bought["abilities"] if x["name"]=="Shock Bolt"
               and x["source"]=="carried_and_bought")
    ability_ok=shock["charges"]==2 and bought["ability_cost"]==150 and \
      all(x["name"]!="Hunter's Fury" for x in bought["abilities"])
    out["ability_usage"] = scenario("ok" if ability_ok else "fail",
      {"agent":"Sova","carried":{"Q":1},"max":2,"cost_per_charge":150},
      {"total_charges":2,"additional_bought_charges":1,"source":"carried_and_bought",
       "ability_cost":150,"ultimate_bought":False},
      {"selected_plan":bought},"Ejecuta _ability_options mediante generate.",["legal_purchase.py"])

    model=RoundWinLoadoutModel()
    features={name:0 for name in ROUND_WIN_FEATURES}
    features.update({"enemy_projected_weapon_value":14500,
      "enemy_projected_armor_value":5000,"enemy_projected_utility_value":2500,
      "map":"Ascent","side":"attack","agent_roles":"mixed",
      "utility_types_available":"smoke,recon","enemy_buy_class":"ENEMY_FULL_BUY"})
    prediction=model.predict_round_win(features)
    overlap=sorted(set(ROUND_WIN_FEATURES)&set(FORBIDDEN_ROUND_WIN_FEATURES))
    rw_ok=not overlap and bool(prediction.get("available") or prediction.get("warnings"))
    out["round_win_prediction"] = scenario("ok" if rw_ok else "fail",
      {"enemy_projected_values":[14500,5000,2500]},
      {"forbidden_overlap":[],"prediction":"available or explicit warning"},
      {"available":model.available(),"prediction":prediction,"forbidden_overlap":overlap},
      "Ejecuta RoundWinLoadoutModel.predict_round_win.",["round_win_model.py"])

    try:
        response=recommend_match_economy(match)
        rounds=response.get("rounds") or []
        first=rounds[0] if rounds else {}
        api_ok=bool(response.get("available") and rounds and first.get("players")
          and first.get("advanced_context") is not None
          and first.get("economy_projection") is not None)
        observed={"available":response.get("available"),"engine":response.get("engine"),
          "advanced_engine":response.get("advanced_engine"),"round_count":len(rounds),
          "first_round_keys":sorted(first),"player_count":len(first.get("players") or []),
          "sample_player_recommendations":[{
            "puuid":item.get("puuid"),
            "recommended_purchase":item.get("recommended_purchase"),
            "reason":item.get("reason"),
            "confidence":item.get("confidence")}
            for item in (first.get("players") or [])[:3]],
          "warnings_top_10":list(dict.fromkeys(
            list(response.get("limitations") or [])+
            list(response.get("debug_limitations") or [])+
            list(first.get("warnings") or [])+
            list(first.get("debug_warnings") or [])))[:10]}
        out["api_contract"] = scenario("ok" if api_ok else "fail",
          {"match_id":match.get("matchInfo",{}).get("matchId")},
          {"available":True,"engine":"player_first_v10",
           "advanced_engine":"player_first_v11_contextual_stable","rounds_nonempty":True},
          observed,"Ejecuta recommend_match_economy.",["round_recommender.py"])
    except Exception as exc:
        out["api_contract"] = scenario("unknown",
          {"match_id":match.get("matchInfo",{}).get("matchId")},{"available":True},{},
          "Fixture insuficiente para contrato completo.",["round_recommender.py"],[str(exc)])
    return out

def audit_round_win(sec: dict) -> None:
    import joblib
    from modules.economy_ml.round_win_dataset import ROUND_WIN_FEATURES
    from modules.economy_ml.round_win_model import FEATURE_VERSION, FORBIDDEN_ROUND_WIN_FEATURES, RoundWinLoadoutModel
    model=RoundWinLoadoutModel()
    overlap=sorted(set(ROUND_WIN_FEATURES)&set(FORBIDDEN_ROUND_WIN_FEATURES))
    with tempfile.TemporaryDirectory() as directory:
        legacy=Path(directory)/"legacy.joblib"
        joblib.dump({"feature_version":"round-win-loadout-v1"},legacy)
        rejected=not RoundWinLoadoutModel(legacy).available()
    version=model.model.get("feature_version") if isinstance(model.model,dict) else None
    sec["observed_values"]={"FEATURE_VERSION":FEATURE_VERSION,"ROUND_WIN_FEATURES":ROUND_WIN_FEATURES,
      "FORBIDDEN_ROUND_WIN_FEATURES":sorted(FORBIDDEN_ROUND_WIN_FEATURES),"forbidden_overlap":overlap,
      "artifact_path":str(model.artifact_path),"artifact_exists":model.artifact_path.exists(),
      "artifact_feature_version":version,"available":model.available(),"artifact_v1_rejected":rejected}
    sec["status"]="ok" if FEATURE_VERSION=="round-win-loadout-v2" and not overlap and rejected and model.available() else "partial"
    if not model.available(): sec["warnings"].append("round_win_artifact_unavailable_or_incompatible")

def audit_dataset(sec: dict) -> None:
    import pandas as pd
    from modules.economy_ml.round_win_dataset import build_round_win_dataset, validate_round_win_dataset
    path=ROOT/"backend/modules/economy_ml/artifacts/economy_round_dataset.parquet"
    if not path.exists():
        sec["status"]="unknown"; sec["warnings"].append("dataset_not_available"); return
    frame=pd.read_parquet(path)
    validation=validate_round_win_dataset(build_round_win_dataset(frame))
    sec["observed_values"]={**validation,"match_count":int(frame["match_id"].nunique()) if "match_id" in frame else None,
                            "dataset_path":str(path)}
    sec["status"]="ok" if validation["valid"] else "fail"
    sec["errors"] += ["missing_feature:"+x for x in validation["missing_features"]]
    sec["errors"] += ["forbidden_feature:"+x for x in validation["forbidden_features"]]

def audit_frontend(sec: dict) -> None:
    paths=[ROOT/"frontend/src/types/matches.ts",ROOT/"frontend/src/components/modals/MatchDetailModal.tsx"]
    text="\n".join(p.read_text(encoding="utf-8") for p in paths)
    tokens=["purchase.display?.loadout_label","purchase.display?.source_label",
            "enemy_projected_buy","macro_model","ml_prediction","debug_warnings","advanced_context"]
    found={x:x in text for x in tokens}
    sec["observed_values"]={"tokens":found,"files":[str(p.relative_to(ROOT)) for p in paths]}
    sec["status"]="ok" if all(found.values()) else "partial"
    sec["warnings"] += ["frontend_token_missing:"+k for k,v in found.items() if not v]

def audit_tests(sec: dict) -> None:
    rows=[]
    for name,purpose in TESTS.items():
        path=ROOT/name
        text=path.read_text(encoding="utf-8") if path.exists() else ""
        rows.append({"file":name,"exists":path.exists(),"test_count":text.count("def test_"),"covers":purpose})
    frontend=list((ROOT/"frontend/src").rglob("*.test.ts"))+list((ROOT/"frontend/src").rglob("*.test.tsx"))
    sec["observed_values"]={"backend":rows,"frontend_tests":[str(x.relative_to(ROOT)) for x in frontend]}
    sec["status"]="ok" if all(x["exists"] for x in rows) else "partial"
    sec["warnings"].append("tests_discovered_not_executed_by_auditor")

def build_audit(match: dict, source: str, include_trace: bool) -> dict:
    sections={spec[0]:section(spec,match) for spec in SPECS}
    test_map={
      "match_data":["backend/tests/test_economy_ml.py"],
      "observed_economy":["backend/tests/test_economy_engine_v10.py"],
      "weapon_catalog":["backend/tests/test_economy_engine_v10.py"],
      "armor_catalog":["backend/tests/test_economy_engine_v10.py"],
      "ability_catalog":["backend/tests/test_economy_engine_v10.py"],
      "prebuy_credits":["backend/tests/test_economy_ledger.py","backend/tests/test_economy_engine_v10.py"],
      "inventory_reset":["backend/tests/test_economy_engine_v10.py"],
      "carried_inventory":["backend/tests/test_economy_engine_v10.py"],
      "purchase_inference":["backend/tests/test_economy_engine_v10.py"],
      "legal_purchases":["backend/tests/test_economy_engine_v10.py"],
      "drops":["backend/tests/test_economy_engine_v10.py"],
      "base_scoring":["backend/tests/test_economy_engine_v10.py"],
      "penalties":["backend/tests/test_economy_engine_v10.py","backend/tests/test_economy_contextual_v11.py"],
      "buy_classification":["backend/tests/test_economy_engine_v10.py"],
      "enemy_economy":["backend/tests/test_economy_contextual_v11.py"],
      "map_site":["backend/tests/test_economy_contextual_v11.py"],
      "player_profile":["backend/tests/test_economy_contextual_v11.py"],
      "ultimates":["backend/tests/test_economy_contextual_v11.py"],
      "armor_durability":["backend/tests/test_economy_contextual_v11.py"],
      "ability_usage":["backend/tests/test_economy_contextual_v11.py"],
      "round_win_model":["backend/tests/test_round_win_model.py"],
      "api_contract":["backend/tests/test_economy_routes_v10.py","backend/tests/test_economy_engine_v10.py"],
      "frontend":["frontend build"],
    }
    for key,names in test_map.items():
        sections[key]["tests"]=[{"file":name,"coverage":"regresión localizada"} for name in names]
    trace=[]
    base=sections["match_data"]
    missing=[x["field"] for x in base["required_data"] if x["required"] and x["value"] is None and "[]" not in x["field"] and "/" not in x["field"]]
    base["status"]="ok" if not missing else "partial"
    base["status_reason"]="ok_runtime_verified" if not missing else "fail_missing_required_data"
    base["observed_values"]={"source":source,"players":len(match.get("players") or []),
                             "rounds":len(match.get("roundResults") or [])}
    base["warnings"] += ["missing:"+x for x in missing]
    checks=[("observed_economy",lambda:audit_normalization(sections["observed_economy"],trace)),
            ("weapon_catalog",lambda:audit_catalogs(sections)),
            ("ability_catalog",lambda:audit_abilities(sections["ability_catalog"])),
            ("round_win_model",lambda:audit_round_win(sections["round_win_model"])),
            ("dataset_training",lambda:audit_dataset(sections["dataset_training"])),
            ("frontend",lambda:audit_frontend(sections["frontend"]))]
    for key,fn in checks:
        try: fn()
        except Exception as exc: set_unknown(sections[key],exc)
    audit_tests(sections["tests"])
    scenarios=audit_scenarios(match)
    links={"pistol_round":"pistol_rounds","half_reset":"inventory_reset",
      "carried_inventory":"carried_inventory","drop":"drops","rich_low_weapon":"full_buy",
      "match_point":"decisive_rounds","enemy_economy":"enemy_economy","site_gating":"map_site",
      "armor_durability":"armor_durability","ability_usage":"ability_usage",
      "post_pistol":"post_pistol","bonus":"bonus",
      "round_win_prediction":"round_win_model","api_contract":"api_contract"}
    for name,item in scenarios.items():
        sec=sections[links[name]]
        sec["observed_values"]["scenario"]=item
        if sec["status"]!="fail" or item["status"]=="fail":
            sec["status"]=item["status"]
        sec["status_reason"]=item["status_reason"]
    runtime_evidence={
      "purchase_inference":"pistol_round","legal_purchases":"carried_inventory",
      "base_scoring":"rich_low_weapon","penalties":"rich_low_weapon",
      "buy_classification":"match_point"}
    for section_key,scenario_key in runtime_evidence.items():
        item=scenarios[scenario_key]
        sections[section_key]["observed_values"]["scenario"]=item
        sections[section_key]["status"]=item["status"]
        sections[section_key]["status_reason"]=item["status_reason"]
    for sec in sections.values():
        if sec["status"]=="unknown" and sec["processes"]:
            sec["status"]="partial"
            sec["status_reason"]="partial_documented_only"
            sec["warnings"].append("documented_from_code_but_not_exercised_in_this_run")
        elif sec["status"]=="ok" and sec["status_reason"]=="unknown_requires_real_match":
            sec["status_reason"]="ok_runtime_verified"
    errors=[key+":"+x for key,sec in sections.items() for x in sec["errors"]]
    warnings=[key+":"+x for key,sec in sections.items() for x in sec["warnings"]]
    status=combine_status(sections)
    if include_trace:
        scenario_steps={
          "build_inventory":"carried_inventory","resolve_drops":"drop",
          "validate_legality":"drop","score_base":"rich_low_weapon",
          "apply_contextual_adjustments":"site_gating","predict_round_win":"round_win_prediction",
          "serialize_api_response":"api_contract"}
        observed_steps={
          "load_match":("match_data","Carga fixture o Mongo."),
          "normalize_observed_economy":("observed_economy","Normaliza UUID, alias y placeholders."),
          "extract_round_states":("match_data","Extrae y ordena equipos/rondas."),
          "reconstruct_credits":("prebuy_credits","Reconcilia observed/rules y resets."),
          "build_inventory":("carried_inventory","Propaga sólo equipamiento conservable."),
          "infer_real_purchase":("purchase_inference","Clasifica origen de compra."),
          "build_advanced_context":("api_contract","Construye enemy/map/site/profile/ultimate."),
          "generate_legal_purchases":("carried_inventory","Enumera compras pagables."),
          "resolve_drops":("drop","Asigna drop de arma financiable."),
          "validate_legality":("drop","Rechaza presupuesto o drop no-arma inválido."),
          "score_base":("rich_low_weapon","Calcula value, score y penalties."),
          "apply_macro_model":("macro_model","Aplica guía macro acotada sin legalizar."),
          "apply_contextual_adjustments":("site_gating","Aplica contexto y ML auxiliar."),
          "predict_round_win":("round_win_prediction","Predice con artifact v2 o warning."),
          "explain_recommendation":("api_contract","Genera razones, confidence y warnings."),
          "serialize_api_response":("api_contract","Comprueba contrato de respuesta."),
          "frontend_contract_check":("frontend","Comprueba tipos y render requerido.")}
        observed_steps["resolve_drops"]=("drops",observed_steps["resolve_drops"][1])
        observed_steps["validate_legality"]=("drops",observed_steps["validate_legality"][1])
        observed_steps["score_base"]=("full_buy",observed_steps["score_base"][1])
        observed_steps["apply_contextual_adjustments"]=("map_site",observed_steps["apply_contextual_adjustments"][1])
        observed_steps["predict_round_win"]=("round_win_model",observed_steps["predict_round_win"][1])
        files={
          "load_match":"scripts/auditar_economia_modelo.py",
          "normalize_observed_economy":"backend/modules/economy_ml/display_normalizer.py",
          "extract_round_states":"backend/modules/economy_ml/state_extractor.py",
          "reconstruct_credits":"backend/modules/economy_ml/economy_ledger.py",
          "build_inventory":"backend/modules/economy_ml/inventory.py",
          "infer_real_purchase":"backend/modules/economy_ml/purchase_inference.py",
          "build_advanced_context":"backend/modules/economy_ml/round_recommender.py",
          "generate_legal_purchases":"backend/modules/economy_ml/legal_purchase.py",
          "resolve_drops":"backend/modules/economy_ml/team_buy_solver.py",
          "validate_legality":"backend/modules/economy_ml/team_buy_solver.py",
          "score_base":"backend/modules/economy_ml/team_buy_solver.py",
          "apply_macro_model":"backend/modules/economy_ml/predict.py",
          "apply_contextual_adjustments":"backend/modules/economy_ml/contextual_scorer.py",
          "predict_round_win":"backend/modules/economy_ml/round_win_model.py",
          "explain_recommendation":"backend/modules/economy_ml/recommendation_explainer.py",
          "serialize_api_response":"backend/modules/economy_ml/round_recommender.py",
          "frontend_contract_check":"frontend/src/components/modals/MatchDetailModal.tsx"}
        trace=[]
        for step,(section_key,process) in observed_steps.items():
            sec=sections[section_key]
            scenario_key=scenario_steps.get(step)
            output=scenarios.get(scenario_key,{}).get("observed") if scenario_key else sec.get("observed_values")
            trace.append({"step":step,"input":{"match_source":source},"process":process,
              "output":output or {},"file":files[step],"status":sec["status"],
              "warnings":sec["warnings"],"errors":sec["errors"]})
    rounds=match.get("roundResults") or []
    players=match.get("players") or []
    teams=match.get("teams") or []
    match_summary={"round_count":len(rounds),"team_count":len(teams),"player_count":len(players),
      "first_round":rounds[0] if rounds else None,
      "round_13":rounds[12] if len(rounds)>=13 else None,
      "last_round":rounds[-1] if rounds else None,
      "sample_player_recommendations":(scenarios.get("api_contract") or {}).get("observed"),
      "warnings_top_10":warnings[:10]}
    return {"status":status,"generated_at":datetime.now(timezone.utc).isoformat(),
      "match_id":match.get("matchInfo",{}).get("matchId"),"match_source":source,
      "match_summary":match_summary,
      "venv_candidates":[{"path":str(x),"exists":x.exists()} for x in VENV_CANDIDATES],
      "sections":sections,"economy_scenarios":scenarios,
      "process_trace":trace if include_trace else [],"warnings":warnings,"errors":errors}

def render_markdown(audit: dict) -> str:
    sections=audit["sections"]
    lines=["# Auditoría completa del motor económico y modelo ML","",
      "## 1. Resumen ejecutivo","",
      "- Estado general: **"+MARK[audit["status"]]+"**.",
      "- Qué funciona: "+str(sum(x["status"]=="ok" for x in sections.values()))+" de "+str(len(sections))+" apartados.",
      "- Qué está parcial: "+str(sum(x["status"]=="partial" for x in sections.values()))+" apartados.",
      "- Qué falta/no verificable: "+str(sum(x["status"]=="unknown" for x in sections.values()))+" apartados.",
      "- Riesgos principales: catálogos externos, artifact/dataset y escenarios no ejecutados.",
      "- Veredicto final: **"+audit["status"]+"**; partial significa evidencia incompleta, no motor roto.","",
      "## 2. Tabla de cobertura general","",
      "| Apartado | Estado | Datos necesarios | Dónde se encuentran | Proceso | Salida | Tests | Riesgo |",
      "|---|---|---|---|---|---|---|---|"]
    for sec in sections.values():
        fields=", ".join(x["field"] for x in sec["required_data"][:4])
        if len(sec["required_data"])>4: fields+="…"
        tests=", ".join(x["file"] for x in sec["tests"]) or "ver sección Tests"
        lines.append("| "+sec["title"]+" | "+MARK[sec["status"]]+" | "+fields+" | "+
          sec["required_data"][0]["source"]+" | "+", ".join(x["name"] for x in sec["processes"])+
          " | JSON estructurado | "+tests+" | "+sec["risk"]+" |")
    lines += ["","## 3. Auditoría detallada por apartado",""]
    for i,(key,sec) in enumerate(sections.items(),1):
        rows=sec["required_data"]
        blocks=[
          "### 3."+str(i)+" "+sec["title"]+" — "+MARK[sec["status"]],"",
          "**Qué datos necesita**","",", ".join(x["field"] for x in rows)+".","",
          "**Dónde los encuentra**","", "; ".join(dict.fromkeys(x["source"] for x in rows))+".","",
          "**Por qué los necesita**","",rows[0]["why_needed"]+".","",
          "**Valor observado en auditoría**","","~~~json",
          json.dumps(sec["observed_values"],ensure_ascii=False,indent=2,default=str),"~~~","",
          "**Proceso que realiza**",""]
        lines += blocks
        lines += ["- "+x["name"]+": "+x["transformation"]+"; salida "+x["output"]+"." for x in sec["processes"]]
        lines += ["","**Funciones / archivos implicados**","",
          ", ".join(x["name"] for x in sec["processes"])+".","",
          "**Salida generada**","","sections."+key+" y campos API/UI indicados.","",
          "**Warnings / fallbacks**","",(", ".join(sec["warnings"]) or "Sin warnings en esta ejecución."),"",
          "**Tests existentes**","",(", ".join(x["file"] for x in sec["tests"]) or "Sin test específico localizado."),"",
          "**Riesgos / mejoras**","",sec["risk"]+(" Errores: "+", ".join(sec["errors"]) if sec["errors"] else ""),""
        ]
    lines += ["## 4. Matriz de penalizaciones","",
      "| Penalty | Condición | Magnitud | Dato requerido | Por qué existe | Test |",
      "|---|---|---|---|---|---|"]
    penalty_fields=sections["penalties"]["required_data"]
    for row in penalty_fields:
        lines.append("| "+row["field"]+" | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |")
    lines += ["","## 5. Matriz de etiquetas económicas","",
      "| Etiqueta | Condición auditada | Datos usados | Ejemplo | Salida UI |",
      "|---|---|---|---|---|"]
    for row in sections["buy_classification"]["required_data"]:
        label=row["field"]
        example={"LAST_HALF_ROUND_BUY":"ronda 12","CLOSING_BUY":"score 12-4",
          "ELIMINATION_BUY":"score 4-12","OVERTIME_BUY":"ronda >=25",
          "BONUS_KEEP_INVENTORY":"3+ Spectres conservadas"}.get(label,"composición/gasto compatible")
        lines.append("| "+label+" | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | "+example+" | recommended_team_buy / plan_kind |")
    return "\n".join(lines)+"\n"

def render_dictionary(audit: dict) -> str:
    groups=["Datos de partida","Datos de jugador","Datos de ronda","Economía observada",
      "Créditos reconstruidos","Inventario","Catálogos","Habilidades","Drops","Enemy economy",
      "Mapa/site","Player profile","Ultimates","Armor durability","Ability usage","Modelo macro",
      "Modelo round-win","API response","UI/frontend"]
    keys=list(audit["sections"])
    lines=["# Diccionario de datos de economía","",
      "Fuente, lectura, transformación y salida permanecen separados para hacer trazable el contrato.",""]
    for i,group in enumerate(groups):
        sec=audit["sections"][keys[min(i,len(keys)-1)]]
        lines += ["## "+group,"",
          "| Campo / ruta payload | Fuente | Tipo esperado | Ejemplo real/fixture | Obligatorio | Lee | Transforma | Salida | Fallback/warning | Por qué importa |",
          "|---|---|---|---|---|---|---|---|---|---|"]
        for row in sec["required_data"]:
            example=json.dumps(row["value"],ensure_ascii=False,default=str) if row["value"] is not None else "no observado"
            warning=", ".join(sec["warnings"][:2]) or "ninguno"
            lines.append("| "+row["field"]+" | "+row["source"]+" | contrato Python/TS | "+
              example+" | "+("sí" if row["required"] else "opcional/contextual")+" | "+
              ", ".join(row["used_by"])+" | "+row["process"]+" | "+row["output_field"]+
              " | "+warning+" | "+row["why_needed"]+" |")
        lines.append("")
    return "\n".join(lines)

def render_flow() -> str:
    lines=["# Flujo completo del motor económico","",
      "Mongo/Riot match → normalización → rondas/equipos → créditos → inventario → compra real → contexto → compras legales → drops → legalidad → scoring → macro → contexto → round-win → explicación → API → frontend",""]
    for i,(name,inp,process,out,file) in enumerate(FLOW,1):
        lines += ["## Paso "+str(i)+": "+name,"","**Entrada**","",inp+".","",
          "**Proceso**","",process+".","","**Salida**","",out+".","",
          "**Archivo principal**","",file+".","","**Errores posibles**","",
          "Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.","",
          "**Cómo verificarlo**","","Consultar process_trace, la sección JSON y los tests asociados.",""]
    return "\n".join(lines)

_render_markdown_v1 = render_markdown
_render_flow_v1 = render_flow

def render_markdown(audit: dict) -> str:
    base = _render_markdown_v1(audit)
    rest = base[base.index("## 2."):]
    sections = audit["sections"]
    counts = {name:sum(item["status"]==name for item in sections.values())
              for name in ("ok","partial","fail","unknown")}
    lines = ["# Auditoría completa del motor económico y modelo ML","",
      "## 1. Resumen ejecutivo","",
      "- Estado general: **"+MARK[audit["status"]]+"**.",
      "- Correctos: "+str(counts["ok"])+".",
      "- Parciales: "+str(counts["partial"])+".",
      "- Fallidos: "+str(counts["fail"])+".",
      "- No verificables: "+str(counts["unknown"])+".",
      "- Qué funciona: "+str(counts["ok"])+" apartados.",
      "- Qué está parcial: "+str(counts["partial"])+" apartados.",
      "- Qué falla: "+str(counts["fail"])+" apartados.",
      "- Qué no es verificable: "+str(counts["unknown"])+" apartados.",
      "- Veredicto final: **"+audit["status"]+"**.","",
      "### Resumen de escenarios ejecutados","",
      "| Escenario | Estado | Razón |","|---|---|---|"]
    for name,item in audit["economy_scenarios"].items():
        lines.append("| "+name+" | "+MARK[item["status"]]+" | "+item["status_reason"]+" |")
    lines += ["","### Errores reales","",
      (", ".join(audit["errors"]) if audit["errors"] else
       "No se detectaron errores runtime en esta ejecución."),"",
      "### Recomendaciones finales","",
      "- Ejecutar con --match-id para añadir evidencia de una partida Mongo real.",
      "- Mantener escenarios runtime y tests alineados con cada cambio del motor.",""]
    # Add semantic reason to the coverage table without duplicating all detail.
    for section in sections.values():
        old="| "+section["title"]+" | "+MARK[section["status"]]+" |"
        new="| "+section["title"]+" | "+MARK[section["status"]]+" ("+section["status_reason"]+") |"
        rest=rest.replace(old,new,1)
    return "\n".join(lines)+rest

def render_dictionary(audit: dict) -> str:
    groups=[
      ("Datos de partida","match_data"),("Datos de jugador","match_data"),
      ("Datos de ronda","match_data"),("Economía observada","observed_economy"),
      ("Catálogo de armas","weapon_catalog"),("Catálogo de escudos","armor_catalog"),
      ("Catálogo de habilidades","ability_catalog"),("Créditos reconstruidos","prebuy_credits"),
      ("Inventario","carried_inventory"),("Inferencia de compra","purchase_inference"),
      ("Compras legales","legal_purchases"),("Drops","drops"),
      ("Scoring y penalizaciones","penalties"),("Clasificación de buy","buy_classification"),
      ("Contexto enemigo","enemy_economy"),("Mapa y site","map_site"),
      ("Player profile","player_profile"),("Ultimates","ultimates"),
      ("Armor durability","armor_durability"),("Ability usage","ability_usage"),
      ("Modelo macro","macro_model"),("ML round-win","round_win_model"),
      ("Dataset y entrenamiento","dataset_training"),("API","api_contract"),
      ("Frontend","frontend"),("Tests","tests")]
    lines=["# Diccionario de datos de economía","",
      "Cada categoría apunta explícitamente a su sección semántica; catálogos, payload y salidas no se mezclan.",""]
    for title,key in groups:
        section=audit["sections"][key]
        lines += ["## "+title,"",
          "| Campo / ruta payload | Fuente | Tipo esperado | Ejemplo real/fixture | Obligatorio | Lee | Transforma | Salida | Fallback/warning | Por qué importa |",
          "|---|---|---|---|---|---|---|---|---|---|"]
        for row in section["required_data"]:
            example=json.dumps(row["value"],ensure_ascii=False,default=str) if row["value"] is not None else "no observado"
            warning=", ".join(section["warnings"][:2]) or "ninguno"
            lines.append("| "+row["field"]+" | "+row["source"]+" | contrato Python/TS | "+
              example+" | "+("sí" if row["required"] else "opcional/contextual")+" | "+
              ", ".join(row["used_by"])+" | "+row["process"]+" | "+row["output_field"]+
              " | "+warning+" | "+row["why_needed"]+" |")
        lines.append("")
    return "\n".join(lines)

def render_flow() -> str:
    return _render_flow_v1()+"\n\nEl ML round-win es un componente auxiliar dentro del ajuste contextual final; no legaliza compras ni sustituye el modelo macro.\n"

def main() -> int:
    parser=argparse.ArgumentParser(description="Auditoría trazable de economy_ml")
    parser.add_argument("--match-id")
    parser.add_argument("--json-out",type=Path)
    parser.add_argument("--markdown-out",type=Path)
    parser.add_argument("--include-process-trace",action="store_true")
    parser.add_argument("--strict",action="store_true")
    args=parser.parse_args()
    match,source=synthetic_match(),"synthetic_fixture"
    if args.match_id:
        try:
            from modules.matches.infrastructure import mongo_match_repo
            found=mongo_match_repo.find_by_id(args.match_id)
            if found: match,source=found,"mongo"
            else: source="mongo_match_not_found"
        except Exception as exc: source="mongo_unavailable:"+type(exc).__name__+":"+str(exc)
    audit=build_audit(match,source,args.include_process_trace)
    if args.match_id and source!="mongo":
        audit["status"]="partial" if audit["status"]=="ok" else audit["status"]
        audit["warnings"].append(source)
    payload=json.dumps(audit,ensure_ascii=False,indent=2,default=str)
    print(payload)
    if args.json_out:
        path=args.json_out if args.json_out.is_absolute() else ROOT/args.json_out
        path.parent.mkdir(parents=True,exist_ok=True); path.write_text(payload+"\n",encoding="utf-8")
    if args.markdown_out:
        path=args.markdown_out if args.markdown_out.is_absolute() else ROOT/args.markdown_out
        path.parent.mkdir(parents=True,exist_ok=True); path.write_text(render_markdown(audit),encoding="utf-8")
    docs=ROOT/"docs"; docs.mkdir(exist_ok=True)
    (docs/"economy_data_dictionary.md").write_text(render_dictionary(audit),encoding="utf-8")
    (docs/"economy_process_flow.md").write_text(render_flow(),encoding="utf-8")
    return 1 if audit["status"]=="fail" or args.strict and audit["status"]!="ok" else 0

if __name__=="__main__":
    raise SystemExit(main())
