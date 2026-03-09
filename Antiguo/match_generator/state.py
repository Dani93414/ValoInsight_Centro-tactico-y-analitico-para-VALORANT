# match_generator/state.py
import random

class PlayerState:
    """Mantiene el estado vivo de un jugador durante la simulación de la partida."""
    
    def __init__(self, puuid, team_id):
        self.puuid = puuid
        self.team_id = team_id

        self.position = {"x": 0, "y": 0}
        
        # Estado volátil (cambia cada ronda)
        self.credits = 800
        self.is_alive = False
        self.current_weapon_id = "" # Guardará el UUID de MongoDB
        self.current_armor_id = ""
        self.ultimate_points = 0
        
        # Estadísticas acumuladas de toda la partida
        self.kills = 0
        self.deaths = 0
        self.assists = 0
        self.rounds_played = 0
        self.playtime_millis = 0
        self.round_scores = []
        
        # Casteo de habilidades
        self.grenade_casts = 0
        self.ability1_casts = 0
        self.ability2_casts = 0
        self.ultimate_casts = 0

    def add_credits(self, amount):
        """Añade créditos respetando el límite oficial de 9000."""
        self.credits = max(0, min(self.credits + amount, 9000))

    def set_credits(self, amount):
        """Fuerza una cantidad de créditos (ej. Overtime o Ronda 1)."""
        self.credits = max(0, min(amount, 9000))

    def add_ultimate_points(self, points):
        """Añade puntos de ultimate respetando el límite (asumimos 8)."""
        self.ultimate_points = min(self.ultimate_points + points, 8)

    def consume_ultimate(self):
        """Intenta usar la ultimate. Devuelve True si se pudo usar."""
        if self.ultimate_points >= 8:
            self.ultimate_points = 0
            self.ultimate_casts += 1
            return True
        return False
        
    def get_average_score(self):
        """Calcula el ACS medio al final de la partida."""
        if not self.round_scores:
            return 0
        return int(sum(self.round_scores) / len(self.round_scores))


class TeamState:
    """Mantiene el estado de un equipo (puntuación y economía)."""
    
    def __init__(self, team_id):
        self.team_id = team_id
        self.rounds_won = 0
        self.loss_streak = 0

    def win_round(self):
        self.rounds_won += 1
        self.loss_streak = 0

    def lose_round(self):
        self.loss_streak += 1


class MatchState:
    """Contenedor principal que maneja a todos los jugadores y equipos juntos."""
    
    def __init__(self, players_data):
        # Inicializa un PlayerState por cada jugador recibido del matchmaking
        self.players = {p["puuid"]: PlayerState(p["puuid"], p["teamId"]) for p in players_data}
        
        # Inicializa los dos equipos
        self.teams = {
            "Red": TeamState("Red"),
            "Blue": TeamState("Blue")
        }

    def initialize_round_positions(self):
        for player in self.players.values():
            if player.team_id == "Red":
                player.position = {
                    "x": random.randint(1000, 4000),
                    "y": random.randint(1000, 4000)
                }
            else:
                player.position = {
                    "x": random.randint(12000, 15000),
                    "y": random.randint(12000, 15000)
                }
            player.is_alive = True


    def update_positions(self):
        for player in self.players.values():
            if not player.is_alive:
                continue
            dx = random.randint(-250, 250)
            dy = random.randint(-250, 250)
            player.position["x"] += dx
            player.position["y"] += dy


    def get_position(self, puuid):
        player = self.players.get(puuid)
        if not player:
            return {"x": 0, "y": 0}
        return player.position


    def apply_halftime_reset(self):
        """Reseteo oficial de la Ronda 13."""
        for player in self.players.values():
            player.set_credits(800)
            player.ultimate_points = 0
            # IMPORTANTE: Limpiar armas y armadura al cambiar de lado
            player.current_weapon_id = ""
            player.current_armor_id = ""
            player.is_alive = True # Para que la lógica de compra detecte que puede comprar
            
        self.teams["Red"].loss_streak = 0
        self.teams["Blue"].loss_streak = 0

    def apply_overtime_reset(self):
        """Reseteo oficial del Overtime (Ronda 25+)."""
        for player in self.players.values():
            player.set_credits(5000)

    def kill_player(self, puuid):
        player = self.players.get(puuid)
        if player:
            player.is_alive = False

    @property
    def alive_players(self):
        return [
            p.puuid
            for p in self.players.values()
            if p.is_alive
        ]