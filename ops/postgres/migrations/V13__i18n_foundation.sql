-- ════════════════════════════════════════════════════════════════════════
-- V13__i18n_foundation.sql — i18n foundation: locale registry + LocaleString
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V12 are applied + immutable.
--
--   The cube speaks two languages today via `label JSONB {"ka":…,"en":…}`
--   columns scattered across stats.* and config.* (V3, V4). But there is no
--   AUTHORITY for what a valid locale IS: no registry, no fallback chain, no
--   completeness rule, no BCP 47 source of truth. A typo'd key ({"kk":…}) or a
--   half-translated row ({"ka":…} with no "en") enters silently and surfaces as
--   a blank label in the UI. i18n is currently a convention, not a contract.
--
--   This migration lays the FOUNDATION (read-only side effects on V1-V12):
--
--     1. config.locale — the SSOT locale registry. BCP 47 primary subtags
--        ('ka','en') as the PK, native + English names, a self-FK fallback
--        chain (ka → en → root), an ICU locale for collation, exactly-one
--        default (partial unique index), and an is_active flag that drives
--        completeness. A new language = an INSERT here, never a schema change.
--
--     2. config.validate_locale_string(label) — the completeness + key-sanity
--        predicate. TRUE iff no unknown keys AND every ACTIVE locale present.
--
--     3. config.resolve_label(label, preferred) — the fallback walker. Returns
--        the best available text for a reader, walking the registry chain,
--        cycle-guarded, with a last-resort to any active locale then any key.
--
--     4. config.enforce_locale_string() — a GENERIC trigger function (column
--        name via TG_ARGV[0]) that rejects an incomplete/invalid write. It is
--        DEFINED here but ATTACHED to no table — wiring is V14 (expand here,
--        contract there: foundation must exist and be tested before enforcement).
--
--     5. ICU collations (config.ka_icu / config.en_icu) for correct
--        language-aware sorting, and per-locale FTS configurations
--        (config.ka / config.en) for localized full-text search.
--
--   KEYS STAY 'ka'/'en' (short subtags) — BCP 47 compliant, SDMX-aligned, and
--   matching every existing label payload, so ZERO data migration is needed.
--
-- ── 09 §B RISK GATE (Class-A additive migration) ────────────────────────
--   Reversibility : TWO-WAY. Every object created here is NEW — the rollback
--                   DROPs remove 100% of it. The only touch to existing schema
--                   is creating new objects INSIDE the existing `config` schema;
--                   no V1-V12 table/column/type/constraint/index is altered.
--                   Attaching the enforcement triggers to existing tables is
--                   deliberately DEFERRED to V14 (parallel change: build, then
--                   enforce), so V13 cannot break any existing write path.
--   Blast radius  : NONE on V1-V12 objects. config.locale is a brand-new table
--                   in the existing config schema. No trigger fires on any
--                   existing table (none attached yet). Reads + writes to
--                   stats.* / config.* behave exactly as before V13.
--   Rollback plan : DROP TABLE config.locale CASCADE;
--                   DROP FUNCTION config.validate_locale_string(JSONB);
--                   DROP FUNCTION config.resolve_label(JSONB, TEXT);
--                   DROP FUNCTION config.enforce_locale_string();
--                   DROP COLLATION IF EXISTS config.ka_icu;
--                   DROP COLLATION IF EXISTS config.en_icu;
--                   DROP TEXT SEARCH CONFIGURATION IF EXISTS config.ka;
--                   DROP TEXT SEARCH CONFIGURATION IF EXISTS config.en;
--                   (Seed locale rows are sacrificed on rollback — acceptable;
--                   they re-seed deterministically on re-apply.)
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS · CREATE OR REPLACE FUNCTION ·
-- INSERT … ON CONFLICT DO NOTHING · CREATE COLLATION/TEXT SEARCH CONFIGURATION
-- IF NOT EXISTS · DROP TRIGGER IF EXISTS + CREATE. Re-run = converge, never error.
-- Additive only; never edits V1-V12.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. config.locale — the SSOT locale registry
-- ════════════════════════════════════════════════════════════════════════
-- GRAIN: one row per supported locale. PK = BCP 47 primary subtag ('ka','en').
-- The self-FK `fallback` builds the resolution chain; `is_active` drives the
-- completeness rule (validate_locale_string); `icu_locale` backs collation.
-- A new language is an INSERT here — never an ALTER of any label column (Law 1:
-- locales are data, not schema; SSOT for "what languages exist").
CREATE TABLE IF NOT EXISTS config.locale (
  code        TEXT    PRIMARY KEY,                       -- BCP 47 primary subtag: 'ka', 'en'
  name        TEXT    NOT NULL,                          -- native name: 'ქართული', 'English'
  name_en     TEXT    NOT NULL,                          -- English exonym: 'Georgian', 'English'
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  fallback    TEXT    REFERENCES config.locale(code),    -- self-FK fallback; NULL = chain root
  icu_locale  TEXT    NOT NULL,                          -- ICU locale for COLLATE: 'ka', 'en-US'
  ord         INT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT locale_no_self_fallback CHECK (fallback <> code)
);

