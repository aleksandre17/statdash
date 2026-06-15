# Opus Brief — durable resume state

## Current State

**Phase:** 2 — Constructor Platform (in progress)
**Last Flyway migration:** V5 (seed)
**Completed layers this phase:**
- 2.1 Capability Descriptor Pattern (OPS/REFS/SPEC/TOKENS catalogs + `platform-capabilities.ts`)
- 2.2 Constructor UI — React Admin + Zustand + 3-layer wizard (Data/Site/Page) + @dnd-kit D&D
- 2.3 DataSpec Query Builder — 18-file feature slice, MeasureSelector/FilterBuilder/PipelineBuilder/EncodingEditor
- 2.4 DB Schema — TimescaleDB hypertable + LTREE classifier hierarchy + Flyway V1–V5 migrations
- 2.5 API Server — `@geostat/api` Fastify + config routes (pages/data-specs/data-sources/site/nav) + stats routes (classifiers/datasets/observations)
- 2.6 Infra — two-stack Docker (infra/ + stack/), pgBouncer, statdash-net
- 2.7 Bootstrap — manifest valid, 8/8 selftest, opus-brief seeded
- 2.8 Constructor → API wiring — `src/lib/api.ts` (native fetch, typed adapters), `src/store/api-actions.ts` (init + write-through thunks), real React Admin DataProvider, async App.tsx init with mock fallback

**Active:** Layer 2.9 — Engine → DB DataStore (replace MSW mock store in geostat with real stats API calls)

**Also completed this session (plugin taxonomy — Phase 2 type enforcement):**
- `slice-meta.ts` — new file: `SliceCategory` typed union + `PageSliceMeta` / `PanelSliceMeta` / `NodeSliceMeta` split interfaces; `PanelSliceMeta.canHaveChildren?: false` literal
- `catalog.ts` — `PaletteEntry` + `PluginCatalog` + `PLUGIN_CATALOG` structured index (`byCategory` / `bySliceType`)
- `NodeRegistry.ts` — `list()` + `getSchema()` for Constructor introspection
- 21 plugin `META` declarations annotated with explicit types (`PageSliceMeta` / `PanelSliceMeta` / `NodeSliceMeta`)
- `page-header.category` corrected: `'chrome'` → `'content'`; `container-page/landing.category`: `'landing'` → `'page'`

**Modules:**
- `platform/engine/{core,react,plugins,expr,styles}` — engine layer (stable, pre-existing)
- `platform/apps/geostat` — dashboard renderer (stable)
- `platform/apps/panel` — Constructor wizard (active development)
- `platform/apps/api` — Fastify REST API (just built, not yet connected to panel)

**Key facts:**
- Constructor store (`constructor.store.ts`) uses `MOCK_SOURCES / MOCK_SPECS / MOCK_SITE / MOCK_PAGE` seeded at app init in `App.tsx`
- API endpoints live at `http://localhost:3001/api/{config,stats}/...`
- Panel env: `ops/config/panel/.env.example` has `VITE_PANEL_API_URL` commented out
- DB: statdash / pgBouncer at `statdash-pgbouncer:5432`
- Infra not yet started on user machine (Docker needed: `docker compose -f ops/compose/infra/...`)
- `platform/apps/api/src/routes/config/pages.ts` — full CRUD, transactions, publish flow
- `dim_key` validation trigger enforces DSD + classifier integrity on every INSERT

**Open debt (defer to Phase 3):**
- Engine → DB DataStore (replace MSW mock store with real stats API)
- Auth layer (JWT/sessions on the API)
- Constructor export/publish flow (JSON → geostat renderer)
- Node tree editor, FilterSchema editor, VarMap/vars builder (Phase 3 Constructor features)
- Plugin catalog isolation (`@geostat/plugins/catalog` transitive react-apexcharts import)
- Engine/core erasableSyntaxOnly violations (pre-existing)
- RLS, read replica, continuous aggregates (Phase 4)

## Last Session

Built DB architecture (TimescaleDB + LTREE + Flyway), Fastify API (`@geostat/api`), two-stack infra (statdash-net), bootstrapped .claude kit (8/8 hooks, manifest valid). All memory templates seeded this session.
