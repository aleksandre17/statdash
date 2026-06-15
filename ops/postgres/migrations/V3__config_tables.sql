-- ════════════════════════════════════════════════════════════════════════
-- V3__config_tables.sql — `config` schema: Constructor output
-- ════════════════════════════════════════════════════════════════════════
-- Stores what the Panel/Constructor wizard produces:
--   Layer 1 (Data)  → config.data_source, config.data_spec
--   Layer 2 (Site)  → config.site_config, config.nav_item
--   Layer 3 (Pages) → config.page, config.page_version
--
-- Domain model mirrors apps/panel/src/types/constructor.ts:
--   DataSourceDef → data_source · NamedDataSpec → data_spec
--   SiteDef       → site_config (+ nav_item) · CanvasPage → page (+ page_version)
--
-- Idempotent: CREATE ... IF NOT EXISTS throughout; no DROP. Re-running this
-- script against a populated volume is a no-op.

-- ── Shared trigger: auto-maintain updated_at ────────────────────────────
-- One function, reused by every table that has an updated_at column.
-- CREATE OR REPLACE is idempotent and lets us evolve the body safely.
CREATE OR REPLACE FUNCTION config.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION config.set_updated_at() IS
  'BEFORE UPDATE trigger: stamps updated_at = now(). Row-level audit (P: integrity).';


