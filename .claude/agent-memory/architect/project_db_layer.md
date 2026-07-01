---
name: db-layer
description: The Phase-2 DB (Postgres+TimescaleDB+LTREE+JSONB) is now backed by Flyway migrations V1-V10 at ops/postgres/migrations/ — the structural SSOT
metadata:
  type: project
---

UPDATE (2026-06): The "no DDL files" gap is CLOSED. Flyway migrations **V1-V10 exist at `ops/postgres/migrations/`** and are the structural SSOT. Key ones: V4 (stats tables: dimension/classifier/dataset/dataset_dimension/observation hypertable + dim_key validation trigger + LTREE path trigger), V6 (classifier_display + dataset_version + SCD-2 columns valid_from/valid_to/is_current wired-not-enforced + RLS seam), V8 (obs_attribute JSONB bag + observation_revision append-only audit via BEFORE-UPDATE trigger). seed.ts + seed-helpers.ts + seed-units.ts now implement the ETL (3 bundles: GDP/ACCOUNTS/REGIONAL → cube). The remaining gap is that seed.ts is a manual, non-observable, no-approval, no-provenance script — the target is to replace it with a staged ingestion architecture. See [[ingestion-architecture]].

**Decided stack (visible in code):** PostgreSQL + **TimescaleDB** (`stats.observation` is a hypertable — comments say "partition pruning on time_period_date"), **LTREE** for classifier hierarchy (`stats.classifier.path`), JSONB + GIN containment (`dim_key @> $::jsonb`), pgBouncer transaction-pooling (`apps/api/src/db.ts`).

**Two schemas (the isolation the user wants is physical):**
- `stats.*` — facts/metadata: `observation(dataset_code, time_period, time_period_date, dim_key jsonb, obs_value, obs_status)`, `dataset`, `dataset_dimension` (the DSD), `dimension`, `classifier(dim_code, code, label, color, parent_id, path ltree, ord, metadata)`.
- `config.*` — the Constructor side: `site_config(key,value jsonb)`, `data_source`, `data_spec`, `nav_item`, `page`, `page_version` (immutable versions, BEFORE-INSERT trigger assigns version_number, is_published one-hot).

**Engine contract (richer than prompts say — already async-ready):** `engine/core/src/data/store.ts` has `DataStore.queryAsync` + `QueryResult` envelope + `StoreCaps.sync` + `Requirement`/prefetch + `asyncFromSync`. The sync-vs-async question is SOLVED (N34). `store-impl.ts` has `ApiStore` (prefetch+cache), `CachedStore`, `ExternalStore`. `DatasourceInstanceConfig` (datasource.ts) is the JSON manifest descriptor; `buildStoreManifest` is the Phase-1→2 switch.

**The real gap:** (1) formalize DDL/migrations for the implied schema; (2) a `stats.display`/config-render table is referenced nowhere yet — display isolation is unbuilt; (3) seed script from the 3 TS datasets; (4) ApiStore endpoints (`/indicators/values`) don't match the route paths (`/datasets/:name/obs`).

**Why:** future DB work must extend this exact schema, not invent a parallel one (Law 7, SSOT).
**How to apply:** before any DB design, read `apps/api/src/routes/stats/*` + `config/*` and `engine/core/src/data/store*.ts`. See [[platform-layout]].