COMMENT ON TABLE  config.locale IS
  'SSOT locale registry (BCP 47 primary subtags). A new language = INSERT here, never an ALTER of any label column. is_active drives completeness (config.validate_locale_string); fallback builds the resolution chain (config.resolve_label).';
COMMENT ON COLUMN config.locale.code       IS 'BCP 47 primary subtag (PK), e.g. ''ka'',''en''. Matches the keys in every label JSONB payload — no data migration.';
COMMENT ON COLUMN config.locale.is_default IS 'Exactly one row may be TRUE (enforced by uq_locale_single_default). The UI''s initial/preferred locale.';
COMMENT ON COLUMN config.locale.is_active  IS 'Active locales MUST have a non-empty entry in every enforced LocaleString (completeness). Deactivate (FALSE), never DELETE, to retire a language.';
COMMENT ON COLUMN config.locale.fallback   IS 'Self-FK to the next locale in the resolution chain; NULL = chain root (terminal). Cycle-guarded at resolve time. CHECK forbids self-fallback.';
COMMENT ON COLUMN config.locale.icu_locale IS 'ICU locale string for COLLATE / FTS, e.g. ''ka'',''en-US''. Backs config.ka_icu / config.en_icu collations.';

-- Exactly one default locale. (UNIQUE … WHERE is_default is invalid Postgres
-- syntax; a partial unique index over a constant expression is the idiom.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_locale_single_default
  ON config.locale ((true)) WHERE is_default;

-- "what languages exist, in display order" — palette / language switcher read.
CREATE INDEX IF NOT EXISTS idx_locale_active_ord
  ON config.locale (ord) WHERE is_active;


-- ── Seed locales — chain: ka → en → (root). English is the terminal fallback.
-- Insert 'en' FIRST so 'ka'.fallback = 'en' satisfies the self-FK at insert time.
INSERT INTO config.locale (code, name, name_en, is_default, icu_locale, fallback, ord) VALUES
  ('en', 'English',  'English',  false, 'en-US', NULL, 2),
  ('ka', 'ქართული', 'Georgian', true,  'ka',    'en', 1)
ON CONFLICT (code) DO NOTHING;


-- ── updated_at maintenance (reuses config.set_updated_at() from V3) ──────
DROP TRIGGER IF EXISTS trg_locale_updated_at ON config.locale;
CREATE TRIGGER trg_locale_updated_at BEFORE UPDATE ON config.locale
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();


-- ════════════════════════════════════════════════════════════════════════
-- 2. config.validate_locale_string(label) — completeness + key-sanity predicate
-- ════════════════════════════════════════════════════════════════════════
-- TRUE iff:
--   (a) no key in `label` is outside config.locale  (catches typos: {"kk":…})
--   (b) every ACTIVE locale has a non-empty, non-whitespace entry (completeness)
-- STABLE, not IMMUTABLE: it reads config.locale, so its result depends on table
-- state within the transaction. Backs both the V14 enforcement trigger and the
-- V14 pre-flight guard.
CREATE OR REPLACE FUNCTION config.validate_locale_string(label JSONB)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(label) k
      WHERE k NOT IN (SELECT code FROM config.locale)
    )
    AND NOT EXISTS (
      SELECT 1 FROM config.locale l
      WHERE l.is_active
        AND COALESCE(NULLIF(TRIM(label ->> l.code), ''), NULL) IS NULL
    );
$$;

COMMENT ON FUNCTION config.validate_locale_string(JSONB) IS
  'LocaleString validity: TRUE iff (a) no key outside config.locale (no typo''d locales) AND (b) every active locale has a non-empty trimmed entry (completeness). STABLE — reads config.locale. Backs the V14 enforcement trigger + pre-flight guard.';


