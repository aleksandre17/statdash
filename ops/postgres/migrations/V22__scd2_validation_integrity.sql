-- ════════════════════════════════════════════════════════════════════════
-- V22__scd2_validation_integrity.sql — close the SCD-2 validation hole V18 opened
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS CHANGES (and WHY) — re-points ONE existence check inside V4's
-- stats.validate_observation_dim_key trigger function so observations can only
-- be keyed on CURRENT classifier codes.
--
--   THE HOLE. V4's validate_observation_dim_key (V4 lines 221-266) validates
--   each dim_key VALUE with:
--       EXISTS(SELECT 1 FROM stats.classifier
--              WHERE dim_code = dim AND code = val)
--   — NO is_current filter (V4 lines 254-257). Before V18 this was correct:
--   V4's blanket UNIQUE(dim_code, code) guaranteed exactly ONE row per code, so
--   "the code exists" and "the current code exists" were the same statement.
--
--   WHAT V18 BROKE (latently). V18 Part A DROPPED that blanket UNIQUE to unlock
--   SCD-2 history (is_current=false rows are now insertable). The instant ETL
--   writes a codelist revision, the unfiltered EXISTS above could match a
--   RETIRED (is_current=false) row and ADMIT an observation keyed on a
--   no-longer-current member — silent corpus corruption. V18's header
--   (lines 62-78) declared this the MANDATORY follow-up, to be closed BEFORE
--   ETL begins writing SCD-2 revisions. V4 is immutable (never edit an applied
--   migration), so the fix is this CREATE OR REPLACE of the function the
--   EXISTING V4 trigger already calls — re-point the load-bearing guard, do not
--   drop it (Chesterton's Fence).
--
--   THE FIX. The function body below is V4's VERBATIM, with exactly ONE change:
--   the dim_key VALUE existence check (step 3) gains  AND is_current = true.
--   Every other line — name, RETURNS TRIGGER, the DSD set-equality check
--   (steps 1-2), every error message, the LANGUAGE — is byte-for-byte the V4
--   definition. A CREATE OR REPLACE that silently dropped any of that logic
--   would WEAKEN the trigger; the whole function is reproduced to prevent that.
--
--   SCOPE OF THE FILTER. The is_current filter is added ONLY to the classifier
--   VALUE lookup (does this code exist as a live member?). It is NOT added to
--   the DSD checks (steps 1-2), which read stats.dataset_dimension — the dataset
--   schema declaration, which has no is_current axis. Filtering the right
--   lookup is the point: a retired CODE must be rejected; the DSD shape check is
--   unchanged.
--
--   THE TRIGGER ITSELF IS UNTOUCHED. V4's trg_observation_validate_dim_key
--   binding stays; CREATE OR REPLACE FUNCTION swaps the body the existing
--   trigger invokes. No DROP/CREATE TRIGGER here.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. CREATE OR REPLACE FUNCTION only — no table,
--                   column, index, constraint, trigger, or data touched.
--                   ROLLBACK = re-apply V4's ORIGINAL function body (the V4
--                   definition WITHOUT the is_current filter, V4 lines 221-266).
--                   That restores the exact prior behavior; no data migration is
--                   needed to roll back.
--   Blast radius  : MODERATE — tightens WRITE-TIME validation on
--                   stats.observation. An observation keyed on a RETIRED
--                   (is_current=false) classifier code that would previously
--                   PASS will now be REJECTED. That is the intended correctness
--                   fix. NO observation keyed on a CURRENT code is affected, and
--                   no read path, partition column, compression, or hypertable
--                   property is touched. The function runs only inside the
--                   existing BEFORE INSERT/UPDATE OF dim_key trigger.
--   Pre-flight    : Are there EXISTING observations keyed on a non-current code?
--                   SCD-2 was only just unlocked (V18) and ETL has not yet
--                   written revisions, so there are ZERO historical classifier
--                   rows and therefore NO existing obs can be keyed on a retired
--                   code. The read-only DO block below ASSERTS that invariant: it
--                   counts observations whose dim_key references any non-current
--                   classifier member and RAISEs if > 0, so the migration REFUSES
--                   to silently invalidate existing data (same defensive pattern
--                   as V14/V16 pre-flights). It writes nothing.
--   Rollback plan : CREATE OR REPLACE stats.validate_observation_dim_key() with
--                   V4's original body (re-run V4 lines 221-266 verbatim). The
--                   trigger binding is unchanged, so no trigger DDL on rollback.
--
-- Idempotent: CREATE OR REPLACE FUNCTION converges on re-run; the pre-flight
-- DO block is READ-ONLY (a COUNT + conditional RAISE). Re-apply = a no-op.
-- No V1-V21 object is dropped or altered (only the V4 function body is replaced
-- in place, which is the sanctioned way to evolve it — V4 stays immutable).
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- PRE-FLIGHT — refuse to apply if any existing observation is keyed on a
-- non-current classifier code (read-only; aborts before tightening the guard).
-- ════════════════════════════════════════════════════════════════════════
-- Defensive: today this count is 0 (no SCD-2 history written yet). If an
-- out-of-band process has already created such a row, the new filter would make
-- that row un-writable on its next UPDATE and silently mis-represent the corpus;
-- fail fast here instead. The check walks each dim_key value and asks whether a
-- CURRENT member exists for it — if not, but the value DOES exist as a non-
-- current member, the observation is keyed on a retired code.
DO $$
DECLARE
  violations INT := 0;
