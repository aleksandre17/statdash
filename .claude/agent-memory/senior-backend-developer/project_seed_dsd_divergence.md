---
name: seed-dsd-divergence
description: R__seed_geostat_gold.sql at HEAD declares GDP_ANNUAL DSD without `approach` and fails the V22 dim_key trigger against the live cube — a latent Flyway-repeatable failure
metadata:
  type: project
---

`ops/postgres/seed/R__seed_geostat_gold.sql` (the Flyway REPEATABLE seed) is divergent from the live/canonical DSD for GDP_ANNUAL and FAILS when re-run.

**The divergence (observed 2026-06-26 on prod statdash-postgres):**
- Live GDP_ANNUAL DSD (`stats.dataset_dimension`) = `{measure, approach (non-time), time (time-dim), geo}` — dim_key = `{measure, approach, geo}`. Live observations correctly carry `{approach, geo, measure}`.
- The R__ seed hardcodes GDP_ANNUAL's `dataset_dimension` block as only `{measure, geo, time}` (NO `approach`) and inserts facts keyed `{geo, measure}`. The V22 gold trigger `stats.validate_observation_dim_key()` raises `dim_key keys {geo,measure} do not match DSD {measure,geo,approach}` → seed aborts.

**Why it surfaces now / blast radius:** Flyway re-runs a REPEATABLE migration whenever its checksum changes. Refreshing the build context to a new HEAD changed the seed's checksum, so `flyway migrate` re-ran it and failed. Flyway rolls the seed back in its own txn — NO poison history row is left, live gold is untouched (obs stayed 2257). BUT: the prod compose api `depends_on: flyway: service_completed_successfully`, so a full `compose up` (which runs the flyway service) will fail this seed and can block api start. A `--no-deps --force-recreate` of api/geostat does NOT invoke flyway, so targeted recreates are safe.

**RESOLVED 2026-06-26 (fresh-provision reproducibility fix):** the canonical fix landed as (c)+(b)+ingest, NOT by editing R__ (it is GENERATED — "do not edit by hand"):
- **V34__gdp_dsd_approach_align.sql** (forward migration) widens GDP_ANNUAL's DSD to the canonical 4-dim `[measure, approach, time, geo]` on every fresh DB — the migration form of the live `?datasetVersion=` mint. Has a fail-fast guard (refuses to widen if 3-dim GDP facts already exist) + a post-condition assert. V5/V7 stay immutable.
- **R__ NEUTRALIZED** from BOTH flyway lanes: prod `ops/compose/docker-compose.prod.yml` and infra `ops/compose/infra/services/flyway.yml` now mount ONLY `/flyway/sql` (`-locations=filesystem:/flyway/sql`), dropping the `/flyway/seed` mount + location. R__ is stale 3-dim and would now fail V22 against the 4-dim DSD; the demo-data SSOT is the canonical workbooks.
- **Bring-up ingest**: prod compose gains a one-shot `ingest` service (alpine + curl/jq) running `ops/scripts/ingest-canonical.sh` (promoted from `work/ingest-canonical-e2e.sh`), POSTing `DATA/canonical/*.xlsx` through the real pipeline; geostat/panel gate on `ingest: service_completed_successfully`. Idempotent (409 → skip).

**STILL STALE (coordination flag, out of my scope — packages/api seed owner):** the bundle-based `pnpm --filter @statdash/api seed` + `ops/seed-data/geostat/*.bundle.json` are ALSO 3-dim GDP (GDP bundle dimKey `{geo,measure}`, 367 obs). `validate-local.sh` stage 4 runs this and will FAIL against the V34 4-dim DSD until the bundles are regenerated 4-dim (via `export:seed-data`) or that stage is replaced by the canonical ingest. Related: [[scd2-classifier-writers]], [[canonical-e2e-pipeline]], [[v7-dsd-vs-canonical-shape]].
