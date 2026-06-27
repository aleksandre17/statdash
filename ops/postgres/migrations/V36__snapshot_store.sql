-- ════════════════════════════════════════════════════════════════════════
-- V36__snapshot_store.sql — config.snapshot: durable embed snapshots (API-09)
-- ════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (and WHY) — promotes the SnapshotStore port (apps/api/src/lib/
-- snapshot-store.ts) from an in-memory LRU ring (lost on every deploy, capped at
-- 100) to a durable Postgres-backed table, so a minted HMAC-signed embed URL
-- handed to an external partner SURVIVES A RESTART. A public embed contract that
-- breaks on every deploy is unshippable for real external embedding (the Grafana
-- snapshot-sharing posture: DB-backed with expiry). The port already exists and is
-- injected at the app layer; this migration is the table its pg adapter
-- (createPgSnapshotStore) targets — one binding change in index.ts, no route edit.
--
--     1. config.snapshot — one row per minted embed. Lives in `config` (the
--        delivery/governance schema, beside audit_log and data_source), NOT in
--        `stats` (it is not cube data). Columns:
--          token       ← the minted opaque id (PK; the HMAC is over this value).
--          snapshot    ← the engine PageDataSnapshot, stored OPAQUELY as JSONB
--                        (the api reads only generatedAt; the rest is an embedder
--                        payload it never interprets — Anti-Corruption boundary).
--          created_at  ← mint time (server clock).
--          expires_at  ← NULLABLE: the embed window close (HTTP 410 past it). NULL
--                        = never expires. Indexed (partial) for the GC sweep.
--          params      ← the EmbedParams whitelist (allowedDims/expiresAt) as JSONB.
--          tenant_id   ← NULLABLE forward-add for the future multi-tenancy model
--                        (API-* foresight): a later migration scopes embeds per
--                        tenant by populating + constraining this; today every row
--                        is NULL (single-tenant) and no read filters on it, so the
--                        column is inert but the schema is already shaped for the
--                        one-way tenancy door (additive, forward-looking).
--
--     2. EXPIRY INDEX — idx_snapshot_expires_at (partial, WHERE expires_at IS NOT
--        NULL) backs the write-path GC the pg adapter runs (DELETE … WHERE
--        expires_at < now()) so dead tokens never accumulate. Partial = it skips
--        the never-expiring rows, staying small and sharp.
--
-- ── 09 §B RISK GATE (Class-M migration) ─────────────────────────────────
--   Reversibility : TWO-WAY. Purely additive — ONE new table + ONE index. DROP
--                   removes 100% of what V36 introduces; nothing pre-existing is
--                   read, altered, or depended upon. On rollback the store falls
--                   back to the in-memory adapter (older behaviour), no data loss
--                   beyond the disposable embed cache.
--   Blast radius  : NONE. No V1-V35 object is touched. FKs: none (a snapshot is a
--                   self-contained delivery artifact; it references no cube row).
--   Rollback plan : DROP TABLE IF EXISTS config.snapshot;
--
-- Idempotent: CREATE TABLE / INDEX … IF NOT EXISTS throughout. Re-run = converge,
-- never error. Additive only; never edits a V1-V35 object.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS config.snapshot (
  token       TEXT        PRIMARY KEY,                    -- minted opaque id; the HMAC signs this
  snapshot    JSONB       NOT NULL,                       -- engine PageDataSnapshot, stored opaquely
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),         -- mint time
  expires_at  TIMESTAMPTZ,                                -- NULL = never expires; past now() ⇒ HTTP 410
  params      JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- EmbedParams whitelist (allowedDims/expiresAt)
  tenant_id   TEXT                                        -- NULLABLE forward-add for multi-tenancy (inert today)
);

COMMENT ON TABLE  config.snapshot            IS 'Durable embed snapshots (SnapshotStore port, snapshot-store.ts). A minted HMAC-signed embed URL survives restart (API-09). One row per /api/snapshots mint; read by /api/embed/:token. tenant_id is a forward-add for the future tenancy model.';
COMMENT ON COLUMN config.snapshot.token      IS 'Minted opaque token (PK). The public embed read is authorized by an HMAC signature over this value, not a JWT.';
COMMENT ON COLUMN config.snapshot.snapshot   IS 'Engine PageDataSnapshot stored OPAQUELY (the api reads only generatedAt at the boundary; the rest is the embedder payload — Anti-Corruption Layer).';
COMMENT ON COLUMN config.snapshot.expires_at IS 'Embed window close. NULL = never expires. Past now() ⇒ the embed route returns 410 Gone. Indexed (partial) for the write-path GC sweep.';
COMMENT ON COLUMN config.snapshot.tenant_id  IS 'NULLABLE forward-add for the future multi-tenancy model. Inert today (every row NULL, no read filters on it); a later migration scopes embeds per tenant.';

-- Partial expiry index — backs the pg adapter''s opportunistic GC of dead tokens.
CREATE INDEX IF NOT EXISTS idx_snapshot_expires_at
  ON config.snapshot (expires_at)
  WHERE expires_at IS NOT NULL;
