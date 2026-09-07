# Compras y ahorro a dos rondas (v2)

Estado de aceptaci?n: integraci?n verificada; ahorro estrat?gico pendiente de demostrar.
V?ase [VALIDACION_COMPRAS_FINAL.md](VALIDACION_COMPRAS_FINAL.md) para los resultados actualizados.

La nota ya compara el valor esperado de la ronda actual y la siguiente.
No se añade una penalización manual por gastar: el saldo de cada alternativa
determina qué equipamientos podrá evaluar el ML en la siguiente decisión.

## Método activo: continuación aprendida

Para construir sus objetivos se toma el estado observado de la siguiente ronda
y se evalúan sus compras legales con el modelo de una ronda. El máximo
respaldado por datos sirve como objetivo de un regresor. Este regresor solo
recibe contexto actual, equipamiento candidato y saldo candidato; no recibe
resultado, dinero ni equipamiento observados del futuro.

Así puede aprender la relación entre ahorrar y llegar a una mejor decisión
posterior, incluyendo variaciones de contexto que una simulación del jugador
aislado no reproduce. Se ajusta en entrenamiento y se seleccionan tres
configuraciones con el bloque de calibración; el test no elige sus parámetros.
El objetivo es un valor estimado por otro modelo, no una recompensa causal
observada. El sesgo de los datos históricos y del estimador base puede propagarse.

La fórmula activa es `(p_victoria_actual + valor_continuacion_aprendido) / 2`.
La selección explícita de la siguiente compra se realiza al generar los
objetivos de entrenamiento; no se inventa un resultado real para esa compra.
Los modelos históricos de continuación se ajustan con los mismos límites
temporales que sus estimadores base. Reinicios y puntos de partido conservan
el horizonte inmediato.

El test existente ya se había examinado en versiones anteriores: sirve como
regresión comparativa, no sustituye una nueva evaluación ciega en partidas
recogidas después de cerrar esta versión.

## Simulación de referencia

Se conserva como alternativa cuando no existe el estimador de continuación.
La primera auditoría mostró que, por sí sola, favorecía demasiado comprar:
en 120 compras intermedias examinadas no emitió ahorro completo. Por ello el
estimador de transiciones reales es el método preferente.

1. Generar compras asequibles, conservar el equipamiento y no comprar arma ni
   escudo cuando el inventario y presupuesto permitan reconstruir esa opción.
2. Estimar la probabilidad de victoria actual con el modelo entrenado.
3. Estimar supervivencia condicionada a ganar o perder con un segundo
   HistGradientBoosting, ajustado en entrenamiento y calibrado en calibración.
4. En cada rama, calcular créditos futuros a partir del saldo candidato y los
   ingresos correspondientes. No se suponen bajas, plantados ni defuses futuros.
   En la rama de derrota con supervivencia se usan 1000 créditos de manera
   conservadora; una derrota tras plantado podría pagar más.
5. Evaluar con el modelo las compras viables en la siguiente ronda y escoger la
   mejor respaldada por al menos cinco partidas del conjunto de ajuste.
6. Promediar la probabilidad actual y el valor esperado de la siguiente decisión.
   La nota es 100 por el valor observado dividido por el mejor valor candidato.
   La recomendación requiere una diferencia de 0.03 en esa escala de valor.

Si un candidato carece de soporte para sus escenarios futuros, todos los
candidatos de esa ronda se comparan en el horizonte inmediato. No se mezclan
notas de horizontes diferentes. En rondas 12 y 24, prórroga y punto de partido
de cualquiera de los equipos se usa únicamente la ronda actual. En esos casos
no se recomienda ahorrar para un presupuesto que se reinicia o para una ronda
cuya existencia depende de sobrevivir al punto de partido.

Se guarda el arma en la rama de supervivencia. El escudo se presupuesta de nuevo
porque no sabemos su durabilidad futura. Se conserva el gasto residual para
otros conceptos: «no comprar arma ni escudo» no promete recuperar créditos
gastados en habilidades ni vender equipamiento conservado.

## Alcance de la simulación

La economía histórica sigue siendo un cálculo determinista. Las cantidades
futuras son **escenarios**, no datos observados ni una predicción exacta del
dinero de la próxima ronda. El contexto monetario aliado/enemigo se mantiene
fijo; no se simulan las próximas compras de todo el equipo. Esto limita el valor
de las estimaciones, especialmente para ecos coordinadas. La proyección no
reconstruye futuras habilidades, daño, drops ni créditos adicionales.

El dataset v2 conserva marcador previo, supervivencia observada y el enlace a
resultado/arma/escudo de la ronda siguiente. Estos últimos son columnas de
auditoría: **no se usan como entradas al valorar la compra actual**. En lugar
de aprender sin más «ganó la ronda siguiente», el planificador selecciona una
segunda compra asequible y la evalúa con el modelo aprendido. Los historiales y
modelos temporales siguen excluyendo la partida evaluada.

## Entrenamiento y validación

Se ha reentrenado sobre las mismas 2261 partidas y 482740 filas, manteniendo
los splits por partida. El modelo inmediato conserva sus resultados: test
log loss 0.644809, Brier 0.227404 y AUC 0.661751.

El nuevo estimador de supervivencia, condicionado al resultado, tiene en test
log loss 0.370525, Brier 0.127114 y AUC 0.857249. Esta última AUC es condicional:
no representa una predicción de supervivencia sin conocer el resultado.

Sobre 64560 pares consecutivos de las 340 partidas de test, las predicciones
de ambas compras **observadas** obtienen MSE 0.116192 frente a 0.148467 de la
referencia constante. Se excluyen pares que cruzan un reinicio de economía.
El intervalo bootstrap por partida es [0.114246, 0.118642]. Esta evaluación
comprueba los estimadores sobre secuencias reales; no valida causalmente la
política de ahorro ni la calibración en estados futuros simulados.

La auditoría de 4210 filas en 20 partidas ha encontrado 4086 evaluables y cero
recomendaciones por encima del presupuesto calculado. Las pruebas incluyen
un escenario en que ahorrar gana a comprar dos veces, penalización por guardar,
puntos de partido, cambios de mitad, prórroga, ausencia de soporte y cambios
en resultados futuros que no deben alterar la nota.

## Pantalla y ejecución

La recomendación distingue «Ahorrar: no comprar arma ni escudo» y «Ahorrar:
conservar el equipamiento». Al ahorrar muestra saldo y créditos del escenario
de derrota normal, sin extras. Los datos originales del jugador no cambian.

Los artefactos activos están en `artifacts/player_buy_v2/`; v1 permanece como
referencia local. Para regenerarlos y verificarlos desde la raíz:

```powershell
& '.\venv\Scripts\python.exe' scripts/entrenar_compras_jugador.py
& '.\venv\Scripts\python.exe' scripts/ajustar_ahorro_compras.py
& '.\venv\Scripts\python.exe' scripts/evaluar_secuencias_compras.py
& '.\venv\Scripts\python.exe' scripts/auditar_compras_jugador.py --matches 20
```

`ajustar_ahorro_compras.py` solo es necesario para actualizar artefactos creados
antes de integrar la continuación en el entrenamiento principal.

El último comando puede tardar varios minutos: evalúa miles de árboles de
decisión de compras futuras. La API limita los lotes de cálculo a 24 filas
para mantener acotado el uso de memoria.
