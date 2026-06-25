# Senior Backend Developer — Memory Index

## Project
- [pnpm workspace root is platform/](project_workspace_root.md) — lockfile + catalog live under platform/, not repo root; shapes Dockerfile/compose context
- [package build/dist resolution](project_package_build_resolution.md) — tsup --dts exposes undeclared sibling deps / self-imports / deep-internal imports that Vite+Vitest source aliases hide
- [API TS build overrides](project_api_tsconfig_overrides.md) — apps/api must override root tsconfig's noEmit/bundler/allowImportingTsExtensions to emit
- [SQL migrations location](project_sql_migrations_location.md) — migrations live at repo-root ops/postgres/migrations, NOT platform/ops
- [config.page schema](project_config_page_schema.md) — page is identity-only; config/data_specs live in append-only config.page_version, key on slug
- [api scripts/src compilation boundary](project_api_scripts_src_boundary.md) — runtime src/ must not import build-time scripts/ (seed-helpers); restate SQL on Queryable port instead
- [time_period↔date SSOT](project_time_period_date_ssot.md) — period↔date math lives only in stats.parse_time_period (start) + parse_time_period_end (V16, end); routes pass raw SDMX text, never compute dates
- [RBAC vocabulary](project_rbac_vocabulary.md) — roles are admin/editor/viewer only; no publisher; publish gated to admin (editor saves, admin publishes)
- [api env fail-fast seam](project_api_env_failfast_seam.md) — env.ts is the single boot-time fail-fast seam; PROD_REQUIRED_SECRETS gate + how to test boot via resetModules
