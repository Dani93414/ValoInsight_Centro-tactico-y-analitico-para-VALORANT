# match_generator/orchestrator.py

import random
from src.utils.helpers import uid, now_ms
from src.match_generator.matchmaking import prepare_matchmaking
from src.match_generator.state import MatchState
from src.match_generator.round_engine import simulate_round
import src.match_generator.schemas as schemas

from db.data_loader import load_shop_weapons, load_shields

SURRENDER_PROB = 0.05
FORCE_OT_PROB = 0.2
# Las 6 regiones oficiales de Riot Games
REGIONES_OFICIALES = ["AP", "EU", "LATAM", "NA", "BR", "KR"]

def generate_match(test_players, map_name=None, seed=None):
    if seed is not None:
        random.seed(seed)

    # 1. MATCHMAKING
    players_data, chosen_map = prepare_matchmaking(test_players, map_name)
    
    # 2. INICIALIZAR ESTADO Y CARGAR RECURSOS
    match_state = MatchState(players_data)
    mongo_weapons = load_shop_weapons()
    mongo_shields = load_shields()
    
    red_wins = 0
    blue_wins = 0
    round_results_raw = []
    
    surrender_team = None
    trigger_surrender = random.random() < SURRENDER_PROB
    force_overtime = random.random() < FORCE_OT_PROB
    
    attackers_start = random.choice(["Red", "Blue"])
    match_start = now_ms() - random.randint(300000, 7200000)

    # ==========================================
    # 3. BUCLE DE RONDAS
    # ==========================================
    for r in range(1, 25):
        attacking_team = attackers_start if r <= 12 else ("Red" if attackers_start == "Blue" else "Blue")
            
        if r == 13:
            match_state.apply_halftime_reset()

        rnd_data = simulate_round(
            match_state, 
            players_data, 
            r, 
            attacking_team,
            mongo_weapons,
            mongo_shields
        )
        round_results_raw.append(rnd_data)

        if rnd_data["winningTeam"] == "Red":
            red_wins += 1
        else:
            blue_wins += 1

        if trigger_surrender and surrender_team is None and r >= 5:
            if abs(red_wins - blue_wins) >= 4:
                surrender_team = "Blue" if red_wins > blue_wins else "Red"
            
            if surrender_team:
                if surrender_team == "Red": blue_wins = 13
                else: red_wins = 13
                
                win_surrender_team = "Blue" if surrender_team == "Red" else "Red"
                next_r = r + 1
                next_atk_team = attackers_start if next_r <= 12 else ("Red" if attackers_start == "Blue" else "Blue")
                surrender_win_role = "Attack" if win_surrender_team == next_atk_team else "Defend"
                
                round_results_raw.append({
                    "roundNum": next_r,
                    "roundResult": "Surrender",
                    "winningTeam": win_surrender_team,
                    "winningTeamRole": surrender_win_role, 
                    "bombPlanter": "",
                    "bombDefuser": "",
                    "playerStats": []
                })
                break 

        if red_wins >= 13 or blue_wins >= 13:
            break

    # ==========================================
    # 4. OVERTIME
    # ==========================================
    if red_wins == 12 and blue_wins == 12:
        if force_overtime or random.random() < 0.50:
            ot_red, ot_blue = 0, 0
            ot_round = len(round_results_raw) + 1
            while True:
                match_state.apply_overtime_reset()
                attacking_ot = "Red" if ot_round % 2 == 1 else "Blue"
                rnd_ot = simulate_round(match_state, players_data, ot_round, attacking_ot, mongo_weapons, mongo_shields)
                round_results_raw.append(rnd_ot)
                if rnd_ot["winningTeam"] == "Red": ot_red += 1
                else: ot_blue += 1
                ot_round += 1
                if abs(ot_red - ot_blue) >= 2:
                    if ot_red > ot_blue: red_wins = 13
                    else: blue_wins = 13
                    break

    # ==========================================
    # 5. DTO FINAL (Ensamblaje Puro Riot API)
    # ==========================================
    total_rounds = len(round_results_raw)
    game_length = total_rounds * 105000 + random.randint(0, 30000)

    game_version = "release-12.00-shipping-29-4132275"
    region = random.choice(REGIONES_OFICIALES)

    match_info = schemas.create_match_info_dto(
        match_id=uid(), map_id=chosen_map["id"] if isinstance(chosen_map, dict) else uid(), 
        game_length=game_length,
        game_start=match_start, is_ranked=True, season_id=uid(),
        game_version=game_version, region=region 
    )

    teams_dto = [
        schemas.create_team_dto("Red", red_wins > blue_wins, total_rounds, red_wins, red_wins),
        schemas.create_team_dto("Blue", blue_wins > red_wins, total_rounds, blue_wins, blue_wins)
    ]

    # Recolectar el Score real de las rondas
    player_totals = {p["puuid"]: {"total_score": 0} for p in players_data}
    
    for rnd in round_results_raw:
        for p_stat in rnd.get("playerStats", []):
            if isinstance(p_stat, dict):
                puuid = p_stat.get("puuid")
                if puuid in player_totals:
                    player_totals[puuid]["total_score"] += p_stat.get("score", 0)

    players_dto = []
    for p in players_data:
        ps = match_state.players[p["puuid"]]
        p_dto = schemas.create_player_dto(
            p["puuid"], p["gameName"], p["tagLine"], p["teamId"], p["characterId"],
            p["competitiveTier"], p["playerCard"], p["playerTitle"], p["partyId"],
            p["accountLevel"] 
        )
        
        # Obtenemos el score acumulado exacto de las rondas
        exact_total_score = player_totals[p["puuid"]]["total_score"]

        p_dto["stats"].update({
            "score": exact_total_score,
            "roundsPlayed": ps.rounds_played,
            "kills": ps.kills,
            "deaths": ps.deaths,
            "assists": ps.assists,
            "playtimeMillis": int(game_length * 0.9)
        })
        
        # 🔥 Usamos los valores reales que el round_engine sumó ronda a ronda
        p_dto["stats"]["abilityCasts"].update({
            "grenadeCasts": ps.grenade_casts,
            "ability1Casts": ps.ability1_casts,
            "ability2Casts": ps.ability2_casts,
            "ultimateCasts": ps.ultimate_casts
        })
        
        players_dto.append(p_dto)

    final_rounds_dto = []
    for rnd in round_results_raw:
        if rnd.get("roundResult") == "Surrender":
            final_rounds_dto.append(schemas.create_round_result_dto(rnd["roundNum"], rnd["winningTeam"], "Surrender", rnd.get("winningTeamRole", "Defend")))
            continue

        r_dto = schemas.create_round_result_dto(
            rnd["roundNum"],
            rnd["winningTeam"],
            rnd["roundResult"],
            rnd.get("winningTeamRole", "Defend")
        )

        r_dto.update({
            "bombPlanter": rnd.get("bombPlanter", ""),
            "bombDefuser": rnd.get("bombDefuser", ""),
            "plantLocation": rnd.get("plantLocation", {"x":0,"y":0}),
            "plantPlayerLocations": rnd.get("plantPlayerLocations", [])
        })
        
        for prs_raw in rnd.get("playerStats", []):
            if not isinstance(prs_raw, dict): continue
            
            eco = prs_raw.get("economy", {})
            if isinstance(eco, list): eco = eco[0] if eco else {}
            
            weapon_obj = eco.get("weapon", {})
            if isinstance(weapon_obj, list):
                weapon_obj = weapon_obj[0] if weapon_obj else {}
            if not isinstance(weapon_obj, dict):
                weapon_obj = {"displayName": "Classic"}
            
            eco_dto = schemas.create_economy_dto(
                loadout_value=eco.get("loadoutValue", 0), 
                weapon=weapon_obj.get("displayName", "Classic"), 
                armor=eco.get("armor", "None"), 
                remaining=eco.get("remaining", 0), 
                spent=eco.get("spent", 0)
            )
            
            p_round_stat = schemas.create_player_round_stats_dto(prs_raw["puuid"], prs_raw["score"], eco_dto)
            
            # 🔥 INYECTAMOS EL OBJETO ABILITY DE LA RONDA CON STRINGS VACÍOS (Formato Riot)
            p_round_stat["ability"] = prs_raw.get("ability", {
                "grenadeEffects": "", "ability1Effects": "", "ability2Effects": "", "ultimateEffects": ""
            })
            
            for k in prs_raw.get("kills", []):
                kill_dto = schemas.create_kill_dto(
                    k["timeSinceGameStartMillis"],
                    k["timeSinceRoundStartMillis"],
                    k["killer"],
                    k["victim"],
                    k["assistants"],
                    k.get("weapon_uuid", ""),
                    victim_location=k.get("victimLocation", {"x":0,"y":0}),
                    player_locations=k.get("playerLocations", [])           
                )
                p_round_stat["kills"].append(kill_dto)
                
            for d in prs_raw.get("damage", []):
                p_round_stat["damage"].append(schemas.create_damage_dto(
                    d["receiver"], d["damage"], d["legshots"], d["bodyshots"], d["headshots"]
                ))
                
            r_dto["playerStats"].append(p_round_stat)
        final_rounds_dto.append(r_dto)

    return schemas.create_match_dto(match_info, players_dto, teams_dto, final_rounds_dto)