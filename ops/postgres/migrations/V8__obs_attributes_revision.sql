-- ════════════════════════════════════════════════════════════════════════
-- V8__obs_attributes_revision.sql — SDMX obs attributes + revision audit log
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V7 are applied + immutable.
--
--   GAP 1 (SDMX obs-attribute completeness) — stats.observation.obs_attribute
--      jsonb bag. SDMX defines many observation-level attributes (OBS_CONF*,
--      OBS_PRE_BREAK, DECIMALS, UNIT_MEASURE override, COMMENT, …). Modelling
--      each as a typed column is Lehman-rot: a new attribute = an ALTER. The
--      open bag catches everything, so a new attribute is a write, never a
--      migration. obs_status (V4, typed) STAYS — it is the hottest attribute
--      and earns its CHECK-constrained column. obs_conf (V4, typed) likewise.
--      The bag is for the long tail (incl. seqPos from the ACCOUNTS bundle,
--      which V7 documented as "stored on the observation metadata" but had no
--      home for — this is that home).
--
--   GAP 4 (revision history) — stats.observation_revision append-only log +
--      a BEFORE UPDATE trigger that captures the OLD value/status/attribute
--      whenever obs_value, obs_status, or obs_attribute changes. A re-seed's
--      ON CONFLICT DO UPDATE previously overwrote silently (data outlives
--      code, but the PRIOR datum was lost). Now every revision is recorded
--      with no seed change — the audit is implicit (trigger-driven).
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY (additive). obs_attribute is ADD COLUMN ... DEFAULT
--                   '{}' (no rewrite of existing rows on PG ≥ 11 — the default
--                   is stored in catalog, not back-filled). observation_revision
--                   is a new table. Rollback = DROP COLUMN / DROP TABLE / DROP
--                   TRIGGER, no data reshape of the hot path.
--   Blast radius  : LOW. No change to the partition column, the unique index,
--                   the compression settings, or any existing column type. The
--                   new trigger fires only on UPDATE of the three value columns
--                   (BEFORE UPDATE OF ...), so pure inserts (the seed's hot
--                   path) pay nothing.
--   Rollback plan : DROP TRIGGER trg_observation_capture_revision;
--                   DROP TABLE stats.observation_revision;
--                   ALTER TABLE stats.observation DROP COLUMN obs_attribute;
--                   (Audit rows are sacrificed on rollback — acceptable for a
--                   log table; the observations themselves are untouched.)
--   Hypertable    : UNAFFECTED. obs_attribute is a plain jsonb column on the
--                   hypertable (allowed); it is NOT the partition key and is NOT
--                   in any unique/segmentby clause. observation_revision is a
--                   PLAIN table (deliberately NOT a hypertable) — an audit log
--                   is low-volume relative to the cube and benefits from a real
--                   surrogate PK + ordinary indexes.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- CREATE OR REPLACE / DROP TRIGGER IF EXISTS. Re-run = no-op. No DROP of any
-- V1-V7 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- GAP 1 — stats.observation.obs_attribute : open SDMX attribute bag
-- ════════════════════════════════════════════════════════════════════════
-- DEFAULT '{}' (not NULL) so consumers never branch on null vs empty — the
-- bag is always an object (Postel: liberal readers, but a stable shape). On
-- PG ≥ 11 a non-volatile DEFAULT on ADD COLUMN is a metadata-only operation
-- (no full-table rewrite), so this is safe on a populated hypertable.
--
-- TimescaleDB note: ADD COLUMN with a CONSTANT default is supported on a
-- compressed hypertable in TimescaleDB ≥ 2.11 (the platform's image). The
-- default is a non-volatile literal, so no chunk decompression is required.
-- If applied against an older Timescale build that rejects ADD COLUMN on
-- compressed chunks, the operator decompresses first
-- (SELECT decompress_chunk(c) FROM show_chunks('stats.observation') c;),
-- runs V8, then lets the compression policy re-compress. Documented here so a
-- failed apply has a known, bounded remediation rather than a guess.
ALTER TABLE stats.observation
  ADD COLUMN IF NOT EXISTS obs_attribute JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN stats.observation.obs_attribute IS
  'Open SDMX observation-attribute bag (the long tail beyond the typed obs_status/obs_conf): OBS_PRE_BREAK, DECIMALS, UNIT_MEASURE override, COMMENT, seqPos, … . A new attribute is a write, never an ALTER. Structural keys live in dim_key; never here.';

-- Optional containment index for "all pre-break observations" / attribute
-- filters. jsonb_path_ops = compact, fast for the @> containment use case.
CREATE INDEX IF NOT EXISTS idx_observation_obs_attribute
  ON stats.observation USING GIN (obs_attribute jsonb_path_ops);


-- ════════════════════════════════════════════════════════════════════════
-- GAP 4 — stats.observation_revision : append-only revision audit log
-- ════════════════════════════════════════════════════════════════════════
-- GRAIN: one row per VALUE-CHANGING update of an observation, capturing the
-- pre-image (the OLD value/status/attribute). The current value always lives
-- on stats.observation (SSOT); this table is the immutable trail of what it
-- USED to be — event-sourcing-lite for the cube's most audit-sensitive datum.
--
-- WHY NOT a foreign key to stats.observation: TimescaleDB hypertables do not
-- support being the TARGET of a foreign key (the chunk layout makes a stable
-- referenced unique key across partitions impractical). The reference is
-- therefore by the SAME logical identity the cube upserts on
-- (dataset_code, time_period, dim_key_hash) — sufficient for an audit log and
-- consistent with how the seed locates a row. We also keep the obs surrogate
-- id (best-effort, may be null on bulk paths) for convenience.
--
-- WHY a plain table (not a hypertable): revisions are sparse vs observations
-- (only changed rows, only on re-load), so a hypertable's chunking buys
-- nothing and costs the FK-target / unique-PK ergonomics. A normal BIGINT
-- IDENTITY PK + btree indexes is the right store for this workload
-- (Polyglot Persistence within one engine — store per workload).
CREATE TABLE IF NOT EXISTS stats.observation_revision (
  id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  observation_id    BIGINT,                       -- best-effort surrogate (no FK; hypertable limitation)
  dataset_code      TEXT        NOT NULL,
  time_period       TEXT        NOT NULL,
  dim_key_hash      TEXT        NOT NULL,          -- logical reference to the observation series
  obs_value_old     NUMERIC,
  obs_status_old    TEXT,
  obs_attribute_old JSONB,
  revised_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revised_by        TEXT,                          -- ETL job name / operator id (from app.revised_by GUC)
  revision_note     TEXT
);

COMMENT ON TABLE stats.observation_revision IS
  'Append-only revision audit log for stats.observation. One row per value-changing UPDATE, holding the PRE-image (old value/status/attribute). No FK to observation (hypertable cannot be an FK target) — referenced by the logical key (dataset_code, time_period, dim_key_hash). Data outlives code: a revised figure no longer destroys its predecessor.';
COMMENT ON COLUMN stats.observation_revision.revised_by IS
  'Who/what made the change. Sourced from the app.revised_by GUC if the ETL/session sets it (SET LOCAL app.revised_by = ''seed''); NULL otherwise.';

-- "history of one series" — the hot read for a revision timeline.
CREATE INDEX IF NOT EXISTS idx_obs_revision_series
  ON stats.observation_revision (dataset_code, time_period, dim_key_hash);
-- "what changed in this dataset, newest first" — audit review.
CREATE INDEX IF NOT EXISTS idx_obs_revision_dataset_time
  ON stats.observation_revision (dataset_code, revised_at DESC);


-- ── Capture trigger — records the pre-image on a value-changing UPDATE ────
-- Fires BEFORE UPDATE OF the three value-bearing columns only, so structural
-- touches (e.g. updated_at-only writes) and pure INSERTs cost nothing. Guards
-- on IS DISTINCT FROM so a no-op upsert (same value) writes no revision —
-- idempotent re-seed of unchanged data leaves the log clean.
CREATE OR REPLACE FUNCTION stats.capture_observation_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.obs_value     IS DISTINCT FROM OLD.obs_value
     OR NEW.obs_status IS DISTINCT FROM OLD.obs_status
     OR NEW.obs_attribute IS DISTINCT FROM OLD.obs_attribute
  THEN
    INSERT INTO stats.observation_revision (
      observation_id, dataset_code, time_period, dim_key_hash,
      obs_value_old, obs_status_old, obs_attribute_old, revised_by
    )
    VALUES (
      OLD.id, OLD.dataset_code, OLD.time_period, OLD.dim_key_hash,
      OLD.obs_value, OLD.obs_status, OLD.obs_attribute,
      -- NULL-safe: returns NULL when the GUC is unset (missing_ok = true).
      current_setting('app.revised_by', true)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION stats.capture_observation_revision() IS
  'BEFORE UPDATE OF obs_value/obs_status/obs_attribute: appends the OLD image to stats.observation_revision when any value-bearing column actually changes (IS DISTINCT FROM guard → no log row on a same-value upsert). revised_by from the app.revised_by GUC.';

DROP TRIGGER IF EXISTS trg_observation_capture_revision ON stats.observation;
CREATE TRIGGER trg_observation_capture_revision
  BEFORE UPDATE OF obs_value, obs_status, obs_attribute ON stats.observation
  FOR EACH ROW EXECUTE FUNCTION stats.capture_observation_revision();
