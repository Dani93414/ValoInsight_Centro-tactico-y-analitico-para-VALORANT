from supabase import create_client, Client

# Conexión a Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def obtener_jugadores():
    response = supabase.table("jugadores_estadisticas").select("id, nombre").order("nombre", desc=False).execute()

    if response.data:
        return [{"id": user["id"], "nombre": user.get("nombre", "Sin nombre")} for user in response.data]
    else:
        return []

if __name__ == "__main__":
    jugadores = obtener_jugadores()
    if jugadores:
        for jugador in jugadores:
            print(f"ID: {jugador['id']}, Nombre: {jugador['nombre']}")
    else:
        print("No hay jugadores registrados.")
