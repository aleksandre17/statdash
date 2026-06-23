# Explorer Memory Index — Data Inventory + Capability Descriptors

## Data Inventory (Codebase Exploration)

- [data_static_facts.md](data_static_facts.md) — Regional/Accounts/GDP raw datasets, DataBundle pattern
- [page_render_configs.md](page_render_configs.md) — Page configs, DataSpec shapes, filter schema, KPIs
- [datastore_architecture.md](datastore_architecture.md) — ExternalStore, Phase 1↔2 bootstrap, migration

## @geostat/expr — Expression Engine

- [ExprOp Catalog](engine_expr_capabilities.md) — all comparison, logic, math, string, lookup, collection ops

## @geostat/engine — Data Pipeline

- [DataSpec Types](engine_dataspec_types.md) — 9 discriminant types (query, row-list, timeseries, growth, ratio-list, by-mode, pivot, transform, custom)
- [TransformStep Operations](engine_transform_steps.md) — 14 pipeline steps (melt, filter, sort, group, lookup, derive, aggregate, rollup, etc.)
- [EncodingSpec Channels](engine_encoding_spec.md) — Grammar of Graphics field→channel mapping

## @geostat/styles — Design System

- [Styles Capabilities](engine_styles_capabilities.md) — tokens (spacing, radii, shadow, aspect, breakpoints, transitions), NodeStyles spec, resolvers, validators

## apps/geostat — Page Config Shapes

- [Node Types](config_node_types.md) — section, chart, table, wrap, columns, repeat, georgraph, hero, stats-carousel
- [DataSpec & Pipelines](config_dataspec_patterns.md) — query, ratio-list, TransformStep ops, EncodingSpec, context references
- [Filter & KPI Specs](config_filter_kpi_specs.md) — FilterSchemaInput, FilterInput types, KpiSpec with ValueSpec & TrendSpec
- [VarMap & ExprOp](config_varmap_patterns.md) — page/section derived variables (lookup, find, breadcrumbs, if, join-labels, template)
- [Manifest & Bootstrap](config_manifest_bootstrap.md) — SiteManifest, SiteBootstrap, Phase 1 → Phase 2 contract, STORE_MANIFEST
