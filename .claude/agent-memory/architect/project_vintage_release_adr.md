---
name: vintage-release-adr
description: ADR-0025 SDMX-P0-2 vintage-as-release / real-time database — release as a publication-event aggregate stamped on observation + observation_revision; as-of reconstruction via pre-image overlay
metadata:
  type: project
---

# ADR-0025 — Vintage-as-Release (real-time / vintage database) for SDMX-P0-2

Decision recorded 2026-06-22. Status: ACCEPTED, design only (migrations/code are the next step, NOT yet written).

## The gap it closes
V8 captures revision PRE-IMAGES into `stats.observation_revision` keyed only by server timestamp `revised_at`. Revisions are per-observation and NOT grouped into a release, so a coherent published vintage cannot be reconstructed. P0-2 needs: (1) "GDP series AS IT WAS PUBLISHED on date D" (vintage reconstruction), (2) revision triangles (how an estimate for period P evolved across releases).

## The decision (the load-bearing choices)
- **Release = a publication-event AGGREGATE** (SDMX/ECB sense), NOT 1:1 with publishSubmission. A named release ("2024-Q3 GDP release") bundles 1..N submissions (revised facts + codelists + displays). New table `stats.release` (UUID id, label JSONB, status open|published|superseded, published_at, dataset_code nullable for cross-dataset releases, is_current via partial unique index per dataset).
- **Lifecycle: explicit open → attach submissions → publish.** A submission carries `release_id` (nullable FK). publishSubmission resolves/auto-opens a release when none is attached (so the single-submission path Just Works), but the API also exposes open/close so a curator can bundle. Publishing the release flips prior current release to `superseded` and stamps `published_at`.
- **Stamping via GUC, read by triggers** — mirrors the existing `app.revised_by` (V8) / `app.dry_run` (V17) idiom. `SET LOCAL app.release_id = '<uuid>'` in the publish txn. (a) A BEFORE INSERT/UPDATE trigger on `stats.observation` stamps `release_id` = the GUC (the release that set the CURRENT value). (b) The V8 capture trigger is extended to ALSO stamp `superseded_by_release_id` = the GUC on the pre-image row (the release that superseded the old value) AND to copy the OLD `release_id` into the pre-image as `set_by_release_id` (the release that had originally set the now-superseded value). This makes each pre-image a closed validity interval keyed by RELEASE, not just timestamp.
- **Validity interval lives on the pre-image, derived from release publish times.** observation.release_id → join release.published_at gives the as-of anchor. A pre-image's validity = [set-by release published_at, superseding release published_at). The as-of query (see spec) for each series picks: the current obs value if its release.published_at <= D AND no superseding release with published_at <= D... else the pre-image whose [set, supersede) interval covers D.
- **dataset_version reconciliation:** a published release for a dataset bumps dataset_version (reuse `stats.bump_dataset_version`, do NOT duplicate the counter). release is the WHO/WHEN of a publication; dataset_version stays the cheap monotonic ETag validator. release_id is the durable vintage key; dataset_version is the cache token. They are NOT merged — different jobs (SSOT each).

## Migration plan (V25, additive, two-way reversible where possible)
- V25: `stats.release` table + `stats.open_release()` / `stats.publish_release()` helpers + ALTER `stats.observation` ADD `release_id UUID` (nullable, metadata-only default-null add on PG11+, hypertable-safe) + ALTER `stats.observation_revision` ADD `set_by_release_id UUID`, `superseded_by_release_id UUID` + GUC-reading triggers (extend V8 capture fn; add a BEFORE trigger for observation.release_id stamping) + a synthetic "genesis" release backfill for existing rows.
- Backfill: one genesis release per dataset (published_at = min(updated_at) or now()), stamp all existing observation.release_id to it; existing observation_revision rows get genesis as set_by and (best-effort) NULL superseded (their supersession predates release tracking — flagged, not invented).

## Fitness function (the invariant)
Every published observation has a non-null release_id; every observation_revision has a non-null superseded_by_release_id (going forward, post-genesis). Encoded as a SQL assertion test in the migration test suite: `SELECT count(*) FROM stats.observation WHERE release_id IS NULL` = 0 after publish; same for revision rows created after V25.

## Rejected alternatives
1. **Full bitemporal SCD-2 on observation (valid_from/valid_to on the hot hypertable).** Rejected: doubles+ the hottest table, fights TimescaleDB compression/unique-index-must-include-partition-col, and the pre-image log (V8) already IS the history store — reuse it, don't duplicate (SSOT). The prompt's mention of observation.valid_from does not exist in V4; we deliberately keep the cube single-valued-current + pre-image log.
2. **Release = 1:1 with submission.** Rejected: a real publication event spans facts+codelists+displays (multiple submissions); ECB/IMF releases are named events, not file uploads. 1:1 cannot model "2024-Q3 release bundled these 3 files."
3. **Reconstruct vintage purely from revised_at timestamps (no release).** Rejected: server timestamps do not group a coherent published set; two figures published in one event get micro-different timestamps and a mid-event D could split a release. Release gives a single atomic published_at per vintage.

## Files grounded in (read before any implementation)
- ops/postgres/migrations/V4 (observation hypertable), V8 (observation_revision + capture trigger + app.revised_by GUC), V6 (dataset_version + bump), V11 (submission FSM), V17 (auto-bump trigger pattern + app.dry_run GUC), V18/V19.
- platform/apps/api/src/ingest/publish.ts (SET LOCAL app.revised_by, publishFacts set-based INSERT), upsert.ts, worker.ts, types.ts.
- platform/apps/api/src/routes/stats/observations.ts (ETag pattern, parse_time_period range bounds — the asOf endpoint extends this).
