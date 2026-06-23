-- ════════════════════════════════════════════════════════════════════════
-- V29__category_scheme.sql — ADR (SDMX-P1-C) CategoryScheme: a browsable theme
--                            tree categorising datasets (Constructor catalog / nav)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V28 are applied + immutable.
--
--   THE GAP (ADR SDMX-P1-C) — there is no SEMANTIC subject taxonomy. The platform
--   has config.nav_item (a SITE's presentation menu) and the cube's classifier
--   dimensions (cube axes), but no agency-level browsable theme tree ("National
--   Accounts > GDP > Annual") that categorises DATASETS. As the Constructor scales
--   past a handful of datasets it needs a catalog layer — browse-by-theme, not a
--   flat list.
--
--   THE DECISION — model the SDMX CategoryScheme as its own artefact, REUSING the
--   classifier code-chain LTREE machinery (ADR-0023, V23/V24) verbatim:
--     stats.category_scheme — the scheme header (code = identity, i18n label).
--     stats.category        — the theme nodes: code = identity within the scheme,
--                            parent_code (code-chain edge — the parent's business
--                            code within the SAME scheme; NULL = root),
--                            category_path LTREE (materialized sanitised-code chain,
--                            owned by the V29 trigger — NEVER set by hand). Reuses
--                            stats.code_to_ltree_label (V23) for the sanitiser.
--     stats.categorisation  — the Dataflow→Category link (M:N): a dataset may sit
--                            under many categories; a category holds many datasets.
--
--   WHY NOW (not deferred) + REJECTED alternatives:
--     · Tiny + reuses proven machinery — the hierarchy engine (LTREE code-chain,
--       acyclicity, sanitiser) already exists; CategoryScheme is "the same table
--       for datasets-by-theme". Highest value-to-cost of the P1 set.
--     · Directly powers two live surfaces — the Constructor dataset palette (browse
--       by theme) + the bootstrap nav (theme tree → nav). The catalog layer the
--       Constructor needs.
--     · REJECTED — reuse config.nav_item for categories. nav_item is PRESENTATION
--       (a site's menu); CategoryScheme is the SEMANTIC subject taxonomy
--       (agency-level, cross-site). Conflating them is first-tenant erosion (a
--       category is not a menu entry). The nav can be GENERATED from a scheme, but
--       they are distinct SSOTs.
--     · REJECTED — categories as classifier rows under a synthetic 'category'
--       dimension. Abuses the cube dimension model (a category is not a cube axis;
--       it never appears in a dim_key). Keep it its own artefact (Law 4 — adopt
--       CategoryScheme whole, not a hack).
--
--   CATEGORISATION → PUBLISHED DATASETS — categorisation.dataset_code is FK'd to
--   stats.dataset (existence), but the catalog PROJECTION (the /api/catalog route)
--   joins stats.dataset_published (V28) so a draft/superseded dataset never surfaces
--   in the browsable catalog even if a stale categorisation row points at it
--   (lifecycle is the projection filter — same posture as V28). The fitness function
--   asserts the catalog projection excludes non-published datasets.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY (pure addition). Three new PLAIN tables inside the
--                   existing stats schema + one FUNCTION + one TRIGGER (on the NEW
--                   stats.category table only). NO V1-V28 object is altered or
--                   dropped. Reuses stats.code_to_ltree_label (V23, IMMUTABLE) — does
--                   NOT redefine it. Rollback = drop the trigger/function + three
--                   tables; no existing object is touched.
--   Blast radius  : NONE on existing objects. FKs point INTO the new tables and into
--                   stats.dataset (categorisation.dataset_code, ON DELETE CASCADE —
--                   removing a dataset removes its categorisations, not vice versa).
--                   NO FK touches stats.observation (the hypertable cannot be an FK
--                   target — V8). NO trigger is added to stats.observation, NO column
--                   added to it: the cube's hot write path is byte-for-byte unchanged
--                   (pre-V29). NO change to the partition key / unique index /
--                   compression.
--   Hypertable    : UNAFFECTED. All three new tables are PLAIN. stats.observation is
--                   not touched.
--   Acyclicity    : the category tree is a DAG — enforced by the same code-chain
--                   guard idiom as ADR-0023: trg_category_code_path RAISES if a
--                   non-NULL parent_code has no member in the scheme (the integrity
--                   guard standing in for the impossible composite FK on a code key),
--                   and the path materialization itself cannot complete a cycle
--                   (a node's path needs its parent's path, which a cycle would
--                   leave NULL). A self-parent is rejected explicitly.
--   i18n          : label columns default to '{}' and are NOT wired to the V13
--                   completeness trigger — same posture as content_constraint /
--                   concept_scheme; provisioning fills full LocaleStrings.
--   Rollback plan : DROP TRIGGER   IF EXISTS trg_category_code_path ON stats.category;
--                   DROP FUNCTION  IF EXISTS stats.refresh_category_code_path();
--                   DROP TABLE     IF EXISTS stats.categorisation;
--                   DROP TABLE     IF EXISTS stats.category;
--                   DROP TABLE     IF EXISTS stats.category_scheme;
--                   (Sacrifices only authored taxonomy rows — re-applied from the
--                    provisioning manifest. No cube datum is touched.)
--
-- Idempotent: CREATE TABLE/INDEX/FUNCTION ... IF NOT EXISTS · CREATE OR REPLACE ·
-- DROP TRIGGER IF EXISTS + CREATE. No data seeded (STRUCTURE only; the taxonomy is
-- AUTHORED via provisioning, like the V26 allowed region). Re-run = no-op. Never
-- edits a V1-V28 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.category_scheme — the CategoryScheme header (the taxonomy namespace)
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stats.category_scheme (
  code       TEXT        PRIMARY KEY,            -- 'NAT_ACCOUNTS' | 'THEMES'
  label      JSONB       NOT NULL DEFAULT '{}',  -- i18n LocaleString (filled by provisioning)
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats.category_scheme IS
  'SDMX CategoryScheme (P1-C) — the namespace for a browsable subject taxonomy (themes) that categorises datasets. code IS the identity (Law 1). The SEMANTIC taxonomy, distinct from config.nav_item (a site''s presentation menu) — the nav may be generated from a scheme, but they are separate SSOTs.';

DROP TRIGGER IF EXISTS trg_category_scheme_updated_at ON stats.category_scheme;
CREATE TRIGGER trg_category_scheme_updated_at BEFORE UPDATE ON stats.category_scheme
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.category — the theme nodes (code-chain LTREE hierarchy, ADR-0023 idiom)
-- ════════════════════════════════════════════════════════════════════════
-- code = identity within the scheme (Law 1). parent_code is the code-chain edge —
-- the parent's business code within the SAME scheme (NULL = root). DELIBERATELY NOT
-- a self-FK on (scheme_code, parent_code): although (scheme_code, code) IS the PK
-- here (categories are not SCD-2, so a composite FK WOULD be possible) we keep the
-- ADR-0023 code-chain posture for symmetry with the classifier hierarchy and to let
-- the path trigger own integrity uniformly. category_path is the materialized
-- sanitised-code chain, owned by trg_category_code_path — NEVER set by hand.
CREATE TABLE IF NOT EXISTS stats.category (
  scheme_code   TEXT  NOT NULL REFERENCES stats.category_scheme(code) ON DELETE CASCADE,
  code          TEXT  NOT NULL,                 -- 'GDP' | 'ANNUAL' (Law 1: identity)
  label         JSONB NOT NULL DEFAULT '{}',    -- i18n LocaleString (filled by provisioning)
  parent_code   TEXT,                           -- code-chain edge within the scheme (NULL = root)
  category_path LTREE,                          -- materialized sanitised-code chain (owned by the trigger)
  ord           INT   NOT NULL DEFAULT 0,
  metadata      JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (scheme_code, code),
  -- A node cannot be its own parent (the trivial cycle; the deeper cycle is caught
  -- by the path trigger leaving category_path NULL — see the fitness function).
  CONSTRAINT category_no_self_parent_chk CHECK (parent_code IS DISTINCT FROM code)
);

COMMENT ON TABLE stats.category IS
  'SDMX Category (P1-C) — a theme node in a CategoryScheme. code IS the identity within the scheme (Law 1). parent_code = the code-chain hierarchy edge (ADR-0023 idiom, the parent''s code within the same scheme; NULL = root). category_path is the materialized sanitised-code LTREE chain, owned by trg_category_code_path (never set by hand). Acyclic — the path trigger cannot complete a cycle.';
COMMENT ON COLUMN stats.category.parent_code IS
  'The parent category''s business code within the SAME scheme (code-chain edge, ADR-0023). NULL = root. Integrity = the trg_category_code_path guard (raises if the parent has no member in the scheme) — the same posture as the classifier code-path (a code key cannot carry a composite FK uniformly with SCD-2 tables).';
COMMENT ON COLUMN stats.category.category_path IS
  'Materialized LTREE path of the SANITISED-code chain (root→node, e.g. ''NAT.GDP.ANNUAL''), reusing stats.code_to_ltree_label (V23). Owned by trg_category_code_path — never set by hand. Enables ancestor/descendant/subtree theme queries in O(log n) via the GIST index.';

-- GIST index for ancestor(@>)/descendant(<@)/subtree theme queries (mirrors the
-- classifier code_path index).
CREATE INDEX IF NOT EXISTS idx_category_code_path ON stats.category USING GIST (category_path);
-- "children of a category" / scheme scan.
CREATE INDEX IF NOT EXISTS idx_category_scheme_parent ON stats.category (scheme_code, parent_code);


-- ════════════════════════════════════════════════════════════════════════
-- 3. refresh_category_code_path — own category_path from the code chain
-- ════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT/UPDATE OF parent_code: builds category_path = parent's category_path
-- || sanitised(code), RAISING if a non-NULL parent_code has no member in the scheme
-- (the integrity guard standing in for the impossible composite FK on a code key —
-- the SAME pattern as ADR-0023 stats.refresh_classifier_code_path). The parent
-- lookup is scoped to the SAME scheme. Reuses stats.code_to_ltree_label (V23) — the
-- sanitiser is NOT redefined here (DRY; one LTREE-label sanitiser for the platform).
CREATE OR REPLACE FUNCTION stats.refresh_category_code_path()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  parent_path LTREE;
  self_label  TEXT;
BEGIN
  self_label := stats.code_to_ltree_label(NEW.code);

  IF NEW.parent_code IS NULL THEN
    NEW.category_path := self_label::LTREE;
  ELSE
    SELECT category_path INTO parent_path
      FROM stats.category
     WHERE scheme_code = NEW.scheme_code
       AND code        = NEW.parent_code;

    IF parent_path IS NULL THEN
      RAISE EXCEPTION
        'category_code_path: no parent (scheme_code=%, code=%) for child (scheme_code=%, code=%) — parent_code references a missing category (or one whose own path is not yet built)',
        NEW.scheme_code, NEW.parent_code, NEW.scheme_code, NEW.code;
    END IF;

    NEW.category_path := parent_path || self_label::LTREE;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION stats.refresh_category_code_path() IS
  'P1-C (ADR-0023 idiom): BEFORE INSERT/UPDATE OF parent_code — materializes stats.category.category_path = parent''s path || sanitised(code), reusing stats.code_to_ltree_label (V23). RAISES if a non-NULL parent_code has no category in the scheme (the integrity guard standing in for the impossible composite FK). Owns category_path — never set it by hand. A cycle cannot complete (the parent''s path would be NULL).';

DROP TRIGGER IF EXISTS trg_category_code_path ON stats.category;
CREATE TRIGGER trg_category_code_path
  BEFORE INSERT OR UPDATE OF parent_code ON stats.category
  FOR EACH ROW EXECUTE FUNCTION stats.refresh_category_code_path();

COMMENT ON TRIGGER trg_category_code_path ON stats.category IS
  'P1-C code-chain path maintainer (ADR-0023 idiom). Fires on INSERT/UPDATE OF parent_code only — a non-parent write costs nothing. Materializes category_path and enforces parent existence + acyclicity.';


-- ════════════════════════════════════════════════════════════════════════
-- 4. stats.categorisation — the Dataflow→Category link (M:N)
-- ════════════════════════════════════════════════════════════════════════
-- A dataset may be filed under many categories; a category holds many datasets. The
-- PK (scheme, category, dataset) is the natural M:N identity + the provisioning
-- idempotency key. dataset_code FK → stats.dataset (existence). The catalog
-- PROJECTION joins stats.dataset_published (V28) so a non-published dataset never
-- surfaces — lifecycle is the projection filter, not an FK to a view (you cannot FK
-- a view, and a categorisation may legitimately predate publication).
CREATE TABLE IF NOT EXISTS stats.categorisation (
  category_scheme_code TEXT NOT NULL,
  category_code        TEXT NOT NULL,
  dataset_code         TEXT NOT NULL REFERENCES stats.dataset(code) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (category_scheme_code, category_code, dataset_code),
  FOREIGN KEY (category_scheme_code, category_code)
    REFERENCES stats.category (scheme_code, code) ON DELETE CASCADE
);

COMMENT ON TABLE stats.categorisation IS
  'SDMX Categorisation (P1-C) — the M:N link from a dataset (Dataflow) to a Category. PK (scheme, category, dataset) is the M:N identity + provisioning idempotency key. dataset_code FK → stats.dataset (existence); the catalog projection joins stats.dataset_published (V28) so only PUBLISHED datasets surface — lifecycle is the projection filter (you cannot FK a view, and a categorisation may predate publication).';

-- "which categories is this dataset filed under" (the reverse lookup).
CREATE INDEX IF NOT EXISTS idx_categorisation_dataset ON stats.categorisation (dataset_code);
-- "which datasets are in this category" (the forward catalog scan).
CREATE INDEX IF NOT EXISTS idx_categorisation_category
  ON stats.categorisation (category_scheme_code, category_code);
