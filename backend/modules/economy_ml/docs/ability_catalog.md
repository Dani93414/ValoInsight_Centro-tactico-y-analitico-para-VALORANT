# Ability Catalog

This catalog feeds `economy_ml` with auditable agent ability metadata: charges,
round-start ability, tactical types and credit costs.

## Sources

The loader merges two sources:

1. `content_collection` via `reference_data.agents_by_uuid()`.
2. `backend/modules/economy_ml/data/ability_catalog_seed.json`.

Content data has priority for official identifiers, names and descriptions. The
manual seed is the expected source for economic ability fields because
`content_collection` and match documents do not include ability credit costs.
It also provides tactical fields such as `max_charges`,
`free_charges_at_round_start` and `tactical_types`.

If content and seed disagree, the content value is kept, a warning is attached,
and the affected record is marked with `needs_review: true`.

## Safety Rules

- Treat the seed as the versioned source of truth for ability credit costs.
- Review seed changes manually; do not infer costs from match data.
- Do not invent costs for missing abilities.
- Ultimates never receive `cost_credits`; they use `ultimate_points`.
- Unknown tactical type becomes `["unknown"]`.
- Missing official agents are reported as incomplete rather than silently filled.

## Endpoints

- `GET /economy-ml/ability-catalog`
- `GET /economy-ml/ability-catalog/report`

The report includes loaded agents, loaded abilities, abilities with and without
cost, incomplete agents, warnings and validation results.
