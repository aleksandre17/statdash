---
name: vintage-foundation-verdict
description: Foundation-audit verdict for vintage/release-time as a first-class dimension — SOUND (bitemporal store already built), gap is PORT reach; two integrity gates fix-first
metadata:
  type: project
---

# Vintage / release-time dimension — foundation audit verdict

**Verdict: the data foundation is SOUND to carry a first-class `vintage` dimension, NOT rotten.** The mission's fear ("a revision overwrites the prior value; history destroyed") is UNFOUNDED.

**Why:** the DB already implements an ALFRED/FRED-grade bitemporal real-time database.
- `stats.observation` (V4) is single-valued-current, keyed `(dataset_code, time_period, dim_key_hash, time_period_date)`; `upsert.ts` does `ON CONFLICT DO UPDATE` (overwrites obs_value).
- BUT non-destructive: V8 `capture_observation_revision` trigger writes the pre-image; V25 stamps it with `set_by_release_id` + `superseded_by_release_id` → every superseded value survives as a release-keyed closed validity interval `[set.published_at, superseded.published_at)`.
- The as-of reconstruction is BUILT (not just designed): `observations.ts::queryAsOf`/`buildAsOfSql` (live ∪ pre-image, DISTINCT ON covering interval), `releases.ts GET /:id/observations`, `?asOf=` param. ADR-0025 header says "design only" but V25 + the route are actually implemented.
- Law 1 honored at the engine: `matchedValues` iterates `ctx.dims` generically; `TIME_DIM`/`MEASURE_DIM` are named SSOT conventions, not branches; no `ctx.year` privileged-time found. `extractDeps` (NodeDeps.dims = ReadonlySet<string>) would carry a vintage dim with zero new code.

**The canonical model:** vintage is a BITEMPORAL PORT coordinate — exposed as a generic peer `ctx.dims['vintage']`, physically realized by the as-of overlay (the ALFRED pattern). It is NOT a `dim_key` dimension (ADR-0025 rightly rejected SCD-2-in-hot-table). Recommend a reserved-dim convention `VINTAGE_DIM='vintage'` (3rd named convention after time/measure) that ApiStore translates to `?asOf=` + a `StoreCaps.asOf` flag. Rejected: a `StoreQuery.asOf` field (doesn't flow through generic dim machinery / Constructor filter+perspective for free).

**Rot-to-fix-FIRST (2 DB-integrity gates, both additive/reversible):**
- **R1** — a non-publish writer can revise obs_value with no release context → pre-image `superseded_by_release_id = NULL` (open-ended hole the overlay can't place). `publish.ts` sets `app.release_id` correctly, but the ADR-0025 fitness function ("post-genesis revision has non-null superseded_by") is DESIGNED, NOT IMPLEMENTED (no test found). Make it executable (+ optional guard trigger).
- **R2** — pre-image stores only `dim_key_hash`; `buildAsOfSql` recovers `dim_key` via LEFT JOIN to the live row → a DISCONTINUED series (live row gone) vanishes from as-of reads. Fix: store full `dim_key` on `observation_revision`.

**Gaps (additive reach, not rot):** G1 store port has no vintage/asOf coordinate (ApiStore never sends `?asOf=`); G2 no governed `vintage` dim / `revision` metric; G3 `fromSDMX`/conform doesn't capture SDMX release/real-time versioning.

**Build sequence:** M0 integrity gates → M1 port coordinate `⛔` → M2 semantic (vintage dim + revision metric) → M3 verify extractDeps (no code) → M4 Constructor revision-triangle view (perspective axis / filter bar, existing machinery).

**Deliverables:** `docs/architecture/proposals/SPEC-vintage-revision-dimension.md` + `docs/architecture/decisions/ADR-036-vintage-as-port-coordinate.md`. Extends [[project_data_semantic_study]] (ADR-034 semantic plane) and ADR-0025 (DB layer).
