from supabase import create_client, Client
import getpass

# Reemplaza con tu URL y API Key de Supabase
SUPABASE_URL = "https://flsfezjgjmnaomwjelhh.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsc2Zlempnam1uYW9td2plbGhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzY5NjE3MywiZXhwIjoyMDY5MjcyMTczfQ.iFAQ1RFp_m0J9gfmS17ZQWlV7Pf52tq-u9NltMkGaKA"

# Crear cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def añadir_jugador_simple():
    """
    Permite añadir un nuevo usuario a `auth.users` y completar su información básica en `jugadores_estadisticas`.
    """
    while True:
        email = input("Introduce el email del jugador (o 'salir' para terminar): ").strip()
        if email.lower() == "salir":
            print("Proceso terminado.")
            break

        # Verificar que el email no esté vacío
        if not email:
            print("El email del jugador no puede estar vacío. Inténtalo de nuevo.")
            continue

        # Pedir la contraseña del usuario, ocultar entrada, y confirmar coincidencia
        while True:
            password = getpass.getpass(f"Introduce la contraseña para {email}: ")
            confirm_password = getpass.getpass("Confirma la contraseña: ")

            if password != confirm_password:
                print("Las contraseñas no coinciden. Inténtalo de nuevo.")
            elif len(password) < 6:
                print("La contraseña debe tener al menos 6 caracteres. Inténtalo de nuevo.")
            else:
                break

        # Crear usuario en auth.users
        user_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password
        })

        if "error" in user_response:
            print(f"Error al crear usuario: {user_response['error']['message']}")
            continue

        user = user_response.user  # Obtener el objeto usuario

        # Obtener el último ID registrado en jugadores_estadisticas
        query = supabase.table("jugadores_estadisticas").select("id").order("id", desc=True).limit(1).execute()

        if query.data:
            last_id = query.data[0]["id"]  # Obtener el ID más alto
            user_id = last_id + 1  # Sumar 1 para el nuevo usuario
        else:
            user_id = 1  # Si no hay jugadores, empezar desde 1

        user_uuid = user.id  # UUID sigue siendo el que genera Supabase

        # Insertar datos básicos en jugadores_estadisticas
        nombre = input("Introduce el nombre del jugador: ").strip()

        stats_response = supabase.table("jugadores_estadisticas").insert({
            "id": user_id,  # Este es el ID del jugador, basado en el ID del usuario
            "usuario_id": user_uuid,  # UUID generado automáticamente
            "nombre": nombre,  # Nombre del jugador ingresado por el usuario
        }).execute()

        if "error" in stats_response and stats_response["error"]:
            print(f"Error al añadir jugador en estadísticas: {stats_response['error']['message']}")
        else:
            print(f"Jugador '{nombre}' añadido correctamente a 'jugadores_estadisticas'.")

if __name__ == "__main__":
    añadir_jugador_simple()