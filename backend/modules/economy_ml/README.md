# Economy ML

Sistema conservador de recomendación económica orientado al valor de partida.

## Contrato de datos

Cada fila separa tres conceptos:

- `estado_precompra`: marcador, ronda, lado, rachas, rango y créditos estimados
  secuencialmente desde el saldo anterior y las reglas de ingreso;
- `acción`: categoría de compra y perfil postcompra observado;
- `labels`: victoria de ronda y victoria de partida.

Armas, armaduras y loadout observados no forman parte del estado precompra.
Durante la recomendación, cada alternativa genera un perfil postcompra
contrafactual coherente mediante `action_profiles.py`. El modelo nunca evalúa
una ECO conservando los rifles de la compra real.

No se usan como features kills, damage, resultado de la ronda actual,
plant/defuse ni economía rival postcompra.

La estimación de créditos y las features del modelo no usan `spent + remaining`
ni `action_total_spent` de la ronda actual porque
en algunas fuentes `spent` se deriva del loadout y filtraría la acción real.
Se reinicia en pistolas/cambio de mitad/overtime y se actualiza con saldo
anterior, victoria/racha de derrotas y bonus de plant de la ronda anterior.

## Interpretación

El entrenamiento estima valor de partida con datos observacionales y ajuste por
propensión mediante pesos estabilizados. Las probabilidades se calibran sobre
partidas posteriores y se evalúan en un tercer bloque temporal.
Si menos del 90% de filas tiene fecha válida, el dataset se rechaza en
lugar de simular una validación temporal.

Esto reduce sesgo, pero no demuestra causalidad ni convierte la salida en una
acción óptima demostrada. Una acción solo puede recomendarse cuando:

- es económicamente viable;
- tiene soporte histórico suficiente en el scope cargado;
- su propensión estimada en el estado actual supera el mínimo configurado.

La confianza mostrada es un margen ajustado por soporte, no una garantía.

## Comandos

```bash
python -m backend.modules.economy_ml.dataset_builder ./partidas --output backend/modules/economy_ml/artifacts/economy_round_dataset.parquet
python -m backend.modules.economy_ml.train --dataset backend/modules/economy_ml/artifacts/economy_round_dataset.parquet
```

Endpoints:

- `GET /economy-ml/status`
- `POST /economy-ml/train`
- `GET /matches/{match_id}/economy-ml`

Los artefactos incluyen una versión de esquema. Artefactos antiguos, parciales
o incompatibles no se cargan. El entrenamiento publica modelos mediante una
carpeta temporal y solo sustituye los artefactos previos cuando se ha generado
al menos un modelo compatible. Si no hay un modelo compatible, la API devuelve
`available: false` y la UI mantiene la heurística como fallback visual.

El entrenamiento HTTP está deshabilitado salvo que exista
`ECONOMY_ML_TRAIN_TOKEN`; requiere ese valor en
`X-Economy-ML-Train-Token` y bloquea entrenamientos concurrentes.
