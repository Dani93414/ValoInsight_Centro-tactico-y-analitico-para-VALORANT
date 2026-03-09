# match_generator/schemas.py

def create_match_dto(match_info, players, teams, round_results, coaches=None):
    return {
        "matchInfo": match_info,
        "players": players,
        "coaches": coaches if coaches is not None else [],
        "teams": teams,
        "roundResults": round_results
    }

def create_match_info_dto(match_id, map_id, game_length, game_start, is_ranked, season_id, game_version, region):
    return {
        "matchId": match_id,
        "mapId": map_id,
        "gameVersion": game_version,
        "gameLengthMillis": game_length,
        "region": region,
        "gameStartMillis": game_start,
        "provisioningFlowId": "Matchmaking",
        "isCompleted": True,
        "customGameName": "",
        "queueId": "competitive" if is_ranked else "unrated",
        "gameMode": "Bomb",
        "isRanked": is_ranked,
        "seasonId": season_id
    }

def create_player_dto(puuid, game_name, tag_line, team_id, character_id, competitive_tier, player_card, player_title, party_id, account_level):
    return {
        "puuid": puuid,
        "gameName": game_name,
        "tagLine": tag_line,
        "teamId": team_id,
        "partyId": party_id,
        "characterId": character_id,
        "stats": create_player_stats_dto(),
        "competitiveTier": competitive_tier,
        "isObserver": False,          # NUEVO (Fijo a False)
        "playerCard": player_card,
        "playerTitle": player_title,
        "accountLevel": account_level # NUEVO
    }

def create_player_stats_dto():
    return {
        "score": 0,
        "roundsPlayed": 0,
        "kills": 0,
        "deaths": 0,
        "assists": 0,
        "playtimeMillis": 0,
        "abilityCasts": {
            "grenadeCasts": 0,
            "ability1Casts": 0,
            "ability2Casts": 0,
            "ultimateCasts": 0
        }
    }

def create_team_dto(team_id, won, rounds_played, rounds_won, num_points):
    return {
        "teamId": team_id, # "Red" o "Blue"
        "won": won,
        "roundsPlayed": rounds_played,
        "roundsWon": rounds_won,
        "numPoints": num_points
    }

def create_round_result_dto(round_num, winning_team, round_result_str, winning_team_role):
    return {
        "roundNum": round_num,
        "roundResult": round_result_str,
        "roundCeremony": "RoundCeremonyDefault",
        "winningTeam": winning_team,
        "winningTeamRole": winning_team_role, # NUEVO
        "bombPlanter": "",
        "bombDefuser": "",
        "plantRoundTime": 0,
        "plantPlayerLocations": [],
        "plantLocation": {"x": 0, "y": 0},
        "plantSite": "",
        "defuseRoundTime": 0,
        "defusePlayerLocations": [],
        "defuseLocation": {"x": 0, "y": 0},
        "playerStats": [],
        "roundResultCode": "Generic"
    }

def create_player_round_stats_dto(puuid, score, economy, ability=None):
    return {
        "puuid": puuid,
        "kills": [],      # Se agregan los create_kill_dto aquí
        "damage": [],     # Se agregan los create_damage_dto aquí
        "score": score,
        "economy": economy,
        "ability": ability if ability else create_ability_dto()
    }

def create_kill_dto(time_game, time_round, killer, victim, assistants, weapon_name,
                    victim_location=None, player_locations=None):

    return {
        "timeSinceGameStartMillis": time_game,
        "timeSinceRoundStartMillis": time_round,
        "killer": killer,
        "victim": victim,
        "victimLocation": victim_location if victim_location else {"x":0,"y":0},
        "assistants": assistants,
        "playerLocations": player_locations if player_locations else [],
        "finishingDamage": {
            "damageType": "Weapon",
            "damageItem": weapon_name,
            "isSecondaryFireMode": False
        }
    }

def create_damage_dto(receiver, damage, legshots, bodyshots, headshots):
    return {
        "receiver": receiver,
        "damage": damage,
        "legshots": legshots,
        "bodyshots": bodyshots,
        "headshots": headshots
    }

def create_economy_dto(loadout_value, weapon, armor, remaining, spent):
    return {
        "loadoutValue": loadout_value,
        "weapon": weapon,
        "armor": armor,
        "remaining": remaining,
        "spent": spent
    }

def create_ability_dto():
    return {
        "grenadeEffects": "",
        "ability1Effects": "",
        "ability2Effects": "",
        "ultimateEffects": ""
    }