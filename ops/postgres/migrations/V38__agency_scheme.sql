-- ════════════════════════════════════════════════════════════════════════
-- V38__agency_scheme.sql — ADR (DB-08) AgencyScheme: the identity SSOT for the
--                          SDMX maintenance agency (agencyID), EXPAND-only
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V37 are applied + immutable.
--
--   THE GAP (DB-08) — the SDMX maintenance agency is NAMED EVERYWHERE and STORED
--   NOWHERE. The free-text `agency TEXT NOT NULL DEFAULT 'SDMX'` is copy-repeated on
--   stats.concept_scheme (V27) and stats.metadataflow (V31), and stats.dataset carries
--   a parallel free-text `source TEXT` ("agency / provider", V4). There is NO agency
--   table: no SSOT for what an agency IS (its code, its i18n name, its contact, its
--   parentage), no referential integrity, no way for two artefacts to share ONE agency
--   identity. Agency identity is a convention, not a contract — the same gap V13 closed
--   for locales and V27 closed for concepts.
--
--   THE DECISION — model the SDMX AgencyScheme as a first-class maintainable artefact
--   (the SAME namespace + code-identity idiom as V27 concept_scheme / V29 category_scheme
--   / V31 metadataflow), and re-point the free-text columns to it by EXPAND-ONLY
--   parallel change:
--
--     stats.agency_scheme — the AgencyScheme namespace (SDMX: one AgencyScheme
--                           'AGENCIES' holds the maintenance agencies). code = identity.
--     stats.agency        — the agency rows. id = a UUID surrogate (the stable FK
--                           target — so a re-point never depends on a mutable business
--                           code); code = the SDMX agencyID (UNIQUE business identity,
--                           'GEOSTAT' | 'SDMX'); name = an i18n LocaleString honoring the
--                           V13/V14 locale contract (the config.enforce_locale_string
--                           REQUIRED trigger — an agency always HAS a name, exactly like
--                           stats.dataset.label); contact_name/contact_email (the SDMX
--                           CONTACT concept, locale-agnostic); parent_id = a self-FK for
--                           sub-agencies (SDMX agencies nest; NULL = a root agency).
--
--     EXPAND — add a NULLABLE `agency_id UUID` FK → stats.agency(id) to the three
--     free-text carriers (stats.concept_scheme, stats.metadataflow, stats.dataset), and
--     BACKFILL every existing row to the agency whose code matches its current free-text
--     value (case-insensitive), falling back to the seeded GEOSTAT agency. The OLD TEXT
--     columns (concept_scheme.agency, metadataflow.agency, dataset.source) are KEPT — the
--     new FK lives in PARALLEL with them for the transition (read either; the FK is the
--     forward SSOT).
--
--   CONTRACT IS OUT OF SCOPE (deliberately, exactly like the MT posture). This migration
--   does NOT drop the free-text columns, does NOT set the FK NOT NULL, and does NOT force
--   any read through the FK. The DROP/NOT-NULL contract is a LATER door — taken only once
--   a SECOND agency proves the model in production (the free-text column is the reversible
--   safety net until then). data outlives code: nothing irreversible before the model is
--   validated.
--
--   NOT MULTI-TENANCY. This is PURE identity normalization (DB-08), justified TODAY with
--   zero relation to tenancy. It adds NO tenant_id, NO RLS FORCE, NO GUC, NO NOT-NULL/
--   column-drop flip. The V6 `stats.dataset.tenant_id` + `USING(true)` RLS placeholder is
--   UNTOUCHED — agency_id (identity) and tenant_id (isolation scope) are DISTINCT columns
--   with distinct jobs. That agency.id is a UUID keeps the deferred MT door open (a future
--   MT migration MAY point tenant_id at stats.agency(id)) WITHOUT designing MT here.
--
--   WHY THIS SHAPE (rationale + rejected alternatives):
--     · UUID id, not the code, is the FK target — Protected Variations: the code (agencyID)
--       is a business identifier that MAY be corrected/re-cased; the surrogate id makes the
--       binding immune to that. (concept_scheme etc. use a code PK because those codes are
--       the SDMX artefact identity read by the /structure serializer; agency is REFERENCED
--       BY id from many carriers, so a stable surrogate is the right target — Kimball.)
--     · REJECTED — "make stats.agency.code the PK and FK to it". A mutable business code as
--       a multi-carrier FK target couples every carrier to code stability; a re-case of
--       'Geostat'→'GEOSTAT' would cascade. The UNIQUE code + UUID id gives both (business
--       identity AND a stable target).
--     · REJECTED — "backfill EVERYTHING to GEOSTAT". Lossy: concept_scheme/metadataflow
--       carry agency='SDMX' (the standards maintenance agency — a real, distinct SDMX
--       agencyID that maintains the cross-domain concepts). Collapsing 'SDMX' into GEOSTAT
--       would DESTROY the distinction the free-text column faithfully records (SSOT). The
--       backfill instead maps each row to the agency matching its own text, GEOSTAT only as
--       the fallback for unmatched/NULL. Both agencies are therefore seeded.
--     · REJECTED — "one agency table, no scheme". SDMX agencies live in an AgencyScheme
--       (the maintainable-artefact namespace); mirroring concept_scheme/category_scheme
--       keeps the model uniform and lets the future /structure serializer emit a clean
--       AgencyScheme document (Law 4 — adopt SDMX whole).
--     · NOTE — V29 stats.category_scheme has NO agency column (verified: only
--       concept_scheme (V27) + metadataflow (V31) carry `agency`; dataset carries `source`).
--       There is nothing to re-point on category_scheme — it is intentionally omitted.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible; EXPAND only) ──
--   Reversibility : TWO-WAY. Two NEW PLAIN tables in the existing stats schema + three
--                   NULLABLE, no-default ADD COLUMNs (agency_id) on plain tables — each is
--                   metadata-only on PG ≥ 11 (catalog entry, no row rewrite). The backfill
--                   only POPULATES the new columns; it reshapes no existing datum and edits
--                   no free-text column. NO existing table/column/type/constraint/index/
--                   trigger/hypertable/policy is altered or dropped. In particular the V6
--                   tenant_id column + stats.dataset_tenant_isolation RLS policy are
--                   UNTOUCHED. Rollback = drop the three FK columns, drop the two new tables
--                   (below); no cube datum and no free-text agency value is touched.
--   Blast radius  : NONE on existing objects. The three new FKs are NULLABLE — a row with a
--                   NULL agency_id satisfies them trivially. NO trigger and NO column is
--                   added to stats.observation: the cube's hot write path is byte-for-byte
--                   unchanged (pre-V38). NO change to any partition key, unique index, or
--                   compression clause. The agency.name completeness trigger fires only on
--                   the NEW stats.agency table.
--   Hypertable    : UNAFFECTED. stats.agency_scheme and stats.agency are PLAIN tables;
--                   stats.observation is not touched in any way.
--   i18n          : stats.agency.name is NOT NULL and WIRED to the V13
--                   config.enforce_locale_string REQUIRED trigger (same posture as
--                   stats.dataset.label, V14) — an agency always has a complete, human-
--                   facing name. stats.agency_scheme.label is '{}'-default and NOT wired
--                   (structure-label posture, same as concept_scheme/category_scheme/
--                   metadataflow); the seed provides a real bilingual label anyway.
--   MT posture    : NO multi-tenancy built. No tenant_id, RLS, GUC, FORCE, NOT-NULL flip, or
--                   column drop. The V6 seam is preserved verbatim.
--   Rollback plan : ALTER TABLE stats.concept_scheme DROP COLUMN IF EXISTS agency_id;
--                   ALTER TABLE stats.metadataflow   DROP COLUMN IF EXISTS agency_id;
--                   ALTER TABLE stats.dataset        DROP COLUMN IF EXISTS agency_id;
--                   DROP TABLE  IF EXISTS stats.agency;
--                   DROP TABLE  IF EXISTS stats.agency_scheme;
--                   (Sacrifices only the seeded agencies + the backfilled FK bindings —
--                    re-derivable from the KEPT free-text columns on the next apply. No cube
--                    datum, and no free-text agency/source value, is touched.)
--
-- Idempotent: CREATE TABLE/INDEX ... IF NOT EXISTS · ADD COLUMN IF NOT EXISTS · ADD
-- CONSTRAINT guarded by an existence check · INSERT ... ON CONFLICT DO NOTHING · the
-- backfill only sets still-NULL agency_id (never overwrites a prior/authored binding).
-- Re-run = converge, never error. Additive only; never edits a V1-V37 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.agency_scheme — the SDMX AgencyScheme namespace (maintainable artefact)
-- ════════════════════════════════════════════════════════════════════════
-- The namespace for the maintenance agencies. code IS the identity (Law 1; a new
-- scheme = an INSERT). label defaults '{}' (structure-label posture, filled by the
-- seed / provisioning) — same posture as concept_scheme / category_scheme / metadataflow.
CREATE TABLE IF NOT EXISTS stats.agency_scheme (
  code       TEXT        PRIMARY KEY,            -- 'AGENCIES' (SDMX: the standard AgencyScheme id)
  label      JSONB       NOT NULL DEFAULT '{}',  -- i18n LocaleString (structure label; seeded below)
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats.agency_scheme IS
  'SDMX AgencyScheme (DB-08) — the namespace for the maintenance agencies (stats.agency). A maintainable artefact identified by code; the SAME identity idiom as stats.concept_scheme (V27) / stats.category_scheme (V29) / stats.metadataflow (V31). The default ''AGENCIES'' scheme = the SDMX standard AgencyScheme. label is a structure LocaleString (''{}''-default posture; the seed/provisioning fills it).';

DROP TRIGGER IF EXISTS trg_agency_scheme_updated_at ON stats.agency_scheme;
CREATE TRIGGER trg_agency_scheme_updated_at BEFORE UPDATE ON stats.agency_scheme
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.agency — the maintenance-agency rows (id = stable UUID FK target)
-- ════════════════════════════════════════════════════════════════════════
-- id  = a UUID surrogate: the STABLE target every carrier's agency_id FK points at
--       (Protected Variations — immune to a business-code re-case). gen_random_uuid()
--       from pgcrypto (V1).
-- code= the SDMX agencyID (UNIQUE business identity: 'GEOSTAT' | 'SDMX'). A new agency =
--       an INSERT (Law 1).
-- name= an i18n LocaleString, NOT NULL (an agency always has a name), wired to the V13
--       REQUIRED completeness trigger below (the stats.dataset.label posture).
-- parent_id = self-FK for sub-agencies (SDMX agencies nest); NULL = a root agency.
CREATE TABLE IF NOT EXISTS stats.agency (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_code   TEXT        NOT NULL REFERENCES stats.agency_scheme(code) ON DELETE CASCADE,
  code          TEXT        NOT NULL UNIQUE,        -- SDMX agencyID (business identity)
  name          JSONB       NOT NULL,               -- i18n LocaleString (required + complete; trigger-guarded)
  contact_name  TEXT,                               -- SDMX CONTACT concept — locale-agnostic
  contact_email TEXT,
  parent_id     UUID        REFERENCES stats.agency(id) ON DELETE SET NULL,  -- self-FK; NULL = root agency
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A node cannot be its own parent (the trivial cycle).
  CONSTRAINT agency_no_self_parent_chk CHECK (parent_id IS DISTINCT FROM id)
);

COMMENT ON TABLE stats.agency IS
  'SDMX maintenance agency (DB-08) — the identity SSOT the free-text agency/source columns re-point to. id = a stable UUID surrogate (the FK target, Protected Variations); code = the UNIQUE SDMX agencyID (business identity, Law 1); name = a required, i18n-complete LocaleString (config.enforce_locale_string, the stats.dataset.label posture). parent_id nests sub-agencies. Agency = the SDMX maintainable-artefact owner; wiring it to the V6 tenant_id (MT) is a DEFERRED, separate door — this table is identity only.';
COMMENT ON COLUMN stats.agency.id IS
  'Stable UUID surrogate — the target of every carrier''s agency_id FK (concept_scheme/metadataflow/dataset). Surrogate (not the code) so a re-case/correction of the business agencyID never cascades to the bindings. A future MT migration MAY point stats.dataset.tenant_id (V6) at this id — that is deferred MT work, not built here.';
COMMENT ON COLUMN stats.agency.code IS
  'The SDMX agencyID (UNIQUE business identity, e.g. ''GEOSTAT'', ''SDMX''). A new agency = an INSERT (Law 1). The backfill matches the free-text agency/source columns to this code (case-insensitive).';
COMMENT ON COLUMN stats.agency.name IS
  'Agency display name — a required, i18n-complete LocaleString (every active config.locale, no unknown keys), enforced by config.enforce_locale_string(''name'') (the stats.dataset.label posture). Human-facing identity shown in provenance/governance surfaces.';
COMMENT ON COLUMN stats.agency.parent_id IS
  'Self-FK to the parent agency (SDMX sub-agency nesting); NULL = a root agency. ON DELETE SET NULL — removing a parent orphans children to roots, never cascades them away. agency_no_self_parent_chk forbids the trivial self-cycle.';

-- Completeness trigger on the required i18n name (the generic V13 guard, column via
-- TG_ARGV — the SAME wiring V14 uses for stats.dataset.label). Scoped to INSERT OR
-- UPDATE OF name so a non-name write costs nothing. Attached at creation (the table is
-- brand-new — no existing rows, so no V14-style pre-flight guard is needed).
DROP TRIGGER IF EXISTS trg_agency_name_locale ON stats.agency;
CREATE TRIGGER trg_agency_name_locale
  BEFORE INSERT OR UPDATE OF name ON stats.agency
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('name');

COMMENT ON TRIGGER trg_agency_name_locale ON stats.agency IS
  'Enforces LocaleString completeness on stats.agency.name (every active locale present, no unknown keys) via config.enforce_locale_string(''name''). An agency cannot enter with a missing-language name — i18n integrity at write time, the same contract as stats.dataset.label (V14).';

-- "children of an agency" / scheme scan.
CREATE INDEX IF NOT EXISTS idx_agency_scheme ON stats.agency (scheme_code);
CREATE INDEX IF NOT EXISTS idx_agency_parent ON stats.agency (parent_id);
-- Locale-agnostic containment search over the name (mirrors the V14 label GIN indexes).
CREATE INDEX IF NOT EXISTS idx_agency_name_gin ON stats.agency USING GIN (name jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_agency_updated_at ON stats.agency;
CREATE TRIGGER trg_agency_updated_at BEFORE UPDATE ON stats.agency
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 3. SEED — the AGENCIES scheme + the two agencies the corpus references
-- ════════════════════════════════════════════════════════════════════════
-- Seeded IN the migration (not left to provisioning) so the backfill below resolves
-- against real rows and the migration applies self-sufficiently V1→V38 with every
-- re-pointed FK valid — the SAME posture as V31 seeding the ESMS_LITE metadataflow.
-- Provisioning (apps/api/scripts/seed.ts) idempotently RE-asserts GEOSTAT for the full
-- manifest; ON CONFLICT here + there makes both converge, neither fights the other.
--
--   GEOSTAT — the National Statistics Office of Georgia (the owning/authoring agency;
--             the fallback target). ROOT (parent NULL).
--   SDMX    — the SDMX standards maintenance agency that owns the cross-domain concept
--             schemes + metadataflow (agency='SDMX' on V27/V30/V31). A real, distinct
--             SDMX agencyID — seeded so the backfill maps 'SDMX' faithfully (not lossily
--             into GEOSTAT). ROOT (parent NULL — GEOSTAT is an independent national
--             agency, not an SDMX sub-agency).
--
-- Names are COMPLETE bilingual LocaleStrings (ka+en) so the trg_agency_name_locale
-- completeness trigger accepts them (an incomplete name would be rejected — the contract).
INSERT INTO stats.agency_scheme (code, label, metadata) VALUES (
  'AGENCIES',
  '{"ka":"სააგენტოების სქემა","en":"Agency Scheme"}'::jsonb,
  jsonb_build_object('seeded_by', 'V38-agency-scheme', 'basis', 'SDMX AgencyScheme (the maintenance-agency namespace)')
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO stats.agency (scheme_code, code, name, contact_name, contact_email, metadata) VALUES
  (
    'AGENCIES', 'GEOSTAT',
    '{"ka":"საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)","en":"National Statistics Office of Georgia (Geostat)"}'::jsonb,
    'Geostat National Accounts Division', 'info@geostat.ge',
    jsonb_build_object('seeded_by', 'V38-agency-scheme', 'role', 'owning/authoring agency (fallback backfill target)')
  ),
  (
    'AGENCIES', 'SDMX',
    '{"ka":"SDMX (სტანდარტების შემნახველი სააგენტო)","en":"SDMX (standards maintenance agency)"}'::jsonb,
    NULL, NULL,
    jsonb_build_object('seeded_by', 'V38-agency-scheme', 'role', 'standards maintenance agency (concept schemes / metadataflow)')
  )
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- 4. EXPAND — nullable agency_id FK → stats.agency(id) on the free-text carriers
-- ════════════════════════════════════════════════════════════════════════
-- Nullable, no-default ADD COLUMN → metadata-only on PG ≥ 11 (no row rewrite). The OLD
-- free-text column (agency / source) is KEPT alongside for the transition; the FK is the
-- forward SSOT. Only three carriers exist: concept_scheme (V27.agency), metadataflow
-- (V31.agency), dataset (V4.source). category_scheme (V29) has NO agency column.
ALTER TABLE stats.concept_scheme ADD COLUMN IF NOT EXISTS agency_id UUID;
ALTER TABLE stats.metadataflow   ADD COLUMN IF NOT EXISTS agency_id UUID;
ALTER TABLE stats.dataset        ADD COLUMN IF NOT EXISTS agency_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'concept_scheme_agency_fk'
                   AND conrelid = 'stats.concept_scheme'::regclass) THEN
    ALTER TABLE stats.concept_scheme
      ADD CONSTRAINT concept_scheme_agency_fk FOREIGN KEY (agency_id) REFERENCES stats.agency(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metadataflow_agency_fk'
                   AND conrelid = 'stats.metadataflow'::regclass) THEN
    ALTER TABLE stats.metadataflow
      ADD CONSTRAINT metadataflow_agency_fk FOREIGN KEY (agency_id) REFERENCES stats.agency(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dataset_agency_fk'
                   AND conrelid = 'stats.dataset'::regclass) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_agency_fk FOREIGN KEY (agency_id) REFERENCES stats.agency(id);
  END IF;
END;
$$;

COMMENT ON COLUMN stats.concept_scheme.agency_id IS
  'DB-08 EXPAND: the maintenance agency (stats.agency, by stable UUID id). Re-points the free-text stats.concept_scheme.agency, which is KEPT in parallel for the transition. Nullable — a CONTRACT migration (drop the TEXT column / NOT NULL) is a later door, once a 2nd agency proves the model.';
COMMENT ON COLUMN stats.metadataflow.agency_id IS
  'DB-08 EXPAND: the maintenance agency (stats.agency, by stable UUID id). Re-points the free-text stats.metadataflow.agency (KEPT in parallel). Nullable; CONTRACT deferred.';
COMMENT ON COLUMN stats.dataset.agency_id IS
  'DB-08 EXPAND: the source/owning agency (stats.agency, by stable UUID id). Re-points the free-text stats.dataset.source (KEPT in parallel). DISTINCT from stats.dataset.tenant_id (V6, the untouched MT isolation-scope placeholder): agency_id is IDENTITY, tenant_id is SCOPE. Nullable; CONTRACT deferred.';


-- ════════════════════════════════════════════════════════════════════════
-- 5. BACKFILL — map each row's free-text agency/source to a real agency, else GEOSTAT
-- ════════════════════════════════════════════════════════════════════════
-- Faithful (SSOT-preserving): first match the existing free-text value to an agency by
-- code (case-insensitive, trimmed) — so 'SDMX' → the SDMX agency, 'Geostat' → GEOSTAT.
-- Then the fallback sets any STILL-NULL binding (unmatched / NULL free-text) to GEOSTAT
-- (the owning agency). Only touches still-NULL agency_id (re-run / pre-authored safe).
DO $$
DECLARE
  geostat_id UUID;
BEGIN
  SELECT id INTO geostat_id FROM stats.agency WHERE code = 'GEOSTAT';

  -- concept_scheme.agency (free text) → agency by code
  UPDATE stats.concept_scheme cs
     SET agency_id = a.id
    FROM stats.agency a
   WHERE cs.agency_id IS NULL
     AND UPPER(TRIM(cs.agency)) = UPPER(a.code);
  UPDATE stats.concept_scheme cs SET agency_id = geostat_id WHERE cs.agency_id IS NULL;

  -- metadataflow.agency (free text) → agency by code
  UPDATE stats.metadataflow mf
     SET agency_id = a.id
    FROM stats.agency a
   WHERE mf.agency_id IS NULL
     AND UPPER(TRIM(mf.agency)) = UPPER(a.code);
  UPDATE stats.metadataflow mf SET agency_id = geostat_id WHERE mf.agency_id IS NULL;

  -- dataset.source (free text provider) → agency by code
  UPDATE stats.dataset d
     SET agency_id = a.id
    FROM stats.agency a
   WHERE d.agency_id IS NULL
     AND UPPER(TRIM(d.source)) = UPPER(a.code);
  UPDATE stats.dataset d SET agency_id = geostat_id WHERE d.agency_id IS NULL;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 6. BACKFILL-COMPLETENESS ASSERTION (read-only) — no existing row left unbound
-- ════════════════════════════════════════════════════════════════════════
-- The EXPAND invariant: after the backfill, EVERY existing row of the three carriers has
-- a valid agency_id (the GEOSTAT fallback guarantees no unmatched row). This gates the
-- migration fast if any row is still NULL (e.g. a seed race). The column stays NULLABLE
-- (a future in-transition insert may omit it) — this asserts only what the backfill just
-- populated, never a schema-level NOT NULL (that is the deferred CONTRACT).
DO $$
DECLARE
  unbound INT;
BEGIN
  SELECT (SELECT COUNT(*) FROM stats.concept_scheme WHERE agency_id IS NULL)
       + (SELECT COUNT(*) FROM stats.metadataflow   WHERE agency_id IS NULL)
       + (SELECT COUNT(*) FROM stats.dataset        WHERE agency_id IS NULL)
    INTO unbound;

  IF unbound > 0 THEN
    RAISE EXCEPTION
      'V38 backfill: % re-pointed row(s) still have a NULL agency_id after backfill (expected 0 — the GEOSTAT fallback should cover every row). Investigate before relying on the agency SSOT.', unbound;
  END IF;
END;
$$;
