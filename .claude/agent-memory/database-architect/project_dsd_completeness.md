---
name: project-dsd-completeness
description: DSD-completeness invariant — every obs dim_key value must be a declared classifier member; GDP_DEFLATOR added to close the live-seed gap
metadata:
  type: project
---
The geostat classifier bundle must COVER every (dim_code, code) value used in any observation dim_key — the DSD contract the V4 `validate_observation_dim_key` trigger enforces (each dim_key value must resolve to a CURRENT classifier member). The Phase-1 in-memory store never validated this; the DB does.

**Closed gap (2026-06-23):** the only missing value across all three facts bundles was `measure = GDP_DEFLATOR` (15 obs in GDP_ANNUAL, geo=GE, 2011-2025, year-on-year % change values -0.65..10.23). Added as a FLAT measure (no parentCode — [[project-classifier-parent-model]]) with `metadata = {approach: 'growth', unit_measure: 'PERCENT', decimals: 2}` — same shape as the existing GDP_GROWTH measure. Label `{en: "GDP Deflator", ka: "მშპ-ის დეფლატორი"}` (standard Geostat term, not a speculative translation). PERCENT is a valid V16 unit code. Added to BOTH `codelists.bundle.json` (+ manifest count 126→127) AND `R__seed_geostat_gold.sql` (the hand-maintained mirror).

**Fitness lock:** `platform/apps/api/scripts/seed-data.fitness.test.ts` Tier-1 (DB-independent) gained TWO invariants: (1) the set of (dim_code, code) in ALL obs dim_keys is a SUBSET of the classifier set (DSD-completeness) — a future unknown code fails offline before the cube rejects it; (2) every `metadata.unit_measure` is a valid V16 unit code (mirrors the V16 INSERT set: GEL/USD/EUR/GEL_MN/USD_MN/PERCENT/RATIO/RATIO_PCT/PURE_NUMBER/INDEX/PERSON).

**Reusable gap computer:** `ops/seed-data/geostat/compute-dim-key-gap.mjs` recomputes the gap deterministically (exit 1 + prints missing set if any). Note: codelist has 127 rows but only 95 distinct dim_key-relevant (dim,code) pairs — `time` codes are duplicated across frequency contexts and aren't in obs dim_keys (time is the partition dim, carried as timePeriod). That duplication is pre-existing bundle structure, not a defect.

**How to apply:** new observations referencing a new code = add the classifier FIRST (bundle + R__ in lockstep). Run compute-dim-key-gap.mjs or the fitness test to confirm before a live seed. See [[project-db-state]], [[project-decision-c-unit-measure]].
