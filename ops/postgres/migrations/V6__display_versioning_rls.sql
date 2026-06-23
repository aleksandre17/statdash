-- ════════════════════════════════════════════════════════════════════════
-- V6__display_versioning_rls.sql — additive expansion of the stats cube
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V5 are applied + immutable.
--
--   1. stats.classifier_display      — per-member, per-locale UI overlay.
--      The bundles' display data is id+attr keyed ({label,color,fullLabel,…}),
--      decoupled from the structural classifier so an i18n/theme swap is an
--      INSERT, never an ALTER, and the engine never reads it (PRINCIPLE 1).
--      This is the SQL form of the 18-classifier-pipe.md structural/display
--      split: stats.classifier = Classifier, stats.classifier_display = DisplayMap.
--
--   2. stats.dataset_version         — monotonic per-dataset version counter
--      for HTTP ETag / cache invalidation. A bump = "this dataset's data or
--      structure changed"; the API turns it into an ETag so clients revalidate
--      cheaply (SSOT for "is my cached cube stale?").
--
--   3. Classifier codelist versioning (SCD-style, additive columns) —
--      valid_from / valid_to / is_current on stats.classifier so "the label
--      for GE changed in the 2025 release" is a new row, not a destructive
--      UPDATE that loses history. Wired (columns + partial unique index),
--      not yet enforced by ETL — matches the design doc's "SCD-2 ready" stance.
--
--   4. Row-Level-Security seam (placeholder) — a nullable tenant_id column on
--      the write-surface tables + a permissive policy, so multi-tenant RLS is
--      a future policy swap, not a schema migration. Defence-in-depth seam.
--
--   5. stats.classifier_display + dataset_version updated_at audit triggers,
--      reusing config.set_updated_at() (defined in V3).
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS /
-- DROP TRIGGER IF EXISTS throughout. No DROP of any table or column.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.classifier_display — per-member, per-locale display overlay
-- ════════════════════════════════════════════════════════════════════════
-- GRAIN (the load-bearing decision): one row per (classifier member, locale).
--   - member_id → stats.classifier(id), the SAME id space the bundles key on.
--   - locale → 'ka' | 'en' | … so a new language = INSERT rows, not ALTER.
--   - display JSONB → the open UI bag: { label, color, fullLabel, sectorOrder,
--     order, sectionId, … } — exactly DisplayMap[id] from the bundles.
--
-- Why per-member (id-keyed), NOT per-(dataset,dimension): the bundles' display
-- data is id-keyed at the classifier-member level and shared across every
-- dataset that uses that member. GDP_DISPLAY.measure['GDP'], ACCOUNTS_DISPLAY
-- .aggregates['B1G'], REGIONAL_DISPLAY.geo['1'] are all member-scoped. Keying
-- by member is the natural grain, normalizes the overlay (one home per datum,
-- SSOT), and lets resolveDisplayRef join classifier(id→code) ⋈ display[id]
-- exactly as the engine does in memory.
CREATE TABLE IF NOT EXISTS stats.classifier_display (
  member_id  BIGINT      NOT NULL REFERENCES stats.classifier(id) ON DELETE CASCADE,
  locale     TEXT        NOT NULL DEFAULT 'ka',
  display    JSONB       NOT NULL DEFAULT '{}',   -- { label, color, fullLabel, … } — open bag
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, locale)
);

COMMENT ON TABLE  stats.classifier_display IS
  'DisplayMap in SQL — per classifier-member, per-locale UI overlay (label/color/fullLabel/…). Engine never reads it; resolveDisplayRef joins classifier(id→code) ⋈ display[id]. i18n add = INSERT rows.';
COMMENT ON COLUMN stats.classifier_display.display IS
  'Open UI attribute bag, 1:1 with bundle DisplayMap[id]: { label, color, fullLabel, order, sectionId, sectorOrder, … }. Structural attrs (parent, code) live in stats.classifier, never here.';

-- Fuzzy search over the localized label (mirrors the classifier label index).
CREATE INDEX IF NOT EXISTS idx_classifier_display_label_trgm
  ON stats.classifier_display USING GIN ((display->>'label') gin_trgm_ops);

-- Locale slice — "all 'en' overlays" (per-locale export / completeness check).
CREATE INDEX IF NOT EXISTS idx_classifier_display_locale
  ON stats.classifier_display (locale);

