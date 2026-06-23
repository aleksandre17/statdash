-- ════════════════════════════════════════════════════════════════════════
-- V24__classifier_code_path_contract.sql — CONTRACT step of ADR-0023
--   Retire the surrogate-id hierarchy: re-point the cycle guard to the code
--   chain, then DROP the id-chain path artifacts and parent_id. ONE-WAY.
-- ════════════════════════════════════════════════════════════════════════
-- ⚠⚠ OPERATIONAL PRECONDITION — DO NOT APPLY IN PRODUCTION UNTIL V23 PARITY
--     IS VERIFIED LIVE. ⚠⚠
--   V24 is the IRREVERSIBLE half of the ADR-0023 expand-contract. It removes the
--   old representation (parent_id + the id-chain `path` + their trigger/function/
--   index). It MUST only run AFTER:
--     (a) V23 is applied and the code-chain path (parent_code + code_path +
--         trg_classifier_code_path) has been live for a parity period;
--     (b) all writers (upsert.ts, publish.ts, seed-helpers.ts) and readers
--         (classifiers.ts routes + /display) have been switched to parent_code /
--         code_path — i.e. NOTHING still reads or writes parent_id / path;
--     (c) the V23 parity assertion has held in production (code_path depth ==
--         id path depth for every current row).
--   There is no live DB in this repo, so this FILE is written now (it is the
--   contract artifact and senior-backend codes against the post-V24 shape), but
--   the precondition above is the deploy gate. Applying V24 before (a)-(c) would
--   break any code still on parent_id/path with no rollback.
--
-- WHAT THIS DOES (and WHY) — completes ADR-0023. After V23 ran both paths in
-- parallel, V24 removes the surrogate-id hierarchy edge and its materialized path,
-- leaving the stable (dim_code, code) code-chain as the SOLE hierarchy
-- representation. ORDER IS LOAD-BEARING:
--
--   STEP 1 — RE-POINT THE CYCLE GUARD FIRST (parent_id chain → parent_code chain).
--     V18's stats.prevent_classifier_cycle walks the ancestor chain via parent_id
--     to reject cycles. parent_id is dropped in Step 3, and the trigger DEPENDS on
--     that column (BEFORE INSERT/UPDATE OF parent_id), so the column drop would
--     FAIL — and, more importantly, acyclicity protection must not lapse for even
--     one statement. We CREATE OR REPLACE prevent_classifier_cycle to walk the
--     CURRENT-row parent_code chain instead, and re-bind its trigger to fire on
--     parent_code. Chesterton's Fence: the guard is load-bearing — re-point it,
--     never just drop it.
--
--   STEP 2 — DROP V4's id-chain path trigger + function. trg_classifier_path and
--     stats.refresh_classifier_path() materialize `path` from the id chain; once
--     `path` is gone they have no purpose. Dropped before the column they write.
--
--   STEP 3 — DROP the id-chain artifacts: idx_classifier_path (GIST on path),
--     idx_classifier_parent_id, the `path` column, and the `parent_id` column.
--     parent_id's V4 self-FK (ON DELETE SET NULL) drops with the column.
--
--   WHAT SURVIVES. The surrogate `id` REMAINS — it is the row PK and
--   stats.classifier_display.member_id (V6). ADR-0023 moves only the hierarchy
--   EDGE and the PATH to codes; identity/display keying on id is unchanged.
--
--   ZERO FACT-TABLE BLAST RADIUS. stats.observation keys on (dim_code, code) via
--   dim_key + the V4/V22 validate trigger — it never referenced parent_id or path.
--   Dropping them changes no observation, no read path, no hypertable property,
--   and does NOT touch V22's validation (already keyed on code, is_current). No
--   third validation migration is needed or written (V22 is complete).
--
-- ── 09 §B RISK GATE (Class-M migration — CONTRACT half, ONE-WAY / IRREVERSIBLE) ─
--   Reversibility : ONE-WAY DOOR. Dropping `parent_id` DESTROYS the surrogate-id
--                   hierarchy edge and the id-chain `path`. They CANNOT be rebuilt
--                   from the remaining data without re-deriving from parent_code —
--                   and the whole point is that parent_code is now authoritative,
--                   so there is no reason and no clean path back. Treat as
--                   irreversible. This is the door that gets maximum scrutiny;
--                   hence the V23 parity period + the live precondition above.
--   Blast radius  : MODERATE but SCOPED to internal hierarchy plumbing.
--                   - Anything still reading stats.classifier.parent_id or .path
--                     BREAKS. By precondition (b) nothing does. Senior-backend has
--                     migrated upsert.ts/publish.ts/classifiers.ts/seed-helpers.ts
--                     to parent_code/code_path before this applies.
--                   - stats.observation, all read APIs that go through dim_key,
--                     compression, the hypertable, and V22 validation: UNAFFECTED.
--                   - classifier_display.member_id (→ id) UNAFFECTED (id survives).
--                   - Acyclicity protection: PRESERVED — re-pointed in Step 1
--                     before parent_id is removed, never lapses.
--   Pre-flight    : The deploy gate (a)-(c) above is the human pre-flight. The
--                   re-point in Step 1 is verified by Step 1's own COMMENT/trigger
--                   rebind; Step 3's drops are guarded IF EXISTS so a partial prior
--                   run converges.
--   Rollback plan : NONE that restores the id chain (one-way). The only forward-
--                   recovery is to RE-RUN V23's logic to re-add parent_id/path and
--                   re-derive them from parent_code — a new migration, not a
--                   rollback. Do NOT apply V24 expecting to undo it.
--   Hypertable impact : NONE. stats.classifier is a PLAIN table.
--
-- Idempotent: CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS + CREATE · DROP
-- INDEX IF EXISTS · DROP COLUMN IF EXISTS. Re-run after success = a no-op (the
-- columns/objects are already gone; the re-pointed cycle guard re-converges).
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- STEP 1 — re-point the acyclicity guard from the parent_id chain to the
--          parent_code chain (MUST precede the parent_id drop)
-- ════════════════════════════════════════════════════════════════════════
-- Walks the CURRENT-row ancestor chain via parent_code (was parent_id, V18). A
-- cycle is reached when the walk returns to NEW's own (dim_code, code). The walk
-- is scoped to is_current = true — the live hierarchy — exactly as V18 scoped the
-- id walk; a non-current ancestor terminates the walk (it cannot mask a cycle in
-- the live tree, which requires a closed loop of live edges). Bounded hop count
-- guards against a malformed pre-existing chain (fail fast, never hang).
CREATE OR REPLACE FUNCTION stats.prevent_classifier_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ancestor_code TEXT;
  hops          INT := 0;
