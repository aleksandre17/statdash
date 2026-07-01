---
name: project-db-contracts
description: The frontend/engine TypeScript contracts the Phase 2 DB must project verbatim, and the docs that own them
metadata:
  type: project
---
The Phase 2 PostgreSQL schema is a **projection of existing frontend contracts**, not a fresh model. Authoritative shapes and their doc homes:

- **Classifier / DisplayMap split** — `docs/architecture/subsystems/18-classifier-pipe.md`. `Classifier = Record<id, {code, parent?, ...structural}>` (engine reads code+parent only); `DisplayMap = Record<id, Record<attr, val>>` (UI overlay, engine ignores). Both **id-keyed** (surrogate), same id space. Facts carry **surrogate ids**, not codes — code↔id translation happens in `ExternalStore.DimResolver`.
- **Observation / ObsQuery** — `docs/architecture/subsystems/17-data-cube.md`. Open dims: `ObsQuery { indicators?, dims?: Record<string,string|string[]>, timeRange? }`. No privileged dimension. JSONB hybrid: physical cols = time_period, geo_code, obs_value, obs_status, dataset_code; everything else = extra_dims JSONB.
- **DatasourceInstanceConfig / AuthConfig / ApiResponse envelope** — `docs/architecture/subsystems/25-datasource-system.md`. Three-tier classifier resolution (Tier1 in-manifest, Tier2 structureUrl, Tier3 in data response). SDMX-JSON `meta+structure+data` envelope is the boundary, never changes.
- **SiteManifest / NavItem / PageConfig** — `docs/architecture/subsystems/08-site-manifest.md`. nav_items and pages are **independent tables**; PageConfig has NO nav field. `pages.children JSONB = NodeDef[]`. Existing agreed DDL sketch is in that doc — extend it, don't contradict.
- **Constructor metadata** — `docs/architecture/subsystems/15-constructor.md`. node_type_registry (label/icon/category/schema JSONB), transform_registry, `GET /api/catalog → DatasetEntry[]`.

**Why:** the platform's whole premise is Constructor writes JSON → engine renders unchanged. If the DB shape diverges from the TS types, the serialize/deserialize boundary breaks.
**How to apply:** before designing any table, find its TS contract in these docs and mirror field names + JSON-safety. `JSON.parse(JSON.stringify(x)) === x` must hold for every config column.

DB overview doc (mostly empty TODO, fill as we go): `docs/architecture/future/01-database/overview.md`.
