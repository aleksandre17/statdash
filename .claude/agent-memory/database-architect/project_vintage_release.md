---
name: project-vintage-release
description: ADR-0025 Vintage-as-Release (SDMX-P0-2) landed as V25__release_vintage.sql — stats.release publication-event aggregate, release_id stamps on observation + observation_revision via app.release_id GUC, as-of vintage reconstruction
metadata:
  type: project
---

ADR-0025 (Vintage-as-Release, SDMX-P0-2) is implemented as `ops/postgres/migrations/V25__release_vintage.sql`. The ADR design doc lives at `platform/.claude/agent-memory/architect/project_vintage_release_adr.md` (authored by the architect). V25 is the migration head after V24.

**Why:** V8's revision pre-images were keyed only by server timestamp `revised_at` and not grouped into a coherent published vintage, so P0-2 could not reconstruct "GDP as published on date D" or build revision triangles. A release is the SDMX/ECB publication-event aggregate that groups 1..N submissions under one atomic `published_at`.

**What V25 created (extends stats.* additively — see [[project-schema-ssot]]):**
- `stats.release` — publication-event aggregate (UUID id, label JSONB, nullable dataset_code FK = cross-dataset when NULL, status open|published|superseded FSM, is_current, published_at = the as-of anchor). Partial unique index `uq_release_current ON (COALESCE(dataset_code,'')) WHERE is_current` (the COALESCE collapses the NULL cross-dataset bucket so at most one current per scope, incl. cross-dataset).
- `stats.observation.release_id UUID` (plain nullable, hypertable-safe — NOT in partition key / unique index / segmentby / orderby).
- `stats.observation_revision.set_by_release_id` + `superseded_by_release_id` — close the pre-image validity interval `[set release.published_at, superseded release.published_at)`.
- `stats_stage.submission.release_id UUID` FK → release (ON DELETE SET NULL).
- Triggers: `trg_observation_aa_release_stamp` (BEFORE INSERT/UPDATE, stamps release_id from `app.release_id` GUC; named *_aa_* to sort first alphabetically). The V8 `capture_observation_revision()` was CREATE OR REPLACE'd — V8 body verbatim + only the two release columns added to its INSERT.
- Helpers: `stats.open_release(dataset_code, label) → uuid`, `stats.publish_release(release_id) → published_at` (demotes prior current of same scope to superseded, stamps published+current, REUSES V6 `bump_dataset_version` — release and dataset_version stay separate jobs, SSOT each).
- Genesis backfill: one synthetic 'published' release per dataset (published_at = min(observation.updated_at) else now()), stamps existing observation.release_id + revision.set_by_release_id; superseded_by stays NULL (pre-V25 supersession is flagged, not invented).

**How to apply:**
- The stamping idiom is the existing GUC pattern: `SET LOCAL app.release_id = '<uuid>'` in the publish txn (mirrors `app.revised_by` V8 / `app.dry_run` V17). When the GUC is unset everything is pre-V25 behaviour — writers that do not opt in are unaffected.
- Genesis-backfill trigger-safety is load-bearing and VERIFIED against the real V8 trigger: the V8 capture trigger is column-scoped `BEFORE UPDATE OF obs_value, obs_status, obs_attribute`, so a `release_id`-only UPDATE does NOT fire capture. The V17 auto-bump (AFTER FOR EACH STATEMENT, NOT column-scoped) WOULD fire, so the backfill sets `app.dry_run='true'` to suppress ETag churn.
- App-side integration (publish.ts: SET LOCAL app.release_id before publishFacts, then call publish_release; an asOf read endpoint on observations.ts) is the NEXT step — not in V25, which is schema only.
