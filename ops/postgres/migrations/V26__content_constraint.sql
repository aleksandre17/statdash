-- ════════════════════════════════════════════════════════════════════════
-- V26__content_constraint.sql — ADR-0027 ContentConstraint (cube region, SDMX-P0-1)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V25 are applied + immutable.
--
--   THE GAP (ADR-0027) — V4 validate_observation_dim_key validates each dim_key
--   value IN ISOLATION (the key set equals the DSD, and each value exists in the
--   classifier for its dimension). It does NOT validate COMBINATIONS. The real
--   ACCOUNTS_SEQUENCE case (series key {measure, side, account}, V7): account
--   'B9' (net lending/borrowing — an SNA balancing item) is legal ONLY on side
--   'U'. The Cartesian product measure×side×account contains combinations that
--   are illegal by SNA design; today a row keyed {account:B9, side:R} passes the
--   V4 trigger (B9 ∈ classifier, R ∈ classifier, key set matches DSD) and enters
--   gold. This migration models the LEGAL CUBE REGION (SDMX ContentConstraint /
--   CubeRegion) so that gap can be closed in the silver validate gate.
--
--   THE DECISION — model the constraint as PREDICATE ROWS, not enumerated tuples:
--     stats.content_constraint        — header (per dataset + role).
--     stats.content_constraint_member — rows. Two row shapes share one table:
--       · UNCONDITIONAL allowed set: (dim_code, code, cond_dim_code NULL) —
--         enumerates the allowed codes for one dimension. A dim with NO
--         unconditional rows is UNCONSTRAINED (any classifier-valid value passes).
--         The allowed region = the Cartesian product of the per-dim allowed sets,
--         defaulting to "all classifier members" for any dim not listed. This is
--         SDMX CubeRegion "included" semantics by KeyValue.
--       · CONDITIONAL rule (the ACCOUNTS case): (dim_code, code, cond_dim_code,
--         cond_code) reads "dim_code may be `code` ONLY WHEN cond_dim_code =
--         cond_code". 'B9 only on side U' is ONE row: (account, B9, side, U).
--         Conditional rows are EXCEPTIONS that RESTRICT (never widen) the
--         unconditional sets.
--
--   WHY NOT the alternatives (ADR-0027 §rejected):
--     1. Explicit allowed-tuple table (one row per legal full combination):
--        combinatorial blow-up (measure×side×account×… = thousands of rows for a
--        handful of real rules) + brittle authoring. The real rules are SPARSE
--        cross-dim dependencies, not an enumerated product.
--     2. Pure per-dim independent sets (no condition): cannot express
--        B9-only-on-U at all — that is exactly a cross-dimension dependency.
--     The predicate-row model is the minimal shape that covers BOTH the simple
--     independent-set case AND the real conditional case (Occam), and is generic
--     over dim codes (Law 1 — no hardcoded 'side'/'account' anywhere in the DDL).
--
--   CONJUNCTION SEMANTICS (the multi-condition edge, decided here): when one
--   (dim_code, code) carries MORE THAN ONE conditional row, the conditions are
--   conjoined (AND) — EVERY condition must hold for the code to be legal. This
--   covers the single-condition real case exactly and gives a DEFINED, fail-safe
--   (restrictive) meaning to the multi-condition case without a separate
--   rule-group table. The dim_key_in_allowed_region() helper below is the single
--   authority for this reading. If true disjunctive (OR) multi-condition rules
--   ever become real, the escalation is a nullable rule_group_id grouping the
--   AND-set — the table shape and helper contract absorb it additively. YAGNI
--   until a real OR rule appears.
--
--   role ∈ {allowed, actual} — populated DIFFERENTLY (SSOT):
--     · 'allowed' = AUTHORED data (provisioned like pages/nav). The legal cube by
--       design. The ONLY role ever stored in this table.
--     · 'actual'  = DERIVED, never a table. A VIEW (stats.cube_actual_region)
--       computed from stats.observation (DISTINCT realized dim_key combinations
--       per dataset). SSOT = the observations themselves; a derived view cannot
--       drift. role is kept on the header as the SDMX vocabulary (allowed/actual)
--       and a CHECK pins the table to 'allowed' so an authored 'actual' row is
--       unrepresentable (fail fast).
--
--   ENFORCEMENT runs in SILVER (validate.ts → ILLEGAL_COMBINATION), NOT a hot
--   BEFORE-INSERT trigger on the observation hypertable. Rationale (ADR-0027 +
--   consistent with V25/V8 keeping the cube write path free of cross-table
--   coupling): validate.ts already loads the DSD + codelists ONCE and checks all
--   rows in memory; the allowed region loads the same way (one query, build the
--   predicate set, check every staged row with zero extra round-trips). A hot
--   per-row constraint scan on the hottest table is rejected. Defense in depth =
--   the silver gate + the fitness function (below), NOT a standing trigger.
--   (A future direct-write path that bypasses silver is the escalation that would
--   justify an opt-in gold trigger reusing dim_key_in_allowed_region(); gated
--   behind a real second writer = YAGNI until then.)
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY (pure addition). Two new PLAIN tables wholly inside
--                   the existing stats schema, one VIEW, one helper FUNCTION. NO
--                   V1-V25 object — table, column, function, constraint, index,
--                   trigger, hypertable, or policy — is created, altered, or
--                   dropped. In particular: NO trigger is added to
--                   stats.observation and NO column is added to it, so the cube's
--                   hot write path is byte-for-byte unchanged (pre-V26 behaviour).
--   Blast radius  : NONE on existing objects. FKs point INTO the new tables and
--                   into stats.dataset / stats.dimension (header → dataset, member
--                   → dimension for both dim_code and cond_dim_code), all ON
--                   DELETE CASCADE. NO FK touches stats.observation (the
--                   hypertable cannot be an FK target — V8). The classifier CODE
--                   referenced by a member row is validated by the authoring path
--                   / fitness function, NOT by an FK (a constraint may legitimately
--                   be authored before its classifier exists; same posture as the
--                   silver tables in V11).
--   Hypertable    : UNAFFECTED. No object here is a hypertable; none touch the
--                   observation partition column, unique index, or compression
--                   clauses. cube_actual_region is a plain VIEW (a DISTINCT scan
--                   over the indexed hypertable — idx_observation_dataset_date +
--                   the dim_key GIN cover it; the Constructor read is not hot).
--   Rollback plan : DROP VIEW     IF EXISTS stats.cube_actual_region;
--                   DROP FUNCTION IF EXISTS stats.dim_key_in_allowed_region(TEXT, JSONB);
--                   DROP TABLE    IF EXISTS stats.content_constraint_member;
--                   DROP TABLE    IF EXISTS stats.content_constraint;
--                   (Sacrifices only authored allowed-region rows — re-applied
--                   from the provisioning manifest on the next boot. No cube datum
--                   is touched.)
--   Data safety   : NO data is seeded. STRUCTURE only. The ACCOUNTS_SEQUENCE
--                   B9-only-on-side-U constraint is AUTHORED via provisioning (not
--                   seeded in SQL), so the rule lives with the other authored
--                   config — consistent with the V7/V11 "no data in migrations"
--                   posture.
--
-- Idempotent: CREATE TABLE/INDEX/VIEW/FUNCTION ... IF NOT EXISTS · CREATE OR
-- REPLACE. Re-run = converge, never error. Additive only; never edits V1-V25.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.content_constraint — the constraint header (per dataset + role)
-- ════════════════════════════════════════════════════════════════════════
-- One row per (dataset_code, role). role is the SDMX ContentConstraint role
-- vocabulary {allowed, actual}; this TABLE only ever holds 'allowed' (the
-- 'actual' region is the derived view below — never authored), pinned by the
-- CHECK so an illegal authored 'actual' row is unrepresentable (fail fast). The
-- (dataset_code, role) UNIQUE is the provisioning idempotency identity.
CREATE TABLE IF NOT EXISTS stats.content_constraint (
  id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_code TEXT        NOT NULL REFERENCES stats.dataset(code) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'allowed',
  label        JSONB       NOT NULL DEFAULT '{}',   -- optional {"en":"SNA legal combinations"}
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- This table is the AUTHORED 'allowed' region only. 'actual' is the derived
  -- view stats.cube_actual_region (SSOT = the observations); never stored here.
  CONSTRAINT content_constraint_role_chk CHECK (role IN ('allowed')),
  CONSTRAINT content_constraint_dataset_role_uq UNIQUE (dataset_code, role)
);

