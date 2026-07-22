---
name: panel-plugin-conventions
description: Panel/plugin operational conventions — the 3-barrel panel registration chain, plugin layout + the tenant-content i18n boundary (2 sync'd gates), and how to run the panel e2e offline. CONSOLIDATED from 4 sibling files.
metadata:
  type: reference
---

## 1. Panel registration — 3 barrels or it silently drops
A panel dir `packages/plugins/panels/<name>/` (with `default/meta.ts` + `default/index.ts` exporting `Shell`+`META`) is NOT live until wired into THREE faces. Miss one → SILENT failure, node renders nothing, `nodeRegistry.get(type)` undefined:
1. **`panels/index.ts`** — `export * as <name> from './<name>'`. This is the runtime gap that bites: `apps/geostat/src/setupRegistrations.ts` feeds `Object.values(Panels)` into `registerSlice()`. Absent here → never registers.
2. **`registry.ts`** — full runtime registry face (renderer + react hooks).
3. **`catalog.ts`** — `export {META as <name>}` + import META from `meta.ts` + add to `PALETTE_META` array (Constructor palette face; META-only, no Shell).

Real incident (2026-06-23): `text`+`gauge` existed on disk, were missing from all 3 barrels → never registered → the offline "site unavailable" fallback page (which renders a `type:'text'` node) rendered EMPTY. Guard added: `packages/plugins/nodes/__tests__/panel-registration.fitness.test.ts` (structural, reads barrel SOURCE as text; asserts every `panels/*` dir with `default/meta.ts` is exported from all 3) + `panel-resolution.test.ts` (proves `nodeRegistry.get()` resolves). Both `@vitest-environment node`, import META from pure `meta.ts` — NOT the barrel (barrel pulls Shell/apexcharts/leaflet/i18next, unresolvable in node env).

**Same rule for node-type integration tests, not just registration:** a test exercising plugin META (e.g. `NodeCap` across every registered slice) MUST live in `packages/plugins/**` — the dependency arrow (`react ← plugins`) forbids a `react`-tier test from importing plugin META. Import registries like `NodeRegistry` DIRECTLY from their file (`@statdash/react/engine/NodeRegistry`), not the top barrel — the barrel drags in `registerSlice.ts` → `i18next`, unresolvable in a pure node-env test.

## 2. Plugin layout + the tenant-content i18n boundary
`packages/plugins` has NO `src/` dir — organised by feature folder (`nodes/`, `panels/`, `chrome/`, `controls/`, `pages/` + root `registry.ts`/`catalog.ts`). Tooling scoped to `**/src/**` silently SKIPS the whole package (root cause of a past un-audited GeoMap currency-literal leak).

Per-slice metadata: `meta.ts` (Constructor palette `label:{ka,en}` + bilingual `i18n:{ka,en}` UI-string bundle, i18next-backed, resolved via `useT(ns)`) · `*Node.ts` (PropSchema/PropertyGroup labels) · chrome slices put `META:ChromeSliceMeta` in `index.ts`.

**Tenant-content boundary — TWO gates, must stay in sync:**
1. SSOT vitest `platform/tests/no-tenant-content.fitness.test.ts` — the `ALLOW` Set is canonical. TIER 1 (GEL ₾/code, brand name, `['ka','en']` literal) forbidden EVERYWHERE incl. catalogs; TIER 2 (Georgian script) forbidden in rendering/logic only, catalogs exempt. `isCatalogClass` auto-exempts `meta.ts`/`*Node.ts`/`index.ts` with a `*SliceMeta` annotation.
2. Bash twin `ops/scripts/check-laws.sh` Law 4 — scans `packages/core/src` via a Georgian-syllable grep heuristic; its `LAW4_CATALOG_ALLOW` must mirror the vitest ALLOW.

Legitimate (residual, allowlisted) content = the engine i18n machinery itself (meta/Node/SliceMeta descriptors, styles/core/expr catalogs, OBS_STATUS_LABELS, Constructor authoring-label catalogs like `spec-catalog.ts`/`op-schemas.ts`/`param-schemas.ts`/`visibility-schemas.ts`/`rowspec-schemas.ts` via the `bi(ka,en)` helper). De-coupling this into a tenant-supplied i18n registry is an ARCHITECT-owned redesign (engine public API). TRUE LEAK = Georgian/currency/brand literals in rendering/logic (`*Shell.tsx`, `components/*.tsx`) bypassing the i18n channel — fix via `useT(ns)` or config/props (e.g. `ChromeConfig.brandTitle`, `ParamRange.fromLabel`). Panel (`apps/panel`) is deliberately NOT scanned (authoring tool, not tenant-rendered output). **Adding a new authoring-label catalog requires updating BOTH allowlists** — this bit check-laws once via a fragile filename/colon heuristic that didn't match `bi('ka','en')`.

## 3. Running the panel e2e offline
The `apps/panel` Playwright e2e (`boot.e2e.ts`) is the "green ≠ works" net over engine changes. To run offline: `@playwright/test` is a devDep not materialized in node_modules — a gitignored resolution shim at `platform/node_modules/@playwright/test/` re-exports the cached standalone `playwright` 1.61.1 test runner (full shim-construction detail lives in plugins-specialist's memory if ever missing). Config's `webServer` auto-boots Vite dev on :5173; `mockApi.ts` intercepts `/api/*` in-browser.

**Source-resolution fact (why a core edit needs no rebuild here):** panel `vite.config.ts` aliases every `@statdash/*` to package SOURCE (core's package.json `exports["."].source` → `./src/index.ts`). The Vite dev server bundles edited `packages/core/src` directly — UNLIKE `apps/api`, which consumes engine DIST (see [[reference_apps_api_engine_dist]]).