BEGIN
  IF NEW.parent_code IS NULL THEN
    RETURN NEW;
  END IF;

  -- A self-edge is the shortest cycle.
  IF NEW.parent_code = NEW.code THEN
    RAISE EXCEPTION 'classifier_cycle: (dim_code=%, code=%) cannot be its own parent',
      NEW.dim_code, NEW.code;
  END IF;

  ancestor_code := NEW.parent_code;
  WHILE ancestor_code IS NOT NULL AND hops < 10000 LOOP
    IF ancestor_code = NEW.code THEN
      RAISE EXCEPTION 'classifier_cycle: inserting (dim_code=%, code=%) with parent_code=% would create a cycle',
        NEW.dim_code, NEW.code, NEW.parent_code;
    END IF;
    SELECT parent_code INTO ancestor_code
      FROM stats.classifier
     WHERE dim_code   = NEW.dim_code
       AND code       = ancestor_code
       AND is_current = true;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION stats.prevent_classifier_cycle() IS
  'ADR-0023 (V24): BEFORE INSERT/UPDATE OF parent_code guard — walks the current-row ancestor chain via parent_code and rejects with classifier_cycle if it returns to NEW.code (or on a self-edge). Re-pointed from the V18 parent_id walk; the (dim_code, code) chain is stable across SCD-2 revisions. Bounded hop count guards a malformed chain.';

-- Re-bind the trigger to fire on parent_code (was parent_id in V18). Dropping the
-- old binding first is required because parent_id is removed in Step 3.
--
-- Renamed trg_classifier_no_cycle -> trg_classifier_acyclic: Postgres fires
-- same-timing BEFORE-row triggers in ALPHABETICAL name order, so the cycle guard
-- MUST sort before trg_classifier_code_path to run first. 'a'cyclic < 'c'ode_path;
-- the old 'n'o_cycle sorted AFTER code_path, defeating the intended ordering.
-- Drop BOTH the old and new names (IF EXISTS) so exactly one cycle trigger remains.
DROP TRIGGER IF EXISTS trg_classifier_no_cycle ON stats.classifier;
DROP TRIGGER IF EXISTS trg_classifier_acyclic ON stats.classifier;
CREATE TRIGGER trg_classifier_acyclic
  BEFORE INSERT OR UPDATE OF parent_code ON stats.classifier
  FOR EACH ROW EXECUTE FUNCTION stats.prevent_classifier_cycle();

COMMENT ON TRIGGER trg_classifier_acyclic ON stats.classifier IS
  'Rejects a parent_code edge that would create a cycle. Name sorts before trg_classifier_code_path (a < c), and Postgres fires same-timing BEFORE-row triggers in alphabetical name order, so this cycle guard fires FIRST: a cyclic edge is rejected with the clear classifier_cycle message before code_path materialization is attempted. BEFORE INSERT/UPDATE OF parent_code (re-pointed from parent_id in V24).';


-- ════════════════════════════════════════════════════════════════════════
-- STEP 2 — drop V4's id-chain path trigger + its function (now purposeless)
-- ════════════════════════════════════════════════════════════════════════
-- trg_classifier_code_path (V23) is the sole path maintainer after this. Drop the
-- trigger before the function, and both before the `path` column they write.
DROP TRIGGER IF EXISTS trg_classifier_path ON stats.classifier;
DROP FUNCTION IF EXISTS stats.refresh_classifier_path();


-- ════════════════════════════════════════════════════════════════════════
-- STEP 3 — drop the id-chain artifacts: indexes, `path`, then `parent_id`
-- ════════════════════════════════════════════════════════════════════════
-- idx_classifier_path (GIST on path) and idx_classifier_parent_id (FK index) lose
-- their columns; drop them explicitly (a column DROP would cascade, but explicit
-- DROP INDEX IF EXISTS is idempotent and intention-revealing).
DROP INDEX IF EXISTS stats.idx_classifier_path;
DROP INDEX IF EXISTS stats.idx_classifier_parent_id;

-- The id-chain materialized path. Superseded by code_path (V23).
ALTER TABLE stats.classifier DROP COLUMN IF EXISTS path;

-- The surrogate-id hierarchy edge. Its V4 self-FK (REFERENCES stats.classifier(id)
-- ON DELETE SET NULL) is dropped together with the column. parent_code (V23) is
-- the sole edge after this. The surrogate `id` itself REMAINS (row PK +
-- classifier_display.member_id) — only this EDGE is retired.
ALTER TABLE stats.classifier DROP COLUMN IF EXISTS parent_id;