COMMENT ON TABLE stats.content_constraint IS
  'SDMX ContentConstraint header (ADR-0027) — the LEGAL cube region for a dataset. role is the SDMX {allowed,actual} vocabulary; this table holds ONLY role=allowed (authored, provisioned). The actual region is the derived view stats.cube_actual_region (SSOT = stats.observation), never stored here. (dataset_code, role) is the provisioning idempotency identity.';
COMMENT ON COLUMN stats.content_constraint.role IS
  'SDMX ContentConstraint role. Pinned to ''allowed'' by content_constraint_role_chk — the authored legal region. ''actual'' is intentionally NOT storable (it is the derived stats.cube_actual_region view), so the table cannot drift from the observations.';

DROP TRIGGER IF EXISTS trg_content_constraint_updated_at ON stats.content_constraint;
CREATE TRIGGER trg_content_constraint_updated_at BEFORE UPDATE ON stats.content_constraint
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.content_constraint_member — the predicate rows
-- ════════════════════════════════════════════════════════════════════════
-- Each row is either an UNCONDITIONAL allowed-set member (cond_dim_code IS NULL)
-- or a CONDITIONAL rule (cond_dim_code + cond_code both set). dim_code and
-- cond_dim_code FK into stats.dimension (codes are generic — Law 1). The CHECK
-- makes the two cond_* columns all-or-nothing (a half-set condition is an illegal
-- state). The UNIQUE de-dupes identical predicate rows (re-provisioning is
-- idempotent and the AND-conjunction reading is unaffected by accidental dupes).
CREATE TABLE IF NOT EXISTS stats.content_constraint_member (
  id            BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  constraint_id BIGINT  NOT NULL REFERENCES stats.content_constraint(id) ON DELETE CASCADE,
  -- The constrained dimension + the code it may take.
  dim_code      TEXT    NOT NULL REFERENCES stats.dimension(code) ON DELETE CASCADE,
  code          TEXT    NOT NULL,
  -- The condition (both NULL = unconditional allowed-set member).
  cond_dim_code TEXT    REFERENCES stats.dimension(code) ON DELETE CASCADE,
  cond_code     TEXT,
  -- Condition columns are all-or-nothing — a half-specified condition is illegal.
  CONSTRAINT ccm_cond_pair_chk CHECK (
    (cond_dim_code IS NULL AND cond_code IS NULL) OR
    (cond_dim_code IS NOT NULL AND cond_code IS NOT NULL)
  ),
  -- A condition must reference a DIFFERENT dimension than the one it constrains
  -- (a self-referential condition 'account=B9 only when account=B9' is a no-op /
  -- authoring error — fail fast).
  CONSTRAINT ccm_cond_diff_dim_chk CHECK (cond_dim_code IS DISTINCT FROM dim_code),
  -- De-dupe identical predicate rows. NULLS NOT DISTINCT so two unconditional
  -- (dim_code, code) rows collide (PG ≥ 15); the cond_* pair distinguishes
  -- conditional rules from the unconditional member and from each other.
  CONSTRAINT ccm_predicate_uq UNIQUE NULLS NOT DISTINCT
    (constraint_id, dim_code, code, cond_dim_code, cond_code)
);

