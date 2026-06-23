-- ════════════════════════════════════════════════════════════════════════
-- V23__classifier_code_path_expand.sql — EXPAND step of ADR-0023
--   Classifier hierarchy: surrogate-id-chain LTREE → stable (dim_code, code)
--   business-key code-chain. This is the ADDITIVE, two-way-reversible half.
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — implements ADR-0023 (Accepted). The classifier
-- hierarchy edge and its materialized LTREE path move OFF the churning surrogate
-- `id` and ONTO the stable (dim_code, code) business key. V23 is the EXPAND half
-- of an expand-contract (parallel-change) rollout: it adds the new edge + new
-- path and runs them IN PARALLEL with V4's id-chain `path` for a live parity
-- period. It drops NOTHING. V24 is the later CONTRACT (one-way) step.
--
--   ROOT CAUSE (ADR-0023). SCD-2 (V6/V18) mints a NEW surrogate id per codelist
--   revision, so a single id-space + a single id-chain path cannot honour both
--   identity fidelity (child → its CURRENT parent) and temporal fidelity (child →
--   the co-existing parent revision). The runtime writer today re-points children
--   and rebuilds subtree paths on every revision (upsert.ts Step 3/3b) just to
--   keep the LIVE tree correct — writing temporally-incoherent historical edges.
--   SDMX identifies codelists by CODE, not surrogate key (Law 1); codes are
--   stable across revisions, so a code-chain path NEVER changes on a revision.
--   The re-point/rebuild dance disappears and an as-of-date read becomes a pure
--   validity-window filter.
--
--   WHAT V23 ADDS:
--     1. stats.classifier.parent_code TEXT — the new hierarchy edge, the parent's
--        business `code` within the SAME dim_code. Nullable; root = NULL.
--        ⚠ DELIBERATELY NOT A FOREIGN KEY. Post-V18 (dim_code, code) is NON-UNIQUE
--        (SCD-2 keeps historical is_current=false rows), so a plain composite FK
--        to (dim_code, code) is IMPOSSIBLE — there is no unique key to reference.
--        Referential integrity instead comes from V6's uq_classifier_current
--        partial unique (one CURRENT row per code) + the V23 code-path trigger
--        below, which RAISES if the current parent is missing. This is intentional
--        (ADR-0023), not an omission — documented on the column so a future reader
--        does not "helpfully" add an FK that cannot exist.
--     2. stats.code_to_ltree_label(TEXT) — IMMUTABLE sanitiser mapping a business
--        code to a valid LTREE label. LTREE labels permit ONLY [A-Za-z0-9_]; real
--        classifier codes contain other characters (V5 seeds 'GE-TB', 'GE-KA' with
--        a hyphen). A raw code::ltree would FAIL on those. The sanitiser replaces
--        every run of disallowed characters with a single '_'. (The id-chain path
--        never hit this because ids are numeric.) See the collision note on the fn.
--     3. stats.classifier.code_path LTREE — the new materialized path: the chain
--        of SANITISED codes from root to this node, e.g. 'B.B1.B1G'. Runs IN
--        PARALLEL with V4's `path` (id chain) through the parity period.
--     4. stats.refresh_classifier_code_path() + trigger trg_classifier_code_path —
--        BEFORE INSERT/UPDATE OF parent_code: materializes code_path from the
--        parent's CURRENT-row code_path, RAISING if the current parent is missing
--        (the integrity guard that substitutes for the impossible FK).
--     5. Backfill: derive parent_code from the existing parent_id edge (parent's
--        code within the same dim_code), then build code_path TOP-DOWN by depth so
--        each level's parent code_path exists before its children are computed.
--     6. Parity assertion (read-only DO block): for every current row, the new
--        code_path and the old id-path must describe the SAME ancestry DEPTH —
--        a fast structural parity check that the two representations agree before
--        V24 is ever allowed to drop the id path.
--
--   WHY id REMAINS. The surrogate `id` is NOT removed by ADR-0023. It stays as the
--   row PK and as stats.classifier_display.member_id (V6). Only the hierarchy EDGE
--   and the PATH move to codes. parent_id + the id-chain `path` are dropped later,
--   in V24.
--
--   ZERO FACT-TABLE BLAST RADIUS. stats.observation references classifiers ONLY by
--   (dim_code, code) business codes (dim_key JSONB + V4/V22 validate trigger keyed
--   on dim_code/code), NEVER by surrogate id. Changing the hierarchy edge touches
--   no observation, no read path, no hypertable property.
--
-- ── 09 §B RISK GATE (Class-M migration — EXPAND half, TWO-WAY reversible) ──
--   Reversibility : TWO-WAY. Everything V23 introduces is ADDITIVE and fully
--                   droppable with no data loss of pre-existing state:
--                     DROP TRIGGER IF EXISTS trg_classifier_code_path ON stats.classifier;
--                     DROP FUNCTION IF EXISTS stats.refresh_classifier_code_path();
--                     ALTER TABLE stats.classifier DROP COLUMN IF EXISTS code_path;
--                     ALTER TABLE stats.classifier DROP COLUMN IF EXISTS parent_code;
--                     DROP FUNCTION IF EXISTS stats.code_to_ltree_label(TEXT);
--                     DROP INDEX  IF EXISTS stats.idx_classifier_code_path;
--                   V4's parent_id, path, refresh_classifier_path() and the
--                   id-chain trigger are UNTOUCHED — the old representation is
--                   intact and authoritative throughout the parity period, so a
--                   rollback returns to the exact pre-V23 behavior.
--   Blast radius  : LOW. parent_code/code_path are NULLABLE adds (no row rewrite,
--                   no default → metadata-only on PG ≥ 11). The new trigger fires
--                   ONLY on INSERT/UPDATE OF parent_code — existing writers that
--                   still set parent_id pay nothing until they switch. No existing
--                   constraint, index, read path, or the V4/V18/V22 triggers are
--                   modified. stats.classifier is a PLAIN table (no hypertable).
--                   stats.observation is not touched.
--   Pre-flight    : The backfill is guarded — it derives parent_code from the
--                   existing parent_id edge and the parity DO block REFUSES to
--                   complete (RAISES) if the new code_path ancestry depth disagrees
--                   with the old id-path depth for any current row. Fail-fast
--                   before V24 can rely on parity.
--   Rollback plan : run the five DROP statements above (the new objects only).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP TRIGGER
-- IF EXISTS + CREATE · CREATE INDEX IF NOT EXISTS · the backfill is an UPDATE that
-- re-converges (sets the same values on re-run). No V1-V22 object is dropped or
-- altered; V23 only ADDS, in parallel.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. parent_code — the new, stable hierarchy edge (NOT a foreign key; see header)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE stats.classifier ADD COLUMN IF NOT EXISTS parent_code TEXT;

