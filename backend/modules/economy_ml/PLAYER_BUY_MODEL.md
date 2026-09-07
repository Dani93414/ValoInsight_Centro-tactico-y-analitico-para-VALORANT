# Evaluación individual de compras

La versión activa es **v2**, con comparación a dos rondas y ahorro explícito.
Véase [PLAYER_BUY_LOOKAHEAD.md](PLAYER_BUY_LOOKAHEAD.md). El resto de este documento
describe la base v1 y sus resultados de referencia.

La pestaña de economía muestra únicamente al jugador seleccionado. Cada ronda
incluye arma y escudo observados al inicio del combate, `loadoutValue`,
`remaining`, créditos calculados antes de comprar, nota de compra y una
alternativa de arma, escudo o ambos cuando el modelo encuentra una diferencia.

## Datos y cálculo de créditos

`player_buy_dataset.py` genera una fila por jugador y ronda. Los créditos no se
predicen: se calculan a partir del `remaining` de la ronda anterior y los ingresos
de esa ronda, con límites y reinicios. Se aplican 200 por baja, 3000 por victoria,
1900/2400/2900 por derrotas consecutivas y 1000 en los casos de supervivencia
penalizada. El plantado paga 300 por atacante. **Por decisión del usuario**, la
desactivación paga también 300 a cada defensor. Esta última es una regla del
proyecto, no una afirmación de verificación oficial.

El código nuevo es independiente del ledger legacy. No se han modificado sus
constantes ni activado el antiguo solver para puntuar las compras nuevas.

Los créditos se etiquetan `fixed_reset`, `observed`, `calculated_rules`,
`incomplete` o `inconsistent`. Las dos últimas categorías no reciben nota. Un
cálculo consistente no prueba que todos los ingresos reales estén registrados:
pueden faltar compensaciones AFK o eventos. La fuente se mantiene en la API.
El valor `string` del proveedor se normaliza: no es un plantado/desactivación y,
en el campo armor presente, representa ausencia de escudo. Un campo armor
ausente se conserva como desconocido.

No se usa `spent` como fuente autoritativa. El gasto se deriva de créditos
iniciales menos remaining. `loadoutValue` se muestra tal como está almacenado y
no se confunde con dinero pagado. Arma/escudo observados no demuestran la compra
individual, el origen de un drop ni la durabilidad exacta de la armadura.

## Dataset e historial

Además de las columnas visibles se guardan identificadores, fecha y versión,
mapa, lado, agente, fase, marcador previo, rachas y créditos previos de ambos
equipos. Las identidades no son features del modelo. El rango procede de la
última partida anterior disponible, no de agregados actuales del dashboard.

Los historiales acumulados se calculan por jugador, jugador/agente,
jugador/arma y jugador/agente/arma: número de rondas, victorias, bajas y daño
asociados al equipamiento inicial. **Estos dos últimos no son una atribución
balística**: un jugador puede cambiar de arma durante la ronda. Se conserva
también el número de bajas explícitamente identificadas con el arma inicial
en `weapon_kills_observed`, sin inventar atribuciones para eventos desconocidos.

Las estadísticas se suavizan con 20 rondas de referencia para que muestras
pequeñas no dominen la predicción. Se almacenan perfiles de todas las armas
anteriores y se recalculan las features históricas para cada alternativa.
Ninguna fila utiliza resultados de su partida ni de partidas simultáneas.
Para partidas nuevas, el servicio reconstruye hasta 1000 partidas anteriores
del jugador. Para partidas incluidas en el dataset, reutiliza sus perfiles
históricos y vuelve a leer la economía del documento actual.

`remaining`, `loadoutValue`, gasto y resultados de la ronda no entran como
estado previo en el modelo. El arma/escudo candidatos y sus valores son la
acción evaluada. Los resultados observados alimentan el label `round_won`.

## Entrenamiento y prueba

Partidas completas ordenadas por fecha, con límites estrictos entre timestamps:

| Bloque | Partidas actuales | Función |
|---|---:|---|
| Ajuste | 1243 | Aprender parámetros (55 %) |
| Calibración | 339 | Calibrar probabilidades (15 %) |
| Validación | 339 | Seleccionar hiperparámetros (15 %) |
| Test | 340 | Evaluación reservada (15 %) |

Los dos primeros bloques forman el 70 % de desarrollo del estimador. La
imputación y codificación se ajustan únicamente en el bloque de ajuste. Se
comparan dos regularizaciones de regresión logística y cuatro combinaciones
de learning rate, hojas y regularización de HistGradientBoosting. La selección
minimiza log loss de validación, sin usar el test para elegir ni activar.
Se exportan los IDs del split y el hash SHA256 del parquet.

