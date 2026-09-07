# Validaci?n del modelo de compras ? 7 de septiembre de 2026

La versi?n activa es `player-buy-v2-two-rounds-defuse-team-300`, con continuaci?n aprendida a partir de transiciones reales. La integraci?n funciona, pero el requisito de ahorro estrat?gico no supera todav?a la aceptaci?n emp?rica. No se han ajustado par?metros ni umbrales a partir de esta auditor?a del test.

## Resultados reproducibles

- 21 pruebas del backend superadas, incluyendo econom?a, historial temporal, presupuesto, ahorro sint?tico y etiquetado de cambios gratuitos.
- 100 partidas recientes, todas del bloque temporal de test: 21270 decisiones; 20838 evaluables y 17639 con horizonte de dos rondas.
- Cero recomendaciones fuera del presupuesto reconstruido; cero partidas compartidas entre entrenamiento, calibraci?n, validaci?n y test.
- Notas entre 51 y 100. 881 recomendaciones de arma, 24 de escudo y 2315 de ambos.
- 136 recomendaciones dejan m?s saldo que la compra observada. Ninguna tiene menor valoraci?n inmediata y mayor valoraci?n conjunta que la compra observada. No hay recomendaciones de ahorro completo.
- Se corrigieron 7 recomendaciones etiquetadas como conservar: realmente cambiaban a un arma gratuita sin aumentar el saldo. Ahora se presentan como cambio de arma. Se repiti? la auditor?a tras la correcci?n.
- Integridad del dataset comprobada frente al hash de entrenamiento. Alterar resultados actuales y futuros en 20 filas no modifica la respuesta del modelo ya entrenado.
- API verificada a trav?s del proxy real de la web, para dos jugadores: 21 rondas cada uno, 21 y 20 evaluables, respectivamente. Ambos reciben la versi?n final. Frontend disponible en http://127.0.0.1:5173/.

## Capacidad predictiva

En 62100 pares de rondas del test, usando entradas anteriores al resultado actual, el error cuadr?tico medio del estimador de dos rondas es 0.143174. La referencia constante obtiene 0.148430; usar la predicci?n inmediata como estimaci?n del resultado de ambas rondas obtiene 0.149663. Menor es mejor.

La diferencia de error frente a la constante, promediando por partida, tiene intervalo bootstrap del 95 % [-0.008008, -0.004826]. Es evidencia predictiva sobre compras observadas, no una estimaci?n del beneficio de seguir recomendaciones. Este test ya se hab?a revisado en versiones anteriores y no constituye una nueva evaluaci?n ciega.

## Criterio de aceptaci?n pendiente

El sistema debe mostrar ejemplos respaldados por datos donde renunciar a valor inmediato mejore la decisi?n conjunta y ese comportamiento debe evaluarse en partidas nuevas. La auditor?a actual no aporta esos ejemplos. No basta con recomendar Classic o un equipamiento barato: el modelo puede hacerlo porque tambi?n lo considera mejor para la ronda actual.

Por ejemplo, una recomendaci?n de Marshal con escudo pesado a Classic con el mismo escudo aumenta el saldo de 1400 a 2350, pero el propio modelo asigna a Classic una probabilidad inmediata mayor (0.4825 frente a 0.4351). Esto no demuestra planificaci?n del ahorro y puede reflejar sesgos de las compras hist?ricas.

Antes de certificar el ahorro se necesita revisar los objetivos de continuaci?n y el soporte de acciones de no compra en entrenamiento/validaci?n; contrastar la pol?tica con una referencia que solo mire la ronda actual; congelar la versi?n y recoger partidas posteriores para una evaluaci?n nueva. Los datos observacionales disponibles no permiten afirmar causalmente cu?l habr?a sido el resultado de una compra alternativa.

## Repetici?n

Desde la ra?z del proyecto:

```powershell
$env:PYTHONPATH='backend'
& '.\venv\Scripts\python.exe' -m unittest discover -s backend/tests -p 'test_player_buy*.py' -q
& '.\venv\Scripts\python.exe' scripts/evaluar_secuencias_compras.py
& '.\venv\Scripts\python.exe' scripts/auditar_compras_jugador.py --matches 100
# Requiere API y frontend en ejecuci?n.
& '.\venv\Scripts\python.exe' scripts/verificar_compras_en_web.py
```

Los informes agregados est?n en `artifacts/player_buy_v2/`. Los ejemplos con identificadores permanecen en `saving_examples.json`, excluido de Git.
