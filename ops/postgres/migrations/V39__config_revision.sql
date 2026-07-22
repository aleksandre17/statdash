-- ════════════════════════════════════════════════════════════════════════
-- V39__config_revision.sql — ADR-052 the config revision log (door #2):
--                            one polymorphic, append-only revision store for the
--                            un-versioned config document kinds. ADDITIVE only.
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — all ADDITIVE; V1-V38 are applied + immutable.
--
--   THE GAP (ADR-052 §1) — `config.data_spec` and `config.data_source` are written
--   by a DESTRUCTIVE partial UPDATE (routes/config/data-specs.ts, data-sources.ts:
--   buildSetClause): a PUT overwrites the prior body IN PLACE, with NO history and NO
--   referential validation. The corruption incidents (the datasetCode flip; the 8
--   orphan 0-row scratch specs) landed squarely here — the only prior-state that
--   survived a bad write was git provisioning. `config.page` already has the
--   discipline these lack: an append-only version store (config.page_version, V3) +
--   a validation gate. This migration gives the un-versioned kinds the SAME
--   discipline as ONE grammar (Law 10 — extend one containment law, never add a
--   parallel version table per kind).
--
--   THE DECISION (ADR-052 §3) — ONE universal, doc-kind-agnostic append-only log,
--   generalising the proven `config.page_version` per-parent monotonic-sequence
--   pattern to every doc kind:
--
--     config.revision — polymorphic (doc_kind, doc_id) → an append-only chain of
--                       full-snapshot bodies. revision_number is trigger-assigned,
--                       monotonic per (doc_kind, doc_id) (the config.page_version
--                       assign_version_number idiom). A revision row is IMMUTABLE:
--                       never UPDATEd/DELETEd; restore = a NEW row whose body is an
--                       old body and whose restored_from points at its source
--                       (history is never rewritten).
--
--   PAGES ARE DELIBERATELY NOT MIGRATED HERE (ADR-052 §3, expand-contract). Pages
--   keep config.page_version with its is_published semantics that bootstrap +
--   provisioning depend on; unifying the two stores is a named, DEFERRED future card.
--   This log serves the un-versioned kinds (data_spec, data_source, and later
--   site_config); the RevisionRecord CONTRACT is universal and pages project into it
--   read-side. Two stores behind one contract — disclosed, not hidden.
--
--   TENANT SEAM (ADR-052 §3) — config.* tables carry NO tenant_id today. The revision
--   table adds `tenant_id UUID` NOW as a NULLABLE placeholder (mirroring the V6
--   stats.dataset.tenant_id posture: nullable, no FK, no RLS FORCE), so a future MT
--   landing is an additive USING-clause swap, not a schema change. tenant_id is NOT
--   projected on the wire in single-tenant v1.
--
-- ── 09 §B RISK GATE (Class-M migration — TWO-WAY reversible; CREATE only) ──
--   Reversibility : TWO-WAY. CREATE TABLE / CREATE FUNCTION / CREATE INDEX / CREATE
--                   TRIGGER only — fully reversible by DROP. The one irreversible
--                   artifact is ACCUMULATED revision data, which is purely additive
--                   (dropping it loses history but breaks NO read — no legacy read
--                   depends on config.revision). NO existing table/column/type/
--                   constraint/index/trigger is altered or dropped.
--   Blast radius  : NONE at creation. Nothing reads config.revision until the new
--                   endpoints ship; existing reads (bootstrap → page_version +
--                   site_config; the renderer → current rows) never touch it. The
--                   genesis backfill (§3) READS existing config rows only and is
--                   idempotent (ON CONFLICT DO NOTHING).
--   Hypertable    : UNAFFECTED. config.revision is a PLAIN table; stats.observation
--                   is not touched in any way.
--   MT posture    : NO multi-tenancy built. tenant_id is a nullable placeholder — no
--                   FK, no RLS, no GUC, no FORCE, no NOT-NULL flip. The V6 seam is
--                   preserved verbatim.
--   Rollback plan : DROP TRIGGER  IF EXISTS trg_revision_assign_number ON config.revision;
--                   DROP FUNCTION IF EXISTS config.assign_revision_number();
--                   DROP TABLE    IF EXISTS config.revision;
--                   (Sacrifices only accumulated revision history — no current config
--                    row, and no existing read, is touched.)
--
-- Idempotent: CREATE ... IF NOT EXISTS · CREATE OR REPLACE FUNCTION · DROP TRIGGER
-- IF EXISTS + CREATE · the genesis backfill INSERTs ON CONFLICT DO NOTHING. Re-run =
-- converge, never error. Additive only; never edits a V1-V38 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. config.revision — the polymorphic append-only revision log
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS config.revision (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind        TEXT        NOT NULL,               -- which config family (CHECK below)
  doc_id          TEXT        NOT NULL,               -- uuid-as-text; a TEXT key for site_config
  revision_number INT         NOT NULL,               -- trigger-assigned, monotonic per (doc_kind, doc_id)
  body            JSONB       NOT NULL,               -- the FULL document snapshot (restore re-applies verbatim)
  actor           TEXT,                               -- JWT sub / 'system:provisioning' | 'system:adoption'; nullable
  note            TEXT,                               -- optional author message from the save/publish affordance
  restored_from   UUID        REFERENCES config.revision(id) ON DELETE SET NULL,  -- lineage of a restore
  tenant_id       UUID,                               -- MT seam: nullable placeholder (mirrors V6 stats.dataset.tenant_id)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT revision_doc_kind_chk CHECK (doc_kind IN ('data_spec','data_source','site_config','page')),
  CONSTRAINT revision_unique       UNIQUE (doc_kind, doc_id, revision_number)
);
-- No updated_at: revisions are immutable by design (append-only audit log — the
-- config.page_version posture, V3).

COMMENT ON TABLE config.revision IS
  'ADR-052 — one polymorphic, append-only revision log for the un-versioned config document kinds (data_spec, data_source, and later site_config). Generalises the config.page_version per-parent monotonic-sequence pattern to every doc kind. A row is IMMUTABLE (never UPDATEd/DELETEd); restore = a NEW row whose body is an old body and whose restored_from points at its source (history is never rewritten). Pages keep config.page_version (expand-contract, ADR-052 §3); the RevisionRecord contract is universal.';
COMMENT ON COLUMN config.revision.doc_id IS
  'The document identity — a uuid-as-text for data_spec/data_source/page, or the TEXT key for site_config. TEXT (not UUID) so the ONE log accommodates every doc kind.';
COMMENT ON COLUMN config.revision.body IS
  'The FULL logical document snapshot a PUT can set (data_spec → {name,description,spec,source_id}; data_source → {name,type,url,config,status}). Restore re-applies it verbatim — no diff replay.';
COMMENT ON COLUMN config.revision.restored_from IS
  'When this row is a restore, the UUID of the revision whose body it re-applies (append-only lineage). ON DELETE SET NULL — but revisions are never deleted in v1 (keep-all retention).';
COMMENT ON COLUMN config.revision.tenant_id IS
  'MT seam (ADR-052 §3): a NULLABLE placeholder mirroring the V6 stats.dataset.tenant_id posture (no FK, no RLS FORCE). Populated from the future app.current_tenant GUC when MT lands; NOT projected on the wire in single-tenant v1.';


-- ════════════════════════════════════════════════════════════════════════
-- 2. assign_revision_number — the per-(doc_kind, doc_id) monotonic sequence
-- ════════════════════════════════════════════════════════════════════════
-- Reuse the proven config.assign_version_number pattern (V3): COALESCE(MAX)+1 under
-- the implicit row lock the INSERT holds, avoiding the classic check-then-insert race
-- for a per-parent sequence. The parent here is the (doc_kind, doc_id) pair.
CREATE OR REPLACE FUNCTION config.assign_revision_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.revision_number IS NULL THEN
    SELECT COALESCE(MAX(revision_number), 0) + 1
      INTO NEW.revision_number
      FROM config.revision
     WHERE doc_kind = NEW.doc_kind AND doc_id = NEW.doc_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION config.assign_revision_number() IS
  'BEFORE INSERT trigger for config.revision: assigns the next revision_number monotonically per (doc_kind, doc_id). Mirrors config.assign_version_number (V3) — the same race-free COALESCE(MAX)+1-under-row-lock idiom.';

DROP TRIGGER IF EXISTS trg_revision_assign_number ON config.revision;
CREATE TRIGGER trg_revision_assign_number BEFORE INSERT ON config.revision
  FOR EACH ROW EXECUTE FUNCTION config.assign_revision_number();


-- ════════════════════════════════════════════════════════════════════════
-- 3. Indexes — the history read (DESC by revision) + the MT seam
-- ════════════════════════════════════════════════════════════════════════
-- "the revisions of doc X, newest first" (the GET /:id/revisions hot read).
CREATE INDEX IF NOT EXISTS idx_revision_doc    ON config.revision (doc_kind, doc_id, revision_number DESC);
-- MT seam index (mirrors the V6 tenant posture; inert until MT lands).
CREATE INDEX IF NOT EXISTS idx_revision_tenant ON config.revision (tenant_id);


-- ════════════════════════════════════════════════════════════════════════
-- 4. GENESIS-ADOPTION BACKFILL — one revision-0 per existing data_spec/data_source
-- ════════════════════════════════════════════════════════════════════════
-- Seed one genesis revision per existing row so history is honest-but-non-empty from
-- day one (the V-genesis precedent). actor='system:adoption'; created_at = the row's
-- updated_at (the last known write time); body = the CURRENT full row. Idempotent via
-- ON CONFLICT (doc_kind, doc_id, revision_number) DO NOTHING — a re-apply is a no-op,
-- and once a doc has taken a post-adoption PUT its genesis row already exists. Reads
-- existing rows only; additive; reversible. If this step were skipped, history would
-- simply begin at each doc's first post-adoption PUT (also honest) — it is included so
-- the panel's history UI is never empty for a pre-existing document.
INSERT INTO config.revision (doc_kind, doc_id, revision_number, body, actor, created_at)
SELECT 'data_source', ds.id::text, 1,
       jsonb_build_object(
         'name',   ds.name,
         'type',   ds.type,
         'url',    ds.url,
         'config', ds.config,
         'status', ds.status
       ),
       'system:adoption', ds.updated_at
  FROM config.data_source ds
ON CONFLICT (doc_kind, doc_id, revision_number) DO NOTHING;

INSERT INTO config.revision (doc_kind, doc_id, revision_number, body, actor, created_at)
SELECT 'data_spec', sp.id::text, 1,
       jsonb_build_object(
         'name',        sp.name,
         'description', sp.description,
         'spec',        sp.spec,
         'source_id',   sp.source_id
       ),
       'system:adoption', sp.updated_at
  FROM config.data_spec sp
ON CONFLICT (doc_kind, doc_id, revision_number) DO NOTHING;
