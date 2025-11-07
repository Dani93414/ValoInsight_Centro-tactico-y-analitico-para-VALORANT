from supabase import create_client, Client
from consulta_jugadores import obtener_jugadores  # Debe devolver una lista de jugadores

# Configuración de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def obtener_id_y_nombre(tabla):
    

    response = supabase.table(tabla).select("id, nombre").execute()
    if response.data:
        opciones = {item["nombre"]: item["id"] for item in response.data}
        return opciones
    else:
        return {}

def solicitar_seleccion(opciones, mensaje, excluidos=set()):

    while True:
        print(mensaje)
        for nombre in opciones.keys():
            if nombre not in excluidos:
                print(f"- {nombre}")
        seleccion = input("Ingrese su elección (o escriba 'salir' para cancelar): ")
        if seleccion.lower() == "salir":
            return None, None
        if seleccion in opciones and seleccion not in excluidos:
            return seleccion, opciones[seleccion]
        print("Entrada no válida o ya seleccionada. Inténtelo de nuevo.")

def insertar_composicion():
 
    # Obtener y seleccionar mapa
    mapas_disponibles = obtener_id_y_nombre("mapas")
    if not mapas_disponibles:
        print("No hay mapas disponibles.")
        return
    nombre_mapa, mapa_id = solicitar_seleccion(mapas_disponibles, "Seleccione un mapa disponible:")
    if mapa_id is None:
        return

    # Obtener y seleccionar equipo
    equipos_disponibles = obtener_id_y_nombre("equipos")
    if not equipos_disponibles:
        print("No hay equipos disponibles.")
        return
    nombre_equipo, equipo_id = solicitar_seleccion(equipos_disponibles, "Seleccione un equipo disponible:")
    if equipo_id is None:
        return

    # Insertar la composición en la tabla composiciones_equipo
    data_composicion = {
        "mapa_id": mapa_id,
        "equipo_id": equipo_id,
        "victorias": 0,
        "derrotas": 0,
        "winrate": 0.0,
        "mejor_jugador": None,
        "peor_jugador": None
    }
    response = supabase.table("composiciones_equipo").insert(data_composicion).execute()
    
    if response.data:
        composicion_id = response.data[0]["id"]
        print(f"Composición creada con ID {composicion_id} en el mapa {nombre_mapa} con el equipo {nombre_equipo}.")
    else:
        print("Error al insertar la composición.")
        return
    
    # Obtener jugadores registrados
    jugadores = obtener_jugadores()  
    nombres_jugadores = {jugador["nombre"]: jugador["id"] for jugador in jugadores}
    if not nombres_jugadores:
        print("No hay jugadores registrados.")
        return
    
    # Obtener agentes registrados
    agentes_disponibles = obtener_id_y_nombre("agentes")
    if not agentes_disponibles:
        print("No hay agentes disponibles.")
        return

    jugadores_agentes = []
    jugadores_seleccionados = set()
    agentes_seleccionados = set()
    
    for i in range(5):  # Suponiendo que la composición tiene 5 jugadores
        nombre_jugador, jugador_id = solicitar_seleccion(nombres_jugadores, f"Seleccione el jugador {i + 1}:", jugadores_seleccionados)
        if jugador_id is None:
            return
        jugadores_seleccionados.add(nombre_jugador)
        
        nombre_agente, agente_id = solicitar_seleccion(agentes_disponibles, f"Seleccione el agente para {nombre_jugador}:", agentes_seleccionados)
        if agente_id is None:
            return
        agentes_seleccionados.add(nombre_agente)
        
        jugadores_agentes.append({"composicion_id": composicion_id, "jugador_id": jugador_id, "agente_id": agente_id})
    
    # Insertar jugadores en la tabla composiciones_jugadores_agente
    response_jugadores = supabase.table("composiciones_jugadores_agentes").insert(jugadores_agentes).execute()

    if response_jugadores.data:
        print("Jugadores añadidos correctamente a la composición.")
    else:
        print("Error al insertar jugadores en la composición.")


# Ejecutar la función para insertar una composición
insertar_composicion()