COMMENT ON TABLE stats.content_constraint_member IS
  'ADR-0027 predicate rows of a ContentConstraint. UNCONDITIONAL (cond_dim_code NULL): enumerates the allowed codes for dim_code (a dim with no such rows is unconstrained). CONDITIONAL (cond_* set): "dim_code may be `code` ONLY WHEN cond_dim_code = cond_code" — e.g. (account,B9,side,U). Conditional rows RESTRICT the unconditional sets; multiple conditions on one (dim_code, code) are conjoined (AND) — see dim_key_in_allowed_region(). Generic over dim codes (Law 1).';
COMMENT ON COLUMN stats.content_constraint_member.code IS
  'The classifier code the dimension may take. NOT FK-enforced to stats.classifier (a constraint may be authored before its codelist exists; same posture as the V11 silver tables). Validity is checked by the authoring path + the fitness function.';
COMMENT ON COLUMN stats.content_constraint_member.cond_dim_code IS
  'The conditioning dimension (NULL = unconditional allowed-set row). With cond_code: "this (dim_code, code) is legal ONLY WHEN cond_dim_code = cond_code". Must differ from dim_code (ccm_cond_diff_dim_chk).';

-- Region load is a single per-dataset query (validate.ts batch-loads ALL members
-- for the dataset's allowed constraint at once); index the FK for that scan.
CREATE INDEX IF NOT EXISTS idx_ccm_constraint ON stats.content_constraint_member (constraint_id);


-- ════════════════════════════════════════════════════════════════════════
-- 3. stats.dim_key_in_allowed_region(dataset_code, dim_key) → BOOLEAN
-- ════════════════════════════════════════════════════════════════════════
-- THE SINGLE AUTHORITY for "is this dim_key inside the dataset's allowed region".
-- The fitness function, any future opt-in gold trigger, and ad-hoc audits all
-- reuse THIS — one definition of "in the region", not three (SSOT). The TS
-- silver check in validate.ts implements the SAME predicate in memory for batch
-- efficiency (no per-row round-trip); this function is the DB-side authority the
-- fitness test asserts against, so the two readings cannot silently diverge.
--
-- SEMANTICS (matches the validate.ts in-memory check exactly):
--   · A dataset with NO role='allowed' constraint → TRUE for every key
--     (unconstrained; the region check is opt-in per dataset).
--   · UNCONDITIONAL: for each dimension that HAS unconditional rows, the key's
--     value for that dim MUST be in that dim's allowed set. A dim with no
--     unconditional rows is unconstrained.
--   · CONDITIONAL (AND-conjoined per (dim_code, code)): for every conditional row
--     whose (dim_code, code) matches the key's value for dim_code, the key's
--     value for cond_dim_code MUST equal cond_code. ALL matching conditions must
--     hold (a violated condition makes the key illegal).
-- STABLE (reads the constraint tables; deterministic within a statement). Not
-- IMMUTABLE — it depends on table contents.
CREATE OR REPLACE FUNCTION stats.dim_key_in_allowed_region(p_dataset_code TEXT, p_dim_key JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  cid       BIGINT;
  m         RECORD;
  key_val   TEXT;
BEGIN
  -- Resolve the dataset's authored allowed constraint. None → unconstrained.
  SELECT id INTO cid
    FROM stats.content_constraint
   WHERE dataset_code = p_dataset_code AND role = 'allowed';
  IF cid IS NULL THEN
    RETURN TRUE;
  END IF;

  -- UNCONDITIONAL allowed sets: for each constrained dimension (one that has any
  -- unconditional row), the key's value for that dim must be in the allowed set.
  FOR m IN
    SELECT dim_code
      FROM stats.content_constraint_member
     WHERE constraint_id = cid AND cond_dim_code IS NULL
     GROUP BY dim_code
  LOOP
    key_val := p_dim_key ->> m.dim_code;
    -- A constrained dim absent from the key, or carrying a value not in the
    -- allowed set, is OUT of region.
    IF key_val IS NULL OR NOT EXISTS (
      SELECT 1 FROM stats.content_constraint_member
       WHERE constraint_id = cid
         AND cond_dim_code IS NULL
         AND dim_code = m.dim_code
         AND code = key_val
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  -- CONDITIONAL rules: every conditional row whose (dim_code, code) matches the
  -- key must have its condition satisfied (AND-conjunction). A matching row whose
  -- cond_dim_code value in the key differs from cond_code makes the key illegal.
  FOR m IN
    SELECT dim_code, code, cond_dim_code, cond_code
      FROM stats.content_constraint_member
     WHERE constraint_id = cid AND cond_dim_code IS NOT NULL
  LOOP
    IF (p_dim_key ->> m.dim_code) = m.code THEN
      IF (p_dim_key ->> m.cond_dim_code) IS DISTINCT FROM m.cond_code THEN
        RETURN FALSE;
      END IF;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION stats.dim_key_in_allowed_region(TEXT, JSONB) IS
  'ADR-0027 SSOT predicate: TRUE iff p_dim_key is inside p_dataset_code''s authored role=allowed cube region. No constraint → TRUE (unconstrained, opt-in per dataset). Unconditional: each constrained dim''s value must be in its allowed set. Conditional (AND-conjoined per (dim_code,code)): every matching "code only when cond_dim=cond_code" rule must hold. Mirrors the validate.ts in-memory batch check (which the silver gate uses for zero round-trips); this is the DB authority the fitness function asserts against. STABLE.';


-- ════════════════════════════════════════════════════════════════════════
-- 4. stats.cube_actual_region — the ACTUAL region (derived view, role=actual)
-- ════════════════════════════════════════════════════════════════════════
-- The SDMX 'actual' ContentConstraint: which dimension-value combinations are
-- ACTUALLY realized in the gold cube, per dataset. DERIVED from stats.observation
-- (SSOT = the observations; a view cannot drift from them). The Constructor reads
-- this to offer only has-data combinations; the cube-profile endpoint (owned by
-- another agent) joins it against the allowed region to classify each combo as
-- has-data / empty-by-design / missing.
--
-- Generic over dim codes (Law 1): the whole realized dim_key is exposed as JSONB
-- (the same shape stats.observation stores), so a consumer reads ctx.dims[code]
-- without any dimension name baked into the view. obs_count + time bounds give the
-- Constructor density/coverage signals per realized combination.
--
-- (Considered a MATERIALIZED VIEW refreshed in publish_release — rejected for V26
-- as YAGNI: the DISTINCT scan is cheap on the indexed hypertable and the
-- Constructor read is not hot. The escalation is a one-line swap to MATERIALIZED
-- with a REFRESH in stats.publish_release — the view CONTRACT is identical
-- = Protected Variations. Promote only if profiling shows it.)
CREATE OR REPLACE VIEW stats.cube_actual_region AS
  SELECT
    o.dataset_code,
    o.dim_key,
    count(*)              AS obs_count,
    min(o.time_period)    AS first_time_period,
    max(o.time_period)    AS last_time_period
  FROM stats.observation o
  GROUP BY o.dataset_code, o.dim_key;

COMMENT ON VIEW stats.cube_actual_region IS
  'ADR-0027 SDMX role=actual ContentConstraint — the dim_key combinations ACTUALLY realized in the gold cube, per dataset, with obs_count + time bounds. Derived from stats.observation (SSOT; cannot drift). The Constructor / cube-profile endpoint reads (dataset_code, dim_key, obs_count, first_time_period, last_time_period) and joins stats.dim_key_in_allowed_region() to classify each combo: has-data (here) vs empty-by-design (in allowed, not here) vs missing (not in allowed). Generic — dim_key is exposed whole as JSONB (Law 1), no dimension name baked in.';
