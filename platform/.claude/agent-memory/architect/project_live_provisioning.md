---
name: project-live-provisioning
description: How the live statdash demo DB gets its data (Flyway V1-V32 + R__ repeatable gold seed) and the 3-dim-vs-canonical-4-dim GDP conflict for dogfood ingestion
metadata:
  type: project
---

The live demo `statdash-postgres` (TimescaleDB-HA pg16, container in `ops/compose/docker-compose.prod.yml`, stack name `statdash-prod`, internal-only) is provisioned ENTIRELY by Flyway (`flyway/flyway:10-alpine`, container `statdash-flyway`), mounting two locations:
- `ops/postgres/migrations` → V1..V32 (immutable schema, 33 files incl. V1).
- `ops/postgres/seed` → `R__seed_geostat_gold.sql` (Flyway REPEATABLE, re-applied on checksum change).

**The placeholder SEED obs come from R__seed_geostat_gold.sql**, NOT from V5 (V5 seeds only dims/classifiers/datasets, no obs, no config pages). R__ lands GOLD directly (bypasses bronze→silver), idempotent INSERT…ON CONFLICT. So a FRESH DB ALWAYS re-seeds the 3-dim placeholders unless R__ is removed from the seed location. This is the crux of any dogfood-ingest cutover.

The geostat front PAGE CONFIGS come from `platform/apps/api/provisioning/geostat.provisioning.json` (4164 lines) loaded via `apps/api/src/provisioning/loader.ts` (config.* tables), separate from R__ gold seed.

**Why:** dogfooding the canonical Excel ingest (`POST /api/ingest/canonical`) to replace placeholder data with the user's 3 real workbooks at `DATA/canonical/*.xlsx`.

**How to apply:** Any "load real data" plan must (a) suppress/neutralize R__ so it stops re-seeding 3-dim placeholders, and (b) handle GDP_ANNUAL's DSD conflict — live gold is `[measure,geo,time]`, canonical STRUCTURE is `[time,approach,measure,geo]` (+approach). ACCOUNTS/REGIONAL match dim SET (compat.ts compares set not order) → routine. GDP needs either a FRESH 4-dim ingest (clean) or the `?datasetVersion=` versioned-mint widen path (mintDatasetVersion). See [[project_classifier_code_path_adr]], [[adr_ingestion_build_ready]].