DROP TRIGGER IF EXISTS trg_classifier_display_updated_at ON stats.classifier_display;
CREATE TRIGGER trg_classifier_display_updated_at BEFORE UPDATE ON stats.classifier_display
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. stats.dataset_version — per-dataset version counter (ETag / cache seam)
-- ════════════════════════════════════════════════════════════════════════
-- One row per dataset. `version` bumps whenever the dataset's observations or
-- structure change. The API renders ETag: W/"<dataset_code>.<version>" so a
-- client revalidate is a cheap 304 until the cube actually changes.
-- SSOT for "is my cached cube stale?" — derived, never guessed.
CREATE TABLE IF NOT EXISTS stats.dataset_version (
  dataset_code TEXT        PRIMARY KEY REFERENCES stats.dataset(code) ON DELETE CASCADE,
  version      BIGINT      NOT NULL DEFAULT 1,
  content_hash TEXT,                                -- optional strong validator (sha256 of obs digest)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  stats.dataset_version IS
  'Per-dataset monotonic version for HTTP ETag / cache invalidation. Bump on any data/structure change. API → ETag W/"<code>.<version>". SSOT for cube staleness.';
COMMENT ON COLUMN stats.dataset_version.content_hash IS
  'Optional strong ETag validator: a stable digest of the dataset observations. NULL = use the version counter (weak validator) only.';

DROP TRIGGER IF EXISTS trg_dataset_version_updated_at ON stats.dataset_version;
CREATE TRIGGER trg_dataset_version_updated_at BEFORE UPDATE ON stats.dataset_version
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

-- Idempotent bump helper. Seeds/ETL call this once after a (re)load; it both
-- creates the row on first sight and increments it thereafter. Atomic upsert
-- (INSERT … ON CONFLICT DO UPDATE) — no check-then-write race.
CREATE OR REPLACE FUNCTION stats.bump_dataset_version(
  p_dataset_code TEXT,
  p_content_hash TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
  INSERT INTO stats.dataset_version (dataset_code, version, content_hash)
  VALUES (p_dataset_code, 1, p_content_hash)
  ON CONFLICT (dataset_code) DO UPDATE
     SET version      = stats.dataset_version.version + 1,
         content_hash = COALESCE(EXCLUDED.content_hash, stats.dataset_version.content_hash),
         updated_at   = now()
  RETURNING version;
$$ LANGUAGE SQL;

COMMENT ON FUNCTION stats.bump_dataset_version(TEXT, TEXT) IS
  'Idempotent per-dataset version bump (create=1, else +1). Call once per (re)load. Atomic upsert — no check-then-write race.';


-- ════════════════════════════════════════════════════════════════════════
-- 3. Classifier codelist versioning (SCD-style, additive — wired not running)
-- ════════════════════════════════════════════════════════════════════════
-- "The label for GE changed in the 2025 release" must not destroy the prior
-- label (data outlives code). These columns let a revision be a NEW classifier
-- row (is_current=false on the old, true on the new) instead of an UPDATE.
-- ADD COLUMN IF NOT EXISTS keeps this safe to re-run.
ALTER TABLE stats.classifier ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE stats.classifier ADD COLUMN IF NOT EXISTS valid_to   DATE;
ALTER TABLE stats.classifier ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN stats.classifier.is_current IS
  'SCD-style codelist versioning: current revision of a (dim_code, code). A revision inserts a new current row and closes the old (is_current=false, valid_to set). Wired; ETL enforces when a codelist first revises.';

-- The existing UNIQUE (dim_code, code) in V4 would block a second revision of
-- the same code. We DO NOT drop it (V4 is immutable). Instead we add a partial
-- unique index that enforces "at most one CURRENT row per (dim_code, code)",
-- which is the real invariant going forward. The V4 constraint still holds for
-- single-version codes (the only ones that exist today) — they are consistent.
-- When ETL begins writing historical (is_current=false) revisions, a follow-up
-- migration (V8) will drop the V4 constraint via expand-contract. Until then,
-- this partial index is the forward-looking guard.
CREATE UNIQUE INDEX IF NOT EXISTS uq_classifier_current
  ON stats.classifier (dim_code, code)
  WHERE is_current;

-- "current members of a dimension" — the hot read once history exists.
CREATE INDEX IF NOT EXISTS idx_classifier_dim_current
  ON stats.classifier (dim_code)
  WHERE is_current;


-- ════════════════════════════════════════════════════════════════════════
-- 4. Row-Level-Security seam (multi-tenant placeholder)
-- ════════════════════════════════════════════════════════════════════════
-- A nullable tenant_id on the dataset (the aggregate root of the cube write
-- surface). Single-tenant today (all NULL); multi-tenant later = populate it +
-- swap the permissive policy for a tenant-scoped one. No table reshape needed.
ALTER TABLE stats.dataset ADD COLUMN IF NOT EXISTS tenant_id UUID;

COMMENT ON COLUMN stats.dataset.tenant_id IS
  'RLS seam (placeholder). NULL = shared/single-tenant. Multi-tenant future: populate + replace stats.dataset_tenant_isolation with a tenant-scoped USING clause (app.current_tenant GUC). Defence in depth.';

CREATE INDEX IF NOT EXISTS idx_dataset_tenant ON stats.dataset (tenant_id);

-- Enable RLS now (so the seam is live) with a permissive policy that is a no-op
-- today. Tightening it later is a policy swap, not a schema migration.
ALTER TABLE stats.dataset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dataset_tenant_isolation ON stats.dataset;
CREATE POLICY dataset_tenant_isolation ON stats.dataset
  USING (true)            -- TODO multi-tenant: (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (true);

COMMENT ON POLICY dataset_tenant_isolation ON stats.dataset IS
  'Permissive placeholder (USING true). Multi-tenant future: scope by tenant_id against the app.current_tenant GUC. Swap here, not the schema.';
