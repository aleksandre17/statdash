-- ════════════════════════════════════════════════════════════════════════
-- V4__stats_tables.sql — stats schema: SDMX cube v2
-- ════════════════════════════════════════════════════════════════════════
--
-- DESIGN PRINCIPLES:
--   1. No privileged dimensions (Law 1) — dimension code IS the identity
--   2. SDMX concepts adopted whole (Law 4) — dimension, DSD, classifier, obs
--   3. TimescaleDB hypertable on observation — time-range queries O(log n)
--   4. LTREE on classifier — ancestor/descendant hierarchy O(log n)
--   5. dim_key validated against DSD + classifiers — no invalid observations
--   6. time_period normalized to DATE for hypertable partitioning
--   7. Classifiers are first-class (the engine uses $cl refs)
--
-- Idempotent: CREATE ... IF NOT EXISTS; CREATE OR REPLACE for functions;
-- hypertable / compression / policy calls guarded by if_not_exists. No DROP
-- of any table. Reuses config.set_updated_at() (defined in V3) for audit.
-- ════════════════════════════════════════════════════════════════════════


-- ── stats.dimension — cube axes (no hardcoded names; CODE is the identity) ──
CREATE TABLE IF NOT EXISTS stats.dimension (
  code       TEXT        PRIMARY KEY,                 -- 'measure' | 'time' | 'geo' | … (generic)
  label      JSONB       NOT NULL,                    -- {"ka":"მაჩვენებელი","en":"Measure"}
  ord        INT         NOT NULL DEFAULT 0,          -- display order of axes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  stats.dimension      IS 'SDMX Dimension — a cube axis. code IS the identity; no hardcoded names (Law 1).';
COMMENT ON COLUMN stats.dimension.code IS 'Generic axis code, e.g. measure/time/geo. Engine reads ctx.dims[code], never a fixed field.';


-- ── stats.classifier — SDMX Codelist entry, LTREE-hierarchical ──────────
-- Renamed from dimension_value. This is the engine's $cl ref target. A surrogate
-- BIGINT id is used (not composite (dim_code, code)) so parent_id can be a single
-- FK and the LTREE materialized path can be built from the id chain.
CREATE TABLE IF NOT EXISTS stats.classifier (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dim_code    TEXT        NOT NULL REFERENCES stats.dimension(code) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  label       JSONB       NOT NULL,           -- {"ka":"...", "en":"..."}
  color       TEXT,
  parent_id   BIGINT      REFERENCES stats.classifier(id) ON DELETE SET NULL,
  path        LTREE,                          -- materialized path: '1.5.23' — enables ancestor/descendant in O(log n)
  ord         INT         NOT NULL DEFAULT 0,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT classifier_dim_code_code_uq UNIQUE (dim_code, code)
);

COMMENT ON TABLE  stats.classifier      IS 'SDMX Codelist entry. Renamed from dimension_value — the engine $cl ref. LTREE path enables hierarchy traversal.';
COMMENT ON COLUMN stats.classifier.path IS 'Materialized LTREE path of id chain. Set by trigger on insert/update. Supports: ancestors(@), descendants(~*), subtree.';
COMMENT ON COLUMN stats.classifier.code IS 'Stable business code, unique within its dimension (geo:GE vs measure:GE differ). What the engine sees at the query boundary.';

-- LTREE path trigger — materializes the path from the root id chain.
-- NEVER set path manually; this trigger owns it on INSERT and on parent_id UPDATE.
CREATE OR REPLACE FUNCTION stats.refresh_classifier_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path LTREE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.id::TEXT::LTREE;
  ELSE
    SELECT path INTO parent_path FROM stats.classifier WHERE id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'parent classifier % has no path yet', NEW.parent_id;
    END IF;
    NEW.path := parent_path || NEW.id::TEXT::LTREE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.refresh_classifier_path() IS
  'BEFORE INSERT/UPDATE OF parent_id: materializes LTREE path from the id chain. Owns classifier.path — never set it by hand.';

DROP TRIGGER IF EXISTS trg_classifier_path ON stats.classifier;
CREATE TRIGGER trg_classifier_path
  BEFORE INSERT OR UPDATE OF parent_id ON stats.classifier
  FOR EACH ROW EXECUTE FUNCTION stats.refresh_classifier_path();

-- LTREE + FK + fuzzy-label indexes.
CREATE INDEX IF NOT EXISTS idx_classifier_path       ON stats.classifier USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_classifier_dim_code   ON stats.classifier (dim_code);
CREATE INDEX IF NOT EXISTS idx_classifier_parent_id  ON stats.classifier (parent_id);
-- Fuzzy label search (Georgian + English) — pg_trgm over the merged label text.
CREATE INDEX IF NOT EXISTS idx_classifier_label_trgm ON stats.classifier USING GIN (
  (label->>'ka' || ' ' || COALESCE(label->>'en', '')) gin_trgm_ops
);


-- ── stats.dataset — a named series collection (SDMX Dataflow) ────────────
CREATE TABLE IF NOT EXISTS stats.dataset (
  code       TEXT        PRIMARY KEY,                 -- 'GDP_ANNUAL' | 'TRADE_Q'
  label      JSONB       NOT NULL,
  frequency  TEXT        NOT NULL DEFAULT 'A',        -- SDMX FREQ: A=annual Q=quarterly M=monthly
  source     TEXT,                                    -- agency / provider
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dataset_frequency_chk CHECK (frequency IN ('A', 'S', 'Q', 'M', 'W', 'D'))
);

COMMENT ON TABLE stats.dataset IS 'SDMX Dataflow — a named collection of related series. frequency = SDMX FREQ code list.';


-- ── stats.dataset_dimension — the dataset''s key structure (SDMX DSD) ────
-- Declares which dimensions a dataset is keyed by, and which one is time.
-- This is the contract that validates an observation''s dim_key shape.
CREATE TABLE IF NOT EXISTS stats.dataset_dimension (
  dataset_code TEXT    NOT NULL REFERENCES stats.dataset(code)   ON DELETE CASCADE,
  dim_code     TEXT    NOT NULL REFERENCES stats.dimension(code),
  is_time_dim  BOOLEAN NOT NULL DEFAULT false,        -- marks the TIME_PERIOD axis
  ord          INT     NOT NULL DEFAULT 0,
  PRIMARY KEY (dataset_code, dim_code)
);

COMMENT ON TABLE stats.dataset_dimension IS 'SDMX DSD — dimensions composing a dataset''s series key. is_time_dim marks TIME_PERIOD.';

CREATE INDEX IF NOT EXISTS idx_dataset_dim_dim_code ON stats.dataset_dimension (dim_code);


-- ── time_period normalization helper ────────────────────────────────────
-- SDMX TIME_PERIOD text → a DATE anchor for hypertable partitioning + range
-- queries. IMMUTABLE + STRICT so it can back a GENERATED STORED column.
--   '2023'       → 2023-01-01
--   '2023-Q1..4' → 01-01 / 04-01 / 07-01 / 10-01
--   '2023-01'    → 2023-01-01
--   '2023-01-15' → 2023-01-15
CREATE OR REPLACE FUNCTION stats.parse_time_period(p TEXT) RETURNS DATE AS $$
  SELECT CASE
    WHEN p ~ '^\d{4}$'
      THEN (p || '-01-01')::DATE
    WHEN p ~ '^\d{4}-Q[1-4]$'
      THEN (substring(p,1,4) || '-' ||
            lpad(((substring(p,7,1)::INT - 1)*3 + 1)::TEXT, 2,'0') || '-01')::DATE
    WHEN p ~ '^\d{4}-\d{2}$'
      THEN (p || '-01')::DATE
    WHEN p ~ '^\d{4}-\d{2}-\d{2}$'
      THEN p::DATE
    ELSE NULL
  END;
$$ LANGUAGE SQL IMMUTABLE STRICT;

COMMENT ON FUNCTION stats.parse_time_period(TEXT) IS
  'SDMX TIME_PERIOD text → DATE anchor (year/quarter/month/day). IMMUTABLE STRICT — backs observation.time_period_date GENERATED STORED.';


-- ── stats.observation — one data point (SDMX Observation), as a hypertable ──
-- Series = (dataset_code, time_period, dim_key). dim_key is a generic jsonb
-- series key (Law 1): a new dimension is new code-list data, never a schema
-- change. md5(dim_key::text) is deterministic because jsonb sorts keys — it is
-- the ON CONFLICT upsert target (INSERT ... ON CONFLICT, never check/delete/insert).
CREATE TABLE IF NOT EXISTS stats.observation (
  id              BIGINT      GENERATED ALWAYS AS IDENTITY,
  dataset_code    TEXT        NOT NULL REFERENCES stats.dataset(code) ON DELETE CASCADE,
  time_period     TEXT        NOT NULL,
  -- Parsed date for TimescaleDB hypertable + range queries (GENERATED STORED).
  time_period_date DATE       GENERATED ALWAYS AS (stats.parse_time_period(time_period)) STORED,
  -- dim_key: series key (all non-time dimensions). JSONB, canonical sorted keys.
  dim_key         JSONB       NOT NULL,
  dim_key_hash    TEXT        GENERATED ALWAYS AS (md5(dim_key::text)) STORED,
  obs_value       NUMERIC,
  obs_status      TEXT        NOT NULL DEFAULT 'A',
  obs_conf        TEXT        NOT NULL DEFAULT 'F',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obs_status_chk  CHECK (obs_status IN ('A','P','E','R','M')),
  CONSTRAINT obs_conf_chk    CHECK (obs_conf   IN ('F','C','N','D')),
  -- C3: enforce SDMX TIME_PERIOD format at write time (year / quarter / month / day).
  CONSTRAINT obs_time_period_fmt_chk CHECK (
    time_period ~ '^\d{4}(-Q[1-4]|-\d{2}(-\d{2})?)?$'
  )
);

COMMENT ON TABLE  stats.observation                  IS 'SDMX Observation, TimescaleDB hypertable partitioned on time_period_date. Series = (dataset_code, time_period, dim_key). Generic dim_key keeps the cube dimension-agnostic (Law 1).';
COMMENT ON COLUMN stats.observation.dim_key          IS 'Series key WITHOUT time_period, e.g. {"measure":"GDP","geo":"GE"}. jsonb = canonical sorted keys.';
COMMENT ON COLUMN stats.observation.dim_key_hash     IS 'md5(dim_key::text), deterministic because jsonb sorts keys. Uniqueness + ON CONFLICT target.';
COMMENT ON COLUMN stats.observation.time_period_date IS 'GENERATED from time_period via stats.parse_time_period — the hypertable partition column.';
COMMENT ON COLUMN stats.observation.obs_status       IS 'SDMX OBS_STATUS: A=normal P=preliminary E=estimate R=revised M=missing.';

-- TimescaleDB hypertable — partition by time_period_date, 3-month chunks.
-- if_not_exists => already-a-hypertable is a no-op (idempotent re-run).
SELECT create_hypertable(
  'stats.observation',
  'time_period_date',
  chunk_time_interval => INTERVAL '3 months',
  if_not_exists => TRUE
);

-- Columnar compression for cold chunks. segmentby groups a series together so
-- whole-series scans read one compressed segment; orderby keeps newest first.
ALTER TABLE stats.observation SET (
  timescaledb.compress,
  timescaledb.compress_segmentby  = 'dataset_code, dim_key_hash',
  timescaledb.compress_orderby    = 'time_period_date DESC, id'
);
SELECT add_compression_policy('stats.observation', INTERVAL '6 months', if_not_exists => TRUE);


-- ── Indexes on observation ──────────────────────────────────────────────
-- Uniqueness / upsert target. NOTE: a UNIQUE index on a TimescaleDB hypertable
-- MUST include the partition column (time_period_date). It is a deterministic
-- GENERATED function of time_period, so adding it does not change the logical
-- key — (dataset_code, time_period, dim_key_hash) still identifies the series.
CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_series
  ON stats.observation (dataset_code, time_period, dim_key_hash, time_period_date);

-- GIN for containment: WHERE dim_key @> '{"measure":"GDP"}'.
-- jsonb_path_ops — smaller & faster than default jsonb_ops for pure @> lookups.
CREATE INDEX IF NOT EXISTS idx_observation_dim_key
  ON stats.observation USING GIN (dim_key jsonb_path_ops);

-- Dataset time-range scans (the hottest read path).
CREATE INDEX IF NOT EXISTS idx_observation_dataset_date
  ON stats.observation (dataset_code, time_period_date);


-- ── stats.observation — dim_key VALIDATION trigger (C2: the audit gap) ───
-- Before write, validate dim_key against the DSD (dataset_dimension) and the
-- classifier code lists. Nothing structurally invalid enters the cube.
CREATE OR REPLACE FUNCTION stats.validate_observation_dim_key()
RETURNS TRIGGER AS $$
DECLARE
  expected_dims TEXT[];
  actual_dims   TEXT[];
  dim           TEXT;
  val           TEXT;
  classifier_ok BOOLEAN;
BEGIN
  -- 1. Fetch non-time dimensions declared for this dataset.
  SELECT array_agg(dim_code ORDER BY ord)
    INTO expected_dims
    FROM stats.dataset_dimension
   WHERE dataset_code = NEW.dataset_code
     AND is_time_dim  = false;

  IF expected_dims IS NULL THEN
    RAISE EXCEPTION 'dataset % has no DSD declared', NEW.dataset_code;
  END IF;

  -- 2. Keys in dim_key must match expected dims exactly (set equality).
  SELECT array_agg(k ORDER BY k)
    INTO actual_dims
    FROM jsonb_object_keys(NEW.dim_key) k;

  IF actual_dims IS DISTINCT FROM (SELECT array_agg(d ORDER BY d) FROM unnest(expected_dims) d) THEN
    RAISE EXCEPTION 'dim_key keys % do not match DSD % for dataset %',
      actual_dims, expected_dims, NEW.dataset_code;
  END IF;

  -- 3. Each value must exist in the classifier for that dimension.
  FOR dim IN SELECT jsonb_object_keys(NEW.dim_key) LOOP
    val := NEW.dim_key ->> dim;
    SELECT EXISTS(
      SELECT 1 FROM stats.classifier
       WHERE dim_code = dim AND code = val
    ) INTO classifier_ok;
    IF NOT classifier_ok THEN
      RAISE EXCEPTION 'dim_key value %.%=% not found in classifier',
        NEW.dataset_code, dim, val;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.validate_observation_dim_key() IS
  'BEFORE INSERT/UPDATE OF dim_key: validates dim_key keys against the DSD and each value against stats.classifier. Rejects structurally invalid observations (corpus integrity).';

DROP TRIGGER IF EXISTS trg_observation_validate_dim_key ON stats.observation;
CREATE TRIGGER trg_observation_validate_dim_key
  BEFORE INSERT OR UPDATE OF dim_key ON stats.observation
  FOR EACH ROW EXECUTE FUNCTION stats.validate_observation_dim_key();


-- ── Triggers — updated_at on mutable stats tables ───────────────────────
DROP TRIGGER IF EXISTS trg_dataset_updated_at ON stats.dataset;
CREATE TRIGGER trg_dataset_updated_at BEFORE UPDATE ON stats.dataset
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_observation_updated_at ON stats.observation;
CREATE TRIGGER trg_observation_updated_at BEFORE UPDATE ON stats.observation
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();
