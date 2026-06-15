-- DEPRECATED: Use Flyway migrations in ops/postgres/migrations/ (V2__schemas.sql).
-- This file kept for reference only. Flyway is the canonical migration source.
-- ════════════════════════════════════════════════════════════════════════
-- 01-schemas.sql — two bounded contexts, one database
-- ════════════════════════════════════════════════════════════════════════
-- `config` — Constructor output: versioned page configs, nav, data specs.
-- `stats`  — SDMX-aligned statistical observations (the data cube).
--
-- Two schemas (not two databases) so a single connection / transaction can
-- join a page's DataSpec against the stats it references, while keeping the
-- two concerns namespaced and independently grant-able.

CREATE SCHEMA IF NOT EXISTS config;
CREATE SCHEMA IF NOT EXISTS stats;

COMMENT ON SCHEMA config IS 'Constructor output: versioned page/site configs, nav, data specs, data sources.';
COMMENT ON SCHEMA stats  IS 'SDMX-aligned (ISO 17369) statistical data cube: dimensions, code lists, datasets, observations.';
