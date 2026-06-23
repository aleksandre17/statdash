-- ════════════════════════════════════════════════════════════════════════
-- V18__scd2_unlock.sql — SCD-2 multi-revision unlock + classifier acyclicity
--                        + SDMX concept-role typing
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — three related codelist-integrity changes. Parts B
-- and C are ADDITIVE; Part A is the one DESTRUCTIVE step (a constraint DROP) and
-- is the irreversible door this whole migration is gated on. Read Part A's note.
--
--   PART A — UNLOCK SCD-2 (drop the V4 single-version constraint).
--     V4 created  classifier_dim_code_code_uq  UNIQUE (dim_code, code)  — which
--     allows exactly ONE row per (dim_code, code). V6 then added the SCD-2
--     machinery (valid_from / valid_to / is_current) AND a partial unique index
--     uq_classifier_current UNIQUE (dim_code, code) WHERE is_current — i.e. "at
--     most one CURRENT row per code", the real forward invariant. But the V4
--     blanket UNIQUE still BLOCKS inserting a second (historical, is_current=
--     false) row: a revision would collide on (dim_code, code). V6's own comment
--     (lines 137-142) explicitly DEFERRED this: "a follow-up migration will drop
--     the V4 constraint via expand-contract." V18 Part A IS that contract step.
--     Expand-contract complete: V6 EXPANDED (added the partial-unique guarantee
--     for current rows); V18 CONTRACTS (removes the now-redundant blanket guard).
--     After this, a codelist revision is a NEW row (old → is_current=false,
--     valid_to set; new → is_current=true) instead of a destructive UPDATE that
--     erases the prior label — "data outlives code" for the cube's codelists.
--
--   PART B — CLASSIFIER ACYCLICITY (defensive cycle prevention).
--     V4's refresh_classifier_path trigger materializes the LTREE path and would
--     fault on a cycle (the parent path lookup), but only INDIRECTLY and with an
--     opaque message. An explicit BEFORE INSERT/UPDATE OF parent_id guard that
--     walks the ancestor chain and rejects a self-ancestor gives a CLEAR,
--     domain-specific error and makes acyclicity an explicit invariant rather
--     than an emergent side effect of path materialization (fail-fast, intention-
--     revealing). Hierarchies must be DAGs; this enforces it at write time.
--
--   PART C — SDMX CONCEPT ROLE typing (stats.dimension.concept_role).
--     SDMX Concept Roles classify what a dimension/concept DOES in a DSD: is it a
--     measure, an attribute, the time dimension, a spatial (geo) dimension, or a
--     classification codelist. Today stats.dimension carries only code+label —
--     a consumer cannot tell the time axis from a classification axis except by
--     the is_time_dim flag on dataset_dimension (which is per-dataset, not a
--     property of the dimension concept itself). concept_role makes the concept's
--     ROLE first-class and drives valid-aggregation policy (a 'measure' may
--     SUM/AVG; an 'attribute' must not aggregate).
--
-- ── 09 §B RISK GATE (Class-M migration — MIXED reversibility, READ CAREFULLY) ─
--   PART A — ONE-WAY DOOR (IRREVERSIBLE in practice).
--     Reversibility : Dropping classifier_dim_code_code_uq is REVERSIBLE ONLY
--                     while no two rows share a (dim_code, code) — i.e. only
--                     until the FIRST SCD-2 historical revision is written. The
--                     instant ETL writes a second (is_current=false) row for any
--                     code, re-adding the V4 UNIQUE would FAIL (duplicate key).
--                     Treat this as IRREVERSIBLE: by design it exists to permit
--                     the very duplicates that would block re-adding it. This is
--                     the door that gets the most scrutiny (one-way vs two-way).
--     Blast radius  : LOW but PERMANENT. Today exactly one row exists per code
--                     (the V4 constraint has held), so the drop changes no
--                     existing data and breaks no current read. The CURRENT-row
--                     uniqueness is fully preserved by V6's uq_classifier_current
--                     partial index — dropping the blanket constraint does NOT
--                     weaken the "one current row per code" guarantee the cube
--                     relies on. What changes is only that HISTORICAL rows become
--                     insertable.
--     ⚠ LATENT INTEGRITY FOLLOW-UP (must be addressed in a future migration):
--                     V4's validate_observation_dim_key trigger checks
--                       EXISTS(SELECT 1 FROM stats.classifier
--                              WHERE dim_code = dim AND code = val)
--                     with NO is_current filter (V4 lines 252-262). While only
--                     current rows exist, that is correct. Once Part A enables
--                     historical rows, that EXISTS could match a RETIRED
--                     (is_current=false) code and admit an observation keyed on a
--                     no-longer-current member. V4 is immutable (cannot be
--                     edited), so the fix is a FUTURE migration that CREATE OR
--                     REPLACEs stats.validate_observation_dim_key to add
--                     "AND is_current = true" to that EXISTS. This migration does
--                     NOT change observation validation; it only UNLOCKS history.
--                     The hole is latent (zero historical rows exist today) but
--                     MUST be closed BEFORE ETL begins writing SCD-2 revisions.
--                     Recorded here so it is not lost (Chesterton's Fence: the V4
--                     EXISTS is load-bearing — re-point it, do not just drop guards).
--     Rollback plan : ALTER TABLE stats.classifier
--                       ADD CONSTRAINT classifier_dim_code_code_uq
--                       UNIQUE (dim_code, code);
--                     — SUCCEEDS ONLY IF no duplicate (dim_code, code) exists yet.
--                       If revisions have been written, rollback is impossible by
--                       definition; that is the accepted one-way property.
--
--   PART B — TWO-WAY. New function + new trigger only.
--     Rollback : DROP TRIGGER IF EXISTS trg_classifier_no_cycle ON stats.classifier;
--                DROP FUNCTION IF EXISTS stats.prevent_classifier_cycle();
--     Blast    : LOW. BEFORE INSERT/UPDATE OF parent_id only — a non-parent write
--                pays nothing. It only REJECTS cycles, which are already invalid
--                (V4's path trigger would fault on them anyway); no legal write is
--                newly blocked. Fires before V4's trg_classifier_path (name sorts
--                earlier), so a cycle is caught with a clear message first.
--
--   PART C — TWO-WAY. One nullable column + one CHECK on stats.dimension.
--     Rollback : ALTER TABLE stats.dimension
--                  DROP CONSTRAINT IF EXISTS dimension_concept_role_chk,
--                  DROP COLUMN     IF EXISTS concept_role;
--     Blast    : LOW. Nullable, no default → metadata-only ADD, no row rewrite,
--                no existing row violates the CHECK (NULL passes a CHECK).
--
--   Hypertable impact (all parts): NONE. stats.classifier and stats.dimension are
--   PLAIN tables. stats.observation is not touched by V18.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS · CREATE OR REPLACE FUNCTION · DROP
-- TRIGGER IF EXISTS + CREATE · ADD COLUMN IF NOT EXISTS · ADD CONSTRAINT guarded
-- by existence check. Re-run = converge, never error.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- PART A — drop the V4 blanket UNIQUE that blocks SCD-2 historical rows
-- ════════════════════════════════════════════════════════════════════════
-- ⚠ IRREVERSIBLE once a second revision exists (see risk gate, Part A). The
-- CURRENT-row invariant is preserved by V6's uq_classifier_current partial unique.
-- IF EXISTS keeps the drop idempotent (re-run after success is a no-op).
ALTER TABLE stats.classifier DROP CONSTRAINT IF EXISTS classifier_dim_code_code_uq;


