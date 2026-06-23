-- ════════════════════════════════════════════════════════════════════════
-- V16__unit_measure.sql — first-class SDMX UNIT_MEASURE / UNIT_MULT model
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V15 are applied + immutable.
--
--   THE GAP — stats.observation.obs_value is a bare NUMERIC with no enforced
--   unit. From the schema alone a renderer CANNOT tell "millions of GEL" from
--   "index 2010=100" from "percent" from "persons". The unit is, today, an
--   out-of-band convention carried in bundle code and display labels — not a
--   validated datum. That is the opposite of SSOT: the most semantically
--   load-bearing fact about a number (what it MEASURES, at what SCALE, to what
--   PRECISION) has no authoritative home in the cube. A consumer that gets the
--   unit wrong renders a chart that is not merely ugly but WRONG (GEL 12,000
--   plotted next to GEL 12,000,000,000). Data-integrity / accessibility law:
--   the unit, scale, precision and base period are part of the figure's meaning
--   and must be first-class, machine-readable data (ONS/Eurostat/IMF do exactly
--   this via the SDMX Cross-Domain Concepts).
--
--   THE STANDARD — SDMX 2.1 / 3.0 Cross-Domain Concepts model this as four
--   coded/attribute concepts attached at the SERIES (dataflow) level, not the
--   observation level:
--       UNIT_MEASURE  — a coded attribute referencing an external concept
--                       scheme (CL_UNIT_MEASURE): the unit of the figure.
--       UNIT_MULT     — the scale (power of ten) the stored value is expressed
--                       in: 0=units, 3=thousands, 6=millions, 9=billions.
--       DECIMALS      — the number of decimal places the figure is precise to.
--       BASE_PERIOD   — for index/rebased series, the reference period
--                       (e.g. "2010=100").
--   Because these are SERIES-level in SDMX and our stats.dataset IS the series
--   collection (SDMX Dataflow, V4), the correct attachment point is
--   stats.dataset — NOT stats.observation. Modelling unit per-observation would
--   denormalize the same code onto millions of hypertable rows for no gain and
--   would fight compression (segmentby groups whole series). SSOT: one unit
--   declaration per dataset, all observations derive it.
--
--   MIXED-UNIT DATASETS — a dataset MAY legitimately mix units across its series
--   (a level in GEL alongside a growth rate in %). The model handles this WITHOUT
--   reshaping the hot path: unit is declared at dataset level for the COMMON case
--   (one unit per dataflow, the norm for these national-accounts datasets), and a
--   per-observation OVERRIDE rides in the EXISTING stats.observation.obs_attribute
--   open bag (V8) under the SDMX key (e.g. {"UNIT_MEASURE":"PERCENT"}). No new
--   column on the hypertable, no migration to support a mixed dataset — exactly
--   what the V8 bag was built for ("UNIT_MEASURE override" is named in its
--   comment). The dataset-level columns are the default; the bag is the exception.
--
--   stats.unit_measure is the coded CONCEPT SCHEME (the codelist) — the SSOT for
--   "what units exist". A new unit is an INSERT here, never an ALTER (Law 1:
--   codelists are data, not schema), symmetric with stats.dimension /
--   stats.classifier. Its label is a LocaleString and is therefore guarded by the
--   SAME generic i18n completeness trigger (config.enforce_locale_string, V13)
--   already wired to the five label columns in V14 — one rule, one more table.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. stats.unit_measure is a brand-new table. The four
--                   columns added to stats.dataset are NULLABLE or carry a
--                   constant DEFAULT, so on PG ≥ 11 the ADD COLUMN is a
--                   metadata-only operation (no table rewrite) and every existing
--                   dataset row stays valid (unit_code NULL = "unit not yet
--                   declared"; unit_mult 0, decimals 2 = sane SDMX defaults).
--                   Rollback DROPs remove 100% of what V16 introduces.
--   Blast radius  : LOW. stats.dataset gains four nullable/defaulted columns +
--                   one FK to the new codelist + one i18n trigger on the new
--                   table. No existing column/type/constraint/index on any
--                   V1-V15 object is altered or dropped. Existing reads + writes
--                   to stats.dataset behave exactly as before (the new columns
--                   are absent from every existing query). The new i18n trigger
--                   fires ONLY on stats.unit_measure, never on another table.
--   Hypertable    : NONE. stats.observation is UNTOUCHED — no column, no
--                   partition-key change, no compression-setting change, no
--                   trigger. The per-observation unit override reuses the
--                   existing obs_attribute jsonb bag (V8) and needs no DDL here.
--   FK pre-flight : The dataset.unit_code FK is added with the column itself as
--                   NULLABLE with no default, so NO existing row can violate it
--                   (every existing dataset gets unit_code = NULL). The seed
--                   below populates the codelist BEFORE any dataset would
--                   reference it, so a later UPDATE to set unit_code resolves.
--   Rollback plan : ALTER TABLE stats.dataset
--                     DROP CONSTRAINT IF EXISTS dataset_unit_mult_chk,
--                     DROP CONSTRAINT IF EXISTS dataset_decimals_chk,
--                     DROP COLUMN IF EXISTS base_period,
--                     DROP COLUMN IF EXISTS decimals,
--                     DROP COLUMN IF EXISTS unit_mult,
--                     DROP COLUMN IF EXISTS unit_code;          -- drops the FK
--                   DROP TRIGGER IF EXISTS trg_unit_measure_locale
--                     ON stats.unit_measure;
--                   DROP TABLE IF EXISTS stats.unit_measure;
--                   (Seed codelist rows are sacrificed on rollback — acceptable;
--                   they re-seed deterministically on re-apply.)
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS · ADD COLUMN IF NOT EXISTS ·
-- CREATE OR REPLACE · DROP TRIGGER IF EXISTS + CREATE · INSERT … ON CONFLICT
-- DO NOTHING · ADD CONSTRAINT guarded by existence checks. Re-run = converge,
-- never error. Additive only; never edits a V1-V15 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. stats.unit_measure — the coded UNIT_MEASURE concept scheme (codelist)
-- ════════════════════════════════════════════════════════════════════════
-- GRAIN: one row per unit code. PK = the SDMX CL_UNIT_MEASURE code where one
-- exists ('PERCENT','INDEX','PERSON',ISO-4217 currencies 'GEL'/'USD'/'EUR'),
-- plus pragmatic platform codes for scaled currencies ('GEL_MN') and a
-- percent-expressed ratio ('RATIO_PCT'). A new unit = an INSERT here, never an
-- ALTER (Law 1: codelists are data). label is a LocaleString guarded by the V13
-- i18n contract (trigger attached below), exactly like every other label column.
CREATE TABLE IF NOT EXISTS stats.unit_measure (
  code        TEXT        PRIMARY KEY,                 -- SDMX CL_UNIT_MEASURE code: 'GEL','PERCENT','INDEX',…
  label       JSONB       NOT NULL,                    -- LocaleString {"ka":"ლარი","en":"Georgian Lari"}
  unit_type   TEXT        NOT NULL,                    -- coarse class: currency|count|ratio|index|other
  symbol      TEXT,                                    -- display symbol: '₾','%','—' (NULL = none)
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unit_measure_type_chk CHECK (unit_type IN ('currency','count','ratio','index','other'))
);

COMMENT ON TABLE  stats.unit_measure IS
  'SDMX UNIT_MEASURE concept scheme (codelist CL_UNIT_MEASURE) — the SSOT for what units exist. A new unit = INSERT, never an ALTER (Law 1). label is a LocaleString guarded by the V13/V14 i18n completeness contract. Referenced by stats.dataset.unit_code; observation-level overrides ride in stats.observation.obs_attribute (V8).';
COMMENT ON COLUMN stats.unit_measure.code      IS 'Unit code (PK). SDMX CL_UNIT_MEASURE / ISO-4217 where one exists (PERCENT, INDEX, PERSON, GEL, USD, EUR); platform-scoped for scaled/derived units (GEL_MN, RATIO_PCT). This is what dataset.unit_code and the obs_attribute UNIT_MEASURE override carry.';
COMMENT ON COLUMN stats.unit_measure.label     IS 'LocaleString {"ka":…,"en":…} display name. Must satisfy config.validate_locale_string (every active locale present, no unknown keys) — enforced by trg_unit_measure_locale.';
COMMENT ON COLUMN stats.unit_measure.unit_type IS 'Coarse classification driving formatting/aggregation policy: currency (money, scalable by unit_mult) | count (persons/items) | ratio (dimensionless or %) | index (rebased, carries base_period) | other.';
COMMENT ON COLUMN stats.unit_measure.symbol    IS 'Optional display symbol (₾, %, —). NULL = no symbol; the renderer falls back to the resolved label.';
COMMENT ON COLUMN stats.unit_measure.is_active IS 'Deactivate (FALSE), never DELETE, to retire a unit — preserves referential integrity of historical dataset.unit_code references (data outlives code).';

-- "active units by type" — the palette read for a Constructor unit picker.
CREATE INDEX IF NOT EXISTS idx_unit_measure_type
  ON stats.unit_measure (unit_type) WHERE is_active;


-- ── i18n completeness trigger — same generic guard as the V14 five ───────
-- PRE-FLIGHT GUARD first (mirrors V14 §1): the table is new and seeded below in
-- the SAME transaction AFTER the trigger is attached, so there are no pre-existing
-- rows to trap — but we keep the guard for symmetry and to fail loudly if a
-- future re-apply runs against a table some out-of-band process has populated
-- with an invalid label. Read-only; aborts before the trigger would trap data.
DO $$
DECLARE
  violations INT := 0;
BEGIN
  SELECT COUNT(*) INTO violations
    FROM stats.unit_measure
   WHERE NOT config.validate_locale_string(label);
  IF violations > 0 THEN
    RAISE EXCEPTION 'V16 pre-flight: % stats.unit_measure rows have invalid locale strings. Backfill before applying.', violations;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_measure_locale ON stats.unit_measure;
CREATE TRIGGER trg_unit_measure_locale
  BEFORE INSERT OR UPDATE OF label ON stats.unit_measure
  FOR EACH ROW EXECUTE FUNCTION config.enforce_locale_string('label');

COMMENT ON TRIGGER trg_unit_measure_locale ON stats.unit_measure IS
  'Enforces LocaleString completeness on stats.unit_measure.label via the generic V13 config.enforce_locale_string(''label''). A half-translated unit name cannot enter the codelist — same one-rule-many-tables contract as the V14 five.';


-- ════════════════════════════════════════════════════════════════════════
-- 2. Seed the standard units (SDMX Cross-Domain aligned where a code exists)
-- ════════════════════════════════════════════════════════════════════════
-- ON CONFLICT DO NOTHING — re-run safe. EVERY label carries BOTH active locales
-- ('ka' + 'en') so it satisfies the trigger attached above at insert time
-- (V14 i18n contract). Codes align to SDMX CL_UNIT_MEASURE / ISO-4217 where one
-- exists; scaled and derived units use platform-scoped codes documented per row.
INSERT INTO stats.unit_measure (code, label, unit_type, symbol) VALUES
  -- Currencies (ISO 4217). Base (un-scaled) currency; use dataset.unit_mult for scale.
  ('GEL',         '{"ka":"ლარი","en":"Georgian Lari"}',                       'currency', '₾'),
  ('USD',         '{"ka":"აშშ დოლარი","en":"US Dollar"}',                      'currency', '$'),
  ('EUR',         '{"ka":"ევრო","en":"Euro"}',                                 'currency', '€'),
  -- Scaled currency — the "millions of GEL" idiom seen across national accounts.
  -- Prefer expressing scale via dataset.unit_mult=6 with unit_code='GEL'; this
  -- explicit code exists for legacy/bundle series that bake "GEL mn" into the unit.
  ('GEL_MN',      '{"ka":"მლნ ლარი","en":"Million Georgian Lari"}',            'currency', '₾'),
  ('USD_MN',      '{"ka":"მლნ აშშ დოლარი","en":"Million US Dollar"}',          'currency', '$'),
  -- Ratios / dimensionless.
  ('PERCENT',     '{"ka":"პროცენტი","en":"Percent"}',                          'ratio',    '%'),
  ('RATIO',       '{"ka":"კოეფიციენტი","en":"Ratio"}',                         'ratio',    '—'),
  ('RATIO_PCT',   '{"ka":"კოეფიციენტი (პროცენტში)","en":"Ratio (percent)"}',   'ratio',    '%'),
  ('PURE_NUMBER', '{"ka":"სუფთა რიცხვი","en":"Pure Number"}',                  'other',    NULL),
  -- Index (rebased) — carries base_period at the dataset level ("2010=100").
  ('INDEX',       '{"ka":"ინდექსი","en":"Index"}',                             'index',    NULL),
  -- Count.
  ('PERSON',      '{"ka":"პირი","en":"Person"}',                               'count',    NULL)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════
-- 3. stats.dataset — series-level unit attributes (SDMX Cross-Domain Concepts)
-- ════════════════════════════════════════════════════════════════════════
-- Four NULLABLE / constant-DEFAULT columns (metadata-only ADD on PG ≥ 11 — no
-- table rewrite, no risk on a populated table). unit_code is a FK to the codelist
-- seeded above; it is NULLABLE ("unit not yet declared") so no existing dataset
-- row violates it. unit_mult / decimals carry SDMX-sane constant defaults and are
-- CHECK-bounded. base_period applies to index series.
ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS unit_code   TEXT REFERENCES stats.unit_measure(code);

ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS unit_mult   SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS decimals    SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE stats.dataset
  ADD COLUMN IF NOT EXISTS base_period TEXT;

-- CHECK constraints added separately + guarded (ADD CONSTRAINT has no IF NOT
-- EXISTS). Because the columns carry constant defaults that satisfy the checks,
-- every existing row validates instantly on add (no rewrite of data, only a
-- catalog validation pass over the default).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_unit_mult_chk'
      AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_unit_mult_chk CHECK (unit_mult IN (0, 3, 6, 9));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dataset_decimals_chk'
      AND conrelid = 'stats.dataset'::regclass
  ) THEN
    ALTER TABLE stats.dataset
      ADD CONSTRAINT dataset_decimals_chk CHECK (decimals BETWEEN 0 AND 9);
  END IF;
END;
$$;

COMMENT ON COLUMN stats.dataset.unit_code IS
  'SDMX UNIT_MEASURE — the dataset''s (series-level) unit, FK to stats.unit_measure. NULL = not yet declared. The COMMON case (one unit per dataflow); a mixed-unit dataset overrides per-observation via obs_attribute->>''UNIT_MEASURE'' (V8 bag).';
COMMENT ON COLUMN stats.dataset.unit_mult IS
  'SDMX UNIT_MULT — power-of-ten scale of the STORED obs_value: 0=units, 3=thousands, 6=millions, 9=billions. The figure''s real magnitude is obs_value × 10^unit_mult. CHECK (0,3,6,9). Default 0 (units).';
COMMENT ON COLUMN stats.dataset.decimals IS
  'SDMX DECIMALS — number of decimal places the figure is precise to (rendering/rounding hint, not a storage constraint on the NUMERIC). CHECK 0..9. Default 2.';
COMMENT ON COLUMN stats.dataset.base_period IS
  'SDMX BASE_PERIOD — reference period for index/rebased series, e.g. "2010=100" or "2015". NULL for non-index datasets. Free text (SDMX itself does not codelist this).';