COMMENT ON COLUMN stats.classifier.parent_code IS
  'ADR-0023 hierarchy edge: the parent member''s business code within the SAME dim_code. NULL = root. DELIBERATELY NOT A FK — post-V18 (dim_code, code) is non-unique (SCD-2 history), so no unique key exists to reference. Integrity = V6 uq_classifier_current (one current row per code) + the trg_classifier_code_path guard (raises if the current parent is missing). Replaces the surrogate parent_id (dropped in V24).';


-- ════════════════════════════════════════════════════════════════════════
-- 2. code_to_ltree_label — sanitise a business code into a valid LTREE label
-- ════════════════════════════════════════════════════════════════════════
-- LTREE labels accept ONLY [A-Za-z0-9_]. Real classifier codes do not (V5 seeds
-- 'GE-TB', 'GE-KA'). Replace every maximal run of disallowed characters with a
-- single '_' so the code becomes a legal label. IMMUTABLE + STRICT so it may be
-- used in the path trigger and (potentially) a generated/indexed expression.
--
-- ⚠ COLLISION CAVEAT: sanitisation is many-to-one ('GE-TB' and 'GE_TB' both map
-- to 'GE_TB'). Within a single dimension that would only matter if two sibling
-- codes differed ONLY by a disallowed character — not the case in this corpus
-- (codes are SDMX identifiers, distinct on label characters). The code_path is
-- used for ANCESTRY traversal, not as an identity key (identity stays the literal
-- (dim_code, code) + parent_code); a collision would at worst over-match an
-- ancestor query, never corrupt the edge itself. Documented so the limit is known.
CREATE OR REPLACE FUNCTION stats.code_to_ltree_label(p_code TEXT)
RETURNS TEXT AS $$
  SELECT regexp_replace(p_code, '[^A-Za-z0-9_]+', '_', 'g');
