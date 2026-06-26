# TFG - Backend y Frontend Separados

Este repositorio usa dos capas:

- Backend: FastAPI en `backend/main.py` (puerto `8000`)
- Frontend: React + Vite en `frontend/` (puerto `5173`)

## Variables de entorno

Hay ejemplos en:

- `/.env.example` para scripts Python y variables compartidas
- `/backend/.env.example` para backend
- `/frontend/.env.example` para frontend

Variables nuevas de desacoplamiento:

- `CORS_ORIGINS`: orígenes permitidos para backend (ej: `http://localhost:5173`)
- `VITE_API_BASE_URL`: URL base de API en frontend (ej: `http://localhost:8000`)

## Arranque local

1. Backend

```bash
cd backend
python main.py
```

2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Estado de la separación

Fase 1 y Fase 2 (estructura) aplicadas:

- CORS del backend parametrizado por entorno.
- Cliente API del frontend sin URLs hardcodeadas por archivo.
- Base URL API centralizada en `frontend/src/api/config.ts`.
- Backend movido a `backend/` (`main.py`, `src/`, `db/`, `tests/`, `requirements.txt`).
- Scripts en `scripts/` actualizados para resolver imports desde `backend/`.

## Flujo Final De Partidas (Un Comando)

Pipeline recomendado para descargar partidas nuevas, evitar duplicados contra MongoDB,
convertir al formato final, subirlas con insercion paralela y reconstruir estadisticas derivadas:

```bash
python scripts/pipeline_partidas.py --matches-per-player 5 --fill-requested --delete-duplicates
```

Opciones útiles:

- Jugadores concretos:

```bash
python scripts/pipeline_partidas.py --matches-per-player 5 --fill-requested --delete-duplicates --players "No Screams#GFS" "No Smoking#Camel"
```

- Sin subida a Mongo (solo descarga+conversión):

```bash
python scripts/pipeline_partidas.py --matches-per-player 5 --skip-upload
```

- Verificación final de integridad:

```bash
python scripts/pipeline_partidas.py --matches-per-player 5 --fill-requested --delete-duplicates --verify --expected-per-player 405
```

- Sacar 700 partidas nuevas buscando anteriores si hay repetidas:

```bash
python scripts/pipeline_partidas.py --matches-per-player 700 --fill-requested --no-max-history-scan --delete-duplicates
```
