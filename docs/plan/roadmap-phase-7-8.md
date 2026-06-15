# Roadmap — Phase 7: Platform Power · Phase 8: Tier-1 Architecture Moves

> Operating rules: [IMPLEMENTATION-ROADMAP.md](IMPLEMENTATION-ROADMAP.md)

---

## Phase 7 — Platform Power (extension points)

With integrity, purity, coupling, JSON-readiness, types, robustness, and readability addressed, raise the ceiling: the extension points a Grafana/Builder.io-class platform exposes that this one does not yet.

---

### Layer 7.1 — Datasource plugin API ✅

> **✅ DONE (2026-06-15)** — `stats-registrations.ts` (new): `registerStoreBuilders()` registers the `'stats'` kind builder — receives `{ id, kind:'stats', url, params:{ datasetCode, nonTimeDims } }`, fetches obs + classifiers, returns `ExternalStore`. `fetchStats()` slims from 30 → 13 lines: `/datasets` → `DatasourceInstanceConfig[]` → `buildStoreManifest()`. Static/api paths unchanged (Strangler-Fig on the generic path only). `registerStoreBuilders()` called in `setupRegistrations.ts`. DoD: one `registerStoreBuilder()` call per new kind, zero engine change. tsc EXIT=0.

**Goal:** A new agency registers its own `DataStore` implementation as a plugin — zero core change — exactly as Grafana registers a datasource plugin.

**Scope:**
- Define a `DatasourcePlugin` contract (`create(config: DatasourceInstanceConfig) → DataStore`) and a `datasourceRegistry`, consumed by `buildStoreManifest` from Layer 3.1. `kind` in the JSON spec dispatches to the registered plugin.
- Register the built-in `ExternalStore`/`ApiStore` as plugins; the app no longer constructs stores imperatively.

**Definition of Done:**
- [ ] A new datasource kind = one `datasourceRegistry.register()` call; no engine/app change.
- [ ] Built-in stores are registered as plugins.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 3.1
**Touches:** engine/core · engine/react · src/data
**Estimated size:** M (half-day)
**Risk:** MED — new extension seam; keep it agnostic (no Geostat assumptions).

**Closes:** Platform-fit (Grafana datasource plugin parity)

---

### Layer 7.2 — Constructor palette metadata completeness ✅

> **✅ DONE (2026-06-15)** — `slice-meta.ts` (new): typed taxonomy — `SliceCategory`, `NodeSliceMeta`, `PageSliceMeta`, `PanelSliceMeta`, `ChromeSliceMeta`, `FilterControlMeta`, `SliceMeta` discriminated union. `NodeRegistry.list()` → all registered slices with full META (open discovery); `NodeRegistry.getSchema(type, variant)` → schema or null. `registerSlice` updated to `AnyNodeSliceMeta` union with per-sliceType `'in'` guards. 35 plugin `meta.ts` files across nodes/pages/panels/chrome — every registered slice carries label, icon, category, schema, defaults, slots, groups, version, i18n. `META` exported from every `default/index.ts`. tsc EXIT=0.

**Goal:** Every registered slice carries complete Constructor metadata (label, icon, category, schema, defaults, slots) so the Phase-2 visual builder can present and author it.

**Scope:**
- Audit all `NodeSliceMeta` across `plugins/**` for missing `label`/`icon`/`category`/`schema`/`defaults`/`slots`/`groups`. Fill gaps so the Constructor palette and property panel are complete for every node, panel, control, and chrome slice.
- Ensure `schema` + `defaults` round-trip (Constructor "new node" creation).

**Definition of Done:**
- [ ] Every registered slice has complete palette + property-panel metadata.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phases 0–4 (stable types/metadata shapes)
**Touches:** plugins
**Estimated size:** M (half-day)
**Risk:** LOW — additive metadata.

**Closes:** Platform-fit (Builder.io/Retool palette parity)

---

## Phase 8 — Tier-1 architecture moves (beyond the gaps)

The structural moves from `ARCHITECTURE-TARGET.md §Tier 1` that are not gap-fixes. N2 (`@geostat/constructor`), N6 (observability seam), N9 (datasource plugin) already land inside Phases 1/7; the four below are the remainder. Rationale for each lives in `ARCHITECTURE-TARGET.md` (not duplicated here — Operating Rule 5).

---

### Layer 8.1 — Split `@geostat/charts` out of `@geostat/engine` `[N1]` ✅

> **✅ DONE (2026-06-15)** — `platform/engine/charts/` (`@geostat/charts`): `ChartDef`/`ChartOutput` types, `interpretChart` dispatch, `ChartRegistry` + `chartRegistry` singleton (13 built-in interpreters), `validateChartDef`. `@geostat/engine` now has zero chart code: `chart/*` deleted, `registry/interpreters.ts` deleted, `EngineRegistry` stripped to spec-only, `setChartRegistry` bootstrap block removed, `ChartInterpreter`/chart exports purged from public API. Registry design: two registries split by package (avoids cycle). `@geostat/react` re-exports `ChartDef`/`ChartOutput`/`interpretChart` from charts. Plugin chart imports updated (17 files). Alias maps updated (tsconfig × 3, vite × 2, vitest × 1). tsc EXIT=0.

**Goal:** Chart interpretation is a separate package; a table-only/headless consumer never bundles chart code.

**Scope:**
- New package `packages/charts` (`@geostat/charts`). Move `chart/*` (`engine.ts`, `types.ts`) + `registry/interpreters.ts` + `ChartType` out of `@geostat/engine`; depend on engine-core's `DataRow`.
- Re-point imports across `engine/react` + `plugins/panels/chart` + `src` to `@geostat/charts`.
- `validateChartDef` + `chartRegistry` move with it; engine-core re-exports nothing chart-related.

**Definition of Done:**
- [ ] `@geostat/charts` builds independently; `@geostat/engine` has zero chart code.
- [ ] App renders identically; all chart types work.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 0.1 (chart-type SSOT) — clean before moving.
**Touches:** engine/core · packages/charts (new) · engine/react · plugins · src
**Estimated size:** M (half-day)
**Risk:** MED — wide import churn; tsc + a render pass per page guard it.
**Closes:** N1 *(co-locates with Phase 7 per ARCHITECTURE-TARGET)*

---

### Layer 8.2 — Unify all chart types through `ChartRendererRegistry` `[N3]`

**Goal:** One swappable render-library seam — every chart type dispatches through the registry, none bespoke in the shell.

**Scope:**
- `plugins/panels/chart/default` — route `DonutChart`/`HBarDivergingChart`/`TreemapChart` and the `toApexOptions` path uniformly through `ChartRendererRegistry.get(type)`; the shell never branches on type.

**Definition of Done:**
- [ ] No `if (type === …)` chart branching in `ChartShell`/`Chart`; all via registry.
- [ ] Adding/replacing a render library is one registry change.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Layer 6.1 (chart-shell decomposition) — natural co-location.
**Touches:** plugins/panels/chart · engine/react
**Estimated size:** M (half-day)
**Risk:** MED — render output must stay pixel-identical; visual check per chart type.
**Closes:** N3

---

### Layer 8.3 — `CachedStore` + batch as the default read path `[N5]`

**Goal:** The caching + batching the platform already built is on by default, not dormant.

**Scope:**
- `resolveStore` wraps any non-static store in `CachedStore`; reads route through `runBatch`/`prefetch` where `StoreCaps.batching` is set (`gaps.md` #8 — built, unused).

**Definition of Done:**
- [ ] Non-static stores are cache-wrapped by default; repeat reads hit cache.
- [ ] No behavior change in rendered output.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 2.1 (row types unified)
**Touches:** engine/react · engine/core
**Estimated size:** S (1–2h)
**Risk:** LOW — wrapper is transparent; verify invalidation on filter change.
**Closes:** N5

---

### Layer 8.4 — Consolidate the filter-model seam `[N7]`

**Goal:** One home for the control plane — `FilterContext` / `FiltersContext` / `useFilterState` form a single coherent filter model, behavior preserved.

**Scope:**
- Consolidate the schema→bars bridge so the three pieces are one seam (see `ARCHITECTURE-TARGET.md` Layer 3.3). No behavior change.

**Definition of Done:**
- [ ] One filter-model entry point; no overlapping responsibility across the three.
- [ ] Filter behavior (URL sync, mode, effects) identical.
- [ ] `npx tsc --noEmit` = 0 errors.

**Dependencies:** Phase 2.3 (honest codec)
**Touches:** engine/react
**Estimated size:** M (half-day)
**Risk:** MED — central control plane; full filter regression pass.
**Closes:** N7
