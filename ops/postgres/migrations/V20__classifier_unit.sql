-- ════════════════════════════════════════════════════════════════════════
-- V20__classifier_unit.sql — unit attaches at the MEASURE-classifier level
-- ════════════════════════════════════════════════════════════════════════
-- DECISION C. Unit/scale/precision are SERIES-SUBKEY attributes of the SDMX
-- INDICATOR concept = a stats.classifier 'measure' member, NOT the whole
-- dataset (V16's dataset columns demote to a dataset-wide DEFAULT) and NOT the
-- obs_attribute bag (retired). Migrates the unvalidated classifier.metadata
-- JSONB into first-class FK- and CHECK-validated columns (Strangler-Fig: same
-- home, now validated). Resolution order (per field, independent):
--   measure-classifier column -> dataset default column -> NULL  (see V21 view).
--
-- ── 09 §B RISK GATE ─────────────────────────────────────────────────────
--   Reversibility : TWO-WAY. Three nullable/constant-default columns + one FK
--                   to an EXISTING codelist (stats.unit_measure, V16).
--   Blast radius  : LOW. stats.classifier gains three columns; no existing
--                   column/type/constraint/index/trigger altered.
--   FK pre-flight : unit_code added NULLABLE, no default -> no existing row can
--                   violate the FK. Codelist populated by V16; backfill resolves.
--   Backfill      : reads measure members' metadata->>'unit_measure'/'decimals'
--                   into typed columns, normalizing legacy 'PCT'->'PERCENT'.
--                   Idempotent (WHERE unit_code IS NULL guard).
--   Rollback plan : ALTER TABLE stats.classifier
--                     DROP CONSTRAINT IF EXISTS classifier_unit_mult_chk,
--                     DROP CONSTRAINT IF EXISTS classifier_decimals_chk,
--                     DROP COLUMN IF EXISTS decimals,
--                     DROP COLUMN IF EXISTS unit_mult,
--                     DROP COLUMN IF EXISTS unit_code;
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE stats.classifier
  ADD COLUMN IF NOT EXISTS unit_code TEXT REFERENCES stats.unit_measure(code);
ALTER TABLE stats.classifier
  ADD COLUMN IF NOT EXISTS unit_mult SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE stats.classifier
  ADD COLUMN IF NOT EXISTS decimals SMALLINT NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classifier_unit_mult_chk'
      AND conrelid = 'stats.classifier'::regclass
  ) THEN
    ALTER TABLE stats.classifier
      ADD CONSTRAINT classifier_unit_mult_chk CHECK (unit_mult IN (0, 3, 6, 9));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classifier_decimals_chk'
      AND conrelid = 'stats.classifier'::regclass
  ) THEN
    ALTER TABLE stats.classifier
      ADD CONSTRAINT classifier_decimals_chk CHECK (decimals BETWEEN 0 AND 9);
  END IF;
END;
$$;

UPDATE stats.classifier c
   SET unit_code = CASE c.metadata->>'unit_measure'
                     WHEN 'PCT' THEN 'PERCENT'
                     ELSE c.metadata->>'unit_measure'
                   END,
       decimals  = COALESCE((c.metadata->>'decimals')::SMALLINT, c.decimals)
 WHERE c.dim_code = 'measure'
   AND c.metadata ? 'unit_measure'
   AND c.unit_code IS NULL;

COMMENT ON COLUMN stats.classifier.unit_code IS
  'SDMX UNIT_MEASURE at the MEASURE-classifier level (Decision C). FK to stats.unit_measure. Resolves ahead of stats.dataset.unit_code (dataset-wide default). NULL on non-measure members and measures with no declared unit.';
COMMENT ON COLUMN stats.classifier.unit_mult IS
  'SDMX UNIT_MULT — power-of-ten scale of obs_value for this measure. CHECK (0,3,6,9). Default 0. (Legacy seed encodes millions via GEL_MN code, not unit_mult=6.)';
COMMENT ON COLUMN stats.classifier.decimals IS
  'SDMX DECIMALS — display precision for this measure. CHECK 0..9. Default 2. Backfilled from classifier.metadata->>''decimals''.';

COMMENT ON COLUMN stats.observation.obs_attribute IS
  'Open SDMX observation-attribute bag (the long tail beyond typed obs_status/obs_conf): OBS_PRE_BREAK, DECIMALS, COMMENT, seqPos, … . A new attribute is a write, never an ALTER. Structural keys live in dim_key; never here. UNIT_MEASURE is NOT resolved from this bag — unit attaches at the measure classifier (Decision C, stats.measure_unit_resolved).';
