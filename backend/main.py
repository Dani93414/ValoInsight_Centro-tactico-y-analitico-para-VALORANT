import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import uvicorn

# 1. Importar routers desde módulos hexagonales
from modules.analytics.interfaces.routes import router as analytics_router
from modules.content.interfaces.routes import router as content_router
from modules.leaderboards.interfaces.routes import router as leaderboards_router
from modules.matches.interfaces.routes import router as matches_router
from modules.players.interfaces.routes import router as players_router
from modules.regions.interfaces.routes import router as regions_router

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


# ---- Cache-Control middleware ----
# Content rarely changes (only on Riot patches); player data is more dynamic.
_CACHE_RULES: list[tuple[str, str]] = [
    ("/content/", "public, max-age=86400"),       # 24 h for static content
    ("/leaderboards/", "public, max-age=3600"),    # 1 h for leaderboards
    ("/regions/", "public, max-age=3600"),          # 1 h for region stats
    ("/matches/", "public, max-age=600"),           # 10 min for match list
    ("/players/", "public, max-age=300"),            # 5 min for player data
]


class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        path = request.url.path
        if request.method == "GET" and response.status_code == 200:
            for prefix, header_value in _CACHE_RULES:
                if path.startswith(prefix):
                    response.headers.setdefault("Cache-Control", header_value)
                    break
        return response


app.add_middleware(CacheControlMiddleware)

# -------------------------
# ROUTERS
# -------------------------
app.include_router(content_router, prefix="/content", tags=["Content"])
app.include_router(leaderboards_router, prefix="/leaderboards", tags=["Leaderboards"])
app.include_router(matches_router, prefix="/matches", tags=["Matches"])

# 2. Registrar los nuevos routers
app.include_router(players_router, prefix="/players", tags=["Players"])
app.include_router(regions_router, prefix="/regions", tags=["Regions"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])

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
            "/players",
            "/regions",
            "/analytics"
        ]
    }


if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=False)