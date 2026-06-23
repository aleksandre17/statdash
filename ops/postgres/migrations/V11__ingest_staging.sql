-- ════════════════════════════════════════════════════════════════════════
-- V11__ingest_staging.sql — Staged Submission Pipeline: bronze + silver + jobs
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V10 are applied + immutable.
--
-- The cube (stats.*, the GOLD layer) is currently loaded by a manual seed
-- script that writes straight into stats.observation / stats.classifier /
-- stats.classifier_display. There is no provenance, no replay, no validation
-- gate, and no async job lifecycle — a bad payload corrupts gold in place.
--
-- This migration introduces the Medallion data architecture (bronze → silver
-- → gold) in its own schema, stats_stage, so ingestion is a Pipe-and-Filter
-- pipeline whose stages each own a table:
--
--   BRONZE (submission_blob)   — raw payload stored untouched. Provenance +
--                                replay. content_hash = dedup / idempotency key.
--   SILVER (obs_staging,       — parsed, conformed rows. Accepts anything; the
--           classifier_staging,  conform/validate filters annotate each row and
--           display_staging)     emit validation_issue diagnostics. Gold is
--                                NEVER touched until status reaches 'publishing'.
--   JOB    (submission)        — the FSM root. One row per upload / registry
--                                pull. received→parsing→staged→publishing→
--                                published (or failed/rejected).
--
-- SSOT: gold (stats.*) remains the single authoritative home for published
-- figures. Silver is a derived, disposable staging copy keyed by submission;
-- on rollback or purge it can be truncated without touching gold. The raw
-- bronze blob is the immutable provenance record — re-submission creates a NEW
-- blob, never mutates an existing one (event-sourcing-lite for ingestion).
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. Pure addition of ONE new schema (stats_stage)
--                   and seven tables wholly inside it, plus their indexes.
--                   No V1-V10 object — table, column, function, constraint,
--                   index, trigger, hypertable, or policy — is created,
--                   altered, or dropped. Revert = DROP SCHEMA stats_stage
--                   CASCADE (drops only this migration's objects; the gold
--                   cube and config schema are untouched).
--   Blast radius  : NONE on existing objects. FKs point INTO stats_stage only
--                   (submission ← blob/staging/issue, all ON DELETE CASCADE);
--                   NO foreign key references stats.* — silver→gold coupling is
--                   resolved at publish time in application code, not by a DB
--                   constraint (gold's hypertable cannot be an FK target, V8,
--                   and silver must accept rows whose codes do not yet exist in
--                   gold — that is precisely what validate reports).
--   Rollback plan : DROP SCHEMA IF EXISTS stats_stage CASCADE;
--                   (Sacrifices in-flight submissions + their bronze blobs +
--                   silver rows + issue logs — all disposable staging state;
--                   any already-published data lives in gold and is unaffected.)
--   Data safety   : NO data is seeded. The migration ships STRUCTURE only.
--                   Bronze raw_content may carry untrusted payloads — it is
--                   stored verbatim as TEXT and never executed; the conform
--                   filter parses it in the application layer, not in SQL.
--   Hypertable    : N/A. obs_staging is a PLAIN table (silver is sparse,
--                   transient, per-submission — chunking buys nothing and would
--                   cost the surrogate-PK / FK ergonomics; cf. V8 rationale for
--                   observation_revision). Promotion to the gold hypertable
--                   happens at publish via ordinary INSERT ... ON CONFLICT.
--
-- Idempotent: CREATE SCHEMA / TABLE / INDEX ... IF NOT EXISTS throughout.
-- Re-run = converge, never error. Additive only; never edits V1-V10.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage — the ingestion staging context (bronze + silver + jobs)
-- ════════════════════════════════════════════════════════════════════════
-- A third schema (alongside config + stats from V2) so the staging lifecycle
-- is namespaced, independently grant-able (ETL role writes here; the public
-- read path never sees it), and droppable as a unit without risking gold.
CREATE SCHEMA IF NOT EXISTS stats_stage;

COMMENT ON SCHEMA stats_stage IS
  'Staged Submission Pipeline (Medallion: bronze raw blob + silver staging rows + job FSM). Feeds the gold cube (stats.*) only on PUBLISH. Disposable per-submission state; gold is never written until status=publishing.';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.submission — job header (the FSM root)
