from supabase import create_client, Client

# Conexión Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def mostrar_mapas_existentes():
    try:
        response = supabase.table("mapas").select("id", "nombre").order("id").execute()
        mapas = response.data

        if mapas:
            print("\n🗺️ Mapas existentes:")
            for mapa in mapas:
                print(f"- {mapa['nombre']}")
            return mapas
        else:
            print("\nℹ️ No hay mapas registrados aún.")
            return []
    except Exception as e:
        print(f"❌ Error al consultar los mapas: {e}")
        return []

def eliminar_mapa():
    mapas = mostrar_mapas_existentes()
    if not mapas:
        return

    nombres_disponibles = {mapa["nombre"].lower(): mapa["nombre"] for mapa in mapas}

    nombre_input = input("\n🗑️  Ingresa el nombre del mapa que deseas eliminar: ").strip().lower()

    if nombre_input not in nombres_disponibles:
        print("❌ No se encontró un mapa con ese nombre.")
        return

    nombre_real = nombres_disponibles[nombre_input]

    confirm = input(f"¿Estás seguro de que deseas eliminar el mapa '{nombre_real}'? (s/n): ").lower()
    if confirm != "s":
        print("❌ Operación cancelada.")
        return

    try:
        response = supabase.table("mapas").delete().eq("nombre", nombre_real).execute()
        if response.data:
            print(f"✅ Mapa '{nombre_real}' eliminado correctamente.")
        else:
            print("❌ No se pudo eliminar el mapa.")
    except Exception as e:
        print(f"❌ Error al eliminar el mapa: {e}")

if __name__ == "__main__":
    eliminar_mapa()
