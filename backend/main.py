import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 1. Importar los nuevos archivos de rutas
from src.api.routes import content, leaderboards, matches, players, regions 

load_dotenv()

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app = FastAPI(
    title="Valorant API",
    version="1.0.0",
    description="API de contenido, leaderboards, jugadores y regiones de Valorant"
)

# CORS configurable por entorno
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# ROUTERS
# -------------------------
app.include_router(content.router, prefix="/content", tags=["Content"])
app.include_router(leaderboards.router, prefix="/leaderboards", tags=["Leaderboards"])
app.include_router(matches.router, prefix="/matches", tags=["Matches"])

# 2. Registrar los nuevos routers
app.include_router(players.router, prefix="/players", tags=["Players"])
app.include_router(regions.router, prefix="/regions", tags=["Regions"])

# -------------------------
# ROOT
# -------------------------
@app.get("/")
def root():
    return {
        "status": "ok",
        "endpoints": [
            "/content",
            "/leaderboards",
            "/matches",
            "/players",  # Endpoint añadido
            "/regions"   # Endpoint añadido
        ]
    }


if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=False)