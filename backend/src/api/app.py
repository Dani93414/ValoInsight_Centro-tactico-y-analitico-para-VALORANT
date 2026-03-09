from fastapi import FastAPI
from src.api.routes import analytics, content, leaderboards

app = FastAPI(
    title="ValoInsight",
    description="API de contenido de Valorant",
    version="1.0.0"
)

app.include_router(content.router, prefix="/content", tags=["Content"])
app.include_router(leaderboards.router, prefix="/leaderboards", tags=["Leaderboards"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
