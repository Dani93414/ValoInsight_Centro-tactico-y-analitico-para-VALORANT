from supabase import create_client, Client

# Reemplaza con tu URL y API Key de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def actualizar_estadisticas():
    """
    Permite registrar o actualizar estadísticas para una partida específica.
    """
    while True:
        # Pedir información del mapa y la composición
        mapa_id = int(input("Introduce el ID del mapa (o '0' para terminar): ").strip())
        if mapa_id == 0:
            break

        composicion_id = int(input("Introduce el ID de la composición: ").strip())

        # Obtener los jugadores existentes
        jugadores_response = supabase.table("jugadores_estadisticas").select("*").execute()
        if jugadores_response.status_code != 200 or not jugadores_response.data:
            print("No hay jugadores registrados o error al obtener la lista.")
            return
        
        jugadores = {j['id']: j for j in jugadores_response.data}
        print("\nJugadores registrados:")
        for id_jugador, datos_jugador in jugadores.items():
            print(f"{id_jugador}: {datos_jugador['nombre']}")

        # Seleccionar jugador para registrar estadísticas
        while True:
            jugador_id = int(input("Introduce el ID del jugador para actualizar estadísticas (o '0' para terminar): ").strip())
            if jugador_id == 0:
                break

            # Buscar si ya existe un registro para este usuario, mapa y composición
            existing_entry = supabase.table("jugadores_estadisticas").select("*").eq("usuario_id", jugador_id).eq("mapa_id", mapa_id).eq("composicion_id", composicion_id).execute()
            if existing_entry.status_code == 200 and existing_entry.data:
                jugador = existing_entry.data[0]
            else:
                # Si no existe, crear un nuevo registro vacío para actualizar después
                supabase.table("jugadores_estadisticas").insert({
                    "usuario_id": jugador_id,
                    "mapa_id": mapa_id,
                    "composicion_id": composicion_id,
                    "victorias": 0,
                    "derrotas": 0,
                    "aces": 0,
                    "kills": 0,
                    "muertes": 0,
                    "asistencias": 0,
                    "kast": 0,
                    "fk": 0,
                    "fd": 0
                }).execute()
                jugador = {
                    "victorias": 0,
                    "derrotas": 0,
                    "aces": 0,
                    "kills": 0,
                    "muertes": 0,
                    "asistencias": 0,
                    "kast": 0,
                    "fk": 0,
                    "fd": 0
                }

            # Preguntar si ganó o perdió la partida
            resultado = input("¿El jugador ganó la partida? (s/n): ").strip().lower()
            if resultado == "s":
                victorias = jugador['victorias'] + 1
                derrotas = jugador['derrotas']
            else:
                victorias = jugador['victorias']
                derrotas = jugador['derrotas'] + 1

            # Calcular winrate
            total_partidas = victorias + derrotas
            winrate = round((victorias / total_partidas) * 100, 2)

            # Actualizar otras estadísticas
            aces = jugador['aces'] + float(input("Introduce el número de aces: "))
            kills = jugador['kills'] + float(input("Introduce el número de kills: "))
            muertes = jugador['muertes'] + float(input("Introduce el número de muertes: "))
            asistencias = jugador['asistencias'] + float(input("Introduce el número de asistencias: "))
            fk = jugador['fk'] + float(input("Introduce el número de primeras kills (FK): "))
            fd = jugador['fd'] + float(input("Introduce el número de primeras muertes (FD): "))

            # Actualizar KD
            kd = round(kills / muertes if muertes != 0 else kills, 2)

            # Actualizar ADR
            nuevo_adr = float(input("Introduce el ADR de esta partida: "))
            adr = round(((jugador['adr'] * total_partidas) + nuevo_adr) / (total_partidas + 1), 2)

            # Actualizar porcentaje de HS
            nuevo_porcentaje_hs = float(input("Introduce el porcentaje de headshots de esta partida: "))
            porcentaje_hs = round(((jugador['porcentaje_hs'] * total_partidas) + nuevo_porcentaje_hs) / (total_partidas + 1), 2)

            # Actualizar KAST
            nuevo_kast = float(input("Introduce el KAST de esta partida: "))
            kast = round(((jugador['kast'] * total_partidas) + nuevo_kast) / (total_partidas + 1), 2)

            # Actualizar las estadísticas en la base de datos
            response = supabase.table("jugadores_estadisticas").update({
                "victorias": victorias,
                "derrotas": derrotas,
                "winrate": winrate,
                "aces": aces,
                "kills": kills,
                "muertes": muertes,
                "asistencias": asistencias,
                "kd": kd,
                "adr": adr,
                "porcentaje_hs": porcentaje_hs,
                "kast": kast,
                "fk": fk,
                "fd": fd
            }).eq("usuario_id", jugador_id).eq("mapa_id", mapa_id).eq("composicion_id", composicion_id).execute()

            if response.status_code == 200:
                print("Estadísticas actualizadas correctamente.")
            else:
                print("Error al actualizar las estadísticas:", response.json())

if __name__ == "__main__":
    actualizar_estadisticas()
