-- ════════════════════════════════════════════════════════════════════════
-- V27__concept_scheme.sql — ADR (SDMX-P1-A) ConceptScheme: separate Concept
--                           identity from Representation (codelist)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V26 are applied + immutable.
--
--   THE GAP (ADR SDMX-P1-A) — Concept IDENTITY is not separated from
--   Representation. Today stats.dimension.code IS BOTH the semantic concept (what
--   the column MEANS — REF_AREA) AND the codelist key (how its values are coded —
--   CL_AREA). SDMX separates Concept (the semantic role a column plays, living in
--   a ConceptScheme) from Codelist (the representation of its values). Two
--   dimensions that share a concept — partner-country and reporter-country, both
--   = REF_AREA over CL_AREA — cannot declare that today. concept_role (V18) types
--   a dimension's ROLE but as a per-dimension enum, not a reference to a real,
--   namespaced, maintainable Concept artefact.
--
--   THE DECISION — model the Concept as a first-class maintainable artefact:
--     stats.concept_scheme — the namespace (agency + version), e.g. CROSS_DOMAIN.
--     stats.concept        — the Concept rows: code = identity (REF_AREA,
--                            TIME_PERIOD, OBS_VALUE), concept_role (the role
--                            vocabulary MOVED here from stats.dimension — its
--                            rightful home), core_representation_codelist (the
--                            SSOT default codelist representing this concept; NULL
--                            = a primitive like a time or numeric representation),
--                            and parent_code (SDMX concepts may nest — the SAME
--                            code-chain edge idiom as ADR-0023 classifier
--                            hierarchy).
--     stats.dimension      += nullable (concept_scheme_code, concept_code) FK —
--                            the BINDING: a dimension REFERENCES a concept
--                            (Protected Variations seam; nullable so legacy /
--                            unclassified dims stay valid).
--
--   concept_role — EXPAND HALF of an expand-contract (parallel-change). V18 put
--   concept_role on stats.dimension as the cheapest first step. V27 promotes it to
--   its rightful home on stats.concept and BACKFILLS stats.concept from the
--   existing per-dimension concept_role values, then BINDS each dimension to the
--   concept it just seeded. stats.dimension.concept_role is KEPT for this round as
--   a read alias (cube-profile + any V18 consumer keep reading it) — a LATER
--   V-contract drops the dimension column once every read goes through the concept.
--   NO DUAL-WRITE: the concept is SSOT; the dimension column is a legacy alias the
--   contract step retires. (Do NOT add a trigger to sync the two — the fitness
--   function asserts no-drift during the expand window; the contract step removes
--   the duplication rather than maintaining it.)
--
--   WHY THIS SHAPE (rationale + rejected alternatives):
--     · Keeps Law 1 — concept.code IS the identity (like dimension.code,
--       classifier.code). A new concept = an INSERT, never an ALTER. NO hardcoded
--       concept name ('REF_AREA' etc.) appears in the DDL or any function body;
--       the only enumerated point is the concept_role CHECK (the SDMX role
--       vocabulary, the same closed-ish set V18 already pinned).
--     · REJECTED — "give stats.dimension a codelist_code column". Keeps concept and
--       representation COLLAPSED; two dimensions could never share a concept
--       (partner/reporter REF_AREA) — exactly the gap. Does not adopt the standard
--       whole (Law 4).
--     · REJECTED — "ConceptScheme as JSONB on dataset.metadata". Not queryable,
--       not FK-validated, not a maintainable artefact; the future SDMX /structure
--       serializer could never emit a clean ConceptScheme document from a blob
--       (SSOT + Law 4).
--     · REJECTED — "one global concept table, no scheme". SDMX concepts are
--       namespaced by scheme+agency+version (maintainable-artefact identity); a
--       flat table cannot represent two agencies' REF_AREA. The scheme IS the
--       namespace.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY (pure addition). Two new PLAIN tables inside the
--                   existing stats schema + two nullable ADD COLUMNs and one FK on
--                   stats.dimension (a PLAIN table). Nullable, no-default adds are
--                   metadata-only on PG ≥ 11 (catalog entry, no row rewrite). The
--                   concept_role backfill only POPULATES the new tables/columns; it
--                   reshapes no existing datum. NO V1-V26 object — table, column,
--                   function, constraint, index, trigger, hypertable, or policy —
--                   is altered or dropped. In particular stats.dimension.concept_role
--                   (V18) is UNTOUCHED (kept as the read alias for the expand
--                   window). Rollback = drop the FK + two columns on stats.dimension,
--                   drop the two new tables; no cube datum is touched.
--   Blast radius  : NONE on existing objects. The new FK
--                   (concept_scheme_code, concept_code) → stats.concept is NULLABLE
--                   — every existing dimension row has NULLs and satisfies it
--                   trivially. NO trigger is added to stats.observation and NO
--                   column is added to it: the cube's hot write path is byte-for-byte
--                   unchanged (pre-V27). NO change to the partition key, unique
--                   index, or compression clauses.
--   Hypertable    : UNAFFECTED. stats.concept_scheme, stats.concept and
--                   stats.dimension are PLAIN tables. stats.observation is not
--                   touched in any way.
--   i18n          : label columns default to '{}' and are NOT wired to the V13
--                   config.enforce_locale_string completeness trigger — same posture
--                   as V26's content_constraint.label (these are STRUCTURE tables
--                   provisioned with full LocaleStrings via the authoring path; the
--                   migration seeds only a derived English-less placeholder is
--                   avoided by leaving labels '{}' on the backfilled concepts, which
--                   provisioning then fills). No half-translated label can be
--                   AUTHORED later because the authoring path validates LocaleStrings
--                   the same way it does for content_constraint.
--   Rollback plan : ALTER TABLE stats.dimension
--                     DROP CONSTRAINT IF EXISTS dimension_concept_fk,
--                     DROP COLUMN     IF EXISTS concept_code,
--                     DROP COLUMN     IF EXISTS concept_scheme_code;
--                   DROP TABLE IF EXISTS stats.concept;
--                   DROP TABLE IF EXISTS stats.concept_scheme;
--                   (Sacrifices only the seeded concept rows + the dimension→concept
--                    bindings — re-derivable from concept_role on the next apply. No
--                    cube datum is touched; concept_role stays on stats.dimension.)
--
-- Idempotent: CREATE TABLE/INDEX ... IF NOT EXISTS · ADD COLUMN IF NOT EXISTS ·
-- ADD CONSTRAINT guarded by an existence check · the backfill INSERTs ON CONFLICT
-- DO NOTHING and the bind UPDATE only touches still-NULL bindings (converges,
-- never double-binds). Re-run = no-op. Never edits a V1-V26 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.concept_scheme — the Concept namespace (maintainable artefact)
-- ════════════════════════════════════════════════════════════════════════
-- A ConceptScheme is the namespace for a coherent set of Concepts, identified by
-- code + agency + version (SDMX maintainable-artefact identity). code is the PK
-- (the single live version per scheme code is the working assumption, mirroring
-- stats.dataset; agency/version are carried for the /structure serializer and to
-- distinguish two agencies' schemes by metadata). label defaults to '{}' and is
-- filled by the authoring/provisioning path (same posture as content_constraint).
CREATE TABLE IF NOT EXISTS stats.concept_scheme (
  code       TEXT        PRIMARY KEY,                  -- 'CROSS_DOMAIN' | 'SDMX_STAT'
  agency     TEXT        NOT NULL DEFAULT 'SDMX',
  version    TEXT        NOT NULL DEFAULT '1.0',
  label      JSONB       NOT NULL DEFAULT '{}',        -- i18n LocaleString (filled by provisioning)
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats.concept_scheme IS
  'SDMX ConceptScheme (P1-A) — the namespace for a set of Concepts, a maintainable artefact identified by code + agency + version. code IS the identity (Law 1; a new scheme = an INSERT). label is an i18n LocaleString filled by provisioning (defaults ''{}'' — same posture as stats.content_constraint).';
COMMENT ON COLUMN stats.concept_scheme.agency IS
  'SDMX maintenance agency (e.g. SDMX, ESTAT). Part of the maintainable-artefact identity; lets two agencies'' same-coded schemes be distinguished by the /structure serializer.';

DROP TRIGGER IF EXISTS trg_concept_scheme_updated_at ON stats.concept_scheme;
CREATE TRIGGER trg_concept_scheme_updated_at BEFORE UPDATE ON stats.concept_scheme
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.concept — the Concept rows (code = semantic identity)
-- ════════════════════════════════════════════════════════════════════════
-- A Concept is the semantic role a column plays (REF_AREA, TIME_PERIOD, OBS_VALUE,
-- FREQ). code is the business identity within its scheme (Law 1 — no hardcoded
-- concept name in the DDL). concept_role is the role vocabulary MOVED here from
-- stats.dimension (V18) — role is a property of the CONCEPT, not the per-cube
-- dimension. core_representation_codelist is the SSOT DEFAULT codelist representing
-- this concept (NULL = a primitive representation: a time or numeric). parent_code
-- is the SDMX concept-nesting edge — the SAME code-chain idiom as ADR-0023 (the
-- parent's business code within the SAME scheme; NULL = root). It is DELIBERATELY
-- NOT a self-FK (kept simple — concepts are few and the nesting shallow; the
-- authoring path validates the parent exists, mirroring how content_constraint
-- members are not FK'd to classifier codes).
CREATE TABLE IF NOT EXISTS stats.concept (
  scheme_code                  TEXT  NOT NULL REFERENCES stats.concept_scheme(code) ON DELETE CASCADE,
  code                         TEXT  NOT NULL,        -- 'REF_AREA' | 'TIME_PERIOD' | 'OBS_VALUE' (Law 1: identity)
  label                        JSONB NOT NULL DEFAULT '{}',
  concept_role                 TEXT,                  -- the role vocabulary, MOVED from stats.dimension (V18)
  core_representation_codelist TEXT,                  -- SSOT default codelist; NULL = primitive (time/numeric)
  parent_code                  TEXT,                  -- SDMX concept-nesting edge (code-chain, ADR-0023 idiom); NULL = root
  ord                          INT   NOT NULL DEFAULT 0,
  metadata                     JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (scheme_code, code),
  -- The SAME closed-ish role vocabulary V18 pinned on stats.dimension. NULL is
  -- permitted by standard CHECK semantics (NULL → UNKNOWN → treated as satisfied),
  -- so an unclassified concept is allowed without listing NULL.
  CONSTRAINT concept_role_chk CHECK (
    concept_role IN ('measure', 'attribute', 'time', 'geo', 'classification')
  )
);

COMMENT ON TABLE stats.concept IS
  'SDMX Concept (P1-A) — the semantic role a column plays (REF_AREA, TIME_PERIOD, OBS_VALUE). code IS the identity within its scheme (Law 1; a new concept = an INSERT, never an ALTER). The SSOT for concept_role (MOVED from stats.dimension V18 via expand-contract) and for the concept''s default representation (core_representation_codelist).';
COMMENT ON COLUMN stats.concept.concept_role IS
  'SDMX concept role (measure/attribute/time/geo/classification). The SSOT home of the role — V18 placed it on stats.dimension as the first step; V27 promotes it here. stats.dimension.concept_role is kept as a read alias for the expand window and dropped by a later contract migration. NULL = unclassified.';
COMMENT ON COLUMN stats.concept.core_representation_codelist IS
  'The SSOT DEFAULT codelist (CL_*) representing this concept''s values — the contract default. NULL = a primitive representation (time format, numeric). A dimension MAY constrain to a sub-codelist at bind time; this is the concept-level default, not the per-dataset actual.';
COMMENT ON COLUMN stats.concept.parent_code IS
  'SDMX concept-nesting edge: the parent concept''s business code within the SAME scheme (code-chain idiom, ADR-0023). NULL = root. NOT a self-FK (concepts are few/shallow; the authoring path validates the parent — same posture as content_constraint member codes).';

DROP TRIGGER IF EXISTS trg_concept_locale ON stats.concept;
-- NOTE: intentionally NOT wiring config.enforce_locale_string here — labels are
-- '{}'-defaulted structure filled by provisioning (same posture as content_constraint).

-- Find every concept of a scheme (the /structure serializer + Constructor scan).
CREATE INDEX IF NOT EXISTS idx_concept_scheme ON stats.concept (scheme_code);
-- Concept-nesting ancestry walk (parent_code chain within a scheme).
CREATE INDEX IF NOT EXISTS idx_concept_parent ON stats.concept (scheme_code, parent_code);


-- ════════════════════════════════════════════════════════════════════════
-- 3. stats.dimension += (concept_scheme_code, concept_code) — the binding
-- ════════════════════════════════════════════════════════════════════════
-- The dimension→concept binding (Protected Variations seam). Nullable composite
-- FK into stats.concept(scheme_code, code): an unbound dimension is legacy /
-- unclassified and stays valid. This is what lets TWO dimensions declare the SAME
-- concept (partner & reporter both bind CROSS_DOMAIN/REF_AREA) — the gap V27
-- closes. Nullable, no-default adds → metadata-only on PG ≥ 11 (no row rewrite);
-- every existing dimension row gets NULLs and satisfies the FK trivially.
ALTER TABLE stats.dimension
  ADD COLUMN IF NOT EXISTS concept_scheme_code TEXT;
ALTER TABLE stats.dimension
  ADD COLUMN IF NOT EXISTS concept_code        TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dimension_concept_fk'
      AND conrelid = 'stats.dimension'::regclass
  ) THEN
    ALTER TABLE stats.dimension
      ADD CONSTRAINT dimension_concept_fk
      FOREIGN KEY (concept_scheme_code, concept_code)
      REFERENCES stats.concept (scheme_code, code);
  END IF;
END;
$$;

COMMENT ON COLUMN stats.dimension.concept_scheme_code IS
  'P1-A binding: the ConceptScheme this dimension''s concept lives in. NULL = unbound (legacy/unclassified). With concept_code forms the nullable composite FK dimension_concept_fk → stats.concept. Lets two dimensions (partner/reporter) share one concept (REF_AREA) — the gap V27 closes.';
COMMENT ON COLUMN stats.dimension.concept_code IS
  'P1-A binding: the Concept this dimension plays (REF_AREA, TIME_PERIOD …). The role now resolves THROUGH the concept (dimension → concept → concept_role); stats.dimension.concept_role is kept as a read alias for the expand window. NULL = unbound.';


-- ════════════════════════════════════════════════════════════════════════
-- 4. BACKFILL — seed concepts from existing dimension.concept_role, then bind
-- ════════════════════════════════════════════════════════════════════════
-- EXPAND step: promote the per-dimension concept_role (V18) into real Concept rows
-- and bind each dimension to the concept it implies. Strategy (Law 1, no hardcoded
-- concept names): one default ConceptScheme ('CROSS_DOMAIN') holds a concept PER
-- DIMENSION that carries a concept_role, keyed BY THE DIMENSION CODE (the dimension
-- code IS its semantic concept identity today — that is exactly the collapse V27
-- separates; the binding now makes the separation explicit and a future re-point to
-- shared concepts like REF_AREA is a pure data UPDATE). A dimension with a NULL
-- concept_role is left UNBOUND (no concept to seed — it stays legacy/unclassified).
--
-- IDEMPOTENT: the scheme + concepts INSERT ON CONFLICT DO NOTHING; the bind UPDATE
-- only sets still-NULL bindings (a dimension already bound by a prior run or by
-- authoring is never overwritten). Re-run converges to the same state.
DO $$
DECLARE
  default_scheme CONSTANT TEXT := 'CROSS_DOMAIN';
BEGIN
  -- Only create the default scheme if there is at least one role-typed dimension to
  -- seed a concept for (a corpus with zero concept_roles needs no scheme — the
  -- migration stays a pure structural add, nothing to backfill).
  IF EXISTS (SELECT 1 FROM stats.dimension WHERE concept_role IS NOT NULL) THEN
    INSERT INTO stats.concept_scheme (code, agency, version, label, metadata)
    VALUES (
      default_scheme, 'SDMX', '1.0',
      '{}'::jsonb,
      jsonb_build_object('seeded_by', 'V27-concept-backfill')
    )
    ON CONFLICT (code) DO NOTHING;

    -- One concept per role-typed dimension, code = the dimension code, concept_role
    -- copied verbatim from the dimension (the EXPAND of the duplicated value). label
    -- left '{}' (provisioning fills it; the migration invents no LocaleString).
    INSERT INTO stats.concept (scheme_code, code, label, concept_role, metadata)
    SELECT
      default_scheme,
      d.code,
      '{}'::jsonb,
      d.concept_role,
      jsonb_build_object('seeded_by', 'V27-concept-backfill')
    FROM stats.dimension d
    WHERE d.concept_role IS NOT NULL
    ON CONFLICT (scheme_code, code) DO NOTHING;

    -- Bind each still-unbound, role-typed dimension to its seeded concept. Only
    -- touches dimensions with no binding yet (re-run / pre-authored safe).
    UPDATE stats.dimension d
       SET concept_scheme_code = default_scheme,
           concept_code        = d.code
     WHERE d.concept_role IS NOT NULL
       AND d.concept_scheme_code IS NULL
       AND d.concept_code        IS NULL
       AND EXISTS (
         SELECT 1 FROM stats.concept c
          WHERE c.scheme_code = default_scheme AND c.code = d.code
       );
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 5. NO-DRIFT ASSERTION (read-only) — bound dimension role == concept role
-- ════════════════════════════════════════════════════════════════════════
-- The expand-contract invariant: while stats.dimension.concept_role lives in
-- PARALLEL with stats.concept.concept_role, a BOUND dimension's role MUST equal
-- its concept's role (no drift). The backfill guarantees this for what it seeded;
-- this read-only check fails the migration fast if any bound pair disagrees (e.g.
-- a pre-existing manual binding that contradicts the role). The fitness function
-- re-asserts this continuously; here it gates the migration itself.
DO $$
DECLARE
  drift INT;
BEGIN
  SELECT COUNT(*) INTO drift
    FROM stats.dimension d
    JOIN stats.concept c
      ON c.scheme_code = d.concept_scheme_code
     AND c.code        = d.concept_code
   WHERE d.concept_role IS DISTINCT FROM c.concept_role;

  IF drift > 0 THEN
    RAISE EXCEPTION
      'V27 no-drift: % bound dimension(s) whose concept_role disagrees with their concept''s role — resolve before relying on the concept SSOT', drift;
  END IF;
END;
$$;