-- ════════════════════════════════════════════════════════════════════════
-- One row per upload or registry pull. status is the finite-state machine:
--   received → parsing → staged → publishing → published
-- with terminal failed / rejected. dataset_code is required only for
-- kind='facts' (codelists/displays span dimensions, not one dataset) — that
-- conditional requirement is enforced by submission_facts_dataset_chk so an
-- illegal header state is unrepresentable (fail-fast at write time).
CREATE TABLE IF NOT EXISTS stats_stage.submission (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT        NOT NULL,   -- 'facts' | 'codelists' | 'displays'
  dataset_code  TEXT,                   -- required for kind='facts'; NULL for codelists/displays
  status        TEXT        NOT NULL DEFAULT 'received',
  source        TEXT,                   -- 'api-upload' | 'sdmx-registry' | 'seed-script' | 'xlsx-import'
  format        TEXT,                   -- 'sdmx-json' | 'sdmx-ml' | 'csv' | 'xlsx' | 'bundle'
  submitted_by  TEXT,                   -- user id or system name
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  staged_at     TIMESTAMPTZ,            -- when silver rows were written
  published_at  TIMESTAMPTZ,            -- when promoted to gold
  row_count     INT,                    -- total rows parsed
  staged_count  INT,                    -- rows successfully staged
  issue_count   INT,                    -- count of validation_issue rows
  error_detail  TEXT,                   -- human-readable on terminal failure
  dry_run       BOOLEAN     NOT NULL DEFAULT false,
  CONSTRAINT submission_kind_chk   CHECK (kind   IN ('facts', 'codelists', 'displays')),
  CONSTRAINT submission_status_chk CHECK (status IN (
    'received', 'parsing', 'staged', 'publishing', 'published', 'failed', 'rejected'
  )),
  -- A 'facts' submission with no dataset_code cannot be published (gold facts
  -- are dataset-scoped). codelists/displays MUST leave it NULL (they are
  -- cross-dataset). Make both illegal states unrepresentable.
  CONSTRAINT submission_facts_dataset_chk CHECK (
    (kind = 'facts'  AND dataset_code IS NOT NULL) OR
    (kind <> 'facts' AND dataset_code IS NULL)
  )
);

COMMENT ON TABLE stats_stage.submission IS
  'Job header for the Staged Submission Pipeline. FSM: received→parsing→staged→publishing→published (or failed/rejected). One row per upload or registry pull. Gold cube is never touched until status=publishing.';
COMMENT ON COLUMN stats_stage.submission.kind         IS
  'Payload class: facts (observations, dataset-scoped) | codelists (classifiers, cross-dataset) | displays (display overlays, cross-dataset). Drives which silver table the conform filter writes.';
COMMENT ON COLUMN stats_stage.submission.dataset_code IS
  'Target dataset for kind=facts (NOT NULL); NULL for codelists/displays (submission_facts_dataset_chk). Resolved against stats.dataset only at publish time — not FK-enforced here so a fact set can stage before its dataset exists in gold (validate reports the gap).';
COMMENT ON COLUMN stats_stage.submission.status       IS
  'FSM state (submission_status_chk). The drain worker selects on this. publishing is the ONLY state in which gold (stats.*) is written; failed/rejected are terminal with error_detail set.';
COMMENT ON COLUMN stats_stage.submission.dry_run      IS
  'true = run conform+validate and report impact (is_new/is_changed counts, issues) but STOP before publishing. The safe-preview path; a dry run can never reach status=published.';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.submission_blob — raw payload (BRONZE)
