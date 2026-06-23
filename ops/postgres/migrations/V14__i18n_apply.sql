-- ════════════════════════════════════════════════════════════════════════
-- V14__i18n_apply.sql — i18n enforcement: attach completeness, FK, GIN indexes
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — the CONTRACT half of the expand-contract pair.
-- V13 built the foundation (locale registry + validate/resolve/enforce funcs)
-- but ATTACHED nothing — every write path behaved exactly as before. V14 turns
-- the foundation on:
--
--     1. PRE-FLIGHT GUARD (DO block) — BEFORE attaching any trigger, scan all 5
--        affected tables for LocaleString violations. If ANY row is invalid,
--        RAISE and abort the whole migration. This is the safety that makes the
--        change safe: a trigger that rejects incomplete writes would otherwise
--        instantly make every already-incomplete row un-UPDATE-able. We fail
--        the MIGRATION loudly (with counts to backfill) instead of silently
--        shipping a schema that traps existing data. Fail-fast at the boundary.
--
--     2. COMPLETENESS TRIGGERS on the 5 LocaleString-bearing tables
--        (stats.dimension/classifier/dataset.label, config.page.title,
--        config.nav_item.label) — each wires the GENERIC V13
--        config.enforce_locale_string() with its column name as TG_ARGV[0].
--        Scoped BEFORE INSERT OR UPDATE OF <col> so a non-label UPDATE pays
--        nothing. From here, an incomplete or typo'd label cannot enter.
--
--     3. FK stats.classifier_display.locale → config.locale(code) — the V6
--        overlay's free-text locale column gains referential integrity: an
--        overlay can only target a registered locale. ON DELETE RESTRICT, not
--        CASCADE — retire a language by is_active=false, never by DELETE (which
--        would orphan/erase overlays). Validated by the pre-flight pattern: the
--        seed locales ('ka','en') already cover every existing overlay.
--
--     4. GIN (jsonb_path_ops) indexes on all 5 LocaleString columns — a
--        LOCALE-AGNOSTIC containment index, replacing the locale-HARDCODED V4
--        idx_classifier_label_trgm as the forward path. New code searches via
--        config.resolve_label + @> containment, not a hand-built 'ka'||'en'
--        string. V4's trgm index is immutable (can't edit V4), so it is KEPT
--        but demoted to legacy — both exist; new queries use the GIN path.
--
-- ── 09 §B RISK GATE (Class-B enforcement migration) ─────────────────────
--   Reversibility : TWO-WAY for the triggers + GIN indexes (plain DROP). The FK
--                   is TWO-WAY *provided no row violates it*; the pre-flight
--                   guard + the fact that the seed covers every existing locale
--                   make the add safe, and DROP CONSTRAINT reverses it cleanly.
--                   No existing column/type/constraint is dropped or altered.
--   Blast radius  : MODERATE — this adds WRITE-TIME enforcement to 5 tables.
--                   READ paths are unchanged (triggers fire only on write; the
--                   new GIN indexes only add a plan option). The risk is future
--                   writes: after V14, an incomplete label INSERT/UPDATE is
--                   rejected. That is the intended contract, not a regression.
--                   The pre-flight guard guarantees no EXISTING row is trapped.
--   Rollback plan : DROP TRIGGER trg_dimension_locale  ON stats.dimension;
--                   DROP TRIGGER trg_classifier_locale ON stats.classifier;
--                   DROP TRIGGER trg_dataset_locale    ON stats.dataset;
--                   DROP TRIGGER trg_page_locale       ON config.page;
--                   DROP TRIGGER trg_nav_item_locale   ON config.nav_item;
--                   ALTER TABLE stats.classifier_display
--                     DROP CONSTRAINT classifier_display_locale_fk;
--                   DROP INDEX stats.idx_dimension_label_gin,
--                              stats.idx_classifier_label_gin,
--                              stats.idx_dataset_label_gin,
--                              config.idx_page_title_gin,
--                              config.idx_nav_item_label_gin;
--                   (The V13 functions/registry stay; rollback only un-wires.)
--
-- Idempotent: DO-block guard is read-only + re-runnable · DROP TRIGGER IF
-- EXISTS + CREATE · ADD CONSTRAINT guarded by existence check · CREATE INDEX
-- IF NOT EXISTS. Re-run = converge, never error.
-- Additive only: adds triggers/FK/indexes to existing objects; never drops or
-- alters an existing column or constraint.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. PRE-FLIGHT GUARD — abort BEFORE enforcement if any row is already invalid
-- ════════════════════════════════════════════════════════════════════════
-- Read-only. Scans every LocaleString column we are about to guard. If any row
-- fails config.validate_locale_string, RAISE with the count so the operator
-- knows exactly what to backfill, and the transaction rolls back BEFORE a
-- single trigger is attached. No existing data is ever made un-writable.
DO $$
DECLARE
  violations INT := 0;
BEGIN
  -- stats.dimension.label
  SELECT COUNT(*) INTO violations FROM stats.dimension WHERE NOT config.validate_locale_string(label);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V14 pre-flight: % stats.dimension rows have invalid locale strings. Backfill before applying.', violations;
  END IF;

  -- stats.classifier.label
  SELECT COUNT(*) INTO violations FROM stats.classifier WHERE NOT config.validate_locale_string(label);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V14 pre-flight: % stats.classifier rows have invalid locale strings. Backfill before applying.', violations;
  END IF;

  -- stats.dataset.label
  SELECT COUNT(*) INTO violations FROM stats.dataset WHERE NOT config.validate_locale_string(label);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V14 pre-flight: % stats.dataset rows have invalid locale strings. Backfill before applying.', violations;
  END IF;

  -- config.page.title
  SELECT COUNT(*) INTO violations FROM config.page WHERE NOT config.validate_locale_string(title);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V14 pre-flight: % config.page rows have invalid locale strings. Backfill before applying.', violations;
  END IF;

  -- config.nav_item.label
  SELECT COUNT(*) INTO violations FROM config.nav_item WHERE NOT config.validate_locale_string(label);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V14 pre-flight: % config.nav_item rows have invalid locale strings. Backfill before applying.', violations;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- 2. Completeness triggers — wire the generic V13 guard to the 5 tables
