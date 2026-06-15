-- ════════════════════════════════════════════════════════════════════════
-- V1__extensions.sql — required Postgres / TimescaleDB extensions
-- ════════════════════════════════════════════════════════════════════════
-- Flyway-managed (canonical). Source of truth for schema evolution; the legacy
-- ops/postgres/init/00-extensions.sql is kept only as a backup reference.
--
-- Idempotent: every CREATE EXTENSION is guarded by IF NOT EXISTS so a re-run
-- (e.g. Flyway repair, or a restored volume) is a no-op.

-- ── Core ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search on labels
CREATE EXTENSION IF NOT EXISTS btree_gin;     -- compound GIN indexes (scalar + jsonb)
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- range / exclusion-constraint indexes
CREATE EXTENSION IF NOT EXISTS unaccent;      -- accent-insensitive search (Georgian etc.)

-- ── Hierarchy ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS ltree;         -- path-based hierarchy (classifiers)

-- ── Observability ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ── Time-series (TimescaleDB image ships the binary; this enables it) ─────
CREATE EXTENSION IF NOT EXISTS timescaledb;
