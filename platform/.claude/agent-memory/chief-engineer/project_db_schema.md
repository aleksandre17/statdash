---
name: project-db-schema
description: Postgres schema topology + design model (stats SDMX cube, config, stats_stage medallion); migration numbering corrected
metadata:
  type: project
---

The DB lives at `C:\Users\Test-User\WebstormProjects\national-accounts\ops\postgres\migrations\` — Flyway-managed V1..V15 (NOT the V1..V14 set named in older audit prompts; numbering differs — V7=real_dataset_structure, V8=obs_attributes_revision, V9=time_period_full_frequency, V11=ingest_staging, V12=display_revision, V15=audit_log). `ops/postgres/init/*` is legacy backup only.

Three bounded contexts / schemas (V2): `config` (Constructor output + users + audit), `stats` (SDMX gold cube), `stats_stage` (V11 medallion bronze/silver + job FSM).

Core data model:
- `stats.observation` = TimescaleDB hypertable, generic `dim_key JSONB` series key (Law 1, no privileged dims) + `dim_key_hash` (md5, ON CONFLICT target) + GENERATED `time_period_date` partition col via `stats.parse_time_period`. Write-time validation trigger checks dim_key against DSD (`dataset_dimension`) + classifier codes.
- `stats.dataset_dimension` = the SDMX DSD (which dims key a dataset, which is time).
- `stats.classifier` = SDMX codelist, LTREE hierarchy + SCD-2 columns (valid_from/to, is_current).
- Revision logs: `stats.observation_revision` (V8, no FK — hypertable can't be FK target), `stats.classifier_display_revision` (V12), `config.audit_log` (V15, append-only enforced by trigger).

**Why:** Investment-grade schema audit done 2026-06. **How to apply:** schema is genuinely senior-level; before claiming a gap, grep — most "missing" capabilities (revisions, provenance, ETag versioning, i18n contract, RLS seam) already exist. Real gaps are below, see [[project-db-schema-gaps]].
