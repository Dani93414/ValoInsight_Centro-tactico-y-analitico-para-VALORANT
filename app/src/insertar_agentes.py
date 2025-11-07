from supabase import create_client, Client

# Reemplaza con tu URL y API Key de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalizar_nombre(nombre: str) -> str:
    """Convierte el nombre al formato 'Nombre' (Primera mayúscula, resto minúscula)."""
    return nombre.strip().capitalize()

def agente_existe(nombre: str) -> bool:
    """Verifica si un agente ya existe ignorando mayúsculas/minúsculas."""
    nombre_normalizado = normalizar_nombre(nombre)
    response = supabase.table("agentes") \
        .select("nombre") \
        .execute()
    
    if response.data:
        nombres_en_db = [agente["nombre"].lower() for agente in response.data]
        return nombre_normalizado.lower() in nombres_en_db
    
    return False

def insertar_agente():
    while True:
        nombre_agente = input("Introduce el nombre del agente (o 'salir' para terminar): ").strip()
        
        if nombre_agente.lower() == 'salir':
            print("Proceso terminado.")
            break
        
        if not nombre_agente:
            print("❌ El nombre del agente no puede estar vacío. Inténtalo de nuevo.")
            continue

        nombre_normalizado = normalizar_nombre(nombre_agente)

        if agente_existe(nombre_normalizado):
            print(f"⚠️  El agente '{nombre_normalizado}' ya existe en la base de datos.")
            continue

        response = supabase.table("agentes").insert({"nombre": nombre_normalizado}).execute()
        
        if response.data:
            print(f"✅ Agente '{nombre_normalizado}' insertado correctamente.")
        else:
            print(f"❌ Error al insertar el agente: {response.error_message or 'Error desconocido'}")

if __name__ == "__main__":
    insertar_agente()