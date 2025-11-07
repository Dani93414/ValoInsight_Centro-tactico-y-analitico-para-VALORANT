from supabase import create_client, Client

# Reemplaza con tu URL y API Key de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def mostrar_mapas_existentes():
    """Consulta y muestra todos los mapas actuales (solo nombres)."""
    try:
        response = supabase.table("mapas").select("nombre").order("nombre").execute()
        mapas = response.data

        if mapas:
            print("\n🗺️  Mapas existentes:")
            for mapa in mapas:
                print(f"- {mapa['nombre']}")
        else:
            print("\nℹ️ No hay mapas registrados aún.")
    except Exception as e:
        print(f"❌ Error al consultar los mapas: {e}")

def insertar_mapa():
    while True:
        mostrar_mapas_existentes()

        nombre_mapa = input("\nIntroduce el nombre del nuevo mapa (o 'salir' para terminar): ").strip()
        
        if nombre_mapa.lower() == 'salir':
            print("🚪 Proceso terminado.")
            break

        if not nombre_mapa:
            print("❌ El nombre del mapa no puede estar vacío. Inténtalo de nuevo.")
            continue

        # Verificar si ya existe un mapa con ese nombre
        existe = supabase.table("mapas").select("id").eq("nombre", nombre_mapa).execute()
        if existe.data:
            print("⚠️  Ya existe un mapa con ese nombre. Intenta con otro.")
            continue

        response = supabase.table("mapas").insert({"nombre": nombre_mapa}).execute()
        
        if response.data:
            print(f"✅ Mapa '{nombre_mapa}' insertado correctamente.")
        else:
            print(f"❌ Error al insertar el mapa '{nombre_mapa}': {response.error_message or 'Respuesta vacía.'}")

if __name__ == "__main__":
    insertar_mapa()