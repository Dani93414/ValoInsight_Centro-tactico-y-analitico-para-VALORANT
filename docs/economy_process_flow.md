# Flujo completo del motor económico

Mongo/Riot match → normalización → rondas/equipos → créditos → inventario → compra real → contexto → compras legales → drops → legalidad → scoring → macro → contexto → round-win → explicación → API → frontend

## Paso 1: Mongo/Riot match

**Entrada**

payload match.

**Proceso**

conserva matchInfo, players, teams y roundResults.

**Salida**

match dict.

**Archivo principal**

state_extractor.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 2: Normalización

**Entrada**

economy raw.

**Proceso**

resuelve UUID, nombre, alias y placeholders.

**Salida**

display objects + warnings.

**Archivo principal**

display_normalizer.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 3: Extracción de rondas/equipos

**Entrada**

match.

**Proceso**

ordena, mapea teams/players y score_before.

**Salida**

round states.

**Archivo principal**

state_extractor.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 4: Reconstrucción de créditos

**Entrada**

spent, remaining e historial.

**Proceso**

reconcilia observed/rules; fuerza resets.

**Salida**

selected credits + quality.

**Archivo principal**

economy_ledger.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 5: Reconstrucción de inventario

**Entrada**

loadout previo + supervivencia.

**Proceso**

propaga sólo equipamiento conservable.

**Salida**

PlayerInventoryState.

**Archivo principal**

inventory.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 6: Inferencia de compra real

**Entrada**

inventario + post-buy + spent.

**Proceso**

clasifica origen y confianza.

**Salida**

purchase hypotheses.

**Archivo principal**

purchase_inference.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 7: Construcción de contexto avanzado

**Entrada**

histórico pre-round.

**Proceso**

enemy, mapa, site, perfil, ultimate, armor y abilities.

**Salida**

advanced_context.

**Archivo principal**

round_recommender.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 8: Generación de compras legales

**Entrada**

créditos + catálogos.

**Proceso**

enumera arma, armor y cargas.

**Salida**

player plans.

**Archivo principal**

legal_purchase.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 9: Resolución de drops

**Entrada**

planes + saldos.

**Proceso**

asigna donante/receptor.

**Salida**

team plans.

**Archivo principal**

team_buy_solver.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 10: Validación de legalidad

**Entrada**

allocation.

**Proceso**

aplica restricciones macro duras.

**Salida**

valid/violations/warnings.

**Archivo principal**

recommendation_validation.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 11: Scoring base

**Entrada**

team plan.

**Proceso**

valora loadout, futuro, sincronía, riesgo y composición.

**Salida**

team_plan_value/score.

**Archivo principal**

team_buy_solver.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 12: Ajuste macro model

**Entrada**

features + artifact.

**Proceso**

suma ajuste acotado a acción compatible.

**Salida**

macro candidate/adjustment.

**Archivo principal**

predict.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 13: Ajuste contextual

**Entrada**

plan + advanced_context.

**Proceso**

aplica ajustes/penalties moderados.

**Salida**

adjusted score.

**Archivo principal**

contextual_scorer.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 14: ML round-win

**Entrada**

candidate features.

**Proceso**

predice v2 o fallback.

**Salida**

ml_prediction.

**Archivo principal**

round_win_model.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 15: Explicación

**Entrada**

ganador + alternativas.

**Proceso**

genera reasons, confidence y warnings.

**Salida**

explained round.

**Archivo principal**

recommendation_explainer.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 16: Respuesta API

**Entrada**

round recommendation.

**Proceso**

serializa contrato /economy-ml con warnings humanos y debug separados.

**Salida**

API response.

**Archivo principal**

interfaces/routes.py.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.

## Paso 17: Render frontend

**Entrada**

API response tipada.

**Proceso**

muestra labels, contexto, candidato macro y loadout rival.

**Salida**

panel UI.

**Archivo principal**

frontend/src/components/modals/MatchDetailModal.tsx.

**Errores posibles**

Dato ausente, catálogo/artifact incompatible o confianza insuficiente; fallback y warning/debug_warning.

**Cómo verificarlo**

Consultar process_trace, la sección JSON y los tests asociados.


El ML round-win es un componente auxiliar dentro del ajuste contextual final; no legaliza compras ni sustituye el modelo macro.
