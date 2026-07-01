# Explorer Memory Index

> Two content families live here: (A) the **geostat-kit** explorer set — documents the LIVE repo package `kits/geostat-kit` (manifest-driven ops orchestration; owner-confirmed, brought from another project, same purpose here); (B) the **statdash codebase** data/capability inventory (current `@statdash` reality).

## A. geostat-kit — Manifest-Driven Ops Package (canonical numbered set)

- [01-geostat-kit-overview](01-geostat-kit-overview.md) — What it is, core pattern, not application code
- [02-geostat-kit-manifest](02-geostat-kit-manifest.md) — geostat.ops.json schema and resolution API
- [03-geostat-kit-drivers](03-geostat-kit-drivers.md) — Driver registry, type dispatch, how to add new drivers
- [04-geostat-compose-generation](04-geostat-compose-generation.md) — Compose pipeline, catalog, three generation modes
- [05-geostat-credentials-and-env](05-geostat-credentials-and-env.md) — No secrets in code, per-module + global fallback
- [06-geostat-ops-consumer](06-geostat-ops-consumer.md) — Consumer ops/ directory, what kit reads
- [07-geostat-kit-lib](07-geostat-kit-lib.md) — Core libraries (ProjectContext API, modules, defaults, credentials)

**Key insight:** the manifest (`geostat.ops.json`) is the SSOT read at runtime by ProjectContext; no hardcoded module IDs/ports/paths in kit code. Driver model = type → commands → scripts (no `if java-boot` branches). Credential isolation per-module + global fallback. Source read from `kits/geostat-kit/` (this repo).

## B. statdash codebase — Data & Capability Inventory

### Data Inventory
- [data_static_facts.md](data_static_facts.md) — Regional/Accounts/GDP raw datasets, DataBundle pattern
- [page_render_configs.md](page_render_configs.md) — Page configs, DataSpec shapes, filter schema, KPIs
- [datastore_architecture.md](datastore_architecture.md) — ExternalStore, Phase 1↔2 bootstrap, migration

### Expression Engine
- [engine_expr_capabilities.md](engine_expr_capabilities.md) — all comparison, logic, math, string, lookup, collection ExprOps

### Data Pipeline
- [engine_dataspec_types.md](engine_dataspec_types.md) — 9 discriminant types (query, row-list, timeseries, growth, ratio-list, by-mode, pivot, transform, custom)
- [engine_core_dataspec_capabilities.md](engine_core_dataspec_capabilities.md) — complete catalog of DataSpec discriminant types + fields for Constructor Panel UI
- [engine_transform_steps.md](engine_transform_steps.md) — 14 pipeline steps (melt, filter, sort, group, lookup, derive, aggregate, rollup, etc.)
- [engine_encoding_spec.md](engine_encoding_spec.md) — Grammar of Graphics field→channel mapping

### Design System
- [engine_styles_capabilities.md](engine_styles_capabilities.md) — tokens (spacing, radii, shadow, aspect, breakpoints, transitions), NodeStyles spec, resolvers, validators

### Page Config Shapes
- [config_node_types.md](config_node_types.md) — section, chart, table, wrap, columns, repeat, georgraph, hero, stats-carousel
- [config_dataspec_patterns.md](config_dataspec_patterns.md) — query, ratio-list, TransformStep ops, EncodingSpec, context references
- [config_filter_kpi_specs.md](config_filter_kpi_specs.md) — FilterSchemaInput, FilterInput types, KpiSpec with ValueSpec & TrendSpec
- [config_varmap_patterns.md](config_varmap_patterns.md) — page/section derived variables (lookup, find, breadcrumbs, if, join-labels, template)
- [config_manifest_bootstrap.md](config_manifest_bootstrap.md) — SiteManifest, SiteBootstrap, Phase 1 → Phase 2 contract, STORE_MANIFEST
- [config_shapes_discovered.md](config_shapes_discovered.md) — full page config JSON shapes, node types, filter schemas, KPI specs, manifest structure

## C. This repo — workspace
- [national-accounts-workspace-structure.md](national-accounts-workspace-structure.md) — structure of THIS repo (national-accounts)
- [reading-session-2026-06-13.md](reading-session-2026-06-13.md) — dated snapshot of roadmap/architecture docs read 2026-06-13 (pre-rename `@geostat` vintage — FLAGGED stale, owner review for Phase 6)
