# Database Architect — Memory Index

## Project
- [DB Infrastructure](project_db_infra.md) — statdash Postgres+pgAdmin in ops/; Docker CLI absent locally, validate compose via YAML parse
- [Schema SSOT](project_schema_ssot.md) — canonical schema is Flyway V1-V25 in ops/postgres/migrations; apps/api routes target it; do NOT fork a 2nd migration system
- [Vintage / Release (ADR-0025)](project_vintage_release.md) — V25 adds stats.release publication-event aggregate; release_id stamps on observation + revision via app.release_id GUC; as-of vintage reconstruction
- [obs.* vs stats.*](project_obs_vs_stats.md) — TWO cube schemas: applied stats.* (real) vs paper obs.* design doc (never built); extend stats.* additively, harvest obs.* ideas only

## Feedback
- [Seed ETL decoupling](feedback_seed_etl_decoupling.md) — api seed imports geostat bundles via ACL + ambient @geostat/engine shim + cleared paths; never couple API to engine type graph
