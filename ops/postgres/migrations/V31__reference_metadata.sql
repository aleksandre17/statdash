-- ════════════════════════════════════════════════════════════════════════
-- V31__reference_metadata.sql — ADR SDMX-P1-D Reference Metadata (ESMS-lite)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V30 are applied + immutable.
--
--   THE GAP (ADR SDMX-P1-D, chief-engineer F8) — the Law-9 data-integrity badges
--   (methodology link · last-updated · source · revision/quality note: ONS / IMF /
--   Eurostat) are today backed by AD-HOC signals: stats.dataset.metadata JSONB
--   (free-text, unvalidated, not i18n-complete) plus the per-observation OBS_STATUS
--   preliminary flag (V8). There is NO STRUCTURED, i18n, queryable home for the
--   STANDING reference metadata of a dataset — methodology, source/provenance,
--   coverage, quality, contact, and the authoritative "last updated" date. The
--   engine's MetadataPort / ProvenanceRecord (packages/core/src/core/provenance.ts:
--   { status, lastUpdated, source, vintage, note, methodology }) already DEFINES the
--   structured shape the badges consume — but the api can only project `status`
--   (from OBS_STATUS) and `version`; the other fields have no SSOT to read from.
--
--   THE DECISION — model SDMX Reference Metadata as a first-class artefact, in the
--   PRAGMATIC dataset-level slice (NOT the full ESMS ~21-concept / ESQRS quality
--   predicate-row engine — that is the deferred door, see §DEFERRED below):
--
--     stats.metadataflow      — the SDMX Metadataflow: the namespace/template a
--                               reference-metadata report conforms to, a maintainable
--                               artefact identified by code + agency + version (the
--                               SAME maintainable-artefact identity idiom as V27
--                               concept_scheme / V29 category_scheme). One default
--                               'ESMS_LITE' flow is seeded — the Euro-SDMX Metadata
--                               Structure, thinned to the fields the badge needs.
--
--     stats.reference_metadata — the SDMX MetadataSet rows: ONE structured report
--                               attached to a TARGET (a dataset now; a dimension or a
--                               classifier member later — the door is the nullable
--                               target columns + the target_type discriminant). It
--                               carries the STRUCTURED, i18n (LocaleString/JSONB,
--                               consistent with V13/V14) attributes the
--                               ProvenanceRecord projects: methodology, source,
--                               coverage, quality, contact — plus the first-class
--                               `last_updated` DATE (the badge's authoritative
--                               last-updated) and a free `note`. SCD-2 VERSIONED
--                               (is_current + valid_from/valid_to + revision) because
--                               reference metadata REVISES and the revision history
--                               must survive (data outlives code; the "last updated"
--                               story is meaningless without a vintage chain).
--
--   TARGET POLYMORPHISM (Law 1 — no privileged dimension). A report targets one of:
--     · 'dataset'   → dataset_code  (FK stats.dataset)        — the slice built NOW.
--     · 'dimension' → dimension_code (FK stats.dimension)     — door open (nullable).
--     · 'classifier'→ dimension_code + member_code            — door open (nullable).
--   The dimension is a GENERIC FK to stats.dimension(code) — never a hardcoded
--   dimension name (Law 1). reference_metadata_target_chk makes the
--   (target_type ⇄ which target columns are populated) coupling unrepresentable when
--   wrong (make-illegal-states-unrepresentable / fail-fast at write).
--
--   WHY THIS SHAPE (rationale + rejected alternatives):
--     · FOLDS INTO the existing badge story (no parallel metadata system). The
--       structured columns are EXACTLY the ProvenanceRecord fields the MetadataPort
--       already feeds the badge — the api serve endpoint reads this table and emits
--       the same shape resolvePreliminary / PanelTitleHost already consume. SSOT for
--       "the dataset's standing reference metadata".
--     · REJECTED — "keep stuffing stats.dataset.metadata JSONB". Not i18n-validated
--       (V14 guards label, not the metadata bag), not SCD-2 (no revision history /
--       last-updated vintage), not target-polymorphic (cannot attach to a dimension),
--       not a maintainable artefact the future SDMX /structure + RM serializer (P1-F)
--       could emit. Free text is a convention, not a contract (the same gap V13 closed
--       for labels). Rejected: SSOT + Law 4 (adopt SDMX Reference Metadata whole).
--     · REJECTED — the FULL ESMS predicate-row engine NOW (stats.metadata_attribute:
--       the ~21-concept ESMS tree + ESQRS quality as content_constraint-shape rows).
--       That is the documented door — large surface, and there is no ESMS report
--       CONSUMER yet (no metadata panel, no SDMX-RM export). YAGNI until the second
--       caller. The pragmatic typed-column slice covers 100% of the badge need today
--       and the metadataflow_code FK is the seam the predicate-row engine slots behind
--       additively (a flow whose attributes live in the future table, not in columns).
--     · REJECTED — one row per (target, attribute) key/value NOW. Over-modelled for a
--       fixed, small, typed attribute set the badge consumes by name; the typed-column
--       MetadataSet is the minimal shape (Occam) and stays i18n-complete per column.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY (pure addition). Two NEW PLAIN tables inside the existing
--                   stats schema. NO column is added to any existing table; NO V1-V30
--                   object — table, column, type, constraint, index, trigger,
--                   hypertable, policy, view, or function — is altered or dropped. The
--                   seed INSERTs only POPULATE the new tables (ON CONFLICT DO NOTHING),
--                   reshaping no existing datum. Rollback = DROP the two new tables.
--   Blast radius  : NONE on existing objects. stats.metadataflow and
--                   stats.reference_metadata are PLAIN tables. NO trigger and NO column
--                   is added to stats.observation: the cube's hot write path is
--                   byte-for-byte unchanged (pre-V31). NO change to the partition key,
--                   unique index, or compression. The FKs target stats.dataset /
--                   stats.dimension (PLAIN tables); they validate only NEW rm rows.
--   Hypertable    : UNAFFECTED. stats.observation is not touched in any way.
--   i18n          : the structured attribute columns are LocaleString JSONB defaulting
--                   '{}'. They are WIRED to the V13 config.enforce_locale_string
--                   completeness trigger (parameterized per column via TG_ARGV) — UNLIKE
--                   V26/V27 structure tables, because reference metadata is HUMAN-FACING
--                   CONTENT shown in the methodology/source UI (a half-translated
--                   methodology blanks the badge for one locale, exactly the V13/V14
--                   failure mode), so completeness must hold the same as for labels.
--                   A NULL/'{}' attribute is OPTIONAL (a report need not carry every
--                   field); the trigger only rejects a PRESENT-but-incomplete value
--                   (config.validate_locale_string treats '{}' as valid — no active
--                   locale has a key, so the "no unknown key" clause passes and the
--                   "every active locale present" clause… would FAIL for '{}'). See §3:
--                   the per-column guard is config.enforce_locale_string_optional, a
--                   NULL/empty-passing variant, so an OMITTED field is allowed but a
--                   PROVIDED field must be locale-complete. (last_updated/contact_* are
--                   not LocaleStrings — a date and a name/email are locale-agnostic.)
--   Rollback plan : DROP TABLE IF EXISTS stats.reference_metadata;
--                   DROP TABLE IF EXISTS stats.metadataflow;
--                   DROP FUNCTION IF EXISTS config.enforce_locale_string_optional();
--                   (Sacrifices only the seeded metadataflow + any authored reports —
--                    re-seedable; no cube datum is touched.)
--
-- Idempotent: CREATE TABLE/INDEX ... IF NOT EXISTS · CREATE OR REPLACE FUNCTION ·
-- ADD CONSTRAINT guarded by an existence check · INSERT ... ON CONFLICT DO NOTHING.
-- Re-run = converge, never error. Additive only; never edits a V1-V30 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. config.enforce_locale_string_optional() — NULL/empty-passing completeness guard
-- ════════════════════════════════════════════════════════════════════════
-- The V13 config.enforce_locale_string() rejects a column that is not a COMPLETE
-- LocaleString — correct for a REQUIRED label (every dataset HAS a name). But a
-- reference-metadata attribute is OPTIONAL: a report may omit `coverage` entirely.
-- An omitted field is NULL or '{}' (no keys). We must allow OMISSION yet still reject
-- a PROVIDED-but-half-translated value (the V13/V14 contract for what IS present).
--
-- This generic guard (same TG_ARGV[0] column-name idiom as V13) PASSES when the
-- value is NULL or has zero keys ('{}'), and otherwise defers to the V13
-- config.validate_locale_string completeness rule. One function, reusable by any
-- future optional-LocaleString column (DRY). DEFINED in config (its home schema).
CREATE OR REPLACE FUNCTION config.enforce_locale_string_optional()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  col_name TEXT := TG_ARGV[0];
  val      JSONB;