-- ════════════════════════════════════════════════════════════════════════
-- 3. config.resolve_label(label, preferred) — the fallback-chain walker
-- ════════════════════════════════════════════════════════════════════════
-- Returns the best available text for a reader's `preferred` locale:
--   1. preferred, then its fallback, then ITS fallback … (registry chain)
--   2. cycle-guarded: at most 16 hops (defensive against a mis-seeded loop)
--   3. last resort: any active locale by ord, then any key at all
-- Never returns NULL for a non-empty label. STABLE — reads config.locale.
CREATE OR REPLACE FUNCTION config.resolve_label(label JSONB, preferred TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE
  cur  TEXT := preferred;
  hops INT  := 0;
  v    TEXT;
BEGIN
  WHILE cur IS NOT NULL AND hops < 16 LOOP
    v := NULLIF(TRIM(label ->> cur), '');
    IF v IS NOT NULL THEN RETURN v; END IF;
    SELECT fallback INTO cur FROM config.locale WHERE code = cur;
    hops := hops + 1;
  END LOOP;
  -- last resort: any active locale in display order
  SELECT NULLIF(TRIM(label ->> l.code), '') INTO v
    FROM config.locale l WHERE l.is_active ORDER BY l.ord LIMIT 1;
  RETURN COALESCE(v, (SELECT value FROM jsonb_each_text(label) LIMIT 1));
END;
$$;

COMMENT ON FUNCTION config.resolve_label(JSONB, TEXT) IS
  'Resolve a LocaleString to text for a preferred locale: walk the config.locale fallback chain (cycle-guarded, ≤16 hops), then fall back to any active locale by ord, then any key. Never NULL for a non-empty label. STABLE — reads config.locale.';


-- ════════════════════════════════════════════════════════════════════════
-- 4. config.enforce_locale_string() — generic completeness trigger function
-- ════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT/UPDATE trigger function, PARAMETERIZED by the LocaleString
-- column name via TG_ARGV[0] — so ONE function guards every label/title column
-- across stats.* and config.* (DRY; one rule, many tables). It reads the target
-- column dynamically (EXECUTE … ($1).%I) and rejects an invalid value via
-- config.validate_locale_string. DEFINED here, ATTACHED to no table — V14 wires
-- it (parallel change: foundation now, enforcement next).
CREATE OR REPLACE FUNCTION config.enforce_locale_string()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  col_name TEXT := TG_ARGV[0];
  val      JSONB;
BEGIN
  EXECUTE format('SELECT ($1).%I', col_name) INTO val USING NEW;
  IF val IS NOT NULL AND NOT config.validate_locale_string(val) THEN
    RAISE EXCEPTION 'locale_string_invalid: column % must have a non-empty entry for every active locale in config.locale and no unknown locale keys. value: %',
      col_name, val;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION config.enforce_locale_string() IS
  'Generic BEFORE INSERT/UPDATE trigger guard for any LocaleString column. The column name is passed as TG_ARGV[0]; the value is read dynamically and rejected if not config.validate_locale_string (incomplete or unknown-key). One function, many tables (DRY). Attached to tables in V14.';


-- ════════════════════════════════════════════════════════════════════════
-- 5. ICU collations + per-locale FTS configurations
-- ════════════════════════════════════════════════════════════════════════
-- The base image (timescaledb-ha:pg16) ships with ICU, so language-aware,
-- non-deterministic collations are available for correct sorting of Georgian
-- and English. Non-deterministic (deterministic = false) so case/accent rules
-- apply; use explicitly via COLLATE config.ka_icu / config.en_icu.
CREATE COLLATION IF NOT EXISTS config.ka_icu (provider = icu, locale = 'ka',    deterministic = false);
CREATE COLLATION IF NOT EXISTS config.en_icu (provider = icu, locale = 'en-US', deterministic = false);

COMMENT ON COLLATION config.ka_icu IS 'ICU collation for Georgian (locale ''ka'', non-deterministic). Use COLLATE config.ka_icu for language-correct ordering of ''ka'' labels.';
COMMENT ON COLLATION config.en_icu IS 'ICU collation for English (locale ''en-US'', non-deterministic). Use COLLATE config.en_icu for language-correct ordering of ''en'' labels.';

-- Per-locale full-text-search configurations, registered under the locale name
-- so search can pick the config by locale code. No Georgian stemmer exists in
-- core Postgres, so 'ka' COPIES `simple` (tokenize-only, no stemming); 'en'
-- COPIES `english` (Snowball stemmer). A real Georgian dictionary can later
-- replace config.ka via ALTER without touching call sites.
--
-- NOTE: CREATE TEXT SEARCH CONFIGURATION has NO `IF NOT EXISTS` clause in
-- Postgres (unlike CREATE COLLATION). To keep this migration re-runnable we
-- guard each CREATE behind a pg_ts_config existence check in a DO block —
-- same idempotent outcome, valid DDL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
    WHERE c.cfgname = 'ka' AND n.nspname = 'config'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION config.ka (COPY = pg_catalog.simple);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_ts_config c JOIN pg_namespace n ON n.oid = c.cfgnamespace
    WHERE c.cfgname = 'en' AND n.nspname = 'config'
  ) THEN
    CREATE TEXT SEARCH CONFIGURATION config.en (COPY = pg_catalog.english);
  END IF;
END;
$$;

COMMENT ON TEXT SEARCH CONFIGURATION config.ka IS 'FTS configuration for Georgian, keyed by locale code ''ka''. COPY of pg_catalog.simple (no Georgian stemmer in core; tokenize-only). Swap to a real ''ka'' dictionary later via ALTER — call sites unchanged.';
COMMENT ON TEXT SEARCH CONFIGURATION config.en IS 'FTS configuration for English, keyed by locale code ''en''. COPY of pg_catalog.english (Snowball stemmer).';
