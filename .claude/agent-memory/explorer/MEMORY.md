# Explorer Memory Index

> Two content families live here: (A) the **geostat-kit** explorer set — documents the LIVE repo package `kits/geostat-kit` (manifest-driven ops orchestration; owner-confirmed, brought from another project, same purpose here); (B) the **statdash codebase** data/capability inventory (current `@statdash` reality).

## A. geostat-kit — Manifest-Driven Ops Package (canonical numbered set)

- [01-geostat-kit-overview](reference_01-geostat-kit-overview.md) — What it is, core pattern, not application code
- [02-geostat-kit-manifest](reference_02-geostat-kit-manifest.md) — geostat.ops.json schema and resolution API
- [03-geostat-kit-drivers](reference_03-geostat-kit-drivers.md) — Driver registry, type dispatch, how to add new drivers
- [04-geostat-compose-generation](reference_04-geostat-compose-generation.md) — Compose pipeline, catalog, three generation modes
- [05-geostat-credentials-and-env](reference_05-geostat-credentials-and-env.md) — No secrets in code, per-module + global fallback
- [06-geostat-ops-consumer](reference_06-geostat-ops-consumer.md) — Consumer ops/ directory, what kit reads
- [07-geostat-kit-lib](reference_07-geostat-kit-lib.md) — Core libraries (ProjectContext API, modules, defaults, credentials)

**Key insight:** the manifest (`geostat.ops.json`) is the SSOT read at runtime by ProjectContext; no hardcoded module IDs/ports/paths in kit code. Driver model = type → commands → scripts (no `if java-boot` branches). Credential isolation per-module + global fallback. Source read from `kits/geostat-kit/` (this repo).

## B. statdash codebase — Data & Capability Inventory

### Data Inventory
- [reference_data_static_facts.md](reference_data_static_facts.md) — Regional/Accounts/GDP raw datasets, DataBundle pattern
- [reference_page_render_configs.md](reference_page_render_configs.md) — Page configs, DataSpec shapes, filter schema, KPIs
- [reference_datastore_architecture.md](reference_datastore_architecture.md) — ExternalStore, Phase 1↔2 bootstrap, migration

### Expression Engine
- [reference_engine_expr_capabilities.md](reference_engine_expr_capabilities.md) — all comparison, logic, math, string, lookup, collection ExprOps

### Data Pipeline
- [reference_engine_dataspec_types.md](reference_engine_dataspec_types.md) — 9 discriminant types (query, row-list, timeseries, growth, ratio-list, by-mode, pivot, transform, custom)
- [reference_engine_core_dataspec_capabilities.md](reference_engine_core_dataspec_capabilities.md) — complete catalog of DataSpec discriminant types + fields for Constructor Panel UI
- [reference_engine_transform_steps.md](reference_engine_transform_steps.md) — 14 pipeline steps (melt, filter, sort, group, lookup, derive, aggregate, rollup, etc.)
- [reference_engine_encoding_spec.md](reference_engine_encoding_spec.md) — Grammar of Graphics field→channel mapping

### Design System
- [reference_engine_styles_capabilities.md](reference_engine_styles_capabilities.md) — tokens (spacing, radii, shadow, aspect, breakpoints, transitions), NodeStyles spec, resolvers, validators

### Page Config Shapes
- [reference_config_node_types.md](reference_config_node_types.md) — section, chart, table, wrap, columns, repeat, georgraph, hero, stats-carousel
- [reference_config_dataspec_patterns.md](reference_config_dataspec_patterns.md) — query, ratio-list, TransformStep ops, EncodingSpec, context references
- [reference_config_filter_kpi_specs.md](reference_config_filter_kpi_specs.md) — FilterSchemaInput, FilterInput types, KpiSpec with ValueSpec & TrendSpec
- [reference_config_varmap_patterns.md](reference_config_varmap_patterns.md) — page/section derived variables (lookup, find, breadcrumbs, if, join-labels, template)
- [reference_config_manifest_bootstrap.md](reference_config_manifest_bootstrap.md) — SiteManifest, SiteBootstrap, Phase 1 → Phase 2 contract, STORE_MANIFEST
- [reference_config_shapes_discovered.md](reference_config_shapes_discovered.md) — full page config JSON shapes, node types, filter schemas, KPI specs, manifest structure

## C. This repo — workspace
- [reference_national-accounts-workspace-structure.md](reference_national-accounts-workspace-structure.md) — structure of THIS repo (national-accounts)
- [reference_reading-session-2026-06-13.md](reference_reading-session-2026-06-13.md) — dated snapshot of roadmap/architecture docs read 2026-06-13 (pre-rename `@geostat` vintage — FLAGGED stale, owner review for Phase 6)