-- ════════════════════════════════════════════════════════════════════════
-- Each passes its LocaleString column name as TG_ARGV[0] to the ONE shared
-- config.enforce_locale_string() function (V13). Scoped to UPDATE OF <col> so
-- a non-label write costs nothing. After this, an incomplete/typo'd label
-- cannot enter the cube or the config tree.

DROP TRIGGER IF EXISTS trg_dimension_locale ON stats.dimension;
CREATE TRIGGER trg_dimension_locale
  BEFORE INSERT OR UPDATE OF label ON stats.dimension
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('label');

COMMENT ON TRIGGER trg_dimension_locale ON stats.dimension IS
  'Enforces LocaleString completeness on stats.dimension.label (every active locale present, no unknown keys) via config.enforce_locale_string(''label''). i18n integrity at write time.';

DROP TRIGGER IF EXISTS trg_classifier_locale ON stats.classifier;
CREATE TRIGGER trg_classifier_locale
  BEFORE INSERT OR UPDATE OF label ON stats.classifier
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('label');

COMMENT ON TRIGGER trg_classifier_locale ON stats.classifier IS
  'Enforces LocaleString completeness on stats.classifier.label via config.enforce_locale_string(''label''). A half-translated codelist entry cannot enter the cube.';

DROP TRIGGER IF EXISTS trg_dataset_locale ON stats.dataset;
CREATE TRIGGER trg_dataset_locale
  BEFORE INSERT OR UPDATE OF label ON stats.dataset
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('label');

COMMENT ON TRIGGER trg_dataset_locale ON stats.dataset IS
  'Enforces LocaleString completeness on stats.dataset.label via config.enforce_locale_string(''label'').';

DROP TRIGGER IF EXISTS trg_page_locale ON config.page;
CREATE TRIGGER trg_page_locale
  BEFORE INSERT OR UPDATE OF title ON config.page
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('title');

COMMENT ON TRIGGER trg_page_locale ON config.page IS
  'Enforces LocaleString completeness on config.page.title via config.enforce_locale_string(''title''). A Constructor page cannot publish with a missing-language title.';

DROP TRIGGER IF EXISTS trg_nav_item_locale ON config.nav_item;
CREATE TRIGGER trg_nav_item_locale
  BEFORE INSERT OR UPDATE OF label ON config.nav_item
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('label');

COMMENT ON TRIGGER trg_nav_item_locale ON config.nav_item IS
  'Enforces LocaleString completeness on config.nav_item.label via config.enforce_locale_string(''label''). A nav entry cannot enter with a missing-language label.';


-- ════════════════════════════════════════════════════════════════════════
-- 3. FK — stats.classifier_display.locale → config.locale(code)
-- ════════════════════════════════════════════════════════════════════════
-- The V6 overlay's `locale` was free text; now it must reference a registered
-- locale (referential integrity for the i18n registry). ON DELETE RESTRICT, not
-- CASCADE: do not silently orphan display overlays if someone tries to remove a
-- locale — retire a language via is_active=false, never DELETE. The seed
-- locales ('ka','en') already cover every existing overlay, and the pre-flight
-- pattern means the add cannot fail on existing data. Guarded so re-run is a
-- no-op (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classifier_display_locale_fk'
      AND conrelid = 'stats.classifier_display'::regclass
  ) THEN
    ALTER TABLE stats.classifier_display
      ADD CONSTRAINT classifier_display_locale_fk
      FOREIGN KEY (locale) REFERENCES config.locale(code)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

COMMENT ON CONSTRAINT classifier_display_locale_fk ON stats.classifier_display IS
  'Referential integrity: an overlay''s locale must be a registered config.locale. ON DELETE RESTRICT — retire a language via is_active=false, never DELETE (which would orphan overlays). silver (stats_stage.*) is left deliberately permissive — no FK there.';


-- ════════════════════════════════════════════════════════════════════════
-- 4. GIN (jsonb_path_ops) indexes — locale-agnostic, replace V4 hardcoded trgm
-- ════════════════════════════════════════════════════════════════════════
-- jsonb_path_ops: compact, fast @> containment over the whole LocaleString,
-- with no hardcoded locale key (the V4 idx_classifier_label_trgm baked in
-- 'ka'||'en'). New code uses config.resolve_label for display and @> for
-- search; these indexes back the @> path uniformly across every label/title.
-- The V4 trgm index is immutable (V4 is applied) — it is KEPT as legacy; both
-- coexist, new queries prefer the GIN path.
CREATE INDEX IF NOT EXISTS idx_dimension_label_gin   ON stats.dimension  USING GIN (label jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_classifier_label_gin  ON stats.classifier USING GIN (label jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_dataset_label_gin     ON stats.dataset    USING GIN (label jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_page_title_gin        ON config.page      USING GIN (title jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_nav_item_label_gin    ON config.nav_item  USING GIN (label jsonb_path_ops);