-- ════════════════════════════════════════════════════════════════════════
-- PART B — explicit classifier hierarchy acyclicity guard
-- ════════════════════════════════════════════════════════════════════════
-- Walks the ancestor chain from NEW.parent_id upward; if it reaches NEW.id, the
-- edge would close a cycle → reject with a clear, domain-specific message.
-- NEW.id is already assigned on INSERT (GENERATED ALWAYS AS IDENTITY populates
-- before BEFORE-ROW triggers fire), so the self-ancestor test is valid on both
-- INSERT and parent_id UPDATE.
--
-- The walk follows CURRENT rows (is_current = true) — the live hierarchy. This is
-- correct because parent_id references the immutable surrogate id and the active
-- tree is the current-row tree; a non-current ancestor terminates the walk
-- (treated as "no further live parent"), which cannot mask a cycle in the LIVE
-- hierarchy (a cycle requires a closed loop of live edges). Documented so a
-- future reader understands the is_current scoping is deliberate, not an oversight.
CREATE OR REPLACE FUNCTION stats.prevent_classifier_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  ancestor_id BIGINT;
  hops        INT := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  ancestor_id := NEW.parent_id;
  -- Bounded walk (defensive against a pre-existing malformed chain): the live
  -- tree cannot be deeper than the row count, and 10000 hops is far beyond any
  -- real classification depth — a runaway loop fails fast instead of hanging.
  WHILE ancestor_id IS NOT NULL AND hops < 10000 LOOP
    IF ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'classifier_cycle: inserting (dim_code=%, code=%) with parent_id=% would create a cycle',
        NEW.dim_code, NEW.code, NEW.parent_id;
    END IF;
    SELECT parent_id INTO ancestor_id
      FROM stats.classifier
     WHERE id = ancestor_id AND is_current = true;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION stats.prevent_classifier_cycle() IS
  'BEFORE INSERT/UPDATE OF parent_id guard: walks the current-row ancestor chain from NEW.parent_id; rejects with a clear classifier_cycle message if it reaches NEW.id. Makes acyclicity an explicit, intention-revealing invariant (V4''s path trigger would only fault indirectly). Bounded hop count guards against a malformed pre-existing chain.';

