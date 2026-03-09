# match_generator/matchmaking.py

import random
from src.utils.helpers import uid
from db.data_loader import (
    load_agents,
    load_player_cards,
    load_player_titles,
    load_maps
)

# Constantes de emparejamiento
RANK_MIN = 5
RANK_MAX = 27
RANK_SPREAD = 2 

# Añadimos los jugadores de prueba aquí para poder importarlos desde cualquier lado
# NUEVO: El jugador "nace" ya con un nivel de cuenta fijo asignado.
TEST_PLAYERS = [
    {
        "puuid": f"test-puuid-{i}", 
        "gameName": f"Player{i}", 
        "tagLine": "EU",
        "accountLevel": random.randint(20, 500)
    } for i in range(1, 31)
]

def generate_parties(players):
    p_mix = 0.65
    p_big = 0.25
    p_fullstack = 0.10

    roll = random.random()
    parties = []

    if roll < p_fullstack:
        random.shuffle(players)
        party1 = players[:5]
        party2 = players[5:]

        pid1 = uid()
        pid2 = uid()
        for p in party1: p["partyId"] = pid1
        for p in party2: p["partyId"] = pid2

        return [party1, party2]

    if roll < p_mix + p_big:
        sizes = [3]
        remaining = 7
        while remaining > 0:
            s = random.choice([1,2,3])
            if s <= remaining:
                sizes.append(s)
                remaining -= s
    else:
        sizes = []
        remaining = 10
        while remaining > 0:
            s = random.choice([1,2,3])
            if s <= remaining:
                sizes.append(s)
                remaining -= s

    random.shuffle(players)
    idx = 0
    for s in sizes:
        group = players[idx:idx+s]
        idx += s
        pid = uid()
        for p in group:
            p["partyId"] = pid
        parties.append(group)

    return parties

def assign_teams_from_parties(parties):
    team_red = []
    team_blue = []
    random.shuffle(parties)

    for party in parties:
        if len(team_red) + len(party) <= 5:
            team_red.extend(party)
        else:
            team_blue.extend(party)

    return team_red, team_blue

def prepare_matchmaking(test_players, map_name=None):
    REQUIRED_PLAYERS = 10

    if len(test_players) < REQUIRED_PLAYERS:
        raise ValueError(
            f"Error: Se requieren {REQUIRED_PLAYERS} jugadores. La lista solo tiene {len(test_players)}."
        )

    selected = random.sample(test_players, REQUIRED_PLAYERS)
    
    base_rank = random.randint(RANK_MIN, RANK_MAX)
    low_rank  = max(RANK_MIN, base_rank - RANK_SPREAD)
    high_rank = min(RANK_MAX, base_rank + RANK_SPREAD)

    PLAYER_CARDS = load_player_cards()
    PLAYER_TITLES = load_player_titles()
    MAPS = load_maps()
    AGENTS = load_agents(return_roles=False)

    players = []
    for tp in selected:
        players.append({
            "puuid": tp["puuid"],
            "gameName": tp["gameName"],
            "tagLine": tp.get("tagLine", "EU"),
            "partyId": None,
            "teamId": None,
            "characterId": None, 
            "competitiveTier": random.randint(low_rank, high_rank),
            "playerCard": random.choice(PLAYER_CARDS) if PLAYER_CARDS else uid(),
            "playerTitle": random.choice(PLAYER_TITLES) if PLAYER_TITLES else uid(),
            "accountLevel": tp.get("accountLevel", 20)  # NUEVO: Leemos el nivel que trae el perfil
        })

    parties = generate_parties(players)
    team_red, team_blue = assign_teams_from_parties(parties)

    agents_red = AGENTS.copy()
    agents_blue = AGENTS.copy()

    for p in team_red:
        agent = random.choice(agents_red)
        agents_red.remove(agent)
        p["characterId"] = agent["id"]
        p["teamId"] = "Red"

    for p in team_blue:
        agent = random.choice(agents_blue)
        agents_blue.remove(agent)
        p["characterId"] = agent["id"]
        p["teamId"] = "Blue"

    chosen_map = None
    if map_name:
        chosen_map = next((m for m in MAPS if m["name"].lower() == map_name.lower()), None)
    
    if not chosen_map:
        chosen_map = random.choice(MAPS)

    final_players = team_red + team_blue
    return final_players, chosen_map