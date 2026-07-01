---
name: seed-units-codelist-mismatch
description: seed-units.ts emits PCT but V16 codelist seeds PERCENT — silent today (metadata is unvalidated), breaks loudly once unit_code becomes an FK
metadata:
  type: project
---

`apps/api/scripts/seed-units.ts` emits unit codes `PCT`, `GEL_MN`, `USD`. The V16
`stats.unit_measure` codelist seeds `PERCENT` (NOT `PCT`), plus `GEL_MN`, `USD`. So
`PCT` has no codelist row.

**Why it matters:** today this is silent because the seed writes unit into
`classifier.metadata` (unvalidated JSONB bag). Once unit becomes `classifier.unit_code`
with an FK to `stats.unit_measure` (the [[unit-attachment-level]] decision), the seed
will fail loudly on `PCT` — which is correct (root-cause surfacing, not a symptom).

**How to apply:** when implementing the unit-attachment migration, the seed cutover must
fix `PCT` -> `PERCENT` in seed-units.ts. Also decide GEL-million representation
explicitly: either `unit_code='GEL_MN', unit_mult=0` (scale baked in code) or the V16
preferred idiom `unit_code='GEL', unit_mult=6`. Prefer the latter for SDMX cleanliness.
