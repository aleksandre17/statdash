-- ════════════════════════════════════════════════════════════════════════
-- V15__audit_log.sql — config.audit_log: the governance audit trail, made real
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — promotes the AuditLogger port's commented DDL
-- (apps/api/src/lib/audit-log.ts, lines 16-24) to a real, durable table so the
-- in-memory ring buffer can be swapped for a Postgres-backed adapter with one
-- binding change at the app layer (the API-readiness law; same AuditLogger
-- surface, no call-site change). Records who did what, when, against which
-- resource — the non-repudiation / auditability quality attribute (ISO 25010).
--
--     1. config.audit_log — the trail itself. Lives in `config` (not `stats`):
--        audit is GOVERNANCE — it guards the config objects (pages, sites,
--        data sources) it sits beside, and the route layer that mints these
--        events (config.save, config.publish, ingest.publish) writes here.
--        Columns track the AuditEntry port one-for-one:
--          user_id  ← AuditEntry.userId  (JWT sub; NULL = anonymous/system)
--          action   ← AuditEntry.action  (dot-namespaced verb, NOT NULL)
--          resource ← AuditEntry.resource(entity id; NULL OK)
--          payload  ← AuditEntry.payload (opaque JSONB; NULL OK)
--        The port's `ts` becomes occurred_at TIMESTAMPTZ DEFAULT now() —
--        SERVER-assigned, never client-supplied. now() is the single source of
--        truth for ordering (the port's own contract: "ts is stamped here").
--        id is GENERATED ALWAYS AS IDENTITY (not SERIAL): the modern, standard
--        identity form — the value cannot be overridden by an INSERT, which
--        suits an append-only ledger where row identity must not be forged.
--
--     2. APPEND-ONLY ENFORCEMENT — trg_audit_log_immutable. An audit trail is
--        append-only BY CONTRACT (the port exposes only log()/recent(): no
--        update, no delete). Here that contract is enforced in the DATABASE,
--        not merely trusted from the app: a BEFORE UPDATE OR DELETE trigger
--        RAISEs and aborts. Immutability is the property that makes an audit
--        log trustworthy — a trail that can be rewritten proves nothing
--        (non-repudiation). This is the DDL form of the "append-only audit log"
--        / immutability principle.
--
--     3. INDEXES for the four ways a trail is read:
--          (occurred_at DESC)            — time-range / "recent" (the port's
--                                          recent() returns newest-first)
--          (user_id) WHERE NOT NULL      — "what did this actor do"
--          (resource) WHERE NOT NULL     — "what happened to this entity"
--          (action)                      — "all publish events", etc.
--        The two partial indexes skip the NULL rows (system actions / global
--        events), keeping the index small and the lookups they serve sharp.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. Purely additive — one new table plus its own
--                   trigger, function, and indexes. DROP removes 100% of what
--                   V15 introduced; nothing pre-existing is read, altered, or
--                   depended upon. No data transform, so no data loss on
--                   rollback (an empty/young trail).
--   Blast radius  : NONE. No V1-V14 object is touched — no existing table,
--                   column, constraint, trigger, or index is created, altered,
--                   or dropped. The append-only trigger fires ONLY on this new
--                   table; it can never affect another table's writes.
--   Rollback plan : DROP TABLE config.audit_log CASCADE;
--                   (CASCADE also drops trg_audit_log_immutable and the four
--                    indexes; then, if desired,
--                    DROP FUNCTION config.audit_log_reject_mutation();)
--
-- Idempotent: CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE FUNCTION ·
-- DROP TRIGGER IF EXISTS + CREATE · CREATE INDEX IF NOT EXISTS throughout.
-- Re-run against a populated volume = a no-op, never an error.
-- Additive only: introduces new objects; never drops or alters a V1-V14 object.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- 1. config.audit_log — the append-only governance trail
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS config.audit_log (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- server-assigned; SSOT for ordering
  user_id     TEXT,                                -- JWT sub; NULL = anonymous/system action
  action      TEXT        NOT NULL,                -- dot-namespaced verb: 'config.save', 'ingest.publish'
  resource    TEXT,                                -- entity id (UUID or opaque string); NULL OK
  payload     JSONB                                -- extra structured context, stored opaquely; NULL OK
  -- Audit rows are append-only: no UPDATE, no DELETE. Enforced by
  -- trg_audit_log_immutable below — the contract lives in the DB, not just code.
);

COMMENT ON TABLE  config.audit_log             IS 'Append-only governance audit trail (AuditLogger port, audit-log.ts). Who/what/when/which-resource. Immutability enforced by trg_audit_log_immutable; UPDATE/DELETE raise. Non-repudiation (ISO 25010).';
COMMENT ON COLUMN config.audit_log.occurred_at IS 'Server-assigned event time (DEFAULT now()), never client-supplied — the single source of truth for trail ordering. Maps to AuditEntry.ts.';
COMMENT ON COLUMN config.audit_log.user_id     IS 'Actor subject id (JWT sub). NULL = anonymous or system action. Maps to AuditEntry.userId.';
COMMENT ON COLUMN config.audit_log.action      IS 'Dot-namespaced verb — e.g. config.save, config.publish, ingest.publish. NOT NULL. Maps to AuditEntry.action.';
COMMENT ON COLUMN config.audit_log.resource    IS 'Id of the entity acted upon (page id, submission id, …). NULL for global actions. Maps to AuditEntry.resource.';
COMMENT ON COLUMN config.audit_log.payload     IS 'Free-form structured detail, stored opaquely. NULL OK. Maps to AuditEntry.payload.';


-- ════════════════════════════════════════════════════════════════════════
-- 2. Append-only enforcement — reject every UPDATE and DELETE
-- ════════════════════════════════════════════════════════════════════════
-- The AuditLogger port has no update/delete by design; this makes that
-- guarantee structural rather than conventional. A BEFORE UPDATE OR DELETE
-- trigger raises before any change lands, so the trail can only ever grow.
-- CREATE OR REPLACE keeps the function definition idempotent and evolvable.
CREATE OR REPLACE FUNCTION config.audit_log_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: rows may not be modified or deleted'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION config.audit_log_reject_mutation() IS
  'BEFORE UPDATE OR DELETE guard for config.audit_log: always RAISEs, enforcing the append-only audit-trail invariant in the database (immutability / non-repudiation).';

-- DROP IF EXISTS + CREATE = idempotent (re)installation of the trigger.
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON config.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON config.audit_log
  FOR EACH ROW EXECUTE FUNCTION config.audit_log_reject_mutation();

COMMENT ON TRIGGER trg_audit_log_immutable ON config.audit_log IS
  'Enforces append-only: any UPDATE or DELETE on config.audit_log raises. An audit trail that can be rewritten proves nothing — immutability is what makes it trustworthy.';


-- ════════════════════════════════════════════════════════════════════════
-- 3. Indexes — the four read paths over the trail
-- ════════════════════════════════════════════════════════════════════════
-- occurred_at DESC backs time-range scans and the port's recent() newest-first
-- read. The two partial indexes (WHERE … IS NOT NULL) cover the actor- and
-- entity-scoped lookups while skipping system/global rows, so they stay lean.
-- action is a plain index — every value is present, so no partial predicate.
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON config.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id     ON config.audit_log (user_id)  WHERE user_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_resource    ON config.audit_log (resource) WHERE resource IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action      ON config.audit_log (action);