DROP TRIGGER IF EXISTS trg_classifier_no_cycle ON stats.classifier;
CREATE TRIGGER trg_classifier_no_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON stats.classifier
  FOR EACH ROW EXECUTE FUNCTION stats.prevent_classifier_cycle();

COMMENT ON TRIGGER trg_classifier_no_cycle ON stats.classifier IS
  'Rejects a parent_id edge that would create a cycle in the classifier hierarchy. Name sorts before trg_classifier_path so the cycle is caught with a clear message BEFORE V4''s LTREE path materialization would fault on it. BEFORE INSERT/UPDATE OF parent_id — a non-parent write costs nothing.';


-- ════════════════════════════════════════════════════════════════════════
-- PART C — SDMX concept-role typing on stats.dimension
-- ════════════════════════════════════════════════════════════════════════
-- Nullable column (no default) → metadata-only ADD on PG ≥ 11, no row rewrite,
-- no existing row violates the CHECK (a NULL column value makes the CHECK
-- evaluate to UNKNOWN, which a CHECK constraint TREATS AS SATISFIED — so NULL is
-- permitted without listing it in the IN set; listing NULL in an IN clause is a
-- no-op anyway since NULL IN (...) is never TRUE. The CHECK therefore enumerates
-- only the real roles and lets NULL through by Postgres CHECK semantics).
ALTER TABLE stats.dimension
  ADD COLUMN IF NOT EXISTS concept_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dimension_concept_role_chk'
      AND conrelid = 'stats.dimension'::regclass
  ) THEN
    ALTER TABLE stats.dimension
      ADD CONSTRAINT dimension_concept_role_chk
      CHECK (concept_role IN ('measure', 'attribute', 'time', 'geo', 'classification'));
  END IF;
END;
$$;

COMMENT ON COLUMN stats.dimension.concept_role IS
  'SDMX concept role. ''measure'' = quantitative measure (valid aggregations: SUM/AVG); ''attribute'' = metadata qualifier (no aggregation); ''time'' = the time dimension (exactly one per DSD); ''geo'' = spatial dimension; ''classification'' = institutional/sector codelist. NULL = unclassified (CHECK permits NULL by standard CHECK semantics). Concept-level role, complementing dataset_dimension.is_time_dim (which is per-dataset).';