$$ LANGUAGE SQL IMMUTABLE STRICT;

COMMENT ON FUNCTION stats.code_to_ltree_label(TEXT) IS
  'ADR-0023: maps a business code to a valid LTREE label (LTREE allows only [A-Za-z0-9_]). Replaces each run of disallowed chars with ''_''. IMMUTABLE STRICT. Many-to-one (collision caveat documented in V23); code_path is for ancestry traversal, not identity — identity stays literal (dim_code, code, parent_code).';


-- ════════════════════════════════════════════════════════════════════════
-- 3. code_path — the new materialized path (sanitised code chain), in PARALLEL
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE stats.classifier ADD COLUMN IF NOT EXISTS code_path LTREE;

COMMENT ON COLUMN stats.classifier.code_path IS
  'ADR-0023 materialized LTREE path of the SANITISED-code chain (e.g. ''B.B1.B1G''), root→node, over the stable (dim_code, code) key. NEVER changes on an SCD-2 revision (codes are stable) — unlike V4''s id-chain `path`, which the runtime re-pointed every revision. Set by trg_classifier_code_path on insert/update of parent_code; never set by hand. Runs in PARALLEL with V4 `path` during the V23→V24 parity period; supersedes it after V24.';

-- GIST index for ancestor(@>)/descendant(<@)/subtree queries — mirrors V4's
-- idx_classifier_path so the new path has the same O(log n) traversal support.
CREATE INDEX IF NOT EXISTS idx_classifier_code_path
  ON stats.classifier USING GIST (code_path);


-- ════════════════════════════════════════════════════════════════════════
-- 4. refresh_classifier_code_path — own code_path from the code chain
-- ════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT/UPDATE OF parent_code. Builds code_path = parent's CURRENT-row
-- code_path || this node's sanitised code. RAISES if a non-NULL parent_code has no
-- CURRENT member — this is the integrity guard that stands in for the impossible
-- composite FK (see header). The parent lookup is scoped to is_current = true: the
-- LIVE tree is the current-row tree, and because codes are stable a child always
-- attaches to its parent's CURRENT code_path (which itself never moves on revision).
CREATE OR REPLACE FUNCTION stats.refresh_classifier_code_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_code_path LTREE;
  self_label       TEXT;
BEGIN
  self_label := stats.code_to_ltree_label(NEW.code);

  IF NEW.parent_code IS NULL THEN
    NEW.code_path := self_label::LTREE;
  ELSE
    SELECT code_path INTO parent_code_path
      FROM stats.classifier
     WHERE dim_code   = NEW.dim_code
       AND code       = NEW.parent_code
       AND is_current = true;

    IF parent_code_path IS NULL THEN
      RAISE EXCEPTION
        'classifier_code_path: no current parent (dim_code=%, code=%) for child (dim_code=%, code=%) — parent_code references a missing or retired member',
        NEW.dim_code, NEW.parent_code, NEW.dim_code, NEW.code;
    END IF;

    NEW.code_path := parent_code_path || self_label::LTREE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.refresh_classifier_code_path() IS
  'ADR-0023: BEFORE INSERT/UPDATE OF parent_code — materializes code_path from the CURRENT parent''s code_path || sanitised(code). RAISES if a non-NULL parent_code has no current member (the integrity guard standing in for the impossible composite FK). Owns classifier.code_path — never set it by hand.';

DROP TRIGGER IF EXISTS trg_classifier_code_path ON stats.classifier;
CREATE TRIGGER trg_classifier_code_path
  BEFORE INSERT OR UPDATE OF parent_code ON stats.classifier
  FOR EACH ROW EXECUTE FUNCTION stats.refresh_classifier_code_path();

COMMENT ON TRIGGER trg_classifier_code_path ON stats.classifier IS
  'ADR-0023 code-chain path maintainer. Fires on INSERT/UPDATE OF parent_code only. Runs in PARALLEL with V4''s trg_classifier_path through the parity period; trg_classifier_path is dropped in V24.';