-- ── config.site_config — site-level key/value settings ──────────────────
-- SiteDef scalar fields (name, logo, defaultLocale, themeOverrides) flattened
-- to typed JSONB values. Key/value (not columns) so the Constructor can add a
-- new setting without a migration — open for extension, schema unchanged.
CREATE TABLE IF NOT EXISTS config.site_config (
  key        TEXT        PRIMARY KEY,                 -- 'name' | 'logo' | 'default_locale' | 'theme_overrides'
  value      JSONB       NOT NULL,                    -- typed JSON: "ka", {...}, ["..."]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE config.site_config IS 'Site-level settings as typed key/value (SiteDef scalars). Extensible without migration.';


-- ── config.page — a Constructor-built page (CanvasPage identity) ─────────
-- Holds page identity only; the editable NodeDef tree lives in page_version
-- so every save is an immutable version (history / rollback).
CREATE TABLE IF NOT EXISTS config.page (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,             -- URL path segment, e.g. 'gdp'
  title      JSONB       NOT NULL,                    -- multilingual: {"ka":"მშპ","en":"GDP"}
  status     TEXT        NOT NULL DEFAULT 'draft',    -- lifecycle FSM, see CHECK below
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Lifecycle as a constraint, not a convention: illegal states unrepresentable.
  CONSTRAINT page_status_chk CHECK (status IN ('draft', 'published', 'archived'))
);

COMMENT ON TABLE  config.page        IS 'Page identity + lifecycle status. Editable tree snapshots live in config.page_version.';
COMMENT ON COLUMN config.page.status IS 'Lifecycle FSM: draft → published → archived. Enforced by page_status_chk.';


-- ── config.page_version — immutable NodeDef tree snapshots ──────────────
-- Every Constructor save = one new version row (append-only). Enables history,
-- diff and rollback. version_number is monotonic per page (assigned by the
-- BEFORE INSERT trigger below — no app-side race on max()+1).
CREATE TABLE IF NOT EXISTS config.page_version (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id        UUID        NOT NULL REFERENCES config.page(id) ON DELETE CASCADE,
  version_number INT         NOT NULL,                -- 1-based, per page; trigger-assigned
  config         JSONB       NOT NULL,                -- full CanvasPage NodeDef tree
  data_specs     JSONB       NOT NULL DEFAULT '[]',   -- NamedDataSpec[] snapshot (point-in-time)
  is_published   BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_version_unique UNIQUE (page_id, version_number)
);
-- No updated_at: versions are immutable by design (append-only audit log).

COMMENT ON TABLE  config.page_version              IS 'Append-only snapshots of a page''s NodeDef tree. One row per save = history + rollback.';
COMMENT ON COLUMN config.page_version.version_number IS 'Monotonic per page, assigned by config.assign_version_number() trigger (no app-side max()+1 race).';

-- Assign the next version_number atomically inside the INSERT.
-- COALESCE(max)+1 under the row lock the INSERT already holds on the parent
-- FK avoids the classic check-then-insert race for per-page sequences.
CREATE OR REPLACE FUNCTION config.assign_version_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO NEW.version_number
      FROM config.page_version
     WHERE page_id = NEW.page_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── config.data_source — external data connections (DataSourceDef) ──────
CREATE TABLE IF NOT EXISTS config.data_source (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL,                    -- 'sdmx-json' | 'rest' | 'static'
  url        TEXT,
  config     JSONB       NOT NULL DEFAULT '{}',       -- connection params (DataSourceDef.config)
  status     TEXT        NOT NULL DEFAULT 'idle',     -- ConnectionStatus
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_source_type_chk   CHECK (type   IN ('sdmx-json', 'rest', 'static')),
  CONSTRAINT data_source_status_chk CHECK (status IN ('idle', 'connected', 'error', 'pending'))
);

COMMENT ON TABLE config.data_source IS 'External data connections (DataSourceDef). status mirrors ConnectionStatus enum.';


-- ── config.data_spec — named, reusable DataSpec definitions (NamedDataSpec) ──
CREATE TABLE IF NOT EXISTS config.data_spec (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  spec        JSONB       NOT NULL,                   -- the DataSpec JSON (one of the 9 catalog types)
  -- SET NULL (not CASCADE): deleting a source must not silently delete the
  -- specs that referenced it — they survive, orphaned, and can be re-pointed.
  source_id   UUID        REFERENCES config.data_source(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  config.data_spec      IS 'Named reusable DataSpec (NamedDataSpec). spec = one of the 9 spec-catalog types.';
COMMENT ON COLUMN config.data_spec.spec IS 'JSON-serializable DataSpec. type discriminant ∈ {query,row-list,timeseries,growth,ratio-list,by-mode,pivot,transform,custom}.';


-- ── config.nav_item — navigation tree (NavItem, self-referential) ───────
CREATE TABLE IF NOT EXISTS config.nav_item (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: removing a parent removes its subtree (a nav branch is one unit).
  parent_id  UUID        REFERENCES config.nav_item(id) ON DELETE CASCADE,
  -- SET NULL: deleting a page must not delete the nav node; it becomes a
  -- dangling label the editor can re-link or remove.
  page_id    UUID        REFERENCES config.page(id) ON DELETE SET NULL,
  label      JSONB       NOT NULL,                    -- multilingual: {"ka":"...","en":"..."}
  href       TEXT,                                    -- external link (mutually exclusive with page_id)
  ord        INT         NOT NULL DEFAULT 0,          -- sibling order (NavItem.order)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A nav item targets EITHER an internal page OR an external href, never both.
  CONSTRAINT nav_item_target_chk CHECK (page_id IS NULL OR href IS NULL)
);

COMMENT ON TABLE config.nav_item IS 'Self-referential navigation tree (NavItem). Targets a page_id OR an external href, never both.';


-- ── Triggers ────────────────────────────────────────────────────────────
-- updated_at maintenance on all mutable config tables.
-- DROP IF EXISTS + CREATE = idempotent trigger (re)installation.
DROP TRIGGER IF EXISTS trg_site_config_updated_at ON config.site_config;
CREATE TRIGGER trg_site_config_updated_at BEFORE UPDATE ON config.site_config
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_page_updated_at ON config.page;
CREATE TRIGGER trg_page_updated_at BEFORE UPDATE ON config.page
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_data_source_updated_at ON config.data_source;
CREATE TRIGGER trg_data_source_updated_at BEFORE UPDATE ON config.data_source
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_data_spec_updated_at ON config.data_spec;
CREATE TRIGGER trg_data_spec_updated_at BEFORE UPDATE ON config.data_spec
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_nav_item_updated_at ON config.nav_item;
CREATE TRIGGER trg_nav_item_updated_at BEFORE UPDATE ON config.nav_item
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

-- version_number assignment (BEFORE INSERT) on page_version.
DROP TRIGGER IF EXISTS trg_page_version_assign_number ON config.page_version;
CREATE TRIGGER trg_page_version_assign_number BEFORE INSERT ON config.page_version
  FOR EACH ROW EXECUTE FUNCTION config.assign_version_number();


-- ── Indexes — every FK column gets one (avoids seq-scan on cascades/joins) ──
CREATE INDEX IF NOT EXISTS idx_page_version_page_id ON config.page_version (page_id);
CREATE INDEX IF NOT EXISTS idx_data_spec_source_id  ON config.data_spec   (source_id);
CREATE INDEX IF NOT EXISTS idx_nav_item_parent_id   ON config.nav_item    (parent_id);
CREATE INDEX IF NOT EXISTS idx_nav_item_page_id     ON config.nav_item    (page_id);

-- Partial index: fast "the published version of page X" lookup (the hot read).
CREATE INDEX IF NOT EXISTS idx_page_version_published
  ON config.page_version (page_id)
  WHERE is_published;

-- Status filter on the page list (Constructor dashboard: drafts vs published).
CREATE INDEX IF NOT EXISTS idx_page_status ON config.page (status);
