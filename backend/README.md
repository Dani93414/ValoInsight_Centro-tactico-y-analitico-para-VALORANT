# Backend

## Setup

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

## Variables de entorno

Copia `backend/.env.example` a `.env` en la raiz del repo (o exporta variables en entorno):

- `DB_URI`
- `DB_NAME`
- `RIOT_API_KEY`
- `HENRY_API_KEY`
- `CORS_ORIGINS`
- `API_HOST` (opcional, por defecto `0.0.0.0`)
- `API_PORT` (opcional, por defecto `8000`)

## Run

```bash
python main.py
```
