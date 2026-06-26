# Senior Backend Developer — Memory Index

## Project
- [versioned ingestion governance](project_versioned_ingestion.md) — ?datasetVersion resolves the DSD gate → new vintage; mints in the route (before facts validate), reuses dataset_dimension/dimension/bump_dataset_version/metadata, NOT V28 supersession
- [pnpm workspace root is platform/](project_workspace_root.md) — lockfile + catalog live under platform/, not repo root; shapes Dockerfile/compose context
- [package build/dist resolution](project_package_build_resolution.md) — tsup --dts exposes undeclared sibling deps / self-imports / deep-internal imports that Vite+Vitest source aliases hide
- [API TS build overrides](project_api_tsconfig_overrides.md) — apps/api must override root tsconfig's noEmit/bundler/allowImportingTsExtensions to emit
- [SQL migrations location](project_sql_migrations_location.md) — migrations live at repo-root ops/postgres/migrations, NOT platform/ops
- [config.page schema](project_config_page_schema.md) — page is identity-only; config/data_specs live in append-only config.page_version, key on slug
- [api scripts/src compilation boundary](project_api_scripts_src_boundary.md) — runtime src/ must not import build-time scripts/ (seed-helpers); restate SQL on Queryable port instead
- [time_period↔date SSOT](project_time_period_date_ssot.md) — period↔date math lives only in stats.parse_time_period (start) + parse_time_period_end (V16, end); routes pass raw SDMX text, never compute dates
- [RBAC vocabulary](project_rbac_vocabulary.md) — roles are admin/editor/viewer only; no publisher; publish gated to admin (editor saves, admin publishes)
- [api env fail-fast seam](project_api_env_failfast_seam.md) — env.ts is the single boot-time fail-fast seam; PROD_REQUIRED_SECRETS gate + how to test boot via resetModules
- [GeoStat source quirks](project_geostat_source_quirks.md) — raw DATA/ Excel defects: File1 ENG GDP column year-shifted (GEO=value SSOT), B6G ka typo, File3 partial activity breakdown + Excel lock hazard
- [V7 DSD vs canonical shape](project_v7_dsd_vs_canonical_shape.md) — V7 pre-registers GDP DSD 3-dim measure,time,geo (always applied, not neutralizable); canonical GDP is 4-dim → DSD gate fires; ACCOUNTS/REGIONAL match
- [version-mint locale label defect — RESOLVED](project_version_mint_locale_label.md) — FIXED in 8e9cb27: stats.dimension {en:code} insert now guarded by `if (isNew)`; existing axis never re-inserted; proven on staging (288 GDP obs, no 500)
- [canonical partial-failure retry trap](project_canonical_partial_failure_retry.md) — route publishes codelists BEFORE facts; a crash between them leaves an orphaned published codelist that 409s ALREADY_PUBLISHED on retry; recover by deleting the orphan submission header (gold untouched)
