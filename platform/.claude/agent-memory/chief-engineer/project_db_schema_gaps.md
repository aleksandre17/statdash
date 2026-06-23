---
name: project-db-schema-gaps
description: Genuine (non-i18n) weaknesses found in the Postgres schema audit 2026-06 — multi-measure, unit model, FK gaps, query-layer hardcodes
metadata:
  type: project
---

Real schema gaps found in the full audit (beyond the known i18n KNOWN_LOCALES hardcode):

1. **No unit/measure metadata model.** `stats.observation` has obs_value (NUMERIC) but no UNIT_MEASURE, UNIT_MULT (scale), DECIMALS, or BASE_PERIOD as first-class/validated structure — they live only in the open `obs_attribute` bag (V8), unvalidated. SDMX/Eurostat treat UNIT as a coded attribute. A chart cannot reliably know "millions GEL" vs "index".
2. **Single-measure-per-row only.** dim_key models measure as a dimension (good), so multi-measure-in-one-row is handled by multiple rows — fine, but there is no measure-type/datatype registry (is GDP a flow? a ratio? what aggregation is valid?). `stats.dimension` has no concept-role typing.
3. **Query-layer time hardcode.** `apps/api/src/routes/stats/observations.ts:84-86` maps from/to to `${from}-01-01` / `${to}-12-31` — annual assumption. A quarterly/monthly dataset's range filter is wrong at the boundary even though the cube stores sub-annual correctly.
4. **classifier.path LTREE not enforced acyclic** beyond the trigger; a manual parent_id cycle could wedge refresh_classifier_path (it RAISEs, so fail-fast, but no EXCLUDE constraint).
5. **RLS is a permissive placeholder** (V6 USING true) — single-tenant in practice. Honest, documented, but not real isolation yet.
6. **dataset_version bump is app-driven**, not trigger-driven — a direct SQL write to stats.observation does NOT bump the version, so the ETag can go stale if ETL bypasses bump_dataset_version.

**Why:** investment-decision audit. **How to apply:** these are the few vital-few items to raise if asked "what's left to reach Eurostat-grade". The unit/measure model (#1) is the single highest-value addition.
