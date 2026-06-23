-- ════════════════════════════════════════════════════════════════════════
-- V17__trigger_versioning.sql — trigger-driven stats.dataset_version bump
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V16 are applied + immutable.
--
--   THE GAP — the per-dataset version counter (stats.dataset_version, V6) is the
--   SSOT for "is my cached cube stale?": the observations route turns it into an
--   HTTP ETag (apps/api/src/routes/stats/observations.ts), so a client gets a
--   cheap 304 until the dataset actually changes. Today that counter is bumped
--   ONLY by the application publish path — seed.ts and ingest/publish.ts call
--   stats.bump_dataset_version(code) after a (re)load. Any write to
--   stats.observation that BYPASSES that path (a manual SQL correction, a future
--   ETL that forgets the call, a psql hotfix) leaves dataset_version STALE: the
--   data changed but the ETag did not, so caches serve a figure that no longer
--   exists. The invalidation guarantee is only as strong as the discipline of
--   every writer — which is not a guarantee at all. (Named explicitly as a known
--   gap by the chief-engineer review: "dataset_version bump is app-driven".)
--
--   THE FIX — move the bump responsibility INTO the database, where it cannot be
--   bypassed. A trigger on stats.observation fires on ANY INSERT/UPDATE — every
--   path, app or not — and bumps the version for each dataset touched. The
--   database becomes the SSOT for invalidation, not the app's call-sites
--   (Information Expert: the table that changed is the authority on "I changed").
--
--   REUSE, DO NOT REINVENT — the bump logic ALREADY exists as the idempotent
--   upsert stats.bump_dataset_version(p_dataset_code, p_content_hash) (V6):
--       INSERT … VALUES (code,1,…) ON CONFLICT (dataset_code)
--       DO UPDATE SET version = version + 1, updated_at = now()
--   The trigger CALLS that function — one definition of "bump", reused (DRY,
--   SSOT for the bump semantics). The version column lives in stats.dataset_VERSION
--   (V6), NOT on stats.dataset; there is no stats.dataset.dataset_version column.
--   This migration is careful to drive the bump through the function, never a
--   hand-rolled UPDATE against a column that does not exist.
--
--   DOUBLE-BUMP IS HARMLESS — the application's explicit bump_dataset_version
--   call is KEPT (backward compatible). If both the app and this trigger fire in
--   one transaction, the counter simply advances by two. The counter is a
--   MONOTONIC cache validator, not a count of changes — its only contract is
--   "strictly increases when the cube changes". Over-bumping costs at most one
--   extra client revalidation (a 200 instead of a 304), never a correctness bug
--   (the opposite — under-bumping — is the real hazard, and the trigger closes
--   exactly that). So the trigger and the app call coexist safely; the app call
--   can be retired later with no behavioural change.
--
--   DRY-RUN AWARE — an ETL "dry run" (validate without committing the version
--   semantics) sets SET LOCAL app.dry_run = 'true'; the trigger reads that GUC
--   with missing_ok=true (NULL when unset → not 'true' → trigger active by
--   default) and SKIPS the bump when it is 'true'. Same GUC idiom as
--   app.revised_by (V8) / app.dataset_code. The seam is inert until a caller
--   opts in, so it changes nothing for existing writers.
--
--   STATEMENT-LEVEL + TRANSITION TABLE — the trigger is AFTER INSERT OR UPDATE
--   FOR EACH STATEMENT with REFERENCING NEW TABLE AS new_obs. WHY statement-level
--   and not row-level:
--     · The cube is loaded in BULK (the seed/ETL inserts a whole dataset's
--       observations in one statement). A row-level trigger would call
--       bump_dataset_version once PER ROW — thousands of redundant upserts and
--       thousands of useless version increments per load. The statement-level
--       trigger collects the DISTINCT dataset_codes from the transition table and
--       bumps each ONCE per statement — O(datasets), not O(rows).
--     · TimescaleDB COMPATIBILITY: per-ROW AFTER triggers on a hypertable
--       interact awkwardly with chunk routing; the SUPPORTED, documented pattern
--       on TimescaleDB 2.x (this image: timescale/timescaledb-ha:pg16) is a
--       STATEMENT-level trigger with a transition table on the hypertable ROOT.
--       The transition table is materialized by Postgres at the statement level
--       BEFORE chunk routing matters, so DISTINCT dataset_code over new_obs is
--       well-defined regardless of how many chunks the statement spanned. An
--       INSERT … ON CONFLICT DO UPDATE (the seed's upsert) populates new_obs with
--       the post-write rows, which is exactly what we read (dataset_code only).
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. One new function + one new trigger on
--                   stats.observation. Nothing pre-existing is altered. Rollback
--                   = DROP TRIGGER + DROP FUNCTION; the app's explicit bump call
--                   (untouched) resumes sole responsibility, i.e. exactly the
--                   pre-V17 behaviour.
--   Blast radius  : MODERATE — this adds a side effect to EVERY committed write
--                   to stats.observation (the cube's hot write path). It is
--                   statement-level (one bump per dataset per statement, not per
--                   row) so the cost is O(distinct datasets per statement) — for
--                   the bulk seed/ETL path, a handful of upserts after a load of
--                   thousands of rows. It writes ONLY to stats.dataset_version
--                   (via the existing function); it does not touch the
--                   observation rows themselves, the partition key, the unique
--                   index, or compression. A dry-run write skips it entirely.
--                   Failure mode: if bump_dataset_version raised, the whole
--                   observation statement would roll back — acceptable and
--                   correct (a write whose invalidation cannot be recorded must
--                   not be silently half-applied; fail-fast at the boundary).
--   Hypertable    : DELIBERATELY statement-level with a ROOT transition table —
--                   the TimescaleDB-supported shape (see header). It reads the
--                   transition table only; it adds no column, no partition
--                   change, no compression change to stats.observation.
--                   FALLBACK (documented, not needed for this image): if a future
--                   TimescaleDB build rejects a transition table on the hypertable
--                   root, replace the trigger with a per-statement bump driven by
--                   the SET LOCAL app.dataset_code GUC the publish path already
--                   sets (one bump for current_setting('app.dataset_code')), or
--                   keep the bump purely in the application path (pre-V17 state).
--                   Either fallback is a function-body / trigger-shape swap, not
--                   a schema reshape.
--   Rollback plan : DROP TRIGGER IF EXISTS trg_obs_auto_version ON stats.observation;
--                   DROP FUNCTION IF EXISTS stats.auto_bump_dataset_version();
--
-- Idempotent: CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS + CREATE.
-- Re-run = converge, never error. Additive only; never edits a V1-V16 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.auto_bump_dataset_version() — statement-level transition-table bump
-- ════════════════════════════════════════════════════════════════════════
-- Reads the transition table new_obs (the rows this statement wrote), bumps the
-- version ONCE per distinct dataset_code by delegating to the V6 idempotent
-- upsert stats.bump_dataset_version. Returns NULL (statement-level AFTER trigger
-- return value is ignored). No-op under SET LOCAL app.dry_run = 'true'.
CREATE OR REPLACE FUNCTION stats.auto_bump_dataset_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  dc TEXT;
BEGIN
  -- Dry-run escape hatch. current_setting(…, true) = missing_ok → NULL when the
  -- GUC is unset, so the trigger is ACTIVE by default and only skips when a
  -- caller explicitly opts out with SET LOCAL app.dry_run = 'true' (txn-scoped).
  IF current_setting('app.dry_run', true) = 'true' THEN
    RETURN NULL;
  END IF;

  -- One bump per distinct dataset touched in THIS statement (not per row).
  -- bump_dataset_version is the V6 idempotent upsert (create=1 else +1) — the
  -- single SSOT definition of "bump"; we never hand-roll the increment here.
  FOR dc IN
    SELECT DISTINCT dataset_code FROM new_obs
  LOOP
    PERFORM stats.bump_dataset_version(dc);
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION stats.auto_bump_dataset_version() IS
  'AFTER INSERT OR UPDATE FOR EACH STATEMENT trigger (transition table new_obs): bumps stats.dataset_version once per distinct dataset_code touched, via the V6 idempotent stats.bump_dataset_version upsert. Makes ETag invalidation automatic for ANY write path (not just the app publish call). No-op under SET LOCAL app.dry_run=''true''. Statement-level + root transition table = the TimescaleDB-supported shape and O(datasets) not O(rows).';


-- ════════════════════════════════════════════════════════════════════════
-- 2. trg_obs_auto_version — wire it to stats.observation
-- ════════════════════════════════════════════════════════════════════════
-- DROP IF EXISTS + CREATE = idempotent (re)installation. REFERENCING NEW TABLE
-- gives the function the set of rows written by the statement; FOR EACH STATEMENT
-- fires it once regardless of row/chunk count.
DROP TRIGGER IF EXISTS trg_obs_auto_version ON stats.observation;
CREATE TRIGGER trg_obs_auto_version
  AFTER INSERT OR UPDATE ON stats.observation
  REFERENCING NEW TABLE AS new_obs
  FOR EACH STATEMENT
  EXECUTE FUNCTION stats.auto_bump_dataset_version();

COMMENT ON TRIGGER trg_obs_auto_version ON stats.observation IS
  'Auto-bumps stats.dataset_version (the ETag SSOT) for every dataset touched by any INSERT/UPDATE on stats.observation — closing the gap where a write that bypassed the app publish path left the version (and thus the HTTP ETag) stale. Statement-level + transition table = bump once per dataset per statement, TimescaleDB-safe. Coexists with the app''s explicit bump (double-bump is harmless — the counter is a monotonic validator). Skipped under app.dry_run.';
