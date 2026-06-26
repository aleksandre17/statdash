# Database Architect — Memory Index

## Project
- [DB Infrastructure](project_db_infra.md) — statdash Postgres+pgAdmin in ops/; Docker CLI absent locally, validate compose via YAML parse
- [Schema SSOT](project_schema_ssot.md) — canonical schema is Flyway V1-V30 in ops/postgres/migrations; apps/api routes target it; do NOT fork a 2nd migration system
- [concept_role SSOT + V30](project_concept_role_ssot.md) — seed dims' SDMX concept_role; V30 (not an edit to V5/V7) sets roles + re-runs V27 backfill; closes V29 category cycle gap
- [DB-gated fixtures](project_db_gated_fixtures.md) — live-DB fitness tests must satisfy V14 LocaleString completeness, V28 published projection, SCD-2 txn-time semantics
- [Vintage / Release (ADR-0025)](project_vintage_release.md) — V25 adds stats.release publication-event aggregate; release_id stamps on observation + revision via app.release_id GUC; as-of vintage reconstruction
- [obs.* vs stats.*](project_obs_vs_stats.md) — TWO cube schemas: applied stats.* (real) vs paper obs.* design doc (never built); extend stats.* additively, harvest obs.* ideas only
- [Demo classifier data (V33)](project_demo_classifier_data.md) — aggregates virtual classifier (isClosing in metadata) + geo SCD-2 de-dup; ON CONFLICT must target the partial unique (V18 dropped the blanket)

## Feedback
- [Seed ETL decoupling](feedback_seed_etl_decoupling.md) — api seed imports geostat bundles via ACL + ambient @geostat/engine shim + cleared paths; never couple API to engine type graph
