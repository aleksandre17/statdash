---
name: constructor-source-authoring-m2
description: M2 source-authoring seam — store-builder capabilities (getMetadata/testConnection) + type↔kind SSOT + panel ADD/TEST/BROWSE/SAVE UI + FF-SOURCE-AUTHORABLE
metadata:
  type: project
---

M2 (Constructor source-authoring) landed: a non-programmer can ADD/TEST/BROWSE/SAVE a data source in the Constructor, and a static source builds a live store with ZERO code change (FF-SOURCE-AUTHORABLE).

**Why:** close the source-spectrum loop now that `static`/`stats` are real store KINDS — the vision's success test is a Constructor-written source building a live store with no code change.

**How to apply (the seams, all additive/byte-identical):**
- **Builder capability registry** (`packages/react/src/engine/storeManifest.ts`): added a SECOND map `_capabilities` beside `_registry`. `registerStoreCapabilities(kind, {getMetadata?, testConnection?})` + `getStoreCapabilities(kind)` + dispatch helpers `getSourceMetadata(config)`/`testSource(config)`. Both capabilities OPTIONAL (degrade, don't throw). Did NOT overload `registerStoreBuilder(kind, fn)` — left it byte-identical.
- **SourceMetadata / SourceTestResult** contracts live in `packages/core/src/data/datasource.ts` (next to DatasourceInstanceConfig) — kind-agnostic dims/measures bundle, the source-tier analogue of CubeProfile.
- **static** caps (`plugins/datasources/static-registrations.ts`): PURE — `deriveStaticMetadata(values)` splits inline-row keys (RESERVED_VALUE_KEYS = value/obsStatus/time; `value`=measure, rest=dims); `testStaticSource(values)` = non-empty array of plain objects.
- **stats** caps (`stats-registrations.ts`): network — getMetadata maps `GET /api/cube/:code/profile` (new `fetchCubeProfile` in stats-api.ts, CUBE_PREFIX); testConnection = `fetchDatasetMeta` resolves.
- **type↔kind SSOT** = `plugins/datasources/source-descriptor.ts`: `SOURCE_KIND_BY_TYPE` ({rest:'stats', static:'static', sdmx-json:null}) + `kindForType`/`typeForKind`/`toSourceDescriptor`. Wire `type` (DB CHECK) vs store `kind` (registry) are different alphabets — one table both directions. geostat `fetch-store-manifest.ts` now uses `toSourceDescriptor` (was rest-only filter) so static rows boot too.
- **UI**: `apps/panel/src/features/datasources/SourceAuthoringPanel.tsx` (kind-pick from `registeredKinds()` filtered by `typeForKind` = OCP; static→JsonDataField; stats→cube picker via new `cubeApi.datasets()`); wired into DataStep right pane with a new `source-new` selection branch + Add/Delete. A passing Test promotes status→`connected` so the public `/api/data-sources` route (status='connected' filter) boots it.
- Persists via EXISTING `configApi.dataSources` CRUD (createDataSource/updateDataSource thunks) — no parallel write path.

**Gotchas:** panel right-pane authoring panel is keyed `key={id ?? 'new'}` to remount-reseed (NOT a setState-in-effect — that trips react-hooks/set-state-in-effect lint error). Tests: 1334 (was 1323), +11 in static/stats-registrations.test.ts.
