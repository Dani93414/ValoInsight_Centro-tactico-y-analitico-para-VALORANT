from supabase import create_client, Client
from consulta_jugadores import obtener_jugadores  # Asegúrate de que este script devuelve una lista de jugadores

# Configuración de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Obtener lista de jugadores registrados
try:
    jugadores = obtener_jugadores()
    nombres_jugadores = {jugador["nombre"]: jugador["id"] for jugador in jugadores}
except Exception as e:
    print(f"❌ Error al obtener jugadores: {e}")
    exit(1)

def equipo_existe(nombre_equipo):
    try:
        response = supabase.table("equipos").select("nombre").execute()
        if response.data:
            nombres_existentes = [equipo["nombre"].lower() for equipo in response.data]
            return nombre_equipo.lower() in nombres_existentes
        return False
    except Exception as e:
        print(f"❌ Error al consultar equipos: {e}")
        return True  # Evita crear si hay fallo

def mostrar_lista_jugadores(jugadores_seleccionados):
    print("\n📋 Lista de jugadores disponibles:")
    disponibles = [nombre for nombre in nombres_jugadores.keys() if nombre not in jugadores_seleccionados]

    for i, nombre in enumerate(disponibles, start=1):
        print(f"{i}. {nombre}")
    print()

def crear_equipo():
    print("=== Creación de equipo ===")
    
    while True:
        nombre_equipo = input("Ingrese el nombre del equipo: ").strip()
        
        if not nombre_equipo:
            print("❌ El nombre del equipo no puede estar vacío.")
            continue

        if equipo_existe(nombre_equipo):
            print("⚠️  Ese nombre de equipo ya está en uso. Intenta con otro.")
            continue
        break

    jugadores_seleccionados = []
    
    while len(jugadores_seleccionados) < 5:
        mostrar_lista_jugadores(jugadores_seleccionados)
        nombre_jugador = input(f"Selecciona el jugador {len(jugadores_seleccionados) + 1} (por nombre): ").strip()

        if not nombre_jugador:
            print("❌ El nombre del jugador no puede estar vacío.")
            continue

        # Ignora mayúsculas
        coincidencias = [nombre for nombre in nombres_jugadores if nombre.lower() == nombre_jugador.lower()]
        if coincidencias:
            nombre_real = coincidencias[0]  # Nombre tal como aparece en la base de datos
            if nombre_real in jugadores_seleccionados:
                print("⚠️  Ese jugador ya ha sido seleccionado.")
            else:
                jugadores_seleccionados.append(nombre_real)
        else:
            print("❌ Jugador no encontrado. Intenta nuevamente.")

    jugadores_ids = [nombres_jugadores[nombre] for nombre in jugadores_seleccionados]

    data = {
        "nombre": nombre_equipo,
        "jugador1_id": jugadores_ids[0],
        "jugador2_id": jugadores_ids[1],
        "jugador3_id": jugadores_ids[2],
        "jugador4_id": jugadores_ids[3],
        "jugador5_id": jugadores_ids[4],
    }

    try:
        response = supabase.table("equipos").insert(data).execute()
        if response.data:
            print(f"\n✅ Equipo '{nombre_equipo}' creado exitosamente.")
        else:
            print(f"\n❌ Error al insertar equipo: {response.error_message or 'Respuesta vacía.'}")
    except Exception as e:
        print(f"\n❌ Error al crear el equipo: {e}")

if __name__ == "__main__":
    crear_equipo()