-- ════════════════════════════════════════════════════════════════════════
-- 5. BACKFILL — derive parent_code from parent_id, then code_path top-down
-- ════════════════════════════════════════════════════════════════════════
-- 5a. parent_code from the existing parent_id edge. The parent's code is read
--     within the SAME dim_code (parent_id is the surrogate id of that parent row).
--     Direct column assignment is used (NOT a parent_code UPDATE that would fire
--     trg_classifier_code_path mid-backfill before code_path exists); the path is
--     built explicitly in 5b. We temporarily DISABLE the path trigger for the
--     backfill so the two columns are populated deterministically in dependency
--     order, then re-enable it for all subsequent live writes.
ALTER TABLE stats.classifier DISABLE TRIGGER trg_classifier_code_path;

UPDATE stats.classifier c
   SET parent_code = p.code
  FROM stats.classifier p
 WHERE c.parent_id = p.id
   AND c.parent_id IS NOT NULL;

-- Roots: parent_id IS NULL → parent_code stays NULL (already the default). No-op,
-- stated for clarity.

-- 5b. code_path TOP-DOWN by depth. A node's code_path needs its parent's code_path
--     to already exist, so we iterate level by level: roots first (parent_code
--     NULL), then each successive generation whose parent already has a code_path.
--     Bounded by max hierarchy depth; converges when a pass updates 0 rows.
DO $$
DECLARE
  affected INT;
  guard    INT := 0;
BEGIN
  -- Roots: code_path = sanitised(code).
  UPDATE stats.classifier
     SET code_path = stats.code_to_ltree_label(code)::LTREE
   WHERE parent_code IS NULL
     AND code_path IS DISTINCT FROM stats.code_to_ltree_label(code)::LTREE;

  -- Descendants: attach to the CURRENT parent's already-built code_path.
  LOOP
    UPDATE stats.classifier c
       SET code_path = p.code_path || stats.code_to_ltree_label(c.code)::LTREE
      FROM stats.classifier p
     WHERE c.parent_code IS NOT NULL
       AND c.code_path   IS NULL
       AND p.dim_code    = c.dim_code
       AND p.code        = c.parent_code
       AND p.is_current  = true
       AND p.code_path   IS NOT NULL;

    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;

    guard := guard + 1;
    IF guard > 10000 THEN
      RAISE EXCEPTION 'V23 backfill: code_path build exceeded 10000 levels — malformed (cyclic?) parent_code chain';
    END IF;
  END LOOP;

  -- Any current row left with a NULL code_path but a non-NULL parent_code means
  -- its parent_code has no current member — a broken edge that the live trigger
  -- would also reject. Fail fast.
  IF EXISTS (
    SELECT 1 FROM stats.classifier
     WHERE is_current = true
       AND parent_code IS NOT NULL
       AND code_path IS NULL
  ) THEN
    RAISE EXCEPTION 'V23 backfill: current row(s) with parent_code but no current parent — broken hierarchy edge';
  END IF;
END;
$$;

ALTER TABLE stats.classifier ENABLE TRIGGER trg_classifier_code_path;


-- ════════════════════════════════════════════════════════════════════════
-- 6. PARITY ASSERTION (read-only) — new code_path depth must match old id path
-- ════════════════════════════════════════════════════════════════════════
-- The two representations must agree on ancestry DEPTH for every current row
-- before V24 is permitted to drop the id path. nlevel() counts labels in an LTREE;
-- the id-chain `path` and the code-chain `code_path` describe the same root→node
-- walk, so they must have identical depth. A mismatch means the backfill or an
-- edge is wrong — abort the migration rather than enter parity on a false premise.
-- (Read-only: a COUNT + conditional RAISE; writes nothing.)
DO $$
DECLARE
  mismatches INT;
BEGIN
  SELECT COUNT(*) INTO mismatches
    FROM stats.classifier
   WHERE is_current = true
     AND path IS NOT NULL
     AND code_path IS NOT NULL
     AND nlevel(path) IS DISTINCT FROM nlevel(code_path);

  IF mismatches > 0 THEN
    RAISE EXCEPTION 'V23 parity: % current classifier row(s) where code_path depth != id path depth — the code-chain backfill disagrees with the id chain. Resolve before V24.', mismatches;
  END IF;
END;
$$;
