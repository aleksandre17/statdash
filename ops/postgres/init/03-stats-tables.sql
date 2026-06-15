-- DEPRECATED: Use Flyway migrations in ops/postgres/migrations/ (V4__stats_tables.sql).
-- This file kept for reference only. Flyway is the canonical migration source.
-- NOTE: the migrations REDESIGN this schema (dimension_value → classifier+LTREE,
-- observation → TimescaleDB hypertable + dim_key validation). Do not run both.
-- ════════════════════════════════════════════════════════════════════════
-- 03-stats-tables.sql — `stats` schema: SDMX data cube (ISO 17369)
-- ════════════════════════════════════════════════════════════════════════
-- Standard adopted whole (Law 4) + no privileged dimensions (Law 1):
--   dimension       — the axes of the cube (measure, time, geo, …) by CODE only
--   dimension_value — code-list entries with multilingual labels
--   dataset         — a named flow of related series (Dataflow)
--   dataset_dimension — which dimensions a dataset is keyed by (DSD)
--   observation     — one data point, keyed by a GENERIC jsonb series key
--
-- Generic dim_key (jsonb) — NOT a column per dimension — is what makes the
-- cube dimension-agnostic: a new dimension is new code-list data, never a
-- schema change. Mirrors the engine's SectionContext.dims (Record<string,DimVal>).
--
-- Idempotent: CREATE ... IF NOT EXISTS; no DROP.

-- Reuse the trigger function defined in 02 (same DB, single connection at init).
-- Stats lives in its own schema but shares config.set_updated_at() — one audit
-- mechanism for the whole database.


