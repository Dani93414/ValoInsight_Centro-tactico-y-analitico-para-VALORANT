# Economy ML

Sistema conservador de recomendacion economica para VALORANT. El modelo es
observacional: estima valor de plan con soporte historico, pero no demuestra
causalidad ni garantiza que una accion sea optima.

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

El plan separa:

- `target_loadout_case`: loadout objetivo observado o contrafactual.
- `observed_cashflow_case`: cashflow real observado.
- `planned_cashflow_case`: cashflow calculado para la accion candidata.
- `cashflow_case`: alias compatible que en planes contrafactuales apunta al
  planned cashflow.

La recomendacion se ordena por `team_plan_value`. `delta_team_plan_value` es la
metrica principal frente a la compra real. `delta_vs_real` se conserva solo como
diferencia secundaria de probabilidad estimada de partida.

## Limitaciones

- Modelo observacional, no causal.
- La compra real de habilidades puede no ser observable.
- Drops y transferencias pueden requerir reconciliacion.
- AFK compensation se marca como inferida si no esta confirmada.
- Datos incompletos o corruptos de la API pueden degradar la confianza.

## Comandos

Reentrenamiento local:

```powershell
venv\Scripts\python.exe scripts\entrenamiento_economia.py
```

Tests backend:

```powershell
$env:PYTHONPATH='backend'; venv\Scripts\python.exe -m unittest backend.tests.test_economy_ml backend.tests.test_economy_ledger
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

Los artefactos incluyen `schema_version`. Con `SCHEMA_VERSION = 9`, artefactos
v8 o anteriores se rechazan hasta reentrenar.
