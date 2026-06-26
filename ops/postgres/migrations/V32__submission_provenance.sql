-- ════════════════════════════════════════════════════════════════════════
-- V32__submission_provenance.sql — ADR-0031 §4 (improvement 4) W3C PROV lineage
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V31 are applied + immutable.
--
--   THE GAP (ADR-0031 improvement 4) — the Staged Submission Pipeline already has
--   an event spine that IS a W3C PROV graph in waiting: stats_stage.submission
--   (the Activity), stats.release V25 (the publication Activity), and
--   observation_revision V8 (the Entity vintage chain), with submitted_by as the
--   Agent. What it CANNOT yet record is the lineage of the SOURCE that produced a
--   submission — the bytes of the uploaded workbook and the parser/mapping/ruleset
--   that transformed them. submission_blob.content_hash is the hash of the JSON
--   PAYLOAD (the idempotency key), NOT the hash of the original source file; the two
--   differ (the canonical-workbook parser deserializes xlsx → a JSON bronze payload).
--   Without the source digest + the transform identity, the PROV graph is broken at
--   its most important edge — "which file, parsed how, became these observations".
--
--   THE DECISION — capture lineage on the submission row with TWO cheap, nullable,
--   additive columns (NOT a parallel provenance store — the PROV graph stays
--   DERIVABLE from the existing tables, Entity=obs/dataset · Activity=submission/
--   release · Agent=curator):
--
--     source_digest TEXT  — SHA-256 hex of the SOURCE bytes (the uploaded workbook),
--                           distinct from submission_blob.content_hash (the payload
--                           hash). The lineage key back to the exact ingested file;
--                           also the de-dup cue for "same file re-uploaded".
--
--     provenance    JSONB — the full PROV bag: { parserVersion, sourceDigest,
--                           sourceFilename, mappingId?, rulesetId? }. JSONB so a new
--                           lineage field carries its own shape with no schema change
--                           (same posture as validation_issue.detail / dataset.metadata).
--
--   Both NULLABLE: the JSON ingest routes (sdmx-json / bundle) that do not parse a
--   source file simply leave them NULL (Postel — the columns describe lineage when it
--   exists, never demand it). Stamped at createSubmission (apps/api/src/ingest/submit.ts).
--
--   WHY THIS SHAPE (rationale + rejected alternatives):
--     · DERIVABLE PROV, no parallel store. The W3C PROV / OpenLineage graph is
--       reconstructed by JOIN over submission (+ these columns) → release (V25) →
--       observation_revision (V8). SSOT: the lineage lives ON the event that caused
--       the change, never duplicated into a side table that could drift.
--     · REJECTED — a dedicated stats_stage.provenance table (one row per submission).
--       Over-modelled: the lineage is 1:1 with the submission and is read with it;
--       two nullable columns are the minimal shape (Occam). The PROV-graph EXPORT
--       (OpenLineage / PROV-O serializer) is the deferred door — it reads these
--       columns, it does not need its own table (YAGNI until an audit/reproduce
--       consumer asks: ADR-0031 §7 improvement-4 SEAM-DEFER).
--     · REJECTED — overload submission_blob.content_hash to mean "source hash". It is
--       the PAYLOAD idempotency key (the JSON bronze the worker re-parses); conflating
--       it with the source-file hash would break the Idempotent Receiver guard (two
--       different source files can normalize to the same canonical payload, and the
--       same source file produces a different payload hash than its own byte hash).
--       source_digest is a SEPARATE SSOT for the source-file identity.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible) ─────────────
--   Reversibility : TWO-WAY (pure addition). TWO nullable columns ADDED to ONE
--                   existing table (stats_stage.submission). No type, constraint,
--                   index, trigger, or default is added; no existing column is
--                   altered or dropped; no data is reshaped. Rollback = DROP the two
--                   columns.
--   Blast radius  : NONE on existing behaviour. The columns are nullable with no
--                   default — every existing INSERT path that does not name them
--                   continues to write NULL (the V11 submission INSERT, the worker's
--                   status UPDATEs). No FK, no CHECK, no trigger fires on them. The
--                   submission_facts_dataset_chk / status_chk / kind_chk are untouched.
--   Hypertable    : N/A. stats_stage.submission is a plain table.
--   Rollback plan : ALTER TABLE stats_stage.submission DROP COLUMN IF EXISTS provenance;
--                   ALTER TABLE stats_stage.submission DROP COLUMN IF EXISTS source_digest;
--                   (Sacrifices only stamped lineage on in-flight/historical
--                    submissions; no cube datum is touched.)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS throughout. Re-run = converge, never error.
-- Additive only; never edits a V1-V31 object.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE stats_stage.submission
  ADD COLUMN IF NOT EXISTS source_digest TEXT;

ALTER TABLE stats_stage.submission
  ADD COLUMN IF NOT EXISTS provenance JSONB;

COMMENT ON COLUMN stats_stage.submission.source_digest IS
  'W3C PROV (ADR-0031 improvement 4) — SHA-256 hex of the SOURCE bytes (the uploaded workbook), DISTINCT from submission_blob.content_hash (the JSON payload hash / idempotency key). The lineage key back to the exact ingested file. NULL for JSON ingest paths that parse no source file.';

COMMENT ON COLUMN stats_stage.submission.provenance IS
  'W3C PROV (ADR-0031 improvement 4) lineage bag: { parserVersion, sourceDigest, sourceFilename, mappingId?, rulesetId? }. JSONB so a new lineage field needs no schema change. The PROV graph (Entity=obs/dataset · Activity=submission/release · Agent=curator) is DERIVABLE from this + the release (V25) / observation_revision (V8) spine — NOT a parallel store. NULL when no source lineage exists.';