-- ── stats.dimension — cube axes (no hardcoded names; CODE is the identity) ──
CREATE TABLE IF NOT EXISTS stats.dimension (
  code       TEXT        PRIMARY KEY,                 -- 'measure' | 'time' | 'geo' | … (generic)
  label      JSONB       NOT NULL,                    -- {"ka":"მაჩვენებელი","en":"Measure"}
  ord        INT         NOT NULL DEFAULT 0,          -- display order of axes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  stats.dimension      IS 'SDMX Dimension — a cube axis. No privileged names (Law 1); code IS the identity.';
COMMENT ON COLUMN stats.dimension.code IS 'Generic axis code, e.g. measure/time/geo. Engine reads ctx.dims[code], never a fixed field.';


-- ── stats.dimension_value — code-list entries (multilingual, hierarchical) ──
CREATE TABLE IF NOT EXISTS stats.dimension_value (
  dim_code    TEXT        NOT NULL REFERENCES stats.dimension(code) ON DELETE CASCADE,
  code        TEXT        NOT NULL,                   -- 'GDP' | 'GE' | '2023'
  label       JSONB       NOT NULL,                   -- {"ka":"მშპ","en":"GDP"}
  color       TEXT,                                   -- optional viz color hint
  parent_code TEXT,                                   -- hierarchical code lists (SDMX HierarchicalCodelist)
  ord         INT         NOT NULL DEFAULT 0,
  metadata    JSONB       NOT NULL DEFAULT '{}',      -- SDMX attributes (unit, isoCode, nutsLevel, …)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Composite PK: a code is unique WITHIN its dimension (geo:GE vs measure:GE differ).
  PRIMARY KEY (dim_code, code),
  -- Hierarchy edge points at a sibling code in the SAME dimension.
  CONSTRAINT dim_value_parent_fk
    FOREIGN KEY (dim_code, parent_code)
    REFERENCES stats.dimension_value(dim_code, code) ON DELETE SET NULL
);

COMMENT ON TABLE  stats.dimension_value             IS 'SDMX Codelist entry. PK (dim_code, code): codes unique within a dimension. Self-FK = hierarchy.';
COMMENT ON COLUMN stats.dimension_value.parent_code IS 'Parent code in the same dimension (regions → subregions). Resolved via parent-edge traversal.';

CREATE INDEX IF NOT EXISTS idx_dim_value_parent ON stats.dimension_value (dim_code, parent_code);


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


-- ── stats.observation — one data point (SDMX Observation) ───────────────
-- DESIGN DECISION — uniqueness on a jsonb series key:
--   A series is identified by (dataset_code, time_period, dim_key). We CANNOT
--   put jsonb in a B-tree UNIQUE/PK directly, and we must treat key-order-
--   independent equality: {"geo":"GE","measure":"GDP"} == {"measure":"GDP","geo":"GE"}.
--
--   Postgres `jsonb` stores object keys in a canonical (sorted) internal form,
--   so `dim_key::text` renders deterministically regardless of insert order.
--   We therefore key uniqueness off md5(dim_key::text) via a STORED generated
--   column — fast, deterministic equality and a valid ON CONFLICT target for
--   idempotent upserts (INSERT ... ON CONFLICT, never check/delete/insert).
--
--   Separately, a GIN index (jsonb_path_ops) on dim_key powers containment
--   queries (@>): "every observation where measure=GDP" without scanning.
CREATE TABLE IF NOT EXISTS stats.observation (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_code  TEXT        NOT NULL REFERENCES stats.dataset(code) ON DELETE CASCADE,
  time_period   TEXT        NOT NULL,                 -- '2023' | '2023-Q1' | '2023-01' (SDMX TIME_PERIOD)
  dim_key       JSONB       NOT NULL,                 -- series key sans time: {"measure":"GDP","geo":"GE"}
  -- Canonical, deterministic hash of the (sorted-key) jsonb — see decision above.
  dim_key_hash  TEXT        GENERATED ALWAYS AS (md5(dim_key::text)) STORED,
  obs_value     NUMERIC,                              -- OBS_VALUE (nullable: missing/suppressed)
  obs_status    TEXT        NOT NULL DEFAULT 'A',     -- SDMX OBS_STATUS
  obs_conf      TEXT        NOT NULL DEFAULT 'F',     -- SDMX CONF_STATUS: F=free C=confidential
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT obs_status_chk CHECK (obs_status IN ('A', 'P', 'E', 'R', 'M')),
  CONSTRAINT obs_conf_chk   CHECK (obs_conf   IN ('F', 'C', 'N', 'D'))
);

COMMENT ON TABLE  stats.observation              IS 'SDMX Observation. Series = (dataset_code, time_period, dim_key). Generic dim_key keeps the cube dimension-agnostic (Law 1).';
COMMENT ON COLUMN stats.observation.dim_key      IS 'Series key WITHOUT time_period, e.g. {"measure":"GDP","geo":"GE"}. jsonb = canonical sorted keys.';
COMMENT ON COLUMN stats.observation.dim_key_hash IS 'md5(dim_key::text), deterministic because jsonb sorts keys. Uniqueness + ON CONFLICT target.';
COMMENT ON COLUMN stats.observation.obs_status   IS 'SDMX OBS_STATUS: A=normal P=preliminary E=estimate R=revised M=missing.';

-- Uniqueness / upsert target: one value per (dataset, period, series).
CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_series
  ON stats.observation (dataset_code, time_period, dim_key_hash);

-- Containment queries over the series key: WHERE dim_key @> '{"measure":"GDP"}'.
-- jsonb_path_ops — smaller & faster than default jsonb_ops for pure @> lookups.
CREATE INDEX IF NOT EXISTS idx_observation_dim_key
  ON stats.observation USING gin (dim_key jsonb_path_ops);

-- Common slice: a dataset''s observations for a period (time-series scans).
CREATE INDEX IF NOT EXISTS idx_observation_dataset_time
  ON stats.observation (dataset_code, time_period);


-- ── Triggers — updated_at on mutable stats tables ───────────────────────
DROP TRIGGER IF EXISTS trg_dataset_updated_at ON stats.dataset;
CREATE TRIGGER trg_dataset_updated_at BEFORE UPDATE ON stats.dataset
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

DROP TRIGGER IF EXISTS trg_observation_updated_at ON stats.observation;
CREATE TRIGGER trg_observation_updated_at BEFORE UPDATE ON stats.observation
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();