-- ════════════════════════════════════════════════════════════════════════
-- The untouched payload for every submission. Immutable: a re-submission
-- creates a NEW blob (never an UPDATE), so bronze is an append-only provenance
-- trail. content_hash (SHA-256 of raw_content) is the dedup / replay-guard
-- key — the app can recognise an identical re-upload before spending the
-- parse/validate budget (Idempotent Receiver, EIP).
CREATE TABLE IF NOT EXISTS stats_stage.submission_blob (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES stats_stage.submission(id) ON DELETE CASCADE,
  content_hash  TEXT        NOT NULL,   -- SHA-256 hex of raw_content (dedup / replay guard)
  raw_content   TEXT        NOT NULL,   -- raw payload (SDMX-JSON/ML, CSV text, bundle JSON)
  byte_size     INT         NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats_stage.submission_blob IS
  'Bronze: raw untouched payload for every submission. content_hash enables dedup and replay. Never mutated — a re-submission creates a new blob.';
COMMENT ON COLUMN stats_stage.submission_blob.content_hash IS
  'SHA-256 hex digest of raw_content. The idempotency / replay-guard key: an identical re-upload is detectable before re-parsing. Computed in the application layer (not a generated column — raw_content can be large and the hash is supplied by the uploader path).';
COMMENT ON COLUMN stats_stage.submission_blob.raw_content  IS
  'Verbatim payload bytes as TEXT (SDMX-JSON/ML, CSV, bundle JSON). Stored, never executed; parsed by the conform filter in the application layer. The provenance source of truth for replay.';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.obs_staging — SILVER facts
-- ════════════════════════════════════════════════════════════════════════
-- Mirror of stats.observation WITHOUT the hypertable, the generated columns,
-- the DSD/classifier validation trigger, or the value CHECKs. Silver is
-- deliberately permissive (Postel: liberal in what it accepts) — it holds
-- whatever parsed out of the payload, and the validate filter annotates each
-- row (is_new / is_changed) and emits validation_issue diagnostics rather than
-- rejecting at write time. Promotion to gold (where the V4 triggers DO fire)
-- happens at publish via INSERT ... ON CONFLICT.
CREATE TABLE IF NOT EXISTS stats_stage.obs_staging (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id UUID        NOT NULL REFERENCES stats_stage.submission(id) ON DELETE CASCADE,
  dataset_code  TEXT        NOT NULL,
  time_period   TEXT        NOT NULL,
  dim_key       JSONB       NOT NULL DEFAULT '{}',
  obs_value     NUMERIC,
  obs_status    TEXT,
  obs_attribute JSONB       NOT NULL DEFAULT '{}',
  row_index     INT,                   -- original row number in the submission (for issue reporting)
  is_new        BOOLEAN,               -- set by validate: true=insert, false=update (impact preview)
  is_changed    BOOLEAN                -- set by validate: value/status/attr differs from gold
);

COMMENT ON TABLE stats_stage.obs_staging IS
  'Silver facts: parsed observations staged per submission. Permissive mirror of stats.observation (no hypertable, no generated cols, no validation trigger). validate annotates is_new/is_changed for impact preview; publish promotes to the gold cube via INSERT ... ON CONFLICT.';
COMMENT ON COLUMN stats_stage.obs_staging.dim_key    IS
  'Parsed series key (non-time dimensions), e.g. {"measure":"GDP","geo":"GE"}. NOT validated against the DSD/classifiers here — that is the validate filter''s job, reported as validation_issue, not enforced as a constraint.';
COMMENT ON COLUMN stats_stage.obs_staging.is_new     IS
  'Set by validate by probing gold on the logical key: true = would INSERT, false = would UPDATE an existing observation. Drives the impact preview shown before publish.';
COMMENT ON COLUMN stats_stage.obs_staging.is_changed IS
  'Set by validate: true when value/status/attribute differs from the current gold row (false for a no-op re-load). Lets a dry run report "N changed, M unchanged".';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.classifier_staging — SILVER codelists
-- ════════════════════════════════════════════════════════════════════════
-- Permissive mirror of stats.classifier (without the surrogate-id LTREE path,
-- the FK to stats.dimension, or the dim_code+code UNIQUE). Hierarchy is staged
-- as parent_code (business code), not parent_id — the gold surrogate id chain
-- is resolved at publish time. Lets a code list stage even if its dimension
-- or parent does not yet exist in gold (validate reports UNKNOWN_DIM / missing
-- parent rather than blocking the stage).
CREATE TABLE IF NOT EXISTS stats_stage.classifier_staging (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id UUID        NOT NULL REFERENCES stats_stage.submission(id) ON DELETE CASCADE,
  dim_code      TEXT        NOT NULL,
  code          TEXT        NOT NULL,
  label         JSONB       NOT NULL DEFAULT '{}',  -- {"ka":"...","en":"..."}
  parent_code   TEXT,
  ord           INT         NOT NULL DEFAULT 0,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  row_index     INT
);

COMMENT ON TABLE stats_stage.classifier_staging IS
  'Silver codelists: parsed classifier entries staged per submission. Permissive mirror of stats.classifier — hierarchy by parent_code (business code), resolved to the gold surrogate id chain at publish. No FK to stats.dimension; validate reports unknown dimensions/parents.';
COMMENT ON COLUMN stats_stage.classifier_staging.parent_code IS
  'Parent classifier''s business code (not the gold surrogate id). NULL = root. Resolved to parent_id at publish; a dangling parent is a validate-time issue, not a stage-time error.';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.display_staging — SILVER display overlays
-- ════════════════════════════════════════════════════════════════════════
-- Permissive mirror of the display overlay (stats.classifier_display). Carries
-- dim_code + code (business identity) + locale, used to resolve the gold
-- member_id at publish time. No FK to the classifier — a display can stage
-- before its classifier exists (validate reports UNKNOWN_CODE).
CREATE TABLE IF NOT EXISTS stats_stage.display_staging (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id UUID        NOT NULL REFERENCES stats_stage.submission(id) ON DELETE CASCADE,
  dim_code      TEXT        NOT NULL,  -- used to resolve member_id at publish time
  code          TEXT        NOT NULL,  -- classifier code
  locale        TEXT        NOT NULL,
  display       JSONB       NOT NULL DEFAULT '{}',
  row_index     INT
);

COMMENT ON TABLE stats_stage.display_staging IS
  'Silver display overlays: parsed display rows staged per submission. (dim_code, code, locale) is the business identity, resolved to the gold member_id at publish. No FK to the classifier — validate reports an unknown code rather than blocking the stage.';


-- ════════════════════════════════════════════════════════════════════════
-- stats_stage.validation_issue — per-row diagnostics
-- ════════════════════════════════════════════════════════════════════════
-- The output of the conform + validate filters. Severity gates the pipeline:
--   error → blocks PUBLISH (the submission cannot reach published)
--   warn  → requires human review before publish
--   info  → informational only
-- Retained with the submission (ON DELETE CASCADE) so the diagnostic survives
-- as long as its job header — the audit trail of why a load was (or was not)
-- accepted.
CREATE TABLE IF NOT EXISTS stats_stage.validation_issue (
  id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id UUID        NOT NULL REFERENCES stats_stage.submission(id) ON DELETE CASCADE,
  layer         TEXT        NOT NULL,  -- 'conform' | 'validate'
  row_index     INT,
  severity      TEXT        NOT NULL,  -- 'error' | 'warn' | 'info'
  code          TEXT        NOT NULL,  -- e.g. 'UNKNOWN_CODE', 'MISSING_LOCALE', 'UNKNOWN_DIM'
  detail        JSONB       NOT NULL DEFAULT '{}',  -- { field, value, expected, ... }
  CONSTRAINT validation_issue_severity_chk CHECK (severity IN ('error', 'warn', 'info')),
  CONSTRAINT validation_issue_layer_chk    CHECK (layer    IN ('conform', 'validate'))
);

COMMENT ON TABLE stats_stage.validation_issue IS
  'Per-row diagnostic from conform + validate filters. error-severity blocks PUBLISH. warn-severity requires human review. Retained with the submission for audit.';
COMMENT ON COLUMN stats_stage.validation_issue.layer    IS
  'Which Pipe-and-Filter stage raised it: conform (parse/shape errors) | validate (conformance against the DSD/classifiers + gold impact).';
COMMENT ON COLUMN stats_stage.validation_issue.code     IS
  'Machine-readable issue code (UNKNOWN_CODE, MISSING_LOCALE, UNKNOWN_DIM, …). Stable identifier the API surfaces; human text is derived from it in the app, not stored.';
COMMENT ON COLUMN stats_stage.validation_issue.detail   IS
  'Structured context for the issue: { field, value, expected, … }. JSONB so a new issue code carries its own shape without a schema change.';


-- ════════════════════════════════════════════════════════════════════════
-- Indexes
-- ════════════════════════════════════════════════════════════════════════
-- Job status filter — drain worker queries 'received' / 'staged' submissions
CREATE INDEX IF NOT EXISTS idx_submission_status    ON stats_stage.submission (status);
CREATE INDEX IF NOT EXISTS idx_submission_kind      ON stats_stage.submission (kind);
-- blob dedup guard
CREATE INDEX IF NOT EXISTS idx_blob_content_hash    ON stats_stage.submission_blob (content_hash);
-- silver → gold publish scan
CREATE INDEX IF NOT EXISTS idx_obs_staging_sub      ON stats_stage.obs_staging     (submission_id);
CREATE INDEX IF NOT EXISTS idx_cls_staging_sub      ON stats_stage.classifier_staging (submission_id);
CREATE INDEX IF NOT EXISTS idx_dsp_staging_sub      ON stats_stage.display_staging  (submission_id);
-- issue report
CREATE INDEX IF NOT EXISTS idx_issue_sub_severity   ON stats_stage.validation_issue (submission_id, severity);
