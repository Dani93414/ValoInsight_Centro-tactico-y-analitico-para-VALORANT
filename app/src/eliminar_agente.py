from supabase import create_client, Client

# Reemplaza con tu URL y API Key de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalizar_nombre(nombre: str) -> str:
    """Convierte el nombre al formato 'Nombre' (Primera mayúscula, resto minúscula)."""
    return nombre.strip().capitalize()

def obtener_agente_id(nombre: str):
    """Busca el agente por nombre (ignorando mayúsculas) y devuelve su ID."""
    nombre_normalizado = normalizar_nombre(nombre)
    response = supabase.table("agentes").select("id, nombre").execute()
    
    if response.data:
        for agente in response.data:
            if agente["nombre"].lower() == nombre_normalizado.lower():
                return agente["id"]
    return None

def listar_agentes():
    """Muestra la lista de agentes disponibles."""
    response = supabase.table("agentes").select("nombre").order("nombre", desc=False).execute()
    
    if response.data:
        print("\n📋 Agentes disponibles:")
        for agente in response.data:
            print(f" - {agente['nombre']}")
        print()
    else:
        print("\n⚠️ No hay agentes registrados en la base de datos.\n")

def eliminar_agente():
    print("=== Eliminador de agentes ===")
    while True:
        opcion = input("\nEscribe el nombre del agente a eliminar, 'ver' para listar agentes, o 'salir' para terminar: ").strip()

        if opcion.lower() == 'salir':
            print("🔚 Proceso terminado.")
            break

        if opcion.lower() == 'ver':
            listar_agentes()
            continue

        if not opcion:
            print("❌ El nombre no puede estar vacío. Inténtalo de nuevo.")
            continue

        agente_id = obtener_agente_id(opcion)
        
        if agente_id is None:
            print(f"⚠️ No se encontró ningún agente con el nombre '{normalizar_nombre(opcion)}'.")
            continue

        response = supabase.table("agentes").delete().eq("id", agente_id).execute()

        if response.data:
            print(f"🗑️  Agente '{normalizar_nombre(opcion)}' eliminado correctamente.")
        else:
            print(f"❌ Error al eliminar el agente: {response.error_message or 'Error desconocido'}")

if __name__ == "__main__":
    eliminar_agente()