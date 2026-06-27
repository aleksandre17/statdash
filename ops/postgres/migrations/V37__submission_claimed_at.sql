-- ════════════════════════════════════════════════════════════════════════
-- V37__submission_claimed_at.sql — ingest crash-recovery: claim visibility (API-02)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — closes the stranded-submission crash-recovery gap.
--
-- The drain worker claims a submission by moving it received → parsing
-- (apps/api/src/ingest/worker.ts claimNext). The row lock is released at COMMIT;
-- the `parsing` status is the durable claim. BUT if the worker PROCESS DIES mid-
-- parse, the row is left in `parsing` forever: it is neither `received` (so the
-- boot drain, which selects status='received', never re-claims it) nor terminal
-- (staged/rejected/failed). The submission is STRANDED — a real crash-recovery
-- hole (Competing-Consumers without a visibility timeout).
--
-- The fix is a VISIBILITY TIMEOUT: stamp claimed_at = now() at claim time, then a
-- boot-time reclaim sweep re-queues any `parsing` row whose claim is older than a
-- threshold (UPDATE … SET status='received', claimed_at=NULL WHERE status='parsing'
-- AND claimed_at < now() - interval). This migration adds ONLY the column + a
-- partial index to find stranded rows cheaply; the sweep lives in application code
-- (apps/api/src/ingest/reclaim.ts) and runs at boot before the drain.
--
--     1. claimed_at TIMESTAMPTZ (NULLABLE) on stats_stage.submission — the claim
--        timestamp. NULL for every row not currently claimed (received / terminal);
--        set to now() when the worker moves a row to `parsing`; cleared back to
--        NULL when reclaimed or when the row reaches a terminal status. Nullable +
--        defaultless so the ADD is instant (no table rewrite) and every existing
--        row is correctly NULL (none is mid-parse during the migration).
--
--     2. idx_submission_stranded — partial index on (claimed_at) WHERE
--        status='parsing'. The reclaim sweep scans ONLY in-flight claims; the
--        partial predicate keeps the index to the handful of `parsing` rows, not
--        the whole submission history.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. Additive — ONE nullable column + ONE partial index.
--                   No data transform (the column starts NULL everywhere). DROP
--                   COLUMN removes it cleanly; the worker tolerates its absence is
--                   N/A here (the co-shipped app sets it), but a rollback to the
--                   prior app + this column is harmless (an unread NULL column).
--   Blast radius  : NONE on existing behaviour. The column is additive; existing
--                   INSERTs (which do not name it) write NULL; existing SELECTs are
--                   unaffected. No constraint, no trigger, no FK. The V4 gold
--                   dim_key invariants are untouched — this is a stats_stage (silver)
--                   job-header column, never read by the gold cube or its triggers.
--   Rollback plan : DROP INDEX IF EXISTS stats_stage.idx_submission_stranded;
--                   ALTER TABLE stats_stage.submission DROP COLUMN IF EXISTS claimed_at;
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE INDEX IF NOT EXISTS. Re-run =
-- converge, never error. Additive only; never edits a V1-V36 object.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE stats_stage.submission
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

COMMENT ON COLUMN stats_stage.submission.claimed_at IS
  'Visibility-timeout claim stamp (API-02). Set to now() when the worker claims a row (received→parsing); NULL otherwise. The boot reclaim sweep re-queues parsing rows whose claimed_at is older than a threshold — recovering a submission stranded by a worker crash mid-parse.';

-- Partial index — the reclaim sweep finds stranded claims without scanning history.
CREATE INDEX IF NOT EXISTS idx_submission_stranded
  ON stats_stage.submission (claimed_at)
  WHERE status = 'parsing';
