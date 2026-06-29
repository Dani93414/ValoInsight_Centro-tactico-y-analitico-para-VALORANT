# Economy ML

Motor player-first de recomendacion economica para VALORANT. La legalidad,
inventario individual, drops y economia futura gobiernan la decision. El ML es
un estimador auxiliar y nunca puede convertir un plan ilegal en viable.

El endpoint de partida usa `RoundEconomyRecommender`: infiere varias hipotesis
de compra real, genera compras legales por jugador, resuelve drops de armas y
puntua planes completos. `ACTION_TEMPLATES` queda relegado al flujo historico
legacy y no es la fuente de las recomendaciones expuestas por la API.

Los dos endpoints de lectura de partida usan el mismo contrato:

- `/matches/{match_id}/economy-ml` (consumido por la UI principal).
- `/economy-ml/matches/{match_id}` (ruta directa del modulo).

Ambos devuelven `engine: player_first_v10`, `rounds`, `limitations`, compras
observadas/inferidas/recomendadas y proyecciones por jugador. `predict.py`,
`policy.py`, `action_profiles.py`, `team_plan.py`, `plan_allocator.py` y
`player_recommendations.py` forman el pipeline macro legacy; ningun endpoint de
produccion los usa para recomendar.

`confidence` combina calidad de reconciliacion e incertidumbre de inferencia.
Los `warnings` indican costes ausentes, hipotesis no observables, falta de apoyo
ML o penalizaciones de composicion. Un warning reduce confianza; no convierte
un plan ilegal en valido.

## Coste Y Valor De Armas

El motor no mezcla el pago de la ronda con la potencia del inventario:

- `weapon_cost`: creditos pagados por ese jugador por su arma esta ronda.
- `weapon_purchase_cost`: precio que debe pagar quien compra el arma; en un
  drop lo paga el donor, no el receptor.
- `weapon_value`: valor tactico/economico del arma equipada para el scoring.
- `weapon_source`: `bought_self`, `carried`, `dropped` o `none`.
- `keep_weapon`: solo es `true` cuando `weapon_source == carried`.

Una Vandal conservada tiene `weapon_cost = 0` y `weapon_value = 2900`. Una
Vandal recibida por drop tambien cuesta 0 al receptor, conserva valor 2900 y
carga los 2900 creditos al comprador.

## Normalizacion Y Mensajes

`display_normalizer.py` convierte UUID, nombres localizados y placeholders en
objetos estables antes de construir inventario o responder a la UI. La API
conserva `weapon_raw` y `armor_raw` para auditoria, pero expone
`weapon_display`, `armor_display` y etiquetas legibles. `string`, valores vacios
y escudos ausentes nunca se muestran literalmente.

Las habilidades se reconcilian por agente y slot (`C/Q/E/X`) antes que por
nombre. Asi, nombres localizados como `Flecha explosiva` reutilizan el coste y
las cargas del alias canonico `Shock Bolt` sin falsos `missing_cost`.

`warnings` contiene mensajes para usuario, `debug_warnings` conserva codigos
tecnicos y `limitations` agrupa limitaciones globales como la ausencia del ML
auxiliar. En pistol, la Classic inicial se explica como arma gratuita y los
planes usan etiquetas `PISTOL_DEFAULT`, `PISTOL_UTILITY`, `PISTOL_ARMOR` o
`PISTOL_SIDEARM`.

## Contrato De Datos

Cada fila separa tres conceptos:

- Estado precompra: marcador, ronda, lado, rachas, rango, composicion y
  creditos seleccionados antes de comprar.
- Accion: categoria de compra y perfil postcompra observado o simulado.
- Labels: resultado de ronda, partida y economia futura.

No se usan como features pre-round kills, damage, resultado de la ronda actual,
plant/defuse actual, score post-round ni loadout enemigo post-buy.

## Creditos

La economia separa tres valores:

- `prebuy_credits_observed`: suma `remaining + spent` cuando la fuente lo trae.
- `prebuy_credits_rules`: reconstruccion por reglas desde la ronda anterior:
  saldo tras compra, win/loss reward, loss streak, kill reward, spike plant
  reward, save penalty, resets de pistol/cambio de mitad/overtime y cap 9000.
- `prebuy_credits_selected`: valor usado por el modelo. En resets obligatorios
  usa reglas. Si observed falta, usa reglas. Si observed y rules chocan mucho,
  usa reglas y marca `credit_estimate_quality = inconsistent`.

Los alias `team_estimated_credits_before_buy` y
`enemy_estimated_credits_before_buy` apuntan al valor selected por
compatibilidad. `prebuy_credits_rules` no debe copiar directamente
`spent + remaining` de la ronda actual.

## Taxonomia

Solo Bulldog, Guardian, Phantom y Vandal cuentan como rifles reales. Operator,
Outlaw y Marshal son snipers y nunca reciben `rifle_default`.

Regen Shield es armadura real intermedia:

- Light Shield: 400 creditos.
- Regen Shield: 650 creditos.
- Heavy Shield: 1000 creditos.

Regen cuenta como armadura fuerte parcial. En fullbuy se permite como downgrade
explicito frente a Heavy Shield con warning y penalty de coherencia.

## Planes Y Cashflow

El analisis postpartida legacy separa:

- `target_loadout_case`: loadout objetivo observado o contrafactual.
- `observed_cashflow_case`: cashflow real observado.
- `planned_cashflow_case`: cashflow calculado para la accion candidata.
- `cashflow_case`: alias compatible que en planes contrafactuales apunta al
  planned cashflow.

Estas etiquetas proceden del post-buy observado y por ello no pertenecen a
`MODEL_FEATURES`. El motor player-first puntua combinaciones individuales
legales y conserva los creditos restantes de cada jugador para las proyecciones.

## Limitaciones

- Modelo observacional, no causal.
- La compra real de habilidades puede no ser observable.
- Las pickups y drops observados pueden ser hipotesis con confianza reducida.
- AFK compensation se marca como inferida si no esta confirmada.
- Datos incompletos o corruptos de la API pueden degradar la confianza.

## Comandos

Reentrenamiento local:

```powershell
venv\Scripts\python.exe scripts\entrenamiento_economia.py
```

Tests backend:

```powershell
$env:PYTHONPATH='backend'; & '.\venv\Scripts\python.exe' -m unittest backend.tests.test_economy_ml backend.tests.test_economy_ledger backend.tests.test_economy_engine_v10 backend.tests.test_economy_routes_v10
```

Build frontend:

```powershell
cd frontend
npm run build
```

Comprobar status del modelo:

```powershell
$env:PYTHONPATH='backend'; venv\Scripts\python.exe -c "from modules.economy_ml.model_registry import status; print(status())"
```

Los artefactos incluyen `schema_version`. Con `SCHEMA_VERSION = 10`, artefactos
v9 o anteriores se rechazan hasta reentrenar porque se eliminaron features con
leakage derivadas del post-buy observado.
