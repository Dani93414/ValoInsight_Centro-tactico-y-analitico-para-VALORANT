# TFG - Backend y Frontend Separados

## Ingesta de partidas: esquema v2 (Riot RAW)

Las partidas nuevas usan por defecto `MATCH_SOURCE=riot_raw`. El historial de
HenrikDev sigue proporcionando IDs, pero cada detalle se solicita mediante su
proxy RAW y se adapta antes de persistirse; ningún lector de Mongo depende del
JSON RAW. El endpoint legacy anterior era `GET /valorant/v4/match/{region}/{id}`.

```text
Henrik history → classify IDs → Riot RAW via Henrik → riot_raw_adapter
→ ValoInsight schema v2 → Mongo → rebuild analytics / players / regions
```

Schema v1 (`henrik_legacy`) y v2 (`riot_raw`) coexisten. Al pedir un jugador,
los legacy del historial se auditan y se actualizan in situ si Riot entrega un
RAW reconocible; se conservan `matchInfo.matchId`, nombres válidos y analytics
embebidas hasta el rebuild. Los intentos no disponibles se marcan en
`rawRefresh` para que no se reintenten indefinidamente.

Para el detalle de una partida, el body RAW es:

```json
{"platform":"pc","queries":"","region":"eu","type":"matchdetails","value":"MATCH_ID"}
```

`type=matchdetails` selecciona el recurso interno equivalente a
`GET https://pd.eu.a.pvp.net/match-details/v1/matches/{MATCH_ID}`; `value` es el
ID, `region` el shard, `platform` la plataforma y `queries` queda vacío al no
necesitar parámetros de query. Ejemplo:

```bash
curl -X POST "https://api.henrikdev.xyz/valorant/v1/raw" \
  -H "Authorization: HENRIK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platform":"pc","queries":"","region":"eu","type":"matchdetails","value":"MATCH_ID"}'
```

Comandos útiles:

```bash
python scripts/pipeline_partidas.py --players "Name#Tag" --matches-per-player 30
python scripts/pipeline_partidas.py --players "Name#Tag" --refresh-all-legacy
python scripts/refresh_match_from_riot_raw.py MATCH_ID --dry-run
python scripts/backfill_riot_raw.py --all --limit 100 --dry-run
python scripts/compare_legacy_vs_raw_match.py MATCH_ID
```

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
