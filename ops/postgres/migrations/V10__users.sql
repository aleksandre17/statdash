-- ════════════════════════════════════════════════════════════════════════
-- V10__users.sql — user accounts + role assignment  [P2-2]
-- ════════════════════════════════════════════════════════════════════════
-- Adds config.user: username, hashed password, roles[]. Gives RBAC
-- (visibleToRoles, wired in the renderer) real identities to test against —
-- replacing the single hardcoded env-var admin credential.
--
-- ── 09 §B RISK GATE (Class-A additive migration) ────────────────────────
--   Reversibility : TWO-WAY. Pure addition of one table + one trigger. Revert
--                   = DROP TABLE config.user (no other object references it; no
--                   data outside this table is mutated).
--   Blast radius  : NONE on existing objects. No V1-V9 table, column, function,
--                   constraint, index, or trigger is touched. config.set_updated_at
--                   (from V3) is REUSED by reference, not redefined.
--   Rollback plan : DROP TRIGGER trg_user_updated_at ON config.user;
--                   DROP TABLE config.user;
--   Data safety   : NO password hash is seeded here (a hash baked into a
--                   committed migration is a hardcoded secret — refused). The
--                   first admin is created at runtime via POST /api/admin/setup
--                   (one-shot, self-disabling) or the env-var bootstrap fallback.
--                   The migration ships table STRUCTURE only.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS; trigger swap is DROP IF EXISTS + CREATE.
-- Additive only; never edits V1-V9. Re-run = converge, never error.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS config.user (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,             -- scrypt: N$r$p$salt$hash (no plaintext, ever)
  roles         TEXT[]      NOT NULL DEFAULT '{viewer}',
  enabled       BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A user with an empty roles array can authenticate but authorize to nothing.
  -- That is a configuration mistake, not a valid state: make it unrepresentable.
  CONSTRAINT user_roles_nonempty_chk CHECK (cardinality(roles) > 0)
);

COMMENT ON TABLE  config.user               IS
  'Platform user accounts. roles[] maps to RBAC: admin/editor/viewer. password_hash is a self-describing scrypt digest (Node crypto, no new dependency). First admin seeded at runtime (POST /api/admin/setup or env-var bootstrap), never in this migration.';
COMMENT ON COLUMN config.user.password_hash IS
  'scrypt digest, self-describing format "scrypt$N$r$p$salt_b64$hash_b64" — parameters travel with the hash so cost can evolve without a schema change.';
COMMENT ON COLUMN config.user.roles         IS
  'RBAC role grants. Matched against DisplaySpec.visibleToRoles in the renderer. Non-empty (user_roles_nonempty_chk).';

-- updated_at maintenance — REUSES config.set_updated_at() from V3 (one function,
-- every mutable config table). DROP IF EXISTS + CREATE = idempotent reinstall.
DROP TRIGGER IF EXISTS trg_user_updated_at ON config.user;
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON config.user
  FOR EACH ROW EXECUTE FUNCTION config.set_updated_at();

-- Username is the login lookup key. UNIQUE already builds a btree on it, so the
-- findUserByUsername hot path is index-served — no extra index needed.
