import random

MAP_SITES = {
    "A": {
        "center": (1000, 2000),
        "radius": 600
    },
    "B": {
        "center": (4000, 2000),
        "radius": 600
    },
    "MID": {
        "center": (2500, 2000),
        "radius": 1200
    }
}


def random_position(center, radius):
    cx, cy = center

    x = int(cx + random.randint(-radius, radius))
    y = int(cy + random.randint(-radius, radius))

    return {"x": x, "y": y}


def generate_player_positions(players):
    """
    Genera posiciones iniciales para todos los jugadores.
    """
    positions = {}

    for p in players:
        site = random.choice(["A", "B", "MID"])
        pos = random_position(MAP_SITES[site]["center"], MAP_SITES[site]["radius"])

        positions[p] = pos

    return positions


def generate_kill_position(player_positions, victim):
    """
    Devuelve la posición donde muere el jugador.
    """
    return player_positions.get(victim, {"x": 0, "y": 0})


def generate_player_locations(player_positions):
    """
    Convierte el dict de posiciones en formato DTO.
    """
    result = []

    for puuid, pos in player_positions.items():
        result.append({
            "puuid": puuid,
            "viewRadians": random.uniform(0, 6.28),
            "location": pos
        })

    return result


def generate_plant_location(site):
    site_data = MAP_SITES[site]
    return random_position(site_data["center"], 200)