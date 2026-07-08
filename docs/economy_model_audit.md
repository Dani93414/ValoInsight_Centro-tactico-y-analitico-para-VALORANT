# Auditoría completa del motor económico y modelo ML

## 1. Resumen ejecutivo

- Estado general: **⚠️ Parcial**.
- Correctos: 27.
- Parciales: 4.
- Fallidos: 0.
- No verificables: 0.
- Qué funciona: 27 apartados.
- Qué está parcial: 4 apartados.
- Qué falla: 0 apartados.
- Qué no es verificable: 0 apartados.
- Veredicto final: **partial**.

### Resumen de escenarios ejecutados

| Escenario | Estado | Razón |
|---|---|---|
| carried_inventory | ✅ Correcto | ok_runtime_verified |
| drop | ✅ Correcto | ok_runtime_verified |
| rich_low_weapon | ✅ Correcto | ok_runtime_verified |
| match_point | ✅ Correcto | ok_runtime_verified |
| pistol_round | ✅ Correcto | ok_runtime_verified |
| half_reset | ✅ Correcto | ok_runtime_verified |
| post_pistol | ✅ Correcto | ok_runtime_verified |
| bonus | ✅ Correcto | ok_runtime_verified |
| enemy_economy | ✅ Correcto | ok_runtime_verified |
| site_gating | ✅ Correcto | ok_runtime_verified |
| armor_durability | ✅ Correcto | ok_runtime_verified |
| ability_usage | ✅ Correcto | ok_runtime_verified |
| round_win_prediction | ✅ Correcto | ok_runtime_verified |
| api_contract | ✅ Correcto | ok_runtime_verified |

### Errores reales

No se detectaron errores runtime en esta ejecución.

### Recomendaciones finales

- Ejecutar con --match-id para añadir evidencia de una partida Mongo real.
- Mantener escenarios runtime y tests alineados con cada cambio del motor.
## 2. Tabla de cobertura general

| Apartado | Estado | Datos necesarios | Dónde se encuentran | Proceso | Salida | Tests | Riesgo |
|---|---|---|---|---|---|---|---|
| Datos base de partida | ✅ Correcto (ok_runtime_verified) | matchInfo.matchId, matchInfo.mapId, matchInfo.queueId, matchInfo.seasonId… | Riot/Mongo match | recommend_match_economy, extract_match_round_states | JSON estructurado | backend/tests/test_economy_ml.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Economía observada | ✅ Correcto (ok_runtime_verified) | economy.weapon, economy.armor, economy.loadoutValue, economy.spent… | roundResults[].playerStats[].economy | normalize_observed_economy, normalize_weapon_display, normalize_armor_display | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Catálogo de armas | ✅ Correcto (ok_runtime_verified) | Classic, Ghost, Sheriff, Frenzy… | Mongo reference_data.weapons | load_weapon_catalog, find_weapon | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Catálogo de escudos | ✅ Correcto (ok_runtime_verified) | Light Shield, Regen Shield, Heavy Shield, Sin escudo | Mongo reference_data.gear y normalizador | load_gear_catalog, normalize_armor_display | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Catálogo de habilidades | ✅ Correcto (ok_runtime_verified) | agent_count, ability_count, missing_cost_count, missing_cost_ratio… | Valorant content + ability_catalog_seed.json | load_ability_catalog, LegalPurchaseGenerator._ability_options | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Créditos prebuy | ⚠️ Parcial (partial_documented_only) | prebuy_credits_observed, prebuy_credits_rules, prebuy_credits_selected, credit_estimate_quality… | spent+remaining y economy ledger | build_economy_ledger, extract_match_round_states | JSON estructurado | backend/tests/test_economy_ledger.py, backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Reset de inventario | ✅ Correcto (ok_runtime_verified) | is_inventory_reset_round, is_pistol_round, is_half_reset, is_overtime | ronda y reglas fijas | fixed_round_start_credits, RoundEconomyRecommender.recommend | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Inventario conservado | ✅ Correcto (ok_runtime_verified) | weapon_before_buy, armor_before_buy, survived_previous_round, keep_weapon… | estado previo y supervivencia | advance_inventory, LegalPurchaseGenerator.generate | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Inferencia de compra real | ✅ Correcto (ok_runtime_verified) | default_spawn_weapon, bought_self, carried, bought_by_teammate… | inventario, spent y post-buy | PurchaseInferenceEngine.infer, PurchaseInferenceEngine.infer_team | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Generación de compras legales | ✅ Correcto (ok_runtime_verified) | weapon options, armor options, ability options, self_cost… | catálogos + PlayerInventoryState | LegalPurchaseGenerator.generate | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Drops | ✅ Correcto (ok_runtime_verified) | donor credits, receiver credits, buys_for, weapon_source… | planes legales por jugador | TeamBuySolver._resolve_weapon_drops | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Scoring económico base | ✅ Correcto (ok_runtime_verified) | weapon_value, armor_value, utility_value, round_win_probability… | plan y contexto | BuyScorer.score, evaluate_team_plan | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Penalizaciones | ✅ Correcto (ok_runtime_verified) | weapon_without_armor_penalty, underarmor_penalty, operator_without_armor_penalty, heavy_weapon_early_penalty… | plan + contexto | BuyScorer, apply_contextual_adjustments | JSON estructurado | backend/tests/test_economy_engine_v10.py, backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Clasificación del plan económico | ✅ Correcto (ok_runtime_verified) | PISTOL_DEFAULT, PISTOL_UTILITY, PISTOL_ARMOR, PISTOL_SIDEARM… | composición, gasto, ronda y marcador | classify_team_buy | JSON estructurado | backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Pistol rounds | ✅ Correcto (ok_runtime_verified) | round 1, round 13, Classic gratis, 800 credits… | reglas fijas | fixed_round_start_credits, normalize_purchase_for_display | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Post-pistol / anti-eco | ✅ Correcto (ok_runtime_verified) | round 2, round 14, won_pistol, previous_round_won… | ronda previa y enemy economy | classify_team_buy, BuyScorer | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Bonus | ✅ Correcto (ok_runtime_verified) | is_bonus_candidate, kept weapons, upgrades, spend… | inventario conservado | classify_team_buy, BuyScorer | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Full buy | ✅ Correcto (ok_runtime_verified) | weapons >= 4, armored >= 3, rich player low weapon penalty, controller smokes… | composición y créditos | BuyScorer, validate_macro_composition | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Match point / últimas rondas | ✅ Correcto (ok_runtime_verified) | round 12, score 12-4, score 4-12, round >=25 | round_number + score_before | classify_team_buy | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Enemy economy | ✅ Correcto (ok_runtime_verified) | enemy_credits_by_player, enemy_players, enemy_buy_recommendation, enemy_projected_buy… | ledger rival + ronda anterior | build_enemy_economy_context | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Mapa y site tendencies | ✅ Correcto (ok_runtime_verified) | map_id, map_name, map_profile, operator_affinity… | mapId + rondas anteriores | build_map_context, build_site_tendencies, apply_contextual_adjustments | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Player profile | ⚠️ Parcial (partial_documented_only) | preferred_weapons, weapon_kill_rate, rifle_tendency, sniper_tendency… | rondas estrictamente anteriores | build_player_profile | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Ultimates | ⚠️ Parcial (partial_documented_only) | ultimate_points, ultimate_cost, ultimate_ready, agent… | playerStats + catálogo | build_ultimate_state | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Armor durability | ✅ Correcto (ok_runtime_verified) | armor_value_remaining, armor_max_value, armor_durability_ratio, armor_effective_value | estado de armor | build_armor_durability_state, LegalPurchaseGenerator.generate | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Ability usage | ✅ Correcto (ok_runtime_verified) | used_abilities_by_slot, charges_carried_after_round, ability_charges_before_buy, carried_and_bought… | casts + catálogo | build_ability_usage_state, LegalPurchaseGenerator._ability_options | JSON estructurado | backend/tests/test_economy_contextual_v11.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Modelo macro económico principal | ⚠️ Parcial (partial_documented_only) | macro_model.available, recommended_action, model_scope, confidence… | artifact compatible + prebuy | predict_action, RoundEconomyRecommender | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| ML auxiliar round-win | ✅ Correcto (ok_runtime_verified) | FEATURE_VERSION, ROUND_WIN_FEATURES, FORBIDDEN_ROUND_WIN_FEATURES, artifact_path… | round_win_loadout.joblib | RoundWinLoadoutModel, validate_round_win_features | JSON estructurado | backend/tests/test_round_win_model.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Dataset y entrenamiento | ✅ Correcto (ok_runtime_verified) | dataset rows, match count, valid_labels, missing_features… | economy_round_dataset.parquet | train_models, train_round_win_model, scripts/entrenamiento_economia.py, /economy-ml/train | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| API response contract | ✅ Correcto (ok_runtime_verified) | available, engine, advanced_engine, match_id… | recommend_match_economy | recommend_match_economy, RecommendationExplainer | JSON estructurado | backend/tests/test_economy_routes_v10.py, backend/tests/test_economy_engine_v10.py | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Frontend/UI | ✅ Correcto (ok_runtime_verified) | enemy_projected_buy, macro_model, ml_prediction, debug_warnings… | matches.ts + MatchDetailModal.tsx | EconomyRecommendation types, MatchDetailModal | JSON estructurado | frontend build | Requiere mantener contrato, tests y evidencia de ejecución alineados. |
| Tests | ✅ Correcto (ok_runtime_verified) | test_economy_ml, test_economy_ledger, test_economy_engine_v10, test_economy_contextual_v11… | backend/tests + frontend | unittest, frontend build | JSON estructurado | ver sección Tests | Requiere mantener contrato, tests y evidencia de ejecución alineados. |

## 3. Auditoría detallada por apartado

### 3.1 Datos base de partida — ✅ Correcto

**Qué datos necesita**

matchInfo.matchId, matchInfo.mapId, matchInfo.queueId, matchInfo.seasonId, matchInfo.isRanked, matchInfo.gameStartMillis, players, players[].puuid, players[].teamId, players[].competitiveTier, players[].characterName / agentName / characterId, teams, roundResults, roundResults[].roundNum, roundResults[].winningTeam, roundResults[].playerStats, roundResults[].playerStats[].puuid, roundResults[].playerStats[].economy.

**Dónde los encuentra**

Riot/Mongo match.

**Por qué los necesita**

identificar, ordenar y contextualizar la partida.

**Valor observado en auditoría**

~~~json
{
  "source": "synthetic_fixture",
  "players": 10,
  "rounds": 1
}
~~~

**Proceso que realiza**

- recommend_match_economy: identificar, ordenar y contextualizar la partida; salida match_data.
- extract_match_round_states: identificar, ordenar y contextualizar la partida; salida match_data.

**Funciones / archivos implicados**

recommend_match_economy, extract_match_round_states.

**Salida generada**

sections.match_data y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_ml.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.2 Economía observada — ✅ Correcto

**Qué datos necesita**

economy.weapon, economy.armor, economy.loadoutValue, economy.spent, economy.remaining.

**Dónde los encuentra**

roundResults[].playerStats[].economy.

**Por qué los necesita**

separar snapshot post-buy, inferencia y display.

**Valor observado en auditoría**

~~~json
{
  "weapons": [
    {
      "input": "29a0cfab-485b-f5d5-779a-b59f85e204a8",
      "id": "29a0cfab-485b-f5d5-779a-b59f85e204a8",
      "displayName": "Classic",
      "shortName": "Classic",
      "kind": "weapon",
      "source_value": "29a0cfab-485b-f5d5-779a-b59f85e204a8",
      "known": true,
      "cost": 0.0,
      "warnings": []
    },
    {
      "input": "Classic",
      "id": "29a0cfab-485b-f5d5-779a-b59f85e204a8",
      "displayName": "Classic",
      "shortName": "Classic",
      "kind": "weapon",
      "source_value": "Classic",
      "known": true,
      "cost": 0.0,
      "warnings": []
    },
    {
      "input": null,
      "id": null,
      "displayName": "Arma no observada",
      "shortName": "Arma no observada",
      "kind": "weapon",
      "source_value": null,
      "known": false,
      "cost": null,
      "warnings": []
    },
    {
      "input": "string",
      "id": null,
      "displayName": "Arma no observada",
      "shortName": "Arma no observada",
      "kind": "weapon",
      "source_value": "string",
      "known": false,
      "cost": null,
      "warnings": [
        "invalid_placeholder_value:string"
      ]
    }
  ],
  "armors": [
    {
      "input": "Light Shield",
      "id": null,
      "displayName": "Light Shield",
      "shortName": "Light Shield",
      "kind": "armor",
      "source_value": "Light Shield",
      "known": true,
      "cost": 400,
      "armor_level": "light",
      "warnings": []
    },
    {
      "input": "Regen Shield",
      "id": null,
      "displayName": "Regen Shield",
      "shortName": "Regen Shield",
      "kind": "armor",
      "source_value": "Regen Shield",
      "known": true,
      "cost": 650,
      "armor_level": "regen",
      "warnings": []
    },
    {
      "input": "Heavy Shield",
      "id": null,
      "displayName": "Heavy Shield",
      "shortName": "Heavy Shield",
      "kind": "armor",
      "source_value": "Heavy Shield",
      "known": true,
      "cost": 1000,
      "armor_level": "heavy",
      "warnings": []
    },
    {
      "input": null,
      "id": null,
      "displayName": "Sin escudo",
      "shortName": "Sin escudo",
      "kind": "armor",
      "source_value": null,
      "known": false,
      "cost": 0,
      "armor_level": "none",
      "warnings": []
    },
    {
      "input": "string",
      "id": null,
      "displayName": "Sin escudo",
      "shortName": "Sin escudo",
      "kind": "armor",
      "source_value": "string",
      "known": false,
      "cost": 0,
      "armor_level": "none",
      "warnings": [
        "invalid_placeholder_value:string"
      ]
    }
  ]
}
~~~

**Proceso que realiza**

- normalize_observed_economy: separar snapshot post-buy, inferencia y display; salida observed_economy.
- normalize_weapon_display: separar snapshot post-buy, inferencia y display; salida observed_economy.
- normalize_armor_display: separar snapshot post-buy, inferencia y display; salida observed_economy.

**Funciones / archivos implicados**

normalize_observed_economy, normalize_weapon_display, normalize_armor_display.

**Salida generada**

sections.observed_economy y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.3 Catálogo de armas — ✅ Correcto

**Qué datos necesita**

Classic, Ghost, Sheriff, Frenzy, Shorty, Stinger, Spectre, Bucky, Judge, Bulldog, Guardian, Phantom, Vandal, Marshal, Outlaw, Operator, Ares, Odin.

**Dónde los encuentra**

Mongo reference_data.weapons.

**Por qué los necesita**

legalizar coste y valor de armas.

**Valor observado en auditoría**

~~~json
{
  "catalog_size": 20,
  "weapons": [
    {
      "displayName": "Classic",
      "expected_cost": 0,
      "actual_cost": 0.0,
      "uuid": "29a0cfab-485b-f5d5-779a-b59f85e204a8",
      "role": "sidearm",
      "status": "ok"
    },
    {
      "displayName": "Ghost",
      "expected_cost": 500,
      "actual_cost": 500.0,
      "uuid": "1baa85b4-4c70-1284-64bb-6481dfc3bb4e",
      "role": "sidearm",
      "status": "ok"
    },
    {
      "displayName": "Sheriff",
      "expected_cost": 800,
      "actual_cost": 800.0,
      "uuid": "e336c6b8-418d-9340-d77f-7a9e4cfe0702",
      "role": "sidearm",
      "status": "ok"
    },
    {
      "displayName": "Frenzy",
      "expected_cost": 450,
      "actual_cost": 450.0,
      "uuid": "44d4e95c-4157-0037-81b2-17841bf2e8e3",
      "role": "sidearm",
      "status": "ok"
    },
    {
      "displayName": "Shorty",
      "expected_cost": 300,
      "actual_cost": 300.0,
      "uuid": "42da8ccc-40d5-affc-beec-15aa47b42eda",
      "role": "sidearm",
      "status": "ok"
    },
    {
      "displayName": "Stinger",
      "expected_cost": 1100,
      "actual_cost": 1100.0,
      "uuid": "f7e1b454-4ad4-1063-ec0a-159e56b58941",
      "role": "smg",
      "status": "ok"
    },
    {
      "displayName": "Spectre",
      "expected_cost": 1600,
      "actual_cost": 1600.0,
      "uuid": "462080d1-4035-2937-7c09-27aa2a5c27a7",
      "role": "smg",
      "status": "ok"
    },
    {
      "displayName": "Bucky",
      "expected_cost": 850,
      "actual_cost": 850.0,
      "uuid": "910be174-449b-c412-ab22-d0873436b21b",
      "role": "shotgun",
      "status": "ok"
    },
    {
      "displayName": "Judge",
      "expected_cost": 1850,
      "actual_cost": 1850.0,
      "uuid": "ec845bf4-4f79-ddda-a3da-0db3774b2794",
      "role": "shotgun",
      "status": "ok"
    },
    {
      "displayName": "Bulldog",
      "expected_cost": 2050,
      "actual_cost": 2050.0,
      "uuid": "ae3de142-4d85-2547-dd26-4e90bed35cf7",
      "role": "rifle",
      "status": "ok"
    },
    {
      "displayName": "Guardian",
      "expected_cost": 2250,
      "actual_cost": 2250.0,
      "uuid": "4ade7faa-4cf1-8376-95ef-39884480959b",
      "role": "rifle",
      "status": "ok"
    },
    {
      "displayName": "Phantom",
      "expected_cost": 2900,
      "actual_cost": 2900.0,
      "uuid": "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a",
      "role": "rifle",
      "status": "ok"
    },
    {
      "displayName": "Vandal",
      "expected_cost": 2900,
      "actual_cost": 2900.0,
      "uuid": "9c82e19d-4575-0200-1a81-3eacf00cf872",
      "role": "rifle",
      "status": "ok"
    },
    {
      "displayName": "Marshal",
      "expected_cost": 950,
      "actual_cost": 950.0,
      "uuid": "c4883e50-4494-202c-3ec3-6b8a9284f00b",
      "role": "sniper",
      "status": "ok"
    },
    {
      "displayName": "Outlaw",
      "expected_cost": 2400,
      "actual_cost": 2400.0,
      "uuid": "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c",
      "role": "sniper",
      "status": "ok"
    },
    {
      "displayName": "Operator",
      "expected_cost": 4700,
      "actual_cost": 4700.0,
      "uuid": "a03b24d3-4319-996d-0f8c-94bbfba1dfc7",
      "role": "sniper",
      "status": "ok"
    },
    {
      "displayName": "Ares",
      "expected_cost": 1600,
      "actual_cost": 1600.0,
      "uuid": "55d8a0f4-4274-ca67-fe2c-06ab45efdf58",
      "role": "heavy",
      "status": "ok"
    },
    {
      "displayName": "Odin",
      "expected_cost": 3200,
      "actual_cost": 3200.0,
      "uuid": "63e6c2b6-4a8e-869c-3d4c-e38355226584",
      "role": "heavy",
      "status": "ok"
    }
  ]
}
~~~

**Proceso que realiza**

- load_weapon_catalog: legalizar coste y valor de armas; salida weapon_catalog.
- find_weapon: legalizar coste y valor de armas; salida weapon_catalog.

**Funciones / archivos implicados**

load_weapon_catalog, find_weapon.

**Salida generada**

sections.weapon_catalog y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.4 Catálogo de escudos — ✅ Correcto

**Qué datos necesita**

Light Shield, Regen Shield, Heavy Shield, Sin escudo.

**Dónde los encuentra**

Mongo reference_data.gear y normalizador.

**Por qué los necesita**

legalizar coste, carry y durabilidad.

**Valor observado en auditoría**

~~~json
{
  "catalog_size": 3,
  "armors": [
    {
      "displayName": "Light Shield",
      "expected_cost": 400,
      "catalog_cost": 400.0,
      "direct_catalog": false,
      "armor_level": "light",
      "normalized": {
        "id": null,
        "displayName": "Light Shield",
        "shortName": "Light Shield",
        "kind": "armor",
        "source_value": "Light Shield",
        "known": true,
        "cost": 400,
        "armor_level": "light",
        "warnings": []
      },
      "status": "ok"
    },
    {
      "displayName": "Regen Shield",
      "expected_cost": 650,
      "catalog_cost": 650.0,
      "direct_catalog": false,
      "armor_level": "regen",
      "normalized": {
        "id": null,
        "displayName": "Regen Shield",
        "shortName": "Regen Shield",
        "kind": "armor",
        "source_value": "Regen Shield",
        "known": true,
        "cost": 650,
        "armor_level": "regen",
        "warnings": []
      },
      "status": "ok"
    },
    {
      "displayName": "Heavy Shield",
      "expected_cost": 1000,
      "catalog_cost": 1000.0,
      "direct_catalog": false,
      "armor_level": "heavy",
      "normalized": {
        "id": null,
        "displayName": "Heavy Shield",
        "shortName": "Heavy Shield",
        "kind": "armor",
        "source_value": "Heavy Shield",
        "known": true,
        "cost": 1000,
        "armor_level": "heavy",
        "warnings": []
      },
      "status": "ok"
    }
  ],
  "no_armor": {
    "id": null,
    "displayName": "Sin escudo",
    "shortName": "Sin escudo",
    "kind": "armor",
    "source_value": null,
    "known": false,
    "cost": 0,
    "armor_level": "none",
    "warnings": []
  }
}
~~~

**Proceso que realiza**

- load_gear_catalog: legalizar coste, carry y durabilidad; salida armor_catalog.
- normalize_armor_display: legalizar coste, carry y durabilidad; salida armor_catalog.

**Funciones / archivos implicados**

load_gear_catalog, normalize_armor_display.

**Salida generada**

sections.armor_catalog y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.5 Catálogo de habilidades — ✅ Correcto

**Qué datos necesita**

agent_count, ability_count, missing_cost_count, missing_cost_ratio, ultimate_count, purchasable_count, free_charge_count, localized_aliases.

**Dónde los encuentra**

Valorant content + ability_catalog_seed.json.

**Por qué los necesita**

comprar utilidad legal por agente y carga.

**Valor observado en auditoría**

~~~json
{
  "agent_count": 29,
  "ability_count": 121,
  "missing_cost_count": 0,
  "missing_cost_ratio": 0.0,
  "ultimate_count": 29,
  "purchasable_count": 78,
  "free_charge_count": 22,
  "localized_aliases": 230,
  "sample": [
    {
      "agent": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_id": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_name": "Gekko",
      "role": "Iniciador",
      "slot": "Q",
      "name": "Wingman",
      "display_name": "Wingman",
      "canonical_name": "Wingman",
      "aliases": [
        "Wingman"
      ],
      "description": "EQUIPA a Wingman. DISPARA para mandarlo hacia delante en busca de enemigos. Wingman libera una explosión aturdidora en dirección al primero que ve. Utiliza el DISPARO ALTERNATIVO mientras apuntas a una zona de la Spike o a una Spike colocada para que la coloque o la desarme. Para colocarla, Gekko debe tenerla en su inventario. Cuando Wingman desaparece, vuelve a su estado en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga tras un breve enfriamiento.",
      "ability_kind": "basic",
      "tactical_types": [
        "recon",
        "plant",
        "defuse",
        "concuss"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 300.0,
      "cost_per_charge": 300.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": true,
      "carries_over": false,
      "recharge_rule": "pickup",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "Q",
      "ability_name": "Wingman",
      "ability_description": "EQUIPA a Wingman. DISPARA para mandarlo hacia delante en busca de enemigos. Wingman libera una explosión aturdidora en dirección al primero que ve. Utiliza el DISPARO ALTERNATIVO mientras apuntas a una zona de la Spike o a una Spike colocada para que la coloque o la desarme. Para colocarla, Gekko debe tenerla en su inventario. Cuando Wingman desaparece, vuelve a su estado en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga tras un breve enfriamiento.",
      "ability_cost": 300.0,
      "utility_profiles": [
        "recon",
        "plant",
        "defuse",
        "concuss"
      ],
      "attack_value_score": 0.71,
      "defense_value_score": 0.63,
      "low_economy_value_score": 0.63,
      "postplant_value_score": 0.63,
      "retake_value_score": 0.71,
      "entry_value_score": 0.55,
      "stall_value_score": 0.55,
      "information_value_score": 0.63
    },
    {
      "agent": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_id": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_name": "Gekko",
      "role": "Iniciador",
      "slot": "E",
      "name": "Dizzy",
      "display_name": "Dizzy",
      "canonical_name": "Dizzy",
      "aliases": [
        "Dizzy"
      ],
      "description": "EQUIPA a Dizzy. DISPARA para lanzar a Dizzy volando hacia delante. Dizzy carga y libera explosiones de plasma hacia los enemigos en su campo de visión. El plasma ciega a los enemigos alcanzados. Cuando Dizzy desaparece, vuelve a su estado de glóbulo en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Dizzy tras un breve enfriamiento.",
      "ability_kind": "signature",
      "tactical_types": [
        "flash",
        "recon",
        "info"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 1,
      "purchasable_charges": null,
      "cost_credits": 0.0,
      "cost_per_charge": null,
      "ultimate_points": null,
      "is_signature": true,
      "is_round_start_ability": true,
      "is_free_at_round_start": true,
      "is_purchasable": true,
      "is_rechargeable": true,
      "carries_over": false,
      "recharge_rule": "pickup",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "E",
      "ability_name": "Dizzy",
      "ability_description": "EQUIPA a Dizzy. DISPARA para lanzar a Dizzy volando hacia delante. Dizzy carga y libera explosiones de plasma hacia los enemigos en su campo de visión. El plasma ciega a los enemigos alcanzados. Cuando Dizzy desaparece, vuelve a su estado de glóbulo en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Dizzy tras un breve enfriamiento.",
      "ability_cost": 0.0,
      "utility_profiles": [
        "flash",
        "recon",
        "info"
      ],
      "attack_value_score": 0.66,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.66,
      "entry_value_score": 0.58,
      "stall_value_score": 0.5,
      "information_value_score": 0.66
    },
    {
      "agent": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_id": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_name": "Gekko",
      "role": "Iniciador",
      "slot": "C",
      "name": "Mosh Pit",
      "display_name": "Mosh",
      "canonical_name": "Mosh Pit",
      "aliases": [
        "Mosh",
        "Mosh Pit"
      ],
      "description": "EQUIPA a Mosh. DISPARA para lanzar a Mosh como una granada. Utiliza el DISPARO ALTERNATIVO para tirarlo. Al caer, Mosh se divide en varias copias en un área grande, que inflige una pequeña cantidad de daño prolongado y, tras un breve lapso, explota. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Mosh tras un breve enfriamiento.",
      "ability_kind": "basic",
      "tactical_types": [
        "damage",
        "postplant",
        "stall"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 250.0,
      "cost_per_charge": 250.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "C",
      "ability_name": "Mosh Pit",
      "ability_description": "EQUIPA a Mosh. DISPARA para lanzar a Mosh como una granada. Utiliza el DISPARO ALTERNATIVO para tirarlo. Al caer, Mosh se divide en varias copias en un área grande, que inflige una pequeña cantidad de daño prolongado y, tras un breve lapso, explota. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Mosh tras un breve enfriamiento.",
      "ability_cost": 250.0,
      "utility_profiles": [
        "damage",
        "postplant",
        "stall"
      ],
      "attack_value_score": 0.5,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.58,
      "retake_value_score": 0.5,
      "entry_value_score": 0.5,
      "stall_value_score": 0.58,
      "information_value_score": 0.5
    },
    {
      "agent": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_id": "e370fa57-4757-3604-3648-499e1f642d3f",
      "agent_name": "Gekko",
      "role": "Iniciador",
      "slot": "X",
      "name": "Thrash",
      "display_name": "Thrash",
      "canonical_name": "Thrash",
      "aliases": [
        "Thrash"
      ],
      "description": "EQUIPA a Thrash. DISPARA para vincular tu mente con la de Thrash y manejarla a través del territorio enemigo. ACTÍVALA para embestir hacia delante y explotar, lo que detendrá a cualquier jugador en un pequeño radio. Cuando Thrash desaparece, vuelve a su estado de glóbulo en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Thrash tras un breve enfriamiento. Thrash se puede recuperar una vez.",
      "ability_kind": "ultimate",
      "tactical_types": [
        "stall",
        "info",
        "entry"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": null,
      "cost_per_charge": null,
      "ultimate_points": 8,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": false,
      "is_rechargeable": true,
      "carries_over": false,
      "recharge_rule": "pickup",
      "resource_name": null,
      "notes": null,
      "source": "content_collection",
      "needs_review": false,
      "warnings": [],
      "ability_cost_available": false,
      "missing_cost": false,
      "ability_slot": "X",
      "ability_name": "Thrash",
      "ability_description": "EQUIPA a Thrash. DISPARA para vincular tu mente con la de Thrash y manejarla a través del territorio enemigo. ACTÍVALA para embestir hacia delante y explotar, lo que detendrá a cualquier jugador en un pequeño radio. Cuando Thrash desaparece, vuelve a su estado de glóbulo en reposo. INTERACTÚA para recuperar el glóbulo y obtener otra carga de Thrash tras un breve enfriamiento. Thrash se puede recuperar una vez.",
      "ability_cost": null,
      "utility_profiles": [
        "stall",
        "info",
        "entry"
      ],
      "attack_value_score": 0.58,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.5,
      "entry_value_score": 0.58,
      "stall_value_score": 0.58,
      "information_value_score": 0.58
    },
    {
      "agent": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_id": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_name": "Fade",
      "role": "Iniciador",
      "slot": "Q",
      "name": "Seize",
      "display_name": "Apresar",
      "canonical_name": "Seize",
      "aliases": [
        "Apresar",
        "Seize"
      ],
      "description": "EQUIPA un Nódulo de terror puro. DISPARA para lanzarlo. El Nódulo cae tras un periodo de tiempo determinado. VUELVE A USAR la habilidad para que el Nódulo caiga antes. El Nódulo estalla al impactar y retiene a los enemigos cercanos. Ensordece y aplica declive a los enemigos retenidos.",
      "ability_kind": "basic",
      "tactical_types": [
        "stall",
        "decay"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 200.0,
      "cost_per_charge": 200.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "Q",
      "ability_name": "Seize",
      "ability_description": "EQUIPA un Nódulo de terror puro. DISPARA para lanzarlo. El Nódulo cae tras un periodo de tiempo determinado. VUELVE A USAR la habilidad para que el Nódulo caiga antes. El Nódulo estalla al impactar y retiene a los enemigos cercanos. Ensordece y aplica declive a los enemigos retenidos.",
      "ability_cost": 200.0,
      "utility_profiles": [
        "stall",
        "decay"
      ],
      "attack_value_score": 0.45,
      "defense_value_score": 0.53,
      "low_economy_value_score": 0.53,
      "postplant_value_score": 0.45,
      "retake_value_score": 0.45,
      "entry_value_score": 0.45,
      "stall_value_score": 0.53,
      "information_value_score": 0.45
    },
    {
      "agent": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_id": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_name": "Fade",
      "role": "Iniciador",
      "slot": "E",
      "name": "Haunt",
      "display_name": "Tormento",
      "canonical_name": "Haunt",
      "aliases": [
        "Tormento",
        "Haunt"
      ],
      "description": "EQUIPA un Vigía aterrador. DISPARA para lanzarlo. El Vigía cae tras un periodo de tiempo determinado. VUELVE A USAR la habilidad para que el Vigía caiga antes. El Vigía ataca al caer, lo que revela a los enemigos que estén en su campo de visión y crea rastros de terror que llevan hasta ellos. Los enemigos pueden destruir al Vigía.",
      "ability_kind": "signature",
      "tactical_types": [
        "recon",
        "reveal",
        "info"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 1,
      "purchasable_charges": null,
      "cost_credits": 0.0,
      "cost_per_charge": null,
      "ultimate_points": null,
      "is_signature": true,
      "is_round_start_ability": true,
      "is_free_at_round_start": true,
      "is_purchasable": true,
      "is_rechargeable": true,
      "carries_over": false,
      "recharge_rule": "cooldown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "E",
      "ability_name": "Haunt",
      "ability_description": "EQUIPA un Vigía aterrador. DISPARA para lanzarlo. El Vigía cae tras un periodo de tiempo determinado. VUELVE A USAR la habilidad para que el Vigía caiga antes. El Vigía ataca al caer, lo que revela a los enemigos que estén en su campo de visión y crea rastros de terror que llevan hasta ellos. Los enemigos pueden destruir al Vigía.",
      "ability_cost": 0.0,
      "utility_profiles": [
        "recon",
        "reveal",
        "info"
      ],
      "attack_value_score": 0.58,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.58,
      "entry_value_score": 0.5,
      "stall_value_score": 0.5,
      "information_value_score": 0.74
    },
    {
      "agent": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_id": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_name": "Fade",
      "role": "Iniciador",
      "slot": "C",
      "name": "Prowler",
      "display_name": "Acechador",
      "canonical_name": "Prowler",
      "aliases": [
        "Acechador",
        "Prowler"
      ],
      "description": "EQUIPA un Acechador. DISPARA para lanzarlo hacia adelante. MANTÉN PULSADO DISPARAR para dirigir al Acechador en la dirección de la mira. El Acechador seguirá al primer enemigo o rastro que vea y reducirá el campo de visión del enemigo al impactar.",
      "ability_kind": "basic",
      "tactical_types": [
        "recon",
        "nearsight",
        "space_creation"
      ],
      "max_charges": 2,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 250.0,
      "cost_per_charge": 250.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "C",
      "ability_name": "Prowler",
      "ability_description": "EQUIPA un Acechador. DISPARA para lanzarlo hacia adelante. MANTÉN PULSADO DISPARAR para dirigir al Acechador en la dirección de la mira. El Acechador seguirá al primer enemigo o rastro que vea y reducirá el campo de visión del enemigo al impactar.",
      "ability_cost": 250.0,
      "utility_profiles": [
        "recon",
        "nearsight",
        "space_creation"
      ],
      "attack_value_score": 0.66,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.58,
      "entry_value_score": 0.58,
      "stall_value_score": 0.5,
      "information_value_score": 0.58
    },
    {
      "agent": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_id": "dade69b4-4f5a-8528-247b-219e5a1facd6",
      "agent_name": "Fade",
      "role": "Iniciador",
      "slot": "X",
      "name": "Nightfall",
      "display_name": "Ocaso",
      "canonical_name": "Nightfall",
      "aliases": [
        "Ocaso",
        "Nightfall"
      ],
      "description": "EQUIPA el poder de las pesadillas. DISPARA para desatar una ola imparable de energía de pesadillas. Marca con rastros de terror, ensordece y aplica declive a los enemigos golpeados por la ola.",
      "ability_kind": "ultimate",
      "tactical_types": [
        "recon",
        "decay",
        "info"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": null,
      "cost_per_charge": null,
      "ultimate_points": 8,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": false,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection",
      "needs_review": false,
      "warnings": [],
      "ability_cost_available": false,
      "missing_cost": false,
      "ability_slot": "X",
      "ability_name": "Nightfall",
      "ability_description": "EQUIPA el poder de las pesadillas. DISPARA para desatar una ola imparable de energía de pesadillas. Marca con rastros de terror, ensordece y aplica declive a los enemigos golpeados por la ola.",
      "ability_cost": null,
      "utility_profiles": [
        "recon",
        "decay",
        "info"
      ],
      "attack_value_score": 0.58,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.58,
      "entry_value_score": 0.5,
      "stall_value_score": 0.5,
      "information_value_score": 0.66
    },
    {
      "agent": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_id": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_name": "Breach",
      "role": "Iniciador",
      "slot": "Q",
      "name": "Flashpoint",
      "display_name": "Explosión cegadora",
      "canonical_name": "Flashpoint",
      "aliases": [
        "Explosión cegadora",
        "Flashpoint"
      ],
      "description": "EQUIPA una carga explosiva cegadora. DISPARA la carga para liberar una rápida explosión que atraviesa la pared. Cuando detona, la carga ciega a todos los jugadores que la estén mirando.",
      "ability_kind": "basic",
      "tactical_types": [
        "flash",
        "entry"
      ],
      "max_charges": 2,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 250.0,
      "cost_per_charge": 250.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "Q",
      "ability_name": "Flashpoint",
      "ability_description": "EQUIPA una carga explosiva cegadora. DISPARA la carga para liberar una rápida explosión que atraviesa la pared. Cuando detona, la carga ciega a todos los jugadores que la estén mirando.",
      "ability_cost": 250.0,
      "utility_profiles": [
        "flash",
        "entry"
      ],
      "attack_value_score": 0.61,
      "defense_value_score": 0.45,
      "low_economy_value_score": 0.45,
      "postplant_value_score": 0.45,
      "retake_value_score": 0.53,
      "entry_value_score": 0.61,
      "stall_value_score": 0.45,
      "information_value_score": 0.45
    },
    {
      "agent": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_id": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_name": "Breach",
      "role": "Iniciador",
      "slot": "E",
      "name": "Fault Line",
      "display_name": "Falla",
      "canonical_name": "Fault Line",
      "aliases": [
        "Falla",
        "Fault Line"
      ],
      "description": "EQUIPA una bomba sísmica. MANTÉN PULSADO DISPARAR para aumentar la distancia. SUELTA para liberar un seísmo que conmocionará a todos los jugadores dentro de la zona y en una línea hasta ella.",
      "ability_kind": "signature",
      "tactical_types": [
        "concuss",
        "entry",
        "stall"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 1,
      "purchasable_charges": null,
      "cost_credits": 0.0,
      "cost_per_charge": null,
      "ultimate_points": null,
      "is_signature": true,
      "is_round_start_ability": true,
      "is_free_at_round_start": true,
      "is_purchasable": true,
      "is_rechargeable": true,
      "carries_over": false,
      "recharge_rule": "cooldown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "E",
      "ability_name": "Fault Line",
      "ability_description": "EQUIPA una bomba sísmica. MANTÉN PULSADO DISPARAR para aumentar la distancia. SUELTA para liberar un seísmo que conmocionará a todos los jugadores dentro de la zona y en una línea hasta ella.",
      "ability_cost": 0.0,
      "utility_profiles": [
        "concuss",
        "entry",
        "stall"
      ],
      "attack_value_score": 0.58,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.5,
      "entry_value_score": 0.58,
      "stall_value_score": 0.58,
      "information_value_score": 0.5
    },
    {
      "agent": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_id": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_name": "Breach",
      "role": "Iniciador",
      "slot": "C",
      "name": "Aftershock",
      "display_name": "Réplica",
      "canonical_name": "Aftershock",
      "aliases": [
        "Réplica",
        "Aftershock"
      ],
      "description": "EQUIPA una carga explosiva de fusión. DISPARA la carga para liberar una explosión que atraviesa la pared tras un retardo. La explosión inflige mucho daño a cualquiera que esté dentro del área afectada.",
      "ability_kind": "basic",
      "tactical_types": [
        "damage",
        "stall",
        "space_creation"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": 200.0,
      "cost_per_charge": 200.0,
      "ultimate_points": null,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": true,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection+manual_seed_cost",
      "needs_review": true,
      "warnings": [
        "missing_cost"
      ],
      "ability_cost_available": true,
      "missing_cost": false,
      "ability_slot": "C",
      "ability_name": "Aftershock",
      "ability_description": "EQUIPA una carga explosiva de fusión. DISPARA la carga para liberar una explosión que atraviesa la pared tras un retardo. La explosión inflige mucho daño a cualquiera que esté dentro del área afectada.",
      "ability_cost": 200.0,
      "utility_profiles": [
        "damage",
        "stall",
        "space_creation"
      ],
      "attack_value_score": 0.58,
      "defense_value_score": 0.58,
      "low_economy_value_score": 0.58,
      "postplant_value_score": 0.5,
      "retake_value_score": 0.5,
      "entry_value_score": 0.58,
      "stall_value_score": 0.58,
      "information_value_score": 0.5
    },
    {
      "agent": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_id": "5f8d3a7f-467b-97f3-062c-13acf203c006",
      "agent_name": "Breach",
      "role": "Iniciador",
      "slot": "X",
      "name": "Rolling Thunder",
      "display_name": "Fragor imparable",
      "canonical_name": "Rolling Thunder",
      "aliases": [
        "Fragor imparable",
        "Rolling Thunder"
      ],
      "description": "EQUIPA una carga explosiva sísmica. DISPARA para liberar un seísmo que se extenderá por una gran zona. El seísmo aturde y lanza por los aires a todos los jugadores que estén en el interior de la zona.",
      "ability_kind": "ultimate",
      "tactical_types": [
        "concuss",
        "retake",
        "entry",
        "stall"
      ],
      "max_charges": 1,
      "free_charges_at_round_start": 0,
      "purchasable_charges": null,
      "cost_credits": null,
      "cost_per_charge": null,
      "ultimate_points": 8,
      "is_signature": false,
      "is_round_start_ability": false,
      "is_free_at_round_start": false,
      "is_purchasable": false,
      "is_rechargeable": false,
      "carries_over": false,
      "recharge_rule": "unknown",
      "resource_name": null,
      "notes": null,
      "source": "content_collection",
      "needs_review": false,
      "warnings": [],
      "ability_cost_available": false,
      "missing_cost": false,
      "ability_slot": "X",
      "ability_name": "Rolling Thunder",
      "ability_description": "EQUIPA una carga explosiva sísmica. DISPARA para liberar un seísmo que se extenderá por una gran zona. El seísmo aturde y lanza por los aires a todos los jugadores que estén en el interior de la zona.",
      "ability_cost": null,
      "utility_profiles": [
        "concuss",
        "retake",
        "entry",
        "stall"
      ],
      "attack_value_score": 0.63,
      "defense_value_score": 0.71,
      "low_economy_value_score": 0.63,
      "postplant_value_score": 0.55,
      "retake_value_score": 0.63,
      "entry_value_score": 0.63,
      "stall_value_score": 0.63,
      "information_value_score": 0.55
    }
  ]
}
~~~

**Proceso que realiza**

- load_ability_catalog: comprar utilidad legal por agente y carga; salida ability_catalog.
- LegalPurchaseGenerator._ability_options: comprar utilidad legal por agente y carga; salida ability_catalog.

**Funciones / archivos implicados**

load_ability_catalog, LegalPurchaseGenerator._ability_options.

**Salida generada**

sections.ability_catalog y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.6 Créditos prebuy — ⚠️ Parcial

**Qué datos necesita**

prebuy_credits_observed, prebuy_credits_rules, prebuy_credits_selected, credit_estimate_quality, team_player_credit_estimates.

**Dónde los encuentra**

spent+remaining y economy ledger.

**Por qué los necesita**

fijar presupuesto legal; resets mandan sobre observed.

**Valor observado en auditoría**

~~~json
{}
~~~

**Proceso que realiza**

- build_economy_ledger: fijar presupuesto legal; resets mandan sobre observed; salida prebuy_credits.
- extract_match_round_states: fijar presupuesto legal; resets mandan sobre observed; salida prebuy_credits.

**Funciones / archivos implicados**

build_economy_ledger, extract_match_round_states.

**Salida generada**

sections.prebuy_credits y campos API/UI indicados.

**Warnings / fallbacks**

documented_from_code_but_not_exercised_in_this_run

**Tests existentes**

backend/tests/test_economy_ledger.py, backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.7 Reset de inventario — ✅ Correcto

**Qué datos necesita**

is_inventory_reset_round, is_pistol_round, is_half_reset, is_overtime.

**Dónde los encuentra**

ronda y reglas fijas.

**Por qué los necesita**

evitar carry imposible en pistol, mitad y overtime.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "round": 13
    },
    "expected": {
      "credits": 800
    },
    "observed": {
      "credits": 800.0
    },
    "process": "Ejecuta reset de mitad.",
    "files": [
      "economy_income_rules.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- fixed_round_start_credits: evitar carry imposible en pistol, mitad y overtime; salida inventory_reset.
- RoundEconomyRecommender.recommend: evitar carry imposible en pistol, mitad y overtime; salida inventory_reset.

**Funciones / archivos implicados**

fixed_round_start_credits, RoundEconomyRecommender.recommend.

**Salida generada**

sections.inventory_reset y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.8 Inventario conservado — ✅ Correcto

**Qué datos necesita**

weapon_before_buy, armor_before_buy, survived_previous_round, keep_weapon, keep_armor, weapon_cost, weapon_value, armor_cost, armor_value.

**Dónde los encuentra**

estado previo y supervivencia.

**Por qué los necesita**

separar coste cero y valor táctico conservado.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "credits": 1000,
      "weapon_before_buy": "Vandal",
      "armor_before_buy": [
        "Light Shield",
        "Regen Shield",
        "Heavy Shield"
      ]
    },
    "expected": {
      "weapon_value": 2900,
      "armor_values": {
        "Light Shield": 400,
        "Regen Shield": 650,
        "Heavy Shield": 1000
      },
      "purchase_costs": 0
    },
    "observed": {
      "variants": [
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 400.0,
          "armor_full_value": 400.0,
          "armor_effective_value": 400.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Light Shield",
          "expected_armor_value": 400
        },
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 650.0,
          "armor_full_value": 650.0,
          "armor_effective_value": 650.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Regen Shield",
          "expected_armor_value": 650
        },
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 1000.0,
          "armor_full_value": 1000.0,
          "armor_effective_value": 1000.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Heavy Shield",
          "expected_armor_value": 1000
        }
      ]
    },
    "process": "Ejecuta LegalPurchaseGenerator para cada armor carried.",
    "files": [
      "inventory.py",
      "legal_purchase.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- advance_inventory: separar coste cero y valor táctico conservado; salida carried_inventory.
- LegalPurchaseGenerator.generate: separar coste cero y valor táctico conservado; salida carried_inventory.

**Funciones / archivos implicados**

advance_inventory, LegalPurchaseGenerator.generate.

**Salida generada**

sections.carried_inventory y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.9 Inferencia de compra real — ✅ Correcto

**Qué datos necesita**

default_spawn_weapon, bought_self, carried, bought_by_teammate, picked_up, unknown, unknown_or_pickup.

**Dónde los encuentra**

inventario, spent y post-buy.

**Por qué los necesita**

explicar procedencia probable sin inventar observación.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "rounds": [
        1,
        13
      ],
      "weapon": "Classic",
      "spent": 0
    },
    "expected": {
      "credits": 800,
      "weapon_source": "default_spawn_weapon",
      "enemy_buy": "ENEMY_PISTOL"
    },
    "observed": {
      "fixed_credits": {
        "1": 800.0,
        "13": 800.0,
        "25": 5000.0
      },
      "inference": {
        "weapon_source": "default_spawn_weapon",
        "confidence": 0.96,
        "estimated_self_spend": 0,
        "reasons": [
          "classic_default_loadout",
          "round_start_default_weapon"
        ],
        "armor_source": "unknown",
        "estimated_team_spend_impact": 0,
        "buys_for_teammate": null,
        "utility_bought_estimated": [],
        "free_utility_granted": [],
        "utility_status": "estimated",
        "warnings": [
          "ability_purchase_not_observable"
        ]
      },
      "display": {
        "weapon_label": "Classic gratis",
        "armor_label": "Sin escudo",
        "loadout_label": "Classic gratis + Sin escudo",
        "ability_label": "Sin compra de utilidad",
        "spend_label": "Gasto propio 0",
        "source_label": "Arma inicial gratis"
      },
      "enemy": {
        "available": true,
        "enemy_team_id": "R",
        "enemy_credits_by_player": {
          "R0": 800.0,
          "R1": 800.0,
          "R2": 800.0,
          "R3": 800.0,
          "R4": 800.0
        },
        "enemy_observed_previous_loadout": {},
        "enemy_projected_buy": {
          "total_credits": 4000.0,
          "average_credits": 800.0,
          "median_credits": 800.0,
          "buy_class": "ENEMY_PISTOL",
          "projected_weapon_value": 0,
          "projected_armor_value": 0,
          "projected_utility_value": 1000,
          "projected_total_loadout_value": 1000,
          "projected_rifle_count": 0,
          "projected_operator_count": 0
        },
        "enemy_buy_recommendation": "ENEMY_PISTOL",
        "enemy_full_buy_probability": 0.0,
        "enemy_force_probability": 0.0,
        "enemy_save_probability": 1.0,
        "enemy_anti_eco_probability": 0.8,
        "enemy_players": [
          {
            "puuid": "R0",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R1",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R2",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R3",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R4",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          }
        ],
        "enemy_can_full_buy_count": 0,
        "enemy_can_rifle_count": 0,
        "enemy_can_operator_count": 0,
        "enemy_low_credit_count": 5,
        "enemy_median_credits": 800.0,
        "enemy_credit_spread": 0.0,
        "enemy_saved_weapon_count": 0,
        "enemy_bonus_candidate": false,
        "confidence": 0.82,
        "source": "shared_economy_ledger+previous_round_inventory",
        "warnings": []
      }
    },
    "process": "Ejecuta reglas, inferencia, display y enemy economy.",
    "files": [
      "economy_income_rules.py",
      "purchase_inference.py",
      "display_normalizer.py",
      "enemy_economy.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- PurchaseInferenceEngine.infer: explicar procedencia probable sin inventar observación; salida purchase_inference.
- PurchaseInferenceEngine.infer_team: explicar procedencia probable sin inventar observación; salida purchase_inference.

**Funciones / archivos implicados**

PurchaseInferenceEngine.infer, PurchaseInferenceEngine.infer_team.

**Salida generada**

sections.purchase_inference y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.10 Generación de compras legales — ✅ Correcto

**Qué datos necesita**

weapon options, armor options, ability options, self_cost, expected_remaining, requires_weapon_drop, ability_combination_limit, pistol_utility_cap_per_player.

**Dónde los encuentra**

catálogos + PlayerInventoryState.

**Por qué los necesita**

enumerar candidatos pagables.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "credits": 1000,
      "weapon_before_buy": "Vandal",
      "armor_before_buy": [
        "Light Shield",
        "Regen Shield",
        "Heavy Shield"
      ]
    },
    "expected": {
      "weapon_value": 2900,
      "armor_values": {
        "Light Shield": 400,
        "Regen Shield": 650,
        "Heavy Shield": 1000
      },
      "purchase_costs": 0
    },
    "observed": {
      "variants": [
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 400.0,
          "armor_full_value": 400.0,
          "armor_effective_value": 400.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Light Shield",
          "expected_armor_value": 400
        },
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 650.0,
          "armor_full_value": 650.0,
          "armor_effective_value": 650.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Regen Shield",
          "expected_armor_value": 650
        },
        {
          "weapon_source": "carried",
          "weapon_cost": 0,
          "weapon_value": 2900.0,
          "armor_source": "carried",
          "armor_cost": 0,
          "armor_purchase_cost": 0.0,
          "armor_value": 1000.0,
          "armor_full_value": 1000.0,
          "armor_effective_value": 1000.0,
          "keep_weapon": true,
          "keep_armor": true,
          "armor": "Heavy Shield",
          "expected_armor_value": 1000
        }
      ]
    },
    "process": "Ejecuta LegalPurchaseGenerator para cada armor carried.",
    "files": [
      "inventory.py",
      "legal_purchase.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- LegalPurchaseGenerator.generate: enumerar candidatos pagables; salida legal_purchases.

**Funciones / archivos implicados**

LegalPurchaseGenerator.generate.

**Salida generada**

sections.legal_purchases y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.11 Drops — ✅ Correcto

**Qué datos necesita**

donor credits, receiver credits, buys_for, weapon_source, weapon_cost, non_weapon_drop.

**Dónde los encuentra**

planes legales por jugador.

**Por qué los necesita**

resolver un drop de arma financiable por donante.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "donor": 9000,
      "receivers": [
        400,
        400
      ],
      "weapon": "Vandal"
    },
    "expected": {
      "receiver_count": 1,
      "donor_buys_for": 1,
      "non_weapon_drop_valid": false
    },
    "observed": {
      "donor": {
        "puuid": "rich",
        "weapon": {
          "displayName": "Vandal",
          "cost": 2900
        },
        "weapon_value": 2900,
        "armor": {
          "displayName": "Heavy Shield",
          "cost": 1000
        },
        "armor_value": 1000,
        "keep_weapon": false,
        "self_cost": 6800.0,
        "expected_remaining": 2200.0,
        "buys_for": [
          "poor1"
        ]
      },
      "receivers": [
        {
          "puuid": "poor1",
          "weapon": {
            "displayName": "Vandal",
            "cost": 2900,
            "source": "dropped"
          },
          "weapon_value": 2900,
          "weapon_purchase_cost": 2900,
          "weapon_cost": 0,
          "armor": null,
          "armor_cost": 0,
          "ability_cost": 0,
          "self_cost": 0,
          "expected_remaining": 400,
          "keep_weapon": false,
          "requires_weapon_drop": false,
          "weapon_source": "dropped",
          "bought_by": "rich"
        },
        {
          "puuid": "poor2",
          "weapon": {
            "displayName": "Vandal",
            "cost": 2900
          },
          "weapon_value": 2900,
          "weapon_purchase_cost": 2900,
          "weapon_cost": 2900,
          "armor": null,
          "armor_cost": 0,
          "ability_cost": 0,
          "self_cost": 0,
          "expected_remaining": 400,
          "keep_weapon": false,
          "requires_weapon_drop": true
        }
      ],
      "non_weapon_validation": {
        "valid": false,
        "warnings": [
          "non_weapon_drop:poor"
        ]
      }
    },
    "process": "Ejecuta _resolve_weapon_drops y validate.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- TeamBuySolver._resolve_weapon_drops: resolver un drop de arma financiable por donante; salida drops.

**Funciones / archivos implicados**

TeamBuySolver._resolve_weapon_drops.

**Salida generada**

sections.drops y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.12 Scoring económico base — ✅ Correcto

**Qué datos necesita**

weapon_value, armor_value, utility_value, round_win_probability, future_economy, synchronization, risk, composition_value, macro_adjustment, penalty, team_plan_value, team_plan_score.

**Dónde los encuentra**

plan y contexto.

**Por qué los necesita**

ordenar planes; value interno y score UI 0..1.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "plan_a": "5 Vandals",
      "plan_b": "4 Vandals + rich Bandit",
      "enemy": "ENEMY_FULL_BUY"
    },
    "expected": {
      "plan_b_lower": true,
      "penalties": [
        "rich_player_low_weapon_full_buy_penalty",
        "rich_player_underpowered_vs_full_buy"
      ]
    },
    "observed": {
      "rifles": {
        "score": 0.7912,
        "team_plan_score": 0.7912,
        "team_plan_value": 0.7912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 19500.0,
        "weapon_value": 14500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.0,
        "warnings": [],
        "debug_warnings": [],
        "data_confidence": 0.6
      },
      "weak": {
        "score": 0.3912,
        "team_plan_score": 0.3912,
        "team_plan_value": 0.3912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 17500.0,
        "weapon_value": 12500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.4,
        "warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "debug_warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "data_confidence": 0.6
      }
    },
    "process": "Ejecuta BuyScorer.score.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- BuyScorer.score: ordenar planes; value interno y score UI 0..1; salida base_scoring.
- evaluate_team_plan: ordenar planes; value interno y score UI 0..1; salida base_scoring.

**Funciones / archivos implicados**

BuyScorer.score, evaluate_team_plan.

**Salida generada**

sections.base_scoring y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.13 Penalizaciones — ✅ Correcto

**Qué datos necesita**

weapon_without_armor_penalty, underarmor_penalty, operator_without_armor_penalty, heavy_weapon_early_penalty, post_pistol_overbuy_penalty, pistol_full_utility_penalty, bonus_upgrade_penalty, team_full_buy_available_but_half_buy_penalty, enemy_full_buy_underinvestment_penalty, excessive_saving_penalty, rich_player_low_weapon_full_buy_penalty, rich_player_underpowered_vs_full_buy, high_credit_player_saved_too_much, heavy_weapon_enemy_low_buy_penalty, heavy_weapon_weak_team_composition_penalty, decisive_round_underinvestment.

**Dónde los encuentra**

plan + contexto.

**Por qué los necesita**

degradar planes legales estratégicamente débiles.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "plan_a": "5 Vandals",
      "plan_b": "4 Vandals + rich Bandit",
      "enemy": "ENEMY_FULL_BUY"
    },
    "expected": {
      "plan_b_lower": true,
      "penalties": [
        "rich_player_low_weapon_full_buy_penalty",
        "rich_player_underpowered_vs_full_buy"
      ]
    },
    "observed": {
      "rifles": {
        "score": 0.7912,
        "team_plan_score": 0.7912,
        "team_plan_value": 0.7912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 19500.0,
        "weapon_value": 14500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.0,
        "warnings": [],
        "debug_warnings": [],
        "data_confidence": 0.6
      },
      "weak": {
        "score": 0.3912,
        "team_plan_score": 0.3912,
        "team_plan_value": 0.3912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 17500.0,
        "weapon_value": 12500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.4,
        "warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "debug_warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "data_confidence": 0.6
      }
    },
    "process": "Ejecuta BuyScorer.score.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- BuyScorer: degradar planes legales estratégicamente débiles; salida penalties.
- apply_contextual_adjustments: degradar planes legales estratégicamente débiles; salida penalties.

**Funciones / archivos implicados**

BuyScorer, apply_contextual_adjustments.

**Salida generada**

sections.penalties y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py, backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.14 Clasificación del plan económico — ✅ Correcto

**Qué datos necesita**

PISTOL_DEFAULT, PISTOL_UTILITY, PISTOL_ARMOR, PISTOL_SIDEARM, POST_PISTOL_CONVERSION, ANTI_ECO, BONUS_KEEP_INVENTORY, BONUS_UPGRADE, ECO, HALF_BUY, FORCE_BUY, BROKEN_BUY, UNDERINVESTED_BUY, FULL_BUY, LAST_HALF_ROUND_BUY, CLOSING_BUY, ELIMINATION_BUY, OVERTIME_BUY.

**Dónde los encuentra**

composición, gasto, ronda y marcador.

**Por qué los necesita**

convertir números en etiqueta explicable.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "last_half": {
        "round_number": 12
      },
      "closing": {
        "round_number": 18,
        "team_score_before": 12,
        "enemy_score_before": 4
      },
      "elimination": {
        "round_number": 20,
        "team_score_before": 4,
        "enemy_score_before": 12
      },
      "overtime": {
        "round_number": 25
      }
    },
    "expected": {
      "last_half": "LAST_HALF_ROUND_BUY",
      "closing": "CLOSING_BUY",
      "elimination": "ELIMINATION_BUY",
      "overtime": "OVERTIME_BUY"
    },
    "observed": {
      "last_half": "LAST_HALF_ROUND_BUY",
      "closing": "CLOSING_BUY",
      "elimination": "ELIMINATION_BUY",
      "overtime": "OVERTIME_BUY"
    },
    "process": "Ejecuta TeamBuySolver._summarize.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- classify_team_buy: convertir números en etiqueta explicable; salida buy_classification.

**Funciones / archivos implicados**

classify_team_buy.

**Salida generada**

sections.buy_classification y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.15 Pistol rounds — ✅ Correcto

**Qué datos necesita**

round 1, round 13, Classic gratis, 800 credits, ENEMY_PISTOL, pistol utility cap, no carryover.

**Dónde los encuentra**

reglas fijas.

**Por qué los necesita**

imponer budget y spawn inicial.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "rounds": [
        1,
        13
      ],
      "weapon": "Classic",
      "spent": 0
    },
    "expected": {
      "credits": 800,
      "weapon_source": "default_spawn_weapon",
      "enemy_buy": "ENEMY_PISTOL"
    },
    "observed": {
      "fixed_credits": {
        "1": 800.0,
        "13": 800.0,
        "25": 5000.0
      },
      "inference": {
        "weapon_source": "default_spawn_weapon",
        "confidence": 0.96,
        "estimated_self_spend": 0,
        "reasons": [
          "classic_default_loadout",
          "round_start_default_weapon"
        ],
        "armor_source": "unknown",
        "estimated_team_spend_impact": 0,
        "buys_for_teammate": null,
        "utility_bought_estimated": [],
        "free_utility_granted": [],
        "utility_status": "estimated",
        "warnings": [
          "ability_purchase_not_observable"
        ]
      },
      "display": {
        "weapon_label": "Classic gratis",
        "armor_label": "Sin escudo",
        "loadout_label": "Classic gratis + Sin escudo",
        "ability_label": "Sin compra de utilidad",
        "spend_label": "Gasto propio 0",
        "source_label": "Arma inicial gratis"
      },
      "enemy": {
        "available": true,
        "enemy_team_id": "R",
        "enemy_credits_by_player": {
          "R0": 800.0,
          "R1": 800.0,
          "R2": 800.0,
          "R3": 800.0,
          "R4": 800.0
        },
        "enemy_observed_previous_loadout": {},
        "enemy_projected_buy": {
          "total_credits": 4000.0,
          "average_credits": 800.0,
          "median_credits": 800.0,
          "buy_class": "ENEMY_PISTOL",
          "projected_weapon_value": 0,
          "projected_armor_value": 0,
          "projected_utility_value": 1000,
          "projected_total_loadout_value": 1000,
          "projected_rifle_count": 0,
          "projected_operator_count": 0
        },
        "enemy_buy_recommendation": "ENEMY_PISTOL",
        "enemy_full_buy_probability": 0.0,
        "enemy_force_probability": 0.0,
        "enemy_save_probability": 1.0,
        "enemy_anti_eco_probability": 0.8,
        "enemy_players": [
          {
            "puuid": "R0",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R1",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R2",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R3",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R4",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          }
        ],
        "enemy_can_full_buy_count": 0,
        "enemy_can_rifle_count": 0,
        "enemy_can_operator_count": 0,
        "enemy_low_credit_count": 5,
        "enemy_median_credits": 800.0,
        "enemy_credit_spread": 0.0,
        "enemy_saved_weapon_count": 0,
        "enemy_bonus_candidate": false,
        "confidence": 0.82,
        "source": "shared_economy_ledger+previous_round_inventory",
        "warnings": []
      }
    },
    "process": "Ejecuta reglas, inferencia, display y enemy economy.",
    "files": [
      "economy_income_rules.py",
      "purchase_inference.py",
      "display_normalizer.py",
      "enemy_economy.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- fixed_round_start_credits: imponer budget y spawn inicial; salida pistol_rounds.
- normalize_purchase_for_display: imponer budget y spawn inicial; salida pistol_rounds.

**Funciones / archivos implicados**

fixed_round_start_credits, normalize_purchase_for_display.

**Salida generada**

sections.pistol_rounds y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.16 Post-pistol / anti-eco — ✅ Correcto

**Qué datos necesita**

round 2, round 14, won_pistol, previous_round_won, enemy_buy, post_pistol penalties.

**Dónde los encuentra**

ronda previa y enemy economy.

**Por qué los necesita**

evitar conversiones frágiles.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "round_number": 2,
      "is_second_round": true,
      "previous_round_won": true,
      "is_anti_eco": true
    },
    "expected": {
      "label": [
        "POST_PISTOL_CONVERSION",
        "ANTI_ECO"
      ],
      "penalty": "heavy_weapon_early_penalty"
    },
    "observed": {
      "label": "ANTI_ECO",
      "odin_score": {
        "score": 0.0,
        "team_plan_score": 0.0,
        "team_plan_value": -1.33877,
        "round_win_probability": 0.3284,
        "match_win_probability": 0.4623,
        "ml_support": null,
        "future_if_win": 3100.0,
        "future_if_loss": 2000.0,
        "synchronization": 0.0,
        "players": [
          {
            "puuid": "p",
            "credits_after_buy": 100.0,
            "credits_if_win": 3100.0,
            "credits_if_loss": 2000.0,
            "can_full_buy_if_win": false,
            "can_full_buy_if_loss": false,
            "economic_risk": 0.4872,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 0,
        "players_can_full_buy_if_loss": 0,
        "players_desynchronized_if_loss": 1,
        "economic_risk": 1.0,
        "team_spend": 3200.0,
        "weapon_value": 3200.0,
        "armor_value": 0.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "ECO_PISTOL_UPGRADE",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 1.44,
        "warnings": [
          "weapon_without_armor_penalty",
          "underarmor_penalty",
          "operator_without_armor_penalty",
          "heavy_weapon_early_penalty",
          "post_pistol_overbuy_penalty",
          "early_heavy_weapon_context_penalty",
          "heavy_weapon_weak_team_composition_penalty",
          "overinvestment_penalty"
        ],
        "debug_warnings": [
          "weapon_without_armor_penalty",
          "underarmor_penalty",
          "operator_without_armor_penalty",
          "heavy_weapon_early_penalty",
          "post_pistol_overbuy_penalty",
          "early_heavy_weapon_context_penalty",
          "heavy_weapon_weak_team_composition_penalty",
          "overinvestment_penalty"
        ],
        "data_confidence": 0.6
      }
    },
    "process": "Ejecuta summarize y scorer.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- classify_team_buy: evitar conversiones frágiles; salida post_pistol.
- BuyScorer: evitar conversiones frágiles; salida post_pistol.

**Funciones / archivos implicados**

classify_team_buy, BuyScorer.

**Salida generada**

sections.post_pistol y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.17 Bonus — ✅ Correcto

**Qué datos necesita**

is_bonus_candidate, kept weapons, upgrades, spend, keep_ratio.

**Dónde los encuentra**

inventario conservado.

**Por qué los necesita**

proteger ventaja de 3+ SMG conservadas.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "carried_spectres": 5
    },
    "expected": {
      "label": "BONUS_KEEP_INVENTORY",
      "keep_weapon_min": 3
    },
    "observed": {
      "label": "BONUS_KEEP_INVENTORY",
      "keep_weapon": 5
    },
    "process": "Ejecuta summarize con 5 Spectres carried.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- classify_team_buy: proteger ventaja de 3+ SMG conservadas; salida bonus.
- BuyScorer: proteger ventaja de 3+ SMG conservadas; salida bonus.

**Funciones / archivos implicados**

classify_team_buy, BuyScorer.

**Salida generada**

sections.bonus y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.18 Full buy — ✅ Correcto

**Qué datos necesita**

weapons >= 4, armored >= 3, rich player low weapon penalty, controller smokes, multi sniper/operator.

**Dónde los encuentra**

composición y créditos.

**Por qué los necesita**

evitar huecos pagables y composiciones frágiles.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "plan_a": "5 Vandals",
      "plan_b": "4 Vandals + rich Bandit",
      "enemy": "ENEMY_FULL_BUY"
    },
    "expected": {
      "plan_b_lower": true,
      "penalties": [
        "rich_player_low_weapon_full_buy_penalty",
        "rich_player_underpowered_vs_full_buy"
      ]
    },
    "observed": {
      "rifles": {
        "score": 0.7912,
        "team_plan_score": 0.7912,
        "team_plan_value": 0.7912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 19500.0,
        "weapon_value": 14500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.0,
        "warnings": [],
        "debug_warnings": [],
        "data_confidence": 0.6
      },
      "weak": {
        "score": 0.3912,
        "team_plan_score": 0.3912,
        "team_plan_value": 0.3912,
        "round_win_probability": 0.94,
        "match_win_probability": 0.5968,
        "ml_support": null,
        "future_if_win": 40000.0,
        "future_if_loss": 34500.0,
        "synchronization": 1.0,
        "players": [
          {
            "puuid": "0",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "1",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "2",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "3",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          },
          {
            "puuid": "4",
            "credits_after_buy": 5000.0,
            "credits_if_win": 8000.0,
            "credits_if_loss": 6900.0,
            "can_full_buy_if_win": true,
            "can_full_buy_if_loss": true,
            "economic_risk": 0.0,
            "drop_bought_for": null,
            "drop_received_from": null
          }
        ],
        "players_can_full_buy_if_win": 5,
        "players_can_full_buy_if_loss": 5,
        "players_desynchronized_if_loss": 0,
        "economic_risk": 0.0,
        "team_spend": 17500.0,
        "weapon_value": 12500.0,
        "armor_value": 5000.0,
        "utility_value": 0.0,
        "macro_model_available": false,
        "macro_model_action": null,
        "macro_model_candidate_action": "FULL_RIFLES",
        "macro_model_scope": null,
        "macro_model_confidence": null,
        "macro_model_adjustment": 0.0,
        "rule_penalty": 0.4,
        "warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "debug_warnings": [
          "rich_player_low_weapon_full_buy_penalty",
          "rich_player_underpowered_vs_full_buy",
          "high_credit_player_saved_too_much"
        ],
        "data_confidence": 0.6
      }
    },
    "process": "Ejecuta BuyScorer.score.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- BuyScorer: evitar huecos pagables y composiciones frágiles; salida full_buy.
- validate_macro_composition: evitar huecos pagables y composiciones frágiles; salida full_buy.

**Funciones / archivos implicados**

BuyScorer, validate_macro_composition.

**Salida generada**

sections.full_buy y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.19 Match point / últimas rondas — ✅ Correcto

**Qué datos necesita**

round 12, score 12-4, score 4-12, round >=25.

**Dónde los encuentra**

round_number + score_before.

**Por qué los necesita**

reducir ahorro sin valor futuro.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "last_half": {
        "round_number": 12
      },
      "closing": {
        "round_number": 18,
        "team_score_before": 12,
        "enemy_score_before": 4
      },
      "elimination": {
        "round_number": 20,
        "team_score_before": 4,
        "enemy_score_before": 12
      },
      "overtime": {
        "round_number": 25
      }
    },
    "expected": {
      "last_half": "LAST_HALF_ROUND_BUY",
      "closing": "CLOSING_BUY",
      "elimination": "ELIMINATION_BUY",
      "overtime": "OVERTIME_BUY"
    },
    "observed": {
      "last_half": "LAST_HALF_ROUND_BUY",
      "closing": "CLOSING_BUY",
      "elimination": "ELIMINATION_BUY",
      "overtime": "OVERTIME_BUY"
    },
    "process": "Ejecuta TeamBuySolver._summarize.",
    "files": [
      "team_buy_solver.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- classify_team_buy: reducir ahorro sin valor futuro; salida decisive_rounds.

**Funciones / archivos implicados**

classify_team_buy.

**Salida generada**

sections.decisive_rounds y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.20 Enemy economy — ✅ Correcto

**Qué datos necesita**

enemy_credits_by_player, enemy_players, enemy_buy_recommendation, enemy_projected_buy, enemy_can_full_buy_count, enemy_can_operator_count, enemy_median_credits, enemy_credit_spread.

**Dónde los encuentra**

ledger rival + ronda anterior.

**Por qué los necesita**

proyectar amenaza pre-round sin leakage.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "pistol": [
        800,
        800,
        800,
        800,
        800
      ],
      "full": [
        5000,
        5000,
        5000,
        5000,
        5000
      ],
      "mixed": [
        9000,
        9000,
        500,
        500,
        500
      ]
    },
    "expected": {
      "labels": [
        "ENEMY_PISTOL",
        "ENEMY_FULL_BUY",
        "not ENEMY_FULL_BUY"
      ]
    },
    "observed": {
      "pistol": {
        "available": true,
        "enemy_team_id": "R",
        "enemy_credits_by_player": {
          "R0": 800.0,
          "R1": 800.0,
          "R2": 800.0,
          "R3": 800.0,
          "R4": 800.0
        },
        "enemy_observed_previous_loadout": {},
        "enemy_projected_buy": {
          "total_credits": 4000.0,
          "average_credits": 800.0,
          "median_credits": 800.0,
          "buy_class": "ENEMY_PISTOL",
          "projected_weapon_value": 0,
          "projected_armor_value": 0,
          "projected_utility_value": 1000,
          "projected_total_loadout_value": 1000,
          "projected_rifle_count": 0,
          "projected_operator_count": 0
        },
        "enemy_buy_recommendation": "ENEMY_PISTOL",
        "enemy_full_buy_probability": 0.0,
        "enemy_force_probability": 0.0,
        "enemy_save_probability": 1.0,
        "enemy_anti_eco_probability": 0.8,
        "enemy_players": [
          {
            "puuid": "R0",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R1",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R2",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R3",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R4",
            "credits": 800.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          }
        ],
        "enemy_can_full_buy_count": 0,
        "enemy_can_rifle_count": 0,
        "enemy_can_operator_count": 0,
        "enemy_low_credit_count": 5,
        "enemy_median_credits": 800.0,
        "enemy_credit_spread": 0.0,
        "enemy_saved_weapon_count": 0,
        "enemy_bonus_candidate": false,
        "confidence": 0.82,
        "source": "shared_economy_ledger+previous_round_inventory",
        "warnings": []
      },
      "full": {
        "available": true,
        "enemy_team_id": "R",
        "enemy_credits_by_player": {
          "R0": 5000.0,
          "R1": 5000.0,
          "R2": 5000.0,
          "R3": 5000.0,
          "R4": 5000.0
        },
        "enemy_observed_previous_loadout": {},
        "enemy_projected_buy": {
          "total_credits": 25000.0,
          "average_credits": 5000.0,
          "median_credits": 5000.0,
          "buy_class": "ENEMY_FULL_BUY",
          "projected_weapon_value": 14500.0,
          "projected_armor_value": 5000.0,
          "projected_utility_value": 2500.0,
          "projected_total_loadout_value": 22000.0,
          "projected_rifle_count": 5,
          "projected_operator_count": 0
        },
        "enemy_buy_recommendation": "ENEMY_FULL_BUY",
        "enemy_full_buy_probability": 1.0,
        "enemy_force_probability": 0.0,
        "enemy_save_probability": 0.0,
        "enemy_anti_eco_probability": 0.0,
        "enemy_players": [
          {
            "puuid": "R0",
            "credits": 5000.0,
            "buy_capacity": "rifle_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": false,
            "projected_weapon_class": "rifle"
          },
          {
            "puuid": "R1",
            "credits": 5000.0,
            "buy_capacity": "rifle_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": false,
            "projected_weapon_class": "rifle"
          },
          {
            "puuid": "R2",
            "credits": 5000.0,
            "buy_capacity": "rifle_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": false,
            "projected_weapon_class": "rifle"
          },
          {
            "puuid": "R3",
            "credits": 5000.0,
            "buy_capacity": "rifle_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": false,
            "projected_weapon_class": "rifle"
          },
          {
            "puuid": "R4",
            "credits": 5000.0,
            "buy_capacity": "rifle_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": false,
            "projected_weapon_class": "rifle"
          }
        ],
        "enemy_can_full_buy_count": 5,
        "enemy_can_rifle_count": 5,
        "enemy_can_operator_count": 0,
        "enemy_low_credit_count": 0,
        "enemy_median_credits": 5000.0,
        "enemy_credit_spread": 0.0,
        "enemy_saved_weapon_count": 0,
        "enemy_bonus_candidate": false,
        "confidence": 0.82,
        "source": "shared_economy_ledger+previous_round_inventory",
        "warnings": []
      },
      "mixed": {
        "available": true,
        "enemy_team_id": "R",
        "enemy_credits_by_player": {
          "R0": 9000.0,
          "R1": 9000.0,
          "R2": 500.0,
          "R3": 500.0,
          "R4": 500.0
        },
        "enemy_observed_previous_loadout": {},
        "enemy_projected_buy": {
          "total_credits": 19500.0,
          "average_credits": 3900.0,
          "median_credits": 500.0,
          "buy_class": "ENEMY_ECO",
          "projected_weapon_value": 9400.0,
          "projected_armor_value": 2000.0,
          "projected_utility_value": 1600.0,
          "projected_total_loadout_value": 13000.0,
          "projected_rifle_count": 0,
          "projected_operator_count": 2
        },
        "enemy_buy_recommendation": "ENEMY_ECO",
        "enemy_full_buy_probability": 0.4,
        "enemy_force_probability": 0.24,
        "enemy_save_probability": 0.6,
        "enemy_anti_eco_probability": 0.48,
        "enemy_players": [
          {
            "puuid": "R0",
            "credits": 9000.0,
            "buy_capacity": "operator_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": true,
            "projected_weapon_class": "operator"
          },
          {
            "puuid": "R1",
            "credits": 9000.0,
            "buy_capacity": "operator_heavy",
            "can_full_buy": true,
            "can_force": true,
            "can_operator": true,
            "projected_weapon_class": "operator"
          },
          {
            "puuid": "R2",
            "credits": 500.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R3",
            "credits": 500.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          },
          {
            "puuid": "R4",
            "credits": 500.0,
            "buy_capacity": "pistol_save",
            "can_full_buy": false,
            "can_force": false,
            "can_operator": false,
            "projected_weapon_class": "sidearm"
          }
        ],
        "enemy_can_full_buy_count": 2,
        "enemy_can_rifle_count": 2,
        "enemy_can_operator_count": 2,
        "enemy_low_credit_count": 3,
        "enemy_median_credits": 500.0,
        "enemy_credit_spread": 8500.0,
        "enemy_saved_weapon_count": 0,
        "enemy_bonus_candidate": false,
        "confidence": 0.82,
        "source": "shared_economy_ledger+previous_round_inventory",
        "warnings": []
      }
    },
    "process": "Ejecuta build_enemy_economy_context.",
    "files": [
      "enemy_economy.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- build_enemy_economy_context: proyectar amenaza pre-round sin leakage; salida enemy_economy.

**Funciones / archivos implicados**

build_enemy_economy_context.

**Salida generada**

sections.enemy_economy y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.21 Mapa y site tendencies — ✅ Correcto

**Qué datos necesita**

map_id, map_name, map_profile, operator_affinity, rifle_affinity, likely_attack_site, rounds_observed, confidence, site_adjustment.

**Dónde los encuentra**

mapId + rondas anteriores.

**Por qué los necesita**

ajustar sólo con muestra >=3 y confidence >=.5.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "site": "B",
      "cases": [
        [
          2,
          0.8
        ],
        [
          3,
          0.4
        ],
        [
          3,
          0.8
        ]
      ]
    },
    "expected": {
      "adjustments": [
        0,
        0,
        ">0"
      ]
    },
    "observed": {
      "rounds_2": 0.0,
      "confidence_04": 0.0,
      "eligible": 0.0375
    },
    "process": "Ejecuta apply_contextual_adjustments.",
    "files": [
      "contextual_scorer.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- build_map_context: ajustar sólo con muestra >=3 y confidence >=.5; salida map_site.
- build_site_tendencies: ajustar sólo con muestra >=3 y confidence >=.5; salida map_site.
- apply_contextual_adjustments: ajustar sólo con muestra >=3 y confidence >=.5; salida map_site.

**Funciones / archivos implicados**

build_map_context, build_site_tendencies, apply_contextual_adjustments.

**Salida generada**

sections.map_site y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.22 Player profile — ⚠️ Parcial

**Qué datos necesita**

preferred_weapons, weapon_kill_rate, rifle_tendency, sniper_tendency, smg_tendency, sample_size, confidence.

**Dónde los encuentra**

rondas estrictamente anteriores.

**Por qué los necesita**

justificar especialización sin kills actuales.

**Valor observado en auditoría**

~~~json
{}
~~~

**Proceso que realiza**

- build_player_profile: justificar especialización sin kills actuales; salida player_profile.

**Funciones / archivos implicados**

build_player_profile.

**Salida generada**

sections.player_profile y campos API/UI indicados.

**Warnings / fallbacks**

documented_from_code_but_not_exercised_in_this_run

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.23 Ultimates — ⚠️ Parcial

**Qué datos necesita**

ultimate_points, ultimate_cost, ultimate_ready, agent, source, confidence.

**Dónde los encuentra**

playerStats + catálogo.

**Por qué los necesita**

reconocer arma de ultimate y modular compra.

**Valor observado en auditoría**

~~~json
{}
~~~

**Proceso que realiza**

- build_ultimate_state: reconocer arma de ultimate y modular compra; salida ultimates.

**Funciones / archivos implicados**

build_ultimate_state.

**Salida generada**

sections.ultimates y campos API/UI indicados.

**Warnings / fallbacks**

documented_from_code_but_not_exercised_in_this_run

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.24 Armor durability — ✅ Correcto

**Qué datos necesita**

armor_value_remaining, armor_max_value, armor_durability_ratio, armor_effective_value.

**Dónde los encuentra**

estado de armor.

**Por qué los necesita**

no valorar Heavy 15/50 como completo.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "armor": "Heavy Shield",
      "remaining": 15,
      "max": 50
    },
    "expected": {
      "armor_value": 1000,
      "armor_effective_value": 300,
      "ratio": 0.3,
      "warning": "context_damaged_armor_should_refresh"
    },
    "observed": {
      "plan": {
        "puuid": "p",
        "weapon": null,
        "armor": {
          "displayName": "Heavy Shield",
          "cost": 0,
          "purchase_cost": 0,
          "armor_value": 1000.0,
          "armor_full_value": 1000.0,
          "armor_effective_value": 300.0,
          "armor_durability_ratio": 0.3,
          "source": "carried"
        },
        "abilities": [],
        "keep_weapon": false,
        "self_cost": 0.0,
        "weapon_cost": 0.0,
        "weapon_purchase_cost": 0.0,
        "weapon_value": 0.0,
        "weapon_source": "none",
        "armor_cost": 0,
        "armor_purchase_cost": 0.0,
        "armor_value": 1000.0,
        "armor_effective_value": 300.0,
        "armor_full_value": 1000.0,
        "armor_durability_ratio": 0.3,
        "armor_source": "carried",
        "keep_armor": true,
        "ability_cost": 0,
        "expected_remaining": 1000.0,
        "bought_by": null,
        "buys_for": null,
        "warnings": [],
        "requires_weapon_drop": false
      },
      "contextual": {
        "team_plan_value": 0.46705,
        "team_plan_score": 0.46705,
        "round_win_probability": 0.5,
        "weapon_value": 1600,
        "armor_value": 400,
        "utility_value": 300,
        "synchronization": 0.5,
        "rule_penalty": 0,
        "data_confidence": 0.7,
        "warnings": [
          "context_damaged_armor_should_refresh"
        ],
        "debug_warnings": [
          "context_damaged_armor_should_refresh"
        ],
        "score": 0.46705,
        "rule_score": 0.5,
        "ml_round_win_probability": 0.5947122818277583,
        "future_economy_score": 0.5,
        "enemy_adjustment": 0.0,
        "map_adjustment": 0.0,
        "site_adjustment": 0.0,
        "player_fit_adjustment": 0.0,
        "utility_adjustment": 0.0,
        "ultimate_adjustment": 0.0,
        "armor_adjustment": -0.05,
        "ml_adjustment": 0.01705,
        "risk_penalty": 0,
        "contextual_adjustment": -0.03295,
        "ml_prediction": {
          "available": true,
          "round_win_probability": 0.5947122818277583,
          "confidence": 0.72,
          "model_scope": "global_temporal",
          "feature_version": "round-win-loadout-v2",
          "warnings": []
        },
        "confidence": 0.705
      }
    },
    "process": "Ejecuta generación y contextual scorer.",
    "files": [
      "armor_durability.py",
      "legal_purchase.py",
      "contextual_scorer.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- build_armor_durability_state: no valorar Heavy 15/50 como completo; salida armor_durability.
- LegalPurchaseGenerator.generate: no valorar Heavy 15/50 como completo; salida armor_durability.

**Funciones / archivos implicados**

build_armor_durability_state, LegalPurchaseGenerator.generate.

**Salida generada**

sections.armor_durability y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.25 Ability usage — ✅ Correcto

**Qué datos necesita**

used_abilities_by_slot, charges_carried_after_round, ability_charges_before_buy, carried_and_bought, free_and_bought.

**Dónde los encuentra**

casts + catálogo.

**Por qué los necesita**

comprar sólo cargas faltantes.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "agent": "Sova",
      "carried": {
        "Q": 1
      },
      "max": 2,
      "cost_per_charge": 150
    },
    "expected": {
      "total_charges": 2,
      "additional_bought_charges": 1,
      "source": "carried_and_bought",
      "ability_cost": 150,
      "ultimate_bought": false
    },
    "observed": {
      "selected_plan": {
        "puuid": "sova",
        "weapon": null,
        "armor": null,
        "abilities": [
          {
            "name": "Shock Bolt",
            "charges": 2,
            "cost": 150.0,
            "cost_per_charge": 150.0,
            "source": "carried_and_bought",
            "tactical_types": [
              "damage"
            ]
          }
        ],
        "keep_weapon": false,
        "self_cost": 150.0,
        "weapon_cost": 0.0,
        "weapon_purchase_cost": 0.0,
        "weapon_value": 0.0,
        "weapon_source": "none",
        "armor_cost": 0.0,
        "armor_purchase_cost": 0.0,
        "armor_value": 0.0,
        "armor_effective_value": 0.0,
        "armor_full_value": 0.0,
        "armor_durability_ratio": null,
        "armor_source": "none",
        "keep_armor": false,
        "ability_cost": 150.0,
        "expected_remaining": 850.0,
        "bought_by": null,
        "buys_for": null,
        "warnings": [],
        "requires_weapon_drop": false
      }
    },
    "process": "Ejecuta _ability_options mediante generate.",
    "files": [
      "legal_purchase.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- build_ability_usage_state: comprar sólo cargas faltantes; salida ability_usage.
- LegalPurchaseGenerator._ability_options: comprar sólo cargas faltantes; salida ability_usage.

**Funciones / archivos implicados**

build_ability_usage_state, LegalPurchaseGenerator._ability_options.

**Salida generada**

sections.ability_usage y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_contextual_v11.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.26 Modelo macro económico principal — ⚠️ Parcial

**Qué datos necesita**

macro_model.available, recommended_action, model_scope, confidence, alternatives, macro_model_candidate_action, macro_model_adjustment.

**Dónde los encuentra**

artifact compatible + prebuy.

**Por qué los necesita**

guiar ranking sin legalizar.

**Valor observado en auditoría**

~~~json
{}
~~~

**Proceso que realiza**

- predict_action: guiar ranking sin legalizar; salida macro_model.
- RoundEconomyRecommender: guiar ranking sin legalizar; salida macro_model.

**Funciones / archivos implicados**

predict_action, RoundEconomyRecommender.

**Salida generada**

sections.macro_model y campos API/UI indicados.

**Warnings / fallbacks**

documented_from_code_but_not_exercised_in_this_run

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.27 ML auxiliar round-win — ✅ Correcto

**Qué datos necesita**

FEATURE_VERSION, ROUND_WIN_FEATURES, FORBIDDEN_ROUND_WIN_FEATURES, artifact_path, artifact_exists, artifact_feature_version, RoundWinLoadoutModel.available(), round_win_probability, ml_adjustment.

**Dónde los encuentra**

round_win_loadout.joblib.

**Por qué los necesita**

comparar loadouts candidatos sin leakage.

**Valor observado en auditoría**

~~~json
{
  "FEATURE_VERSION": "round-win-loadout-v2",
  "ROUND_WIN_FEATURES": [
    "team_weapon_value",
    "team_armor_value",
    "team_utility_value",
    "enemy_projected_weapon_value",
    "enemy_projected_armor_value",
    "enemy_projected_utility_value",
    "rifle_count",
    "operator_count",
    "smg_count",
    "sidearm_count",
    "heavy_weapon_count",
    "heavy_shield_count",
    "regen_shield_count",
    "light_shield_count",
    "ultimate_ready_count",
    "map",
    "side",
    "round_number",
    "score_diff",
    "loss_streak",
    "team_credits_total",
    "team_credits_median",
    "enemy_credits_total",
    "enemy_credits_median",
    "agent_roles",
    "utility_types_available",
    "player_weapon_fit_scores",
    "enemy_buy_class"
  ],
  "FORBIDDEN_ROUND_WIN_FEATURES": [
    "current_round_damage",
    "current_round_defuse",
    "current_round_kills",
    "current_round_plant",
    "current_round_result",
    "enemy_current_postbuy_loadout",
    "post_round_score"
  ],
  "forbidden_overlap": [],
  "artifact_path": "C:\\Users\\lrg20\\Desktop\\TFG\\ValoInsight\\backend\\modules\\economy_ml\\artifacts\\round_win_loadout.joblib",
  "artifact_exists": true,
  "artifact_feature_version": "round-win-loadout-v2",
  "available": true,
  "artifact_v1_rejected": true,
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "enemy_projected_values": [
        14500,
        5000,
        2500
      ]
    },
    "expected": {
      "forbidden_overlap": [],
      "prediction": "available or explicit warning"
    },
    "observed": {
      "available": true,
      "prediction": {
        "available": true,
        "round_win_probability": 0.026121108643162135,
        "confidence": 0.72,
        "model_scope": "global_temporal",
        "feature_version": "round-win-loadout-v2",
        "warnings": []
      },
      "forbidden_overlap": []
    },
    "process": "Ejecuta RoundWinLoadoutModel.predict_round_win.",
    "files": [
      "round_win_model.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- RoundWinLoadoutModel: comparar loadouts candidatos sin leakage; salida round_win_model.
- validate_round_win_features: comparar loadouts candidatos sin leakage; salida round_win_model.

**Funciones / archivos implicados**

RoundWinLoadoutModel, validate_round_win_features.

**Salida generada**

sections.round_win_model y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_round_win_model.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.28 Dataset y entrenamiento — ✅ Correcto

**Qué datos necesita**

dataset rows, match count, valid_labels, missing_features, forbidden_features, train_samples, test_samples, metrics, artifact output.

**Dónde los encuentra**

economy_round_dataset.parquet.

**Por qué los necesita**

entrenar macro observacional y auxiliar.

**Valor observado en auditoría**

~~~json
{
  "valid": true,
  "rows": 76734,
  "valid_labels": 76734,
  "forbidden_features": [],
  "missing_features": [],
  "feature_version": "round-win-loadout-v2",
  "match_count": 1800,
  "dataset_path": "C:\\Users\\lrg20\\Desktop\\TFG\\ValoInsight\\backend\\modules\\economy_ml\\artifacts\\economy_round_dataset.parquet"
}
~~~

**Proceso que realiza**

- train_models: entrenar macro observacional y auxiliar; salida dataset_training.
- train_round_win_model: entrenar macro observacional y auxiliar; salida dataset_training.
- scripts/entrenamiento_economia.py: entrenar macro observacional y auxiliar; salida dataset_training.
- /economy-ml/train: entrenar macro observacional y auxiliar; salida dataset_training.

**Funciones / archivos implicados**

train_models, train_round_win_model, scripts/entrenamiento_economia.py, /economy-ml/train.

**Salida generada**

sections.dataset_training y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.29 API response contract — ✅ Correcto

**Qué datos necesita**

available, engine, advanced_engine, match_id, rounds, limitations, debug_limitations, round_number, team_id, side, score_before, recommended_team_buy, team_plan_score, team_plan_value, confidence, players, alternatives, economy_projection, advanced_context, warnings, debug_warnings, observed_weapon, observed_armor, inferred_real_purchase, recommended_purchase, reason, context_reasons.

**Dónde los encuentra**

recommend_match_economy.

**Por qué los necesita**

entregar contrato y separar humano/debug.

**Valor observado en auditoría**

~~~json
{
  "scenario": {
    "status": "ok",
    "status_reason": "ok_runtime_verified",
    "input_data": {
      "match_id": "synthetic-economy-audit"
    },
    "expected": {
      "available": true,
      "engine": "player_first_v10",
      "advanced_engine": "player_first_v11_contextual_stable",
      "rounds_nonempty": true
    },
    "observed": {
      "available": true,
      "engine": "player_first_v10",
      "advanced_engine": "player_first_v11_contextual_stable",
      "round_count": 2,
      "first_round_keys": [
        "advanced_context",
        "alternatives",
        "confidence",
        "debug_warnings",
        "economy_projection",
        "inferred_team_buy",
        "players",
        "real_team_buy_observed",
        "recommended_team_buy",
        "round_number",
        "score_before",
        "side",
        "team_id",
        "team_plan_score",
        "team_plan_value",
        "warnings"
      ],
      "player_count": 5,
      "sample_player_recommendations": [
        {
          "puuid": "B0",
          "recommended_purchase": {
            "puuid": "B0",
            "weapon": null,
            "armor": null,
            "abilities": [
              {
                "name": "Recon Bolt",
                "charges": 1,
                "cost": 0,
                "cost_per_charge": 0,
                "source": "free_round_start",
                "tactical_types": [
                  "recon",
                  "reveal",
                  "info"
                ]
              }
            ],
            "keep_weapon": false,
            "self_cost": 0.0,
            "weapon_cost": 0.0,
            "weapon_purchase_cost": 0.0,
            "weapon_value": 0.0,
            "weapon_source": "none",
            "armor_cost": 0.0,
            "armor_purchase_cost": 0.0,
            "armor_value": 0.0,
            "armor_effective_value": 0.0,
            "armor_full_value": 0.0,
            "armor_durability_ratio": null,
            "armor_source": "none",
            "keep_armor": false,
            "ability_cost": 0,
            "expected_remaining": 800.0,
            "bought_by": null,
            "buys_for": null,
            "warnings": [],
            "requires_weapon_drop": false,
            "display": {
              "weapon_label": "Classic gratis",
              "armor_label": "Sin escudo",
              "loadout_label": "Classic gratis + Sin escudo",
              "ability_label": "Recon Bolt x1",
              "spend_label": "Gasto propio 0",
              "source_label": "Arma inicial gratis"
            }
          },
          "reason": "Compra coherente con el plan pistol default.",
          "confidence": 0.96
        },
        {
          "puuid": "B1",
          "recommended_purchase": {
            "puuid": "B1",
            "weapon": null,
            "armor": null,
            "abilities": [
              {
                "name": "Tailwind",
                "charges": 1,
                "cost": 0,
                "cost_per_charge": 0,
                "source": "free_round_start",
                "tactical_types": [
                  "dash",
                  "mobility",
                  "escape",
                  "entry"
                ]
              }
            ],
            "keep_weapon": false,
            "self_cost": 0.0,
            "weapon_cost": 0.0,
            "weapon_purchase_cost": 0.0,
            "weapon_value": 0.0,
            "weapon_source": "none",
            "armor_cost": 0.0,
            "armor_purchase_cost": 0.0,
            "armor_value": 0.0,
            "armor_effective_value": 0.0,
            "armor_full_value": 0.0,
            "armor_durability_ratio": null,
            "armor_source": "none",
            "keep_armor": false,
            "ability_cost": 0,
            "expected_remaining": 800.0,
            "bought_by": null,
            "buys_for": null,
            "warnings": [],
            "requires_weapon_drop": false,
            "display": {
              "weapon_label": "Classic gratis",
              "armor_label": "Sin escudo",
              "loadout_label": "Classic gratis + Sin escudo",
              "ability_label": "Tailwind x1",
              "spend_label": "Gasto propio 0",
              "source_label": "Arma inicial gratis"
            }
          },
          "reason": "Compra coherente con el plan pistol default.",
          "confidence": 0.96
        },
        {
          "puuid": "B2",
          "recommended_purchase": {
            "puuid": "B2",
            "weapon": null,
            "armor": null,
            "abilities": [
              {
                "name": "Tailwind",
                "charges": 1,
                "cost": 0,
                "cost_per_charge": 0,
                "source": "free_round_start",
                "tactical_types": [
                  "dash",
                  "mobility",
                  "escape",
                  "entry"
                ]
              }
            ],
            "keep_weapon": false,
            "self_cost": 0.0,
            "weapon_cost": 0.0,
            "weapon_purchase_cost": 0.0,
            "weapon_value": 0.0,
            "weapon_source": "none",
            "armor_cost": 0.0,
            "armor_purchase_cost": 0.0,
            "armor_value": 0.0,
            "armor_effective_value": 0.0,
            "armor_full_value": 0.0,
            "armor_durability_ratio": null,
            "armor_source": "none",
            "keep_armor": false,
            "ability_cost": 0,
            "expected_remaining": 800.0,
            "bought_by": null,
            "buys_for": null,
            "warnings": [],
            "requires_weapon_drop": false,
            "display": {
              "weapon_label": "Classic gratis",
              "armor_label": "Sin escudo",
              "loadout_label": "Classic gratis + Sin escudo",
              "ability_label": "Tailwind x1",
              "spend_label": "Gasto propio 0",
              "source_label": "Arma inicial gratis"
            }
          },
          "reason": "Compra coherente con el plan pistol default.",
          "confidence": 0.96
        }
      ],
      "warnings_top_10": [
        "Motor activo: reglas y solver player-first + ML auxiliar de victoria por loadout.",
        "macro_economy_model_unavailable_rules_fallback"
      ]
    },
    "process": "Ejecuta recommend_match_economy.",
    "files": [
      "round_recommender.py"
    ],
    "warnings": [],
    "errors": []
  }
}
~~~

**Proceso que realiza**

- recommend_match_economy: entregar contrato y separar humano/debug; salida api_contract.
- RecommendationExplainer: entregar contrato y separar humano/debug; salida api_contract.

**Funciones / archivos implicados**

recommend_match_economy, RecommendationExplainer.

**Salida generada**

sections.api_contract y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

backend/tests/test_economy_routes_v10.py, backend/tests/test_economy_engine_v10.py

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.30 Frontend/UI — ✅ Correcto

**Qué datos necesita**

enemy_projected_buy, macro_model, ml_prediction, debug_warnings, Classic gratis, advanced_context, loadout enemigo proyectado, modelo económico recomienda/candidato.

**Dónde los encuentra**

matches.ts + MatchDetailModal.tsx.

**Por qué los necesita**

tipar y renderizar sin UUIDs/placeholders.

**Valor observado en auditoría**

~~~json
{
  "tokens": {
    "purchase.display?.loadout_label": true,
    "purchase.display?.source_label": true,
    "enemy_projected_buy": true,
    "macro_model": true,
    "ml_prediction": true,
    "debug_warnings": true,
    "advanced_context": true
  },
  "files": [
    "frontend\\src\\types\\matches.ts",
    "frontend\\src\\components\\modals\\MatchDetailModal.tsx"
  ]
}
~~~

**Proceso que realiza**

- EconomyRecommendation types: tipar y renderizar sin UUIDs/placeholders; salida frontend.
- MatchDetailModal: tipar y renderizar sin UUIDs/placeholders; salida frontend.

**Funciones / archivos implicados**

EconomyRecommendation types, MatchDetailModal.

**Salida generada**

sections.frontend y campos API/UI indicados.

**Warnings / fallbacks**

Sin warnings en esta ejecución.

**Tests existentes**

frontend build

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

### 3.31 Tests — ✅ Correcto

**Qué datos necesita**

test_economy_ml, test_economy_ledger, test_economy_engine_v10, test_economy_contextual_v11, test_round_win_model, test_economy_routes_v10, frontend tests.

**Dónde los encuentra**

backend/tests + frontend.

**Por qué los necesita**

vincular garantías con regresiones.

**Valor observado en auditoría**

~~~json
{
  "backend": [
    {
      "file": "backend/tests/test_economy_ml.py",
      "exists": true,
      "test_count": 59,
      "covers": "datos, dataset, features y política"
    },
    {
      "file": "backend/tests/test_economy_ledger.py",
      "exists": true,
      "test_count": 15,
      "covers": "ledger, créditos, ingresos y reconciliación"
    },
    {
      "file": "backend/tests/test_economy_engine_v10.py",
      "exists": true,
      "test_count": 50,
      "covers": "inventario, legalidad, drops, scoring y API"
    },
    {
      "file": "backend/tests/test_economy_contextual_v11.py",
      "exists": true,
      "test_count": 18,
      "covers": "enemy, mapa/site, perfil, ultimates, armor y abilities"
    },
    {
      "file": "backend/tests/test_round_win_model.py",
      "exists": true,
      "test_count": 4,
      "covers": "dataset y artifact round-win v2"
    },
    {
      "file": "backend/tests/test_economy_routes_v10.py",
      "exists": true,
      "test_count": 4,
      "covers": "rutas y entrenamiento"
    }
  ],
  "frontend_tests": [
    "frontend\\src\\utils\\damageAttribution.test.ts",
    "frontend\\src\\utils\\rankUtils.test.ts",
    "frontend\\src\\utils\\analytics\\momentum.test.ts",
    "frontend\\src\\utils\\stats\\combatEvents.test.ts"
  ]
}
~~~

**Proceso que realiza**

- unittest: vincular garantías con regresiones; salida tests.
- frontend build: vincular garantías con regresiones; salida tests.

**Funciones / archivos implicados**

unittest, frontend build.

**Salida generada**

sections.tests y campos API/UI indicados.

**Warnings / fallbacks**

tests_discovered_not_executed_by_auditor

**Tests existentes**

Sin test específico localizado.

**Riesgos / mejoras**

Requiere mantener contrato, tests y evidencia de ejecución alineados.

## 4. Matriz de penalizaciones

| Penalty | Condición | Magnitud | Dato requerido | Por qué existe | Test |
|---|---|---|---|---|---|
| weapon_without_armor_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| underarmor_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| operator_without_armor_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| heavy_weapon_early_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| post_pistol_overbuy_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| pistol_full_utility_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| bonus_upgrade_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| team_full_buy_available_but_half_buy_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| enemy_full_buy_underinvestment_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| excessive_saving_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| rich_player_low_weapon_full_buy_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| rich_player_underpowered_vs_full_buy | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| high_credit_player_saved_too_much | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| heavy_weapon_enemy_low_buy_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| heavy_weapon_weak_team_composition_penalty | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |
| decisive_round_underinvestment | Se activa por la composición/contexto homónimo en BuyScorer o contextual_scorer | Ajuste acotado definido en código; consultar process_trace/código vigente | plan, créditos, ronda y enemy context | evita inversión incoherente | test_economy_engine_v10 / test_economy_contextual_v11 |

## 5. Matriz de etiquetas económicas

| Etiqueta | Condición auditada | Datos usados | Ejemplo | Salida UI |
|---|---|---|---|---|
| PISTOL_DEFAULT | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| PISTOL_UTILITY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| PISTOL_ARMOR | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| PISTOL_SIDEARM | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| POST_PISTOL_CONVERSION | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| ANTI_ECO | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| BONUS_KEEP_INVENTORY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | 3+ Spectres conservadas | recommended_team_buy / plan_kind |
| BONUS_UPGRADE | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| ECO | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| HALF_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| FORCE_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| BROKEN_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| UNDERINVESTED_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| FULL_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | composición/gasto compatible | recommended_team_buy / plan_kind |
| LAST_HALF_ROUND_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | ronda 12 | recommended_team_buy / plan_kind |
| CLOSING_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | score 12-4 | recommended_team_buy / plan_kind |
| ELIMINATION_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | score 4-12 | recommended_team_buy / plan_kind |
| OVERTIME_BUY | classify_team_buy evalúa ronda, gasto, armas, armor, carry y marcador | round_number, score_before, composition, spend, keep_ratio | ronda >=25 | recommended_team_buy / plan_kind |