BEGIN
  EXECUTE format('SELECT ($1).%I', col_name) INTO val USING NEW;
  -- OMITTED (NULL) or EMPTY ('{}') → optional field absent → allowed.
  IF val IS NULL OR val = '{}'::jsonb THEN
    RETURN NEW;
  END IF;
  -- PRESENT → must be a complete LocaleString (V13 rule: no unknown key + every
  -- active locale present). A half-translated methodology is rejected at write.
  IF NOT config.validate_locale_string(val) THEN
    RAISE EXCEPTION 'locale_string_invalid: optional column % is present but not a complete LocaleString (every active locale, no unknown keys). value: %',
      col_name, val;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION config.enforce_locale_string_optional() IS
  'Generic BEFORE INSERT/UPDATE guard for an OPTIONAL LocaleString column (TG_ARGV[0] = column name). Passes when the value is NULL or ''{}'' (field omitted); otherwise enforces config.validate_locale_string completeness (the V13 rule for what IS present). DRY companion to config.enforce_locale_string for optional content columns (V31 reference metadata).';


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.metadataflow — the SDMX Metadataflow (the report template namespace)
-- ════════════════════════════════════════════════════════════════════════
-- An SDMX Metadataflow names the STRUCTURE a reference-metadata report conforms to —
-- the maintainable artefact (code + agency + version) a MetadataSet declares against,
-- exactly as a Dataflow names a data structure. We seed ONE default flow 'ESMS_LITE'
-- (the Euro-SDMX Metadata Structure, thinned to the badge fields). label defaults
-- '{}' and is filled by provisioning (same posture as concept_scheme / category_scheme
-- STRUCTURE tables — a flow code is machine identity; its label is authored content).
CREATE TABLE IF NOT EXISTS stats.metadataflow (
  code       TEXT        PRIMARY KEY,            -- 'ESMS_LITE' (Law 1: identity; a new flow = an INSERT)
  agency     TEXT        NOT NULL DEFAULT 'SDMX',
  version    TEXT        NOT NULL DEFAULT '1.0',
  label      JSONB       NOT NULL DEFAULT '{}',  -- i18n LocaleString (filled by provisioning)
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats.metadataflow IS
  'SDMX Metadataflow (P1-D) — the template/namespace a reference-metadata report (stats.reference_metadata MetadataSet) conforms to. A maintainable artefact (code + agency + version), the SAME identity idiom as stats.concept_scheme (V27) / stats.category_scheme (V29). The default ''ESMS_LITE'' flow = the Euro-SDMX Metadata Structure thinned to the Law-9 badge fields. The seam the deferred full-ESMS predicate-row attribute engine slots behind (a flow whose attributes live in a future table).';
COMMENT ON COLUMN stats.metadataflow.agency IS
  'SDMX maintenance agency (e.g. SDMX, ESTAT). Part of the maintainable-artefact identity; lets two agencies'' same-coded flows be distinguished by the future /structure serializer.';

DROP TRIGGER IF EXISTS trg_metadataflow_updated_at ON stats.metadataflow;
CREATE TRIGGER trg_metadataflow_updated_at BEFORE UPDATE ON stats.metadataflow
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 3. stats.reference_metadata — the SDMX MetadataSet (SCD-2, target-keyed)
-- ════════════════════════════════════════════════════════════════════════
-- ONE structured reference-metadata report attached to a TARGET. SCD-2 versioned:
-- a revision INSERTs a new row (is_current=true) and the prior current row is closed
-- (is_current=false, valid_to set) — the revision history survives (data outlives
-- code; the badge's "last updated" is meaningless without the vintage chain). The
-- structured attribute columns are EXACTLY the engine ProvenanceRecord fields the
-- MetadataPort feeds the badge (methodology/source/coverage/quality + last_updated +
-- note) — folding into the existing badge story, not a parallel system.
CREATE TABLE IF NOT EXISTS stats.reference_metadata (
  id                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ── Metadataflow binding (the report's structure/template) ──────────────
  metadataflow_code  TEXT        NOT NULL REFERENCES stats.metadataflow(code),

  -- ── Target polymorphism (Law 1 — no privileged dimension) ───────────────
  -- target_type discriminates which target columns are populated; the CHECK below
  -- makes a mismatched combination unrepresentable (fail-fast at write).
  target_type        TEXT        NOT NULL DEFAULT 'dataset',   -- 'dataset' | 'dimension' | 'classifier'
  dataset_code       TEXT        REFERENCES stats.dataset(code)   ON DELETE CASCADE,
  dimension_code     TEXT        REFERENCES stats.dimension(code) ON DELETE CASCADE,  -- generic FK (Law 1)
  member_code        TEXT,                                       -- classifier member (no FK: SCD-2 codelist, ADR-0023 posture)

  -- ── Structured i18n reference-metadata attributes (ESMS-lite) ───────────
  -- LocaleString JSONB, optional (defaults '{}'), guarded by the optional-locale
  -- trigger (§ below). These are the ProvenanceRecord content fields the badge shows.
  methodology        JSONB       NOT NULL DEFAULT '{}',  -- methodology / compilation notes (the ℹ link + body)
  source             JSONB       NOT NULL DEFAULT '{}',  -- source / provenance ("Geostat National Accounts")
  coverage           JSONB       NOT NULL DEFAULT '{}',  -- statistical coverage / population / scope
  quality            JSONB       NOT NULL DEFAULT '{}',  -- quality / accuracy / revision note
  note               JSONB       NOT NULL DEFAULT '{}',  -- free-text provenance note (tooltip)

  -- ── Non-localised provenance fields ─────────────────────────────────────
  last_updated       DATE,                               -- the badge's authoritative "last updated" (ISO date)
  contact_name       TEXT,                               -- contact (SDMX CONTACT concept) — locale-agnostic
  contact_email      TEXT,
  methodology_url    TEXT,                               -- external methodology page (drives the ℹ link href)

  -- ── SCD-2 vintage chain (reference metadata revises) ────────────────────
  revision           INT         NOT NULL DEFAULT 1,     -- monotonic per target
  is_current         BOOLEAN     NOT NULL DEFAULT true,
  valid_from         TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to           TIMESTAMPTZ,                        -- NULL ⟺ is_current
  metadata           JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- target_type ⇄ populated-target-columns coupling (make-illegal-states-unrepresentable)
  CONSTRAINT reference_metadata_target_chk CHECK (
    (target_type = 'dataset'    AND dataset_code IS NOT NULL AND dimension_code IS NULL AND member_code IS NULL)
    OR (target_type = 'dimension'  AND dimension_code IS NOT NULL AND dataset_code IS NULL AND member_code IS NULL)
    OR (target_type = 'classifier' AND dimension_code IS NOT NULL AND member_code IS NOT NULL AND dataset_code IS NULL)
  ),
  -- SCD-2 integrity: a current row is open (valid_to NULL); a closed row is not current.
  CONSTRAINT reference_metadata_current_chk CHECK ((valid_to IS NULL) = is_current)
);

COMMENT ON TABLE stats.reference_metadata IS
  'SDMX MetadataSet (P1-D, ESMS-lite) — ONE structured reference-metadata report attached to a target (dataset now; dimension/classifier the open door). SCD-2 versioned (is_current + valid_from/valid_to + revision) so the revision history + last-updated vintage survive (data outlives code). The structured columns ARE the engine ProvenanceRecord fields (provenance.ts) the MetadataPort feeds the Law-9 methodology/source/last-updated/quality badge — folds into the badge story, not a parallel system.';
COMMENT ON COLUMN stats.reference_metadata.target_type IS
  'Polymorphic target discriminant: ''dataset'' | ''dimension'' | ''classifier''. reference_metadata_target_chk ties it to exactly which of dataset_code / dimension_code / member_code are populated (make-illegal-states-unrepresentable). Law 1: dimension_code is a generic FK to stats.dimension, never a hardcoded dimension name.';
COMMENT ON COLUMN stats.reference_metadata.methodology IS
  'i18n LocaleString — methodology / compilation notes. Optional (''{}'' = omitted); when present must be locale-complete (config.enforce_locale_string_optional). Projected to ProvenanceRecord.methodology (the badge ℹ link body).';
COMMENT ON COLUMN stats.reference_metadata.last_updated IS
  'The authoritative "last updated" date (ISO 8601) the Law-9 last-updated badge shows. Distinct from stats.release.published_at (the data vintage, V25) and dataset_version (the ETag, V6) — this is the METADATA''s last-updated, a separate SSOT. Locale-agnostic (a date).';
COMMENT ON COLUMN stats.reference_metadata.is_current IS
  'SCD-2 current-version flag. Exactly one current row per target (uq_reference_metadata_current). A revision closes the prior current row (is_current=false, valid_to=now()) and inserts a new is_current=true row — the history is preserved, not overwritten.';
COMMENT ON COLUMN stats.reference_metadata.metadataflow_code IS
  'The SDMX Metadataflow this report conforms to (stats.metadataflow). The seam the deferred full-ESMS predicate-row attribute engine slots behind additively (a flow whose attributes live in a future stats.metadata_attribute table, not in these typed columns).';

-- Exactly ONE current report per DATASET target. Partial unique index over the
-- dataset target (PG16 partial unique idiom, same as uq_locale_single_default V13).
-- The dimension/classifier targets get their own current-uniqueness when those doors
-- open (a separate partial index per target_type — additive, not built now: YAGNI).
CREATE UNIQUE INDEX IF NOT EXISTS uq_reference_metadata_current_dataset
  ON stats.reference_metadata (dataset_code)
  WHERE is_current AND target_type = 'dataset';

-- The hot serve read: "the current report for this dataset" (the badge read).
CREATE INDEX IF NOT EXISTS idx_reference_metadata_dataset_current
  ON stats.reference_metadata (dataset_code) WHERE is_current;

-- ── i18n completeness on the optional content columns (V13 guard, optional variant) ──
-- WHY wired (unlike V26/V27 structure tables): these are HUMAN-FACING CONTENT shown in
-- the methodology/source UI — a half-translated value blanks the badge for one locale
-- (the exact V13/V14 failure mode). The OPTIONAL variant lets a report omit a field
-- (NULL/'{}') yet rejects a PROVIDED-but-incomplete one. One trigger per content column
-- (the V13 column-name-via-TG_ARGV idiom). Scoped to INSERT OR UPDATE OF <col>.
DROP TRIGGER IF EXISTS trg_reference_metadata_methodology ON stats.reference_metadata;
CREATE TRIGGER trg_reference_metadata_methodology
  BEFORE INSERT OR UPDATE OF methodology ON stats.reference_metadata
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string_optional('methodology');

DROP TRIGGER IF EXISTS trg_reference_metadata_source ON stats.reference_metadata;
CREATE TRIGGER trg_reference_metadata_source
  BEFORE INSERT OR UPDATE OF source ON stats.reference_metadata
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string_optional('source');

DROP TRIGGER IF EXISTS trg_reference_metadata_coverage ON stats.reference_metadata;
CREATE TRIGGER trg_reference_metadata_coverage
  BEFORE INSERT OR UPDATE OF coverage ON stats.reference_metadata
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string_optional('coverage');

DROP TRIGGER IF EXISTS trg_reference_metadata_quality ON stats.reference_metadata;
CREATE TRIGGER trg_reference_metadata_quality
  BEFORE INSERT OR UPDATE OF quality ON stats.reference_metadata
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string_optional('quality');

DROP TRIGGER IF EXISTS trg_reference_metadata_note ON stats.reference_metadata;
CREATE TRIGGER trg_reference_metadata_note
  BEFORE INSERT OR UPDATE OF note ON stats.reference_metadata
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string_optional('note');


-- ════════════════════════════════════════════════════════════════════════
-- 4. SEED — the default ESMS_LITE metadataflow (idempotent)
-- ════════════════════════════════════════════════════════════════════════
-- The default flow every dataset report conforms to. label is a COMPLETE LocaleString
-- (this is the ONE seeded content row, and metadataflow.label is NOT trigger-guarded —
-- it is a structure label, '{}'-default posture — but we seed a real bilingual label so
-- the future RM serializer has a name). A representative dataset REPORT is seeded by the
-- provisioning/seed script (apps/api/scripts/seed.ts), NOT here — reports are CONTENT
-- (i18n, revisable), the same structure-vs-data split as V7 (DSD in migration) vs
-- seed.ts (members/displays/observations). One report row in a migration would also be
-- un-revisable by the SCD-2 path (a migration cannot be re-run to bump a revision).
INSERT INTO stats.metadataflow (code, agency, version, label, metadata)
VALUES (
  'ESMS_LITE', 'SDMX', '1.0',
  '{"ka":"მეტამონაცემთა ნაკადი (ESMS-მსუბუქი)","en":"Reference Metadata (ESMS-lite)"}'::jsonb,
  jsonb_build_object('seeded_by', 'V31-reference-metadata', 'basis', 'Euro-SDMX Metadata Structure (ESMS), thinned to the Law-9 badge fields')
)
ON CONFLICT (code) DO NOTHING;