Se entrenan además dos snapshots temporales con parámetros fijos para valorar
partidas históricas sin usar modelos ajustados con esas partidas. El modelo
principal solo se usa después del período de selección. Las primeras partidas
del corpus no tienen estimador anterior: se muestran con «No evaluable».

Resultados de esta ejecución: 2261 partidas, 482740 filas, 479280 filas válidas.
Mejor configuración: HistGradientBoosting, learning rate 0.05, 15 hojas,
regularización L2 1, 120 iteraciones y mínimo de 100 muestras por hoja.

| Métrica en test | Modelo | Referencia constante |
|---|---:|---:|
| Log loss | 0.644809 | 0.693147 |
| Brier | 0.227404 | 0.250000 |
| ROC AUC | 0.661751 | 0.500000 |

El informe incluye intervalos bootstrap por partida y resultados por arma,
agente, fase y presencia de historial. Las ablaciones se evalúan en validación:
modelo completo 0.651657 log loss; sin historial personal 0.651771; sin historial
específico del agente 0.651601. **No hay evidencia de una mejora relevante por el
historial específico del agente en esta muestra.** La cobertura de historial
personal es 34 % y con agente 23 %. Se preservan esas señales solicitadas sin
afirmar una personalización que los resultados todavía no demuestran.

La segunda ejecución reproduce el mismo ajuste y test para incorporar al
informe las ablaciones y los desgloses; no cambia la selección usando el test.

## Nota y alternativas

El ML estima el resultado de la ronda para cada combinación de arma y escudo.
Se requiere soporte de al menos cinco partidas de ajuste para la combinación,
fase y franja de 1000 créditos. Se necesita al menos una alternativa comparable.
Este soporte reduce extrapolaciones, pero no garantiza comparabilidad causal.

La nota es `round(100 * p_observada / p_mejor_alternativa)`, incluyendo la
configuración observada entre las alternativas. Es una escala relativa
definida sobre el ML, no una etiqueta humana ni una probabilidad de victoria.
Solo se recomienda un cambio si la diferencia estimada alcanza tres puntos
porcentuales. Ese margen es una convención explícita, no una mejora causal
demostrada ni un intervalo de confianza. No se agregan puntuaciones heurísticas.

La legalidad presupuestaria se calcula, no se aprende. Cuando el jugador viene
de morir o de un reinicio y su gasto permite explicar arma y escudo completos,
se comparan compras de sustitución conservando el gasto residual para otros
conceptos. En otros casos solo se financian cambios con remaining: no se
reembolsa una compra no demostrada, ni se venden armas o escudos conservados.
La compra exacta de habilidades y los drops no se observan; por ello esta
comparación es conservadora y puede omitir alternativas que habrían sido
posibles con información completa. Los precios pertenecen al catálogo congelado
en el entrenamiento, no a un historial de precios por parche.

La auditoría actual cubre 4210 filas de 20 partidas, con 4086 evaluables:
554 cambios de ambos componentes, 280 solo de arma y 11 solo de escudo;
cero recomendaciones fuera del presupuesto calculado. Eso verifica viabilidad
y funcionamiento, **no que seguir las recomendaciones aumente las victorias**.
Los datos son observacionales, sin resultados contrafactuales ni asignación
aleatoria. La calidad predictiva no demuestra optimalidad de compra. El primer
objetivo aprendido es ganar la ronda; no hay recompensa explícita de economía
futura, por lo que debe vigilarse especialmente el comportamiento en ecos.

## Ejecución

Desde la raíz del repositorio, en PowerShell:

```powershell
& '.\venv\Scripts\python.exe' scripts/entrenar_compras_jugador.py
& '.\venv\Scripts\python.exe' scripts/auditar_compras_jugador.py
```

`--refresh` vuelve a consultar Mongo; `--limit` limita las partidas de esa
extracción; `--audit-only` construye e inspecciona sin entrenar. La caché local
de entrada está en `data/player_buy_matches.json.gz`. No se escribe en MongoDB.

Artefactos en `artifacts/player_buy_v1/`: `decisions.parquet`, `splits.json`,
`model.joblib`, `report.json`, `audit.json` y `recommendation_audit.json`.
Los datos individuales y binarios se excluyen de Git; el código y los informes
agregados son revisables. Los modelos se cargan automáticamente al existir.

API: `GET /economy-ml/matches/{match_id}/players/{puuid}/purchases`.
La UI utiliza una clave de caché distinta por partida y jugador, cancela
peticiones obsoletas y muestra los casos sin nota sin recurrir al solver legacy.
