from fastapi import APIRouter
from modules.regions.infrastructure import mongo_region_repo

router = APIRouter()

@router.get("/")
def get_regions():
    """
    Devuelve las estadísticas globales de todas las regiones 
    recalculadas por el motor central.
    """
    return mongo_region_repo.get_all_sorted()