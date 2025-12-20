from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import content, leaderboards

app = FastAPI(
    title="Valorant API",
    version="1.0.0",
    description="API de contenido y leaderboards de Valorant"
)

# -------------------------
# CORS
# -------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# ROUTERS
# -------------------------

app.include_router(
    content.router,
    prefix="/content",
    tags=["Content"]
)

app.include_router(
    leaderboards.router,
    prefix="/leaderboards",
    tags=["Leaderboards"]
)

# -------------------------
# ROOT
# -------------------------

@app.get("/")
def root():
    return {
        "status": "ok",
        "endpoints": [
            "/content",
            "/leaderboards"
        ]
    }