BEGIN
  SELECT COUNT(*) INTO violations
    FROM stats.observation o
   WHERE EXISTS (
     SELECT 1
       FROM jsonb_each_text(o.dim_key) AS kv(dim, val)
      WHERE EXISTS (
              SELECT 1 FROM stats.classifier c
               WHERE c.dim_code = kv.dim AND c.code = kv.val
            )
        AND NOT EXISTS (
              SELECT 1 FROM stats.classifier c
               WHERE c.dim_code = kv.dim AND c.code = kv.val
                 AND c.is_current = true
            )
   );
  IF violations > 0 THEN
    RAISE EXCEPTION 'V22 pre-flight: % stats.observation row(s) are keyed on a non-current (retired) classifier code. Re-key or retire these observations before applying — V22 would otherwise reject them on next write.', violations;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- Re-point the dim_key VALUE existence check to CURRENT classifier rows.
-- Body is V4 lines 221-266 VERBATIM; the ONLY change is "AND c.is_current = true"
-- on the step-3 classifier lookup (originally V4 lines 254-257).
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stats.validate_observation_dim_key()
RETURNS TRIGGER AS $$
DECLARE
  expected_dims TEXT[];
  actual_dims   TEXT[];
  dim           TEXT;
  val           TEXT;
  classifier_ok BOOLEAN;
BEGIN
  -- 1. Fetch non-time dimensions declared for this dataset.
  SELECT array_agg(dim_code ORDER BY ord)
    INTO expected_dims
    FROM stats.dataset_dimension
   WHERE dataset_code = NEW.dataset_code
     AND is_time_dim  = false;

  IF expected_dims IS NULL THEN
    RAISE EXCEPTION 'dataset % has no DSD declared', NEW.dataset_code;
  END IF;

  -- 2. Keys in dim_key must match expected dims exactly (set equality).
  SELECT array_agg(k ORDER BY k)
    INTO actual_dims
    FROM jsonb_object_keys(NEW.dim_key) k;

  IF actual_dims IS DISTINCT FROM (SELECT array_agg(d ORDER BY d) FROM unnest(expected_dims) d) THEN
    RAISE EXCEPTION 'dim_key keys % do not match DSD % for dataset %',
      actual_dims, expected_dims, NEW.dataset_code;
  END IF;

  -- 3. Each value must exist in the classifier for that dimension.
  --    V22: only a CURRENT (is_current = true) member may key an observation —
  --    after V18 unlocked SCD-2, an unfiltered match could admit a RETIRED code.
  FOR dim IN SELECT jsonb_object_keys(NEW.dim_key) LOOP
    val := NEW.dim_key ->> dim;
    SELECT EXISTS(
      SELECT 1 FROM stats.classifier c
       WHERE c.dim_code = dim AND c.code = val AND c.is_current = true
    ) INTO classifier_ok;
    IF NOT classifier_ok THEN
      RAISE EXCEPTION 'dim_key value %.%=% not found as a current classifier member (code may be retired or nonexistent)',
        NEW.dataset_code, dim, val;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.validate_observation_dim_key() IS
  'BEFORE INSERT/UPDATE OF dim_key: validates dim_key keys against the DSD and each value against stats.classifier WHERE is_current = true (V22). Rejects structurally invalid observations AND observations keyed on retired SCD-2 codes (corpus integrity). Invoked by the V4 trg_observation_validate_dim_key trigger (binding unchanged).';
