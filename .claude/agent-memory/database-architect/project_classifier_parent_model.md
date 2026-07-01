---
name: project-classifier-parent-model
description: classifier.parent_code is a SAME-dim edge only; measures are FLAT (approach = metadata attribute, not a parent). geo/sector have genuine same-dim hierarchies.
metadata:
  type: project
---
`stats.classifier.parent_code` (ADR-0023, V23) is a SAME dim_code business-key hierarchy edge — NOT a foreign key (post-V18 SCD-2 makes (dim_code,code) non-unique). The V23 `trg_classifier_code_path` trigger RAISES if a non-NULL parent_code has no CURRENT same-dim member; ingest `publishClassifiers` (publish.ts) does the same topological resolve and fails identically. So a cross-dim parent_code is unrepresentable.

**MODEL DECISION (data-confirmed, 2026-06-23):** a measure's APPROACH (production/expenditure/income/growth/per_capita/total/noe/investment) is an SDMX **attribute/concept carried in `metadata.approach`**, NOT a same-dim parent. **Measures are FLAT** (no same-dim hierarchy). The geostat bundle originally mis-mapped 22 measure classifiers with `parentCode == metadata.approach` (redundant; the approach codes live in the `approach`/`account` dims, never `measure`) — this broke the live R__ seed at the V23 trigger. Fix = strip those 22 parentCodes (metadata.approach untouched).
**Why:** SDMX identifies grouping concepts as attributes; a cross-dim parent violates the same-dim edge contract and the trigger precondition.

**GENUINE same-dim hierarchies that ARE kept:** `geo` (11 regions → `total`) and `sector` (9 → `_T`). Those parents ARE same-dim members and are emitted parent-before-child (topological) in the R__ seed, which the trigger requires. `account` has no parent_codes in the geostat corpus.

**SSOT + artifacts:** `ops/seed-data/geostat/codelists.bundle.json` is the SSOT (the TS bundles were deleted, ADR-0028). The R__ stage-1 net `ops/postgres/seed/R__seed_geostat_gold.sql` mirrors it (no live generator script remains — the header's `export:seed-data` / `seed-pipeline-payloads.ts` no longer exist; treat R__ as a hand-maintained generated artifact, edit in lockstep with the bundle).

**Fitness guard:** `platform/apps/api/scripts/seed-data.fitness.test.ts` Tier-1 (DB-independent) now asserts: every parentCode resolves to a same-dim member (no cross-dim), no self-parent, measures flat + approach in metadata. Re-introducing a cross-dim parent fails offline before the seed runs.

**How to apply:** new classifier data — parent_code is ALWAYS a same-dim code or absent. Grouping that spans dims = an attribute in `metadata`, never a parent. See `[[project-db-state]]`, `[[project-decision-c-unit-measure]]` (unit_measure is also a measure metadata attribute).
