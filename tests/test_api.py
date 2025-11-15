import os
import requests
from dotenv import load_dotenv

# Cargar variables del archivo .env
load_dotenv()

API_KEY = os.getenv("RIOT_API_KEY")

# Datos de ejemplo (puedes cambiarlos)
REGION = "europe"  # cambia según tu servidor ("na", "ap", etc.)
GAME_NAME = "No Screams"  # nombre de jugador
TAG_LINE = "GFS"    # tag del jugador

# Construir URL del endpoint
url = f"https://{REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{GAME_NAME}/{TAG_LINE}"

# Encabezado con la API key
headers = {"X-Riot-Token": API_KEY}

# Hacer la petición
response = requests.get(url, headers=headers)

# Mostrar el resultado
if response.status_code == 200:
    print("✅ Conexión correcta con la API de Riot")
    print("Datos del jugador:")
    print(response.json())
else:
    print("❌ Error al conectar con la API")
    print("Código de estado:", response.status_code)
    print("Mensaje:", response.text)
