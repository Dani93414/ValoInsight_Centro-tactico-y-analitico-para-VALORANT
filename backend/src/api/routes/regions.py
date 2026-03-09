from fastapi import APIRouter
from db.mongo_client import regions_collection

router = APIRouter()

@router.get("/")
def get_regions():
    """
    Devuelve las estadísticas globales de todas las regiones 
    recalculadas por el motor central.
    """
    # Buscamos todas las regiones, quitando el _id de Mongo que no sirve en el Front
    regiones = list(regions_collection.find({}, {"_id": 0}))
    
    # Opcional: Ordenarlas por K/D medio o por número de jugadores antes de enviarlas
    regiones_ordenadas = sorted(regiones, key=lambda x: x.get("avg_kd", 0), reverse=True)
    
    return regiones_ordenadas