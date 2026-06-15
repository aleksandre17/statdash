-- DEPRECATED: Use Flyway migrations in ops/postgres/migrations/ (V1__extensions.sql).
-- This file kept for reference only. Flyway is the canonical migration source.
-- ════════════════════════════════════════════════════════════════════════
-- 00-extensions.sql — required Postgres extensions
-- ════════════════════════════════════════════════════════════════════════
-- Runs once, in lexical order, on first container start (empty data volume).
-- Idempotent: IF NOT EXISTS guards a re-run against a restored volume.

-- gen_random_uuid() for UUID primary keys (config schema).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Trigram index support — future fuzzy text search over labels / page titles.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gin — lets a single GIN index mix scalar columns (e.g. dataset_code)
-- with a jsonb column (dim_key). Used by the compound observation lookup index.
CREATE EXTENSION IF NOT EXISTS btree_gin;
