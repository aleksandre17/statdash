# Architecture Target — Geostat National Accounts Dashboard

> Standard: **Senior Application, Architecture & Design Engineer** — Readable · Clear · Organized · Growth-oriented · SOLID · Patterns · Agnostic · DRY
>
> Source: `SYSTEM-PIPELINE-TREE.md` (current state, 8 layers) + the 2026-06-02 deep audit (34 gaps) distilled in `IMPLEMENTATION-ROADMAP.md`.
>
> Scope: the **target** — same 8-layer tree, every divergence from the current state justified by a named principle or pattern. This is the platform *as it should be* to reach best-in-class quality among JSON-rendering platforms (Grafana · Builder.io · Retool · Vega-Lite), not merely the gap-fix list.

---

## Design Principles Applied

Seven axes drove every operation below. Each recommendation cites the axis (and gap `[#N]` / new-move `[Nx]`) that justifies it.

1. **Clean Architecture — strictly inward dependencies (DIP + ISP).** `src → plugins → @geostat/react → @geostat/charts → @geostat/engine → @geostat/expr`. No inner layer imports an outer one; no concrete type leaks across a boundary. Fat surfaces get split (ISP); leaking adapters get pushed behind a port (DIP).

2. **Open registry, single source of truth (OCP).** Every extensible axis is a registry. **No closed union, `Set`, or array may mirror a registry's contents** — the type system *derives* from the registry. A new type is one `register()` call, zero core change. (Root A — the three drifting mirrors are deleted.)

3. **JSON-first / Constructor-ready.** Every config is plain JSON — no functions, JSX, or class instances. The platform exposes **one typed schema-export** (`@geostat/constructor`) that emits the full visual-builder contract (palette + property schema + datasource catalog). `JSON.parse(JSON.stringify(x)) === x` for every config. (Root B.)

4. **Agnostic core, brand at the edge.** `@geostat/engine` and `@geostat/charts` know no Geostat, no locale string, no Vite. Brand = `@geostat/styles` tokens. Locale = `LocaleString` resolved at the boundary. The engine ships to any statistical agency unchanged.

5. **Loose coupling via explicit seams + one home per concern (DRY + SRP).** Pipelines are composable named stages. The same logic never lives twice (one raw-row type, one var-evaluator, one chart-render boundary). Collaborating layers communicate through narrow ports, never concrete imports. (Root D.)

6. **Observable & fail-loud (no silent failure).** No code path returns `[]` / `null` / placeholder for a misconfiguration without surfacing a typed, Constructor-visible diagnostic. A dedicated observability seam carries render/resolve traces — the engine never embeds `console`. (Root C.)

7. **Performance by default.** Lazy render, memoized context, batched + cached store queries are the default path, not opt-in — the platform turns on the performance machinery it already builds.

8. **Official-statistics grade (the ONS / Eurostat / IMF bar).** This platform publishes a *national statistics office's* numbers. Four obligations are therefore architectural, not features: **provenance** (every figure traceable to source · vintage · methodology · revision status), **accessibility** (every visual usable without sight or a mouse — WCAG 2.1 AA, enforced, with a data-table alternative for every chart), **reproducibility** (the same config + data always renders the same figure; configs are versioned and migratable), and **export** (every dataset downloadable in an open format). A figure that cannot be traced, accessed, reproduced, or exported is not publishable.

The five operation types used in every table:
- 🔴 **REMOVE** — delete; a principle violation that does not justify keeping.
- 🟡 **MOVE** — relocate; right idea, wrong layer/package.
- 🟢 **ADD** — introduce; a capability missing for SOLID / patterns / growth / Constructor fitness.
- 🔵 **RESHAPE** — exists but redesign (rename, split, merge, interface change).
- ⚪ **KEEP** — already conforms; called out when it is load-bearing or a debt item might tempt a change that should not happen.

---

## Layer 0 — Build & Workspace Foundation

| Element | Op | Reason |
|---|---|---|
| Vite + `VITE_STORE_MODE` env switch | ⚪ KEEP | Correct, and the env read lives only in `src/` (Principle 4). |
| TypeScript strict, `tsc --noEmit = 0` invariant | ⚪ KEEP | The standing gate; every target layer preserves it. |
| Monorepo packages `expr · engine · react · styles` | 🔵 RESHAPE | Split out a fifth published package **`@geostat/charts`** (chart interpreters + `ChartOutput` types) from `@geostat/engine` `[N1]`. Chart interpretation is a distinct axis of change from data resolution (ISP at the package level); a table-only or headless deployment must not pull chart code. Precedent: `@grafana/data` vs panel plugins; `vega` vs `vega-lite`. Engine-core becomes data-only. |
| `@geostat/constructor` (NEW package) | 🟢 ADD | One typed module that composes the Phase-2 builder contract from the registries: `describeRegistry()` → `{ palette, propertySchemas, datasourceCatalog, chartTypes, specTypes }` as JSON `[N2]`. Today this metadata is scattered across slice `META` + ad-hoc `specTypes()`/`chartTypes()`. The Constructor needs one entry point (Principle 3). Pure, depends only on the registries. |
| `src/main.tsx` (i18next.init → setupRegistrations → mount) | ⚪ KEEP | Correct ordering. |
| `src/mocks/` (MSW) | ⚪ KEEP | Correct simulation of the Phase-2 network boundary; the right place for it (`src/`). |
| `import.meta.env` reachable from engine | 🔴 REMOVE | Vite API inside a zero-dep core is a layer breach `[#1, #34]`. The engine reads no env; observability is injected (see Layer 2 / Principle 6). |

---

## Layer 1 — Primitives & Contracts

| Element | Op | Reason |
|---|---|---|
| `@geostat/expr` (ExprVal, evalExpr, open op registry, ops/*, template, derive, guards) | ⚪ KEEP | Zero-dep, registry-extensible, pure — exemplary. The engine registering domain ops into it (find/breadcrumbs/join-labels) is correct DIP. |
| `core/context.ts` `SectionContext { timeMode, dims, locale? }` | ⚪ KEEP | Generic dimension map, no privileged dim — the Non-Negotiable. Load-bearing; do not specialize. |
| `Unit` closed union | 🔵 RESHAPE | `Unit = string` (open) `[#6]`. Units are data, not an engine-owned enum (Principle 2/4). |
| `ChartType` literal union | 🔴 REMOVE | Delete; `ChartType = string` derived from the chart registry `[#2]`. The union is a closed mirror of an open registry (Principle 2). Moves to `@geostat/charts`. |
| `ModeId` / `ModeDef` / `ModeContext` | 🔵 RESHAPE | `ModeDef.label: LocaleString` `[#9]`. Mode is open already; only the label leaks locale. |
| `LocaleString` + `resolveLocaleString` / `resolveLabel` | ⚪ KEEP | Correct inline-bilingual contract (Sanity pattern); backward-compatible with plain strings. |
| `sdmx.ts` (Observation, ObsQuery, Classifier, DisplayMap, DimRef, DataBundle) | ⚪ KEEP | The one storage/wire model; clean ISO-17369 shape. The single SDMX boundary is correct. |
| `core/types.ts` `DataLookupOp` / `NodeDeriveMap` | ⚪ KEEP | Engine-level derive that extends ExprVal with data access — correct extension point. |
| `core/layout.ts` `groupBySpan<T>` | ⚪ KEEP | Generic, type-agnostic algorithm with boundary wrappers — textbook "core knows how, boundary knows who." |

---

## Layer 2 — Engine Data Core (`@geostat/engine`, data-only after split)

### 2.1 Data access (Repository)

| Element | Op | Reason |
|---|---|---|
| `DataStore` port + `StoreQuery` discriminated union | ⚪ KEEP | The single, capability-open port (Grafana `DataSourceApi`). Correct. |
| `StaticStore` / `ExternalStore` (+ `DimResolver`) | ⚪ KEEP | Clean adapters; OLAP slice + Kimball code↔id translation are right. |
| `ApiStore` / `CachedStore` | 🔵 RESHAPE | Both are **built but unwired** (`gaps.md` #8). Make `CachedStore` the default wrapper around any non-static store, and route reads through `runBatch`/`prefetch` so the batch + cache the platform already paid for is the default path `[N5]` (Principle 7). |
| `DatasourcePlugin` API (NEW) | 🟢 ADD | `DatasourcePlugin.create(config: DatasourceInstanceConfig) → DataStore` + `datasourceRegistry`; `kind` in JSON dispatches to the plugin `[N9, #18]`. A new agency registers its own store with zero core change (Grafana datasource provisioning). The built-in `ExternalStore`/`ApiStore` register as plugins. |
| `AsyncDataStore` capability + Suspense resolution (NEW) | 🟢 ADD | `interpretSpec` is sync; a real Phase-2 API must suspend, not return `[]`. Add an async capability so `resolveNodeRows` resolves via a `use()`/Suspense boundary (already half-wired — `renderNode` step 7 has `<Suspense>`) `[N4]`. The render pipeline connects to it; the engine stays framework-free by exposing a promise-cache port, not React. |
| `data/source.ts` + `data/resolve.ts` + `data/codelist.ts` | ⚪ KEEP | Universal options abstraction + pure resolvers + ref resolution — clean. |

### 2.2 Spec resolution (Strategy + Registry)

| Element | Op | Reason |
|---|---|---|
| `interpretSpec` dispatch via `EngineRegistry` | ⚪ KEEP | The core Strategy. Correct. |
| DEV logging block inside `interpretSpec` | 🔴 REMOVE & 🟢 ADD | Remove the embedded `import.meta`/`console` (SRP + purity breach `[#1,#34]`). Add an injected `ResolveObserver` port (`onResolve(tag, ctx, rows)`) the app wires in dev — a real observability seam (Principle 6). |
| Unknown-spec `console.warn + return []` | 🔵 RESHAPE | Return a typed diagnostic the render boundary surfaces `[#33]`. Fail-loud (Principle 6). |
| `KNOWN_SPEC_TYPES` Set (validation) | 🔴 REMOVE | Closed mirror of the resolver registry; validate against `defaultRegistry.specTypes()` `[#16/#33]` (Principle 2). |
| `CustomResolver` (`spec.fn(ctx)`) | 🔴 REMOVE | Function in config; not JSON-serializable `[#3]`. Escape-hatch becomes a *registered* `SpecResolver`, not an inline fn (Principle 3). |
| 8 declarative `SpecResolver`s | ⚪ KEEP | Each an independent unit, no switch — correct Strategy. |
| `by-mode` silent first-branch fallback | 🔵 RESHAPE | Emit a validation warning when the active mode key is absent `[#22]` (Principle 6). |
| `config/section.ts` dead Track-B types (`SectionDef`/`WidgetDef`/`TabsDef`/`groupBy*`/…) | 🔴 REMOVE | Dead surface in the public API; no live config uses them `[#12]`. Delete after validation re-points at the live tree (below). Keep `ColumnDef`/`RowSpec`/`TableConfig` (panels use them). |

### 2.3 Transform pipeline + Encoding

| Element | Op | Reason |
|---|---|---|
| `TransformStep` union + `applyPipeline` + `DeriveExpr` parser + `FORMATTERS` | ⚪ KEEP | Declarative, JSON-serializable, composable — the Vega-Lite/Tidy-Data standard done right. Load-bearing; do not touch behavior. |
| `RawRow` (transform) vs `EngineRow` (encoding) | 🔵 RESHAPE | Byte-identical types, two names, two files. Unify to one canonical raw-row type; document its relation to `DataRow` `[#11, #28]`. Removes the `as unknown as` bridges in `resolveNodeRows` (Principle 5/DRY). |
| `applyEncoding` / `EncodingSpec` / `DataRow` | ⚪ KEEP | The Grammar-of-Graphics seam — the right separation of data vs render. |
| `FieldConfig` + utils | ⚪ KEEP | Grafana field-override parity; clean. |

### 2.4 KPIs, links, validation, i18n format

| Element | Op | Reason |
|---|---|---|
| `interpretKpis` / `KpiSpec` · `resolveDataLinks` / `DataLinkDef` | ⚪ KEEP | Clean declarative resolvers. |
| `validation/pipeline.ts` validating the dead `SectionDef` | 🔵 RESHAPE | Re-point at the **live `NodeDef` tree**: traverse children, run per-slice `validate` hooks + spec/chart validators, expose `validatePageTree(page) → ValidationResult` `[#27]`. The Constructor validates what renders (Principle 6/3). |
| `validators` factories with Georgian defaults + `validateField` | 🔵 RESHAPE | `message` always supplied by the caller; no locale string in the engine `[#8]` (Principle 4). |
| `i18n/format.ts` currency fallback (hardcoded 2-decimal/space) | 🔵 RESHAPE | Use `Intl.NumberFormat`; honor `decimals` `[#24]` (Principle 4). |
| `interpreters.ts` UTF-8 mojibake | 🔴 REMOVE (corruption) | Re-save clean UTF-8 `[#17]`. |

---

## Layer 2b — `@geostat/charts` (NEW package, split from engine) `[N1]`

| Element | Op | Reason |
|---|---|---|
| `ChartInterpreter`s + `interpretChart` + `ChartOutput`/`ChartDef` types + `ChartType` | 🟡 MOVE | Relocate out of `@geostat/engine` into `@geostat/charts`, depending on engine-core's `DataRow`. Distinct axis of change; lets a deployment opt out of chart code (ISP at package level). |
| `KNOWN_CHART_TYPES` Set | 🔴 REMOVE | Closed mirror; `validateChartDef` validates against `chartRegistry.chartTypes()` `[#16, #2]` (Principle 2). |
| `interpretChart` silent `placeholderOutput` on unregistered type | 🔵 RESHAPE | Emit a typed diagnostic `[#29]` (Principle 6). |
| Chart interpreters (bar/hbar/diverging/line/area/pie/donut/waterfall/contribution/combo/treemap) | ⚪ KEEP | Neutral output, renderer-agnostic — the correct engine/render separation. |

---

## Layer 3 — React Rendering Platform (`@geostat/react`)

### 3.1 Registries

| Element | Op | Reason |
|---|---|---|
| `NodeRegistry` / `chromeRegistry` / `filterControlRegistry` / `skeletonRegistry` / `middlewareRegistry` / `ChartRendererRegistry` | ⚪ KEEP | The platform's open-extension backbone — Grafana/Builder.io parity. |
| `NodeRegistry.register` `children: any` / `def: any` | 🔵 RESHAPE | Type `children: ChildrenArg`, `def: T` `[#14]` — restore the registration-time contract (Principle 1). |
| `registerSlice` hub | ⚪ KEEP | Clean discriminated dispatch by `sliceType`. |
| `middlewareRegistry.all()` returns live array, no priority | 🔵 RESHAPE | Return a frozen snapshot; add a `priority` field for deterministic ordering `[#21]` (encapsulation). |

### 3.2 Render pipeline

| Element | Op | Reason |
|---|---|---|
| `renderNode` 12-step composite | ⚪ KEEP | Zero `if/switch` on type, lazy children, per-node error isolation — the heart of the platform; exemplary. |
| Lazy children Proxy (9 methods) | 🔵 RESHAPE | Delegate **all** array methods generically (`slice`/`find`/`flat`/…) via `all()[prop]` `[#20]` — a typed `ReactNode[]` must be Array-substitutable (LSP, fail-loud). |
| `resolveNodeRows` / `resolveStore(ctx)` | 🔵 RESHAPE | Widen to `resolveStore(ctx, node.storeKey)` and consume `node.storeKey` in `renderNode` so store scope cascades `[#15, #23]` — Critical silent bug (Principle 6). |
| `EngineRow`/`RawRow`/`DataRow` `as unknown as` casts | 🔴 REMOVE | Gone once the row types unify `[#11]`. |
| `SiteRenderer` inline var-eval loop | 🔴 REMOVE | Duplicates `evalVarMap.ts`; call the shared function `[#26]` (Principle 5/DRY). |
| `evalVarMap` / `defineShell` / `resolveChrome` / `ChromeRegion` / `NodeErrorBoundary` / `navUtils` / `wrapStyleContext` | ⚪ KEEP | Each a single-responsibility seam; correct. |
| `RenderContext` mixes data + functions | 🔵 RESHAPE | Document/type-split the runtime-services subset (`set`/`renderNode`/`resolveLinks`) from the serializable subset `[#19]` — keep the ctx/config boundary unambiguous (Principle 3). |
| `types.ts` (`NodeBase`, `NodeTypeMap`, `RenderContext`, slice META) | ⚪ KEEP | Open module-augmentation type system — correct OCP. |

### 3.3 Contexts & hooks (control plane)

| Element | Op | Reason |
|---|---|---|
| `FilterContext` (React owns state, URL write-only sync) | ⚪ KEEP | The documented anti-ghost-render design is correct and subtle — do not revert to URL-as-source. |
| `FiltersContext` + `useFilterState` | 🔵 RESHAPE | Consolidate the schema→bars bridge so there is one filter-model seam, not three loosely-related pieces `[N7]` (Principle 5). Behavior preserved. |
| `FilterControlSlice.codec.toUrl: () => string` returning `null as unknown as string` | 🔵 RESHAPE | Contract becomes `() => string \| null`; delete the casts across all controls `[#30]` (honesty/Principle 6). |
| `SiteContext` (resource injection + i18n hooks) | ⚪ KEEP | AppSmith/Retool injection pattern; clean. |
| `ModeContext` / `PageStoreContext` / `GlobalState` / `FrameContext` / Chrome contexts / `SectionNavContext` | ⚪ KEEP | Each a focused plane; correct. |
| `EventBus<TMap = Record<string, any>>` | 🔵 RESHAPE | Require the generic (default to a typed map) — no `any` default `[#13]`. |

### 3.4 Theme defaults + styles

| Element | Op | Reason |
|---|---|---|
| `theme/defaults/*` no-op shells | ⚪ KEEP | Null-Object pattern; lets the platform render before any plugin registers. |
| `@geostat/styles` (tokens + resolvers + view-state) | ⚪ KEEP | Token-driven, brand-free — exactly the agnostic-styling target (Principle 4). |

---

## Layer 4 — Plugins (Geostat shells)

| Element | Op | Reason |
|---|---|---|
| Registry-dispatched shells (chrome / controls / nodes / pages / panels) | ⚪ KEEP | OCP: one `registerSlice` per shell, zero `packages/` change — the target extension model. |
| `SectionShell` (152 lines, inline SVG, hardcoded Georgian aria) | 🔵 RESHAPE | Split view-toggle + collapse header into co-located subcomponents; move SVGs to the shared icon module; aria via `useT` `[#31]` (Principle 4/Readable). |
| `panels/chart` render boundary (some types via `toApexOptions`, some bespoke `DonutChart`/`HBarDivergingChart`/`TreemapChart`) | 🔵 RESHAPE | Unify **all** chart types through `ChartRendererRegistry` so the render library is a single swappable seam `[N3]` — Strategy at the render layer mirroring the interpreter Strategy at the engine layer (Principle 5). Adding/replacing a render lib = one registry, not a fork in the shell. |
| `toApexOptions.ts` (910 L) / `DataTable.tsx` (408 L) | 🔵 RESHAPE | Decompose by concern (axis/series/per-type builders; footer/pivot/bar-gauge) `[#31]` (size budget / Readable). |
| Control codecs `null as unknown as string` | 🔵 RESHAPE | Follow the honest codec contract from Layer 3.3 `[#30]`. |
| `georgraph` (Leaflet) / `repeat` / layout primitives | ⚪ KEEP | Generic, token-styled; correct. |
| Any hardcoded locale string in a shell's UI text | 🔵 RESHAPE | Route through `useT` so a shell is multi-site (Principle 4). |

---

## Layer 5 — App, Bootstrap & Data Sources (`src/`)

| Element | Op | Reason |
|---|---|---|
| `site-manifest.ts` `bootstrapSite()` (THE SEAM) | ⚪ KEEP | The single Phase-1/2 switch — load-bearing, exactly right. |
| `SiteManifest` (no `datasources` field; stores built imperatively in `fetchApi`/`fetchStatic`) | 🟢 ADD | Add `datasources: DatasourceInstanceConfig[]` (JSON); derive `stores` via `buildStoreManifest(datasources)` using the Layer-2 `datasourceRegistry` `[#18, N9]` (Root B / Principle 3). The manifest becomes pure JSON, Constructor-authorable. |
| `store-manifest.ts` (imperative `storeKey → store`) | 🔵 RESHAPE | Replaced by `buildStoreManifest` output; the static map becomes derived, not hand-maintained. |
| Adapters (`fromGDPFacts`/`fromSDMX`) using `as unknown as Observation[]` / `as Record<string,any>` | 🔵 RESHAPE | Align `ExternalStoreOptions.classifiers` to the real classifier type; remove the casts + eslint-disables `[#10]` (Principle 1). `fromSDMX` stays the one true SDMX boundary. |
| `App.tsx` renders `null` during bootstrap | 🔵 RESHAPE | Render `<AppSkeleton/>` `[#32]` (ONS/Eurostat loading standard, top-level). |
| `setupRegistrations` (registers all slices + modes + dev middleware) | ⚪ KEEP | Correct single registration point; gains the `ResolveObserver` + locale validator messages it now owns (Principles 6/4). |
| `LocaleGuard` / `PageLoader` / `nav.config` / `chrome-config` / `site-config` | ⚪ KEEP | Clean app-layer wiring. |

---

## Layer 6 — Track A Page Configs (authored JSON)

| Element | Op | Reason |
|---|---|---|
| `pages/*.{config,filters,kpis,sections}.ts` as pure `NodeDef` trees | ⚪ KEEP | The Constructor's eventual output shape; JSON-serializable by contract. |
| `codesOf(CLASSIFIERS.time)` at module-load for `FIRST`/`LAST` | 🔵 RESHAPE | Resolve year range at render from the datasource (`years: { $cl: 'time' }` already supported; badges via template) `[#5]` — survives API-sourced classifiers (Root B). |
| Plain-string labels that should be bilingual | 🔵 RESHAPE | Widen to `LocaleString` `[#7]` (Principle 4); resolved via `useResolveLocale`. |
| Inline-array `FilterDerive.source` | 🔵 RESHAPE | Prefer `{ $cl }` / `{ $d }` refs; warn on inline arrays `[#25]` (Constructor-readiness). |

---

## Layer 7 — Rendered UI

| Element | Op | Reason |
|---|---|---|
| ONS/Eurostat page (chrome · sticky filter bar · KPI · sections [chart↔table] · map · footer), ka/en, URL-permalinked | ⚪ KEEP | The correct output target; raised only by the layers beneath it. No structural change — quality flows up from the fixed layers. |

---

## Revised Full Pipeline — the target

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 0 — Build & Workspace                                                    │
│   Vite · tsc strict · packages/{expr, engine(core), charts, react, styles,     │
│                                  constructor(NEW)}                              │
│   main.tsx (i18next → setupRegistrations → mount)        MSW (mock /api)        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 1 — Primitives & Contracts                                               │
│   @geostat/expr (ExprVal · evalExpr · registerExprOp · ops · template)         │
│   engine-core: SectionContext{timeMode,dims} · SDMX Observation · Classifier   │
│     · LocaleString · ModeDef(label:LocaleString) · Unit=string                 │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 2 — Engine Data Core (@geostat/engine, data-only)  — agnostic, fail-loud │
│                                                                                │
│   datasourceRegistry ──► DatasourcePlugin.create(config) ──► DataStore         │
│        DataStore (port): Static · External · Api · Cached(default wrap)         │
│        AsyncDataStore capability ─► Suspense boundary (promise-cache port)      │
│        runBatch / prefetch = default read path                                  │
│            │                                                                    │
│            ▼                                                                    │
│   interpretSpec(spec, ctx, store) ─► EngineRegistry.spec(type)  [SSOT]         │
│            │   (unknown type → typed diagnostic, never silent [])              │
│            ▼                                                                    │
│   applyPipeline(TransformStep[]) ─► canonical RawRow[]  (one row type)         │
│            ▼                                                                    │
│   applyEncoding(EncodingSpec) ─► DataRow[]                                      │
│            │                                                                    │
│            ├──────────────► (table path) DataRow[] ─────────────┐              │
│            │                                                    │              │
│   ┌────────▼─────────────────────────┐                         │              │
│   │ LAYER 2b — @geostat/charts (NEW) │                         │              │
│   │  chartRegistry [SSOT for types]  │                         │              │
│   │  interpretChart ─► ChartOutput   │                         │              │
│   │  (unknown type → diagnostic)     │                         │              │
│   └────────┬─────────────────────────┘                         │              │
│            │ ChartOutput                                        │ DataRow[]    │
│   observability: ResolveObserver (injected; engine has no console)             │
│   validation: validatePageTree(page) ─► ValidationResult (live NodeDef tree)   │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 3 — React Rendering Platform (@geostat/react)  — adapter, no brand        │
│   registries: Node · chrome · filterControl · skeleton · ChartRenderer ·        │
│               middleware(frozen, priority)        ▲ registerSlice               │
│                                                                                │
│   renderNode(node, ctx) ── 12 steps, zero type-switch ──────────────────────  │
│     migrate→visibleWhen→validate→mw.before→resolveNodeRows→node-vars→          │
│     view/fieldConfig→registry.get→lazy children proxy (FULL Array)→            │
│     ErrorBoundary→Suspense(async data)→mw.after                                │
│         └ resolveNodeRows → resolveStore(ctx, node.storeKey)  [cascade fixed]  │
│   SiteRenderer → RenderContext (evalVarMap shared; no inline dup)              │
│   control plane: URL ◄─► FilterContext → useFilterState → SectionContext       │
│                  (one filter-model seam; honest codec string|null)            │
│   @geostat/styles tokens · theme/defaults (Null Object)                        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │ registry.get(type) → shell
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 4 — Plugins (Geostat shells)  — OCP, token-styled, i18n via useT          │
│   chrome · controls · nodes(section split, no inline SVG) ·                     │
│   pages · panels:                                                              │
│     chart ─► ChartRendererRegistry [ONE render seam]                           │
│              ├ ApexRenderer (bar/line/area/combo/contribution/waterfall)       │
│              ├ DonutChart · HBarDivergingChart · TreemapChart                  │
│              └ (swap/add render lib = one registry)                            │
│     table ─► DataTable(decomposed)     kpi-strip ─► KpiCard                     │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │ registerSlice(...) at startup
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 5 — App / Bootstrap & Data (src/)                                         │
│   setupRegistrations(+ResolveObserver,+locale msgs) → App(AppSkeleton) →        │
│   SiteProvider → routes → LocaleGuard → PageLoader                              │
│   site-manifest.ts (SEAM): bootstrapSite → { manifest(+datasources JSON),       │
│                                              stores = buildStoreManifest() }    │
│   datasets: raw → adapter(fromSDMX, typed) → DatasourcePlugin → DataStore        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │ pages: Record<id, NodePageConfig>
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 6 — Track A Page Configs (pure JSON NodeDef; years resolved at render)   │
│   gdp · accounts · regional · landing   (Phase 2: Constructor → DB → API)      │
│        ▲ @geostat/constructor: describeRegistry() → palette + schemas + catalog │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │ renderNode(page, ctx)
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 7 — Rendered UI                                                          │
│   Chrome · sticky FilterBar · KPI strip · Sections [chart↔table] · GeoMap ·     │
│   Methodology footer   →   ONS/Eurostat-grade page, ka/en, permalinked          │
└──────────────────────────────────────────────────────────────────────────────┘

Cross-cutting (every layer):
   i18n: LocaleString (engine) · useResolveLocale/useT/useFmt (react) ·
         slice i18n resources (plugins) · /:locale/* routing (app)
   extension: open registries + NodeTypeMap augmentation — new type = 1 register call
   observability: ResolveObserver + render-trace middleware (no console in core)
   Phase-1/2 seam: bootstrapSite() one-line switch (static JSON → fetch /api/site)
```

---

## Tier 1 — Structural moves beyond the 34 gaps (best-in-class engineering)

These are not in the gap list — they are the moves that take the platform from "all gaps closed" to "best-in-class engineering."

| ID | Move | Op | Principle / precedent |
|----|------|----|----|
| **N1** | Split `@geostat/charts` out of `@geostat/engine` | 🔵 RESHAPE | ISP at package level; axis-of-change separation. `@grafana/data` vs panels; `vega` vs `vega-lite`. |
| **N2** | `@geostat/constructor` — one `describeRegistry()` schema-export | 🟢 ADD | Principle 3. The Phase-2 builder's single typed entry point. Builder.io/Retool component manifest. |
| **N3** | Unify all chart types through `ChartRendererRegistry` | 🔵 RESHAPE | Principle 5. Strategy at the render layer; one swappable render-lib seam. |
| **N4** | `AsyncDataStore` + Suspense data-resolution boundary | 🟢 ADD | Principle 7 + Phase-2 readiness. React `use()` + Suspense; engine stays framework-free via a promise-cache port. |
| **N5** | Wire `CachedStore` + `runBatch`/`prefetch` as the default read path | 🔵 RESHAPE | Principle 7. Performance the platform already built but never turned on (`gaps.md` #8). |
| **N6** | `ResolveObserver` observability seam (replaces embedded DEV console) | 🟢 ADD | Principle 6. Decouples diagnostics from the core; enables real render tracing. |
| **N7** | Consolidate the filter-model seam (Filter/Filters/useFilterState) | 🔵 RESHAPE | Principle 5. One control-plane home; behavior preserved. |
| **N9** | `DatasourcePlugin` API + `SiteManifest.datasources` JSON | 🟢 ADD | Root B + Principle 3. Grafana datasource provisioning; new agency = one register call. |

---

## What is deliberately KEPT (do not "improve")

A Senior names what not to touch as carefully as what to change. These already meet the bar; changing them would regress:

- The **`renderNode` 12-step composite** (zero type-switch, lazy children, per-node error isolation).
- The **registry + Strategy** backbone (`EngineRegistry`, `NodeRegistry`, `filterControlRegistry`, `modeRegistry`, expr ops).
- The **transform pipeline** (`TransformStep` + `applyPipeline`) and the **encoding seam** (`applyEncoding` / `DataRow`).
- The **`SectionContext` generic dimension map** (no privileged dim — Non-Negotiable).
- The **`FilterContext` React-owns-state + URL-write-only-sync** design (anti-ghost-render; subtle and correct).
- The **Phase-1/2 seam** (`bootstrapSite` one-line switch).
- The **single `fromSDMX` boundary** and the **`@geostat/styles` token system**.
- **`SiteProvider` resource injection** and the **Null-Object theme defaults**.

---

## Change Summary Table

| Layer | Change | Op | Reason (principle / gap) | Impact |
|---|---|---|---|---|
| 0 | Split `@geostat/charts` from engine | 🔵 RESHAPE | ISP / axis-of-change [N1] | Headless/table deploy drops chart code |
| 0 | New `@geostat/constructor` package | 🟢 ADD | JSON-first [N2] | One typed entry point for Phase-2 builder |
| 0 | `import.meta` out of engine | 🔴 REMOVE | Purity [#1,#34] | Engine runs in any (non-Vite) env |
| 1 | `Unit = string`, `ChartType` from registry, `ModeDef.label: LocaleString` | 🔵 RESHAPE | Open/agnostic [#6,#2,#9] | New unit/chart/mode = zero engine edit |
| 2 | `CachedStore`/`runBatch`/`prefetch` as default read path | 🔵 RESHAPE | Perf [N5, gaps#8] | Batch + cache on by default |
| 2 | `DatasourcePlugin` API + registry | 🟢 ADD | Growth [N9,#18] | New agency store = one register call |
| 2 | `AsyncDataStore` + Suspense boundary | 🟢 ADD | Phase-2 async [N4] | Real API suspends, never blank-[] |
| 2 | `ResolveObserver` seam (replaces console) | 🟢 ADD | Observability [#1,#34] | Render tracing without core coupling |
| 2 | Registry-driven validation (drop `KNOWN_*` Sets) | 🔴 REMOVE | SSOT [#16,#33] | Validator can't drift from registry |
| 2 | Remove `CustomResolver` fn-in-config | 🔴 REMOVE | JSON-first [#3] | All specs Constructor-authorable |
| 2 | Unify `RawRow`/`EngineRow` | 🔵 RESHAPE | DRY [#11,#28] | No `as unknown as` row bridges |
| 2 | `validatePageTree` on live NodeDef tree | 🔵 RESHAPE | Fail-loud [#27] | Validation matches what renders |
| 2 | Locale-agnostic validators/currency | 🔵 RESHAPE | Agnostic [#8,#24] | Multi-site clean |
| 2 | Delete dead Track-B types | 🔴 REMOVE | Dead code [#12] | Smaller, honest public API |
| 2b | Move chart interpreters to `@geostat/charts`; drop `KNOWN_CHART_TYPES`; fail-loud | 🟡 MOVE + 🔴 + 🔵 | SSOT/ISP [N1,#16,#29] | One chart-type authority |
| 3 | `storeKey` cascade + `resolveStore(ctx, key)` | 🔵 RESHAPE | Fail-loud [#15,#23] | Section store override actually works |
| 3 | Complete lazy children Proxy | 🔵 RESHAPE | LSP [#20] | No silent `undefined` on array methods |
| 3 | `SiteRenderer` uses `evalVarMap` | 🔴 REMOVE dup | DRY [#26] | Page/node var-eval can't drift |
| 3 | Honest codec `string\|null`; typed EventBus/NodeRegistry | 🔵 RESHAPE | Type safety [#30,#13,#14] | No `any`/lying casts |
| 3 | Frozen middleware snapshot + priority | 🔵 RESHAPE | Encapsulation [#21] | Deterministic, immutable order |
| 3 | Consolidate filter-model seam | 🔵 RESHAPE | DRY [N7] | One control-plane home |
| 4 | Unify chart render via `ChartRendererRegistry` | 🔵 RESHAPE | Strategy [N3] | Swap render lib = one registry |
| 4 | Split `SectionShell`/`toApexOptions`/`DataTable`; icons + aria via useT | 🔵 RESHAPE | Readable/agnostic [#31] | Within size budget, multi-site |
| 5 | `SiteManifest.datasources` JSON + `buildStoreManifest` | 🟢 ADD | JSON-first [N9,#18] | Manifest fully Constructor-authorable |
| 5 | Typed adapter boundary (drop `as any`); `AppSkeleton` | 🔵 RESHAPE | Type safety/UX [#10,#32] | No casts; no blank-screen flash |
| 6 | Years resolved at render; `LocaleString` labels; ref-only derive source | 🔵 RESHAPE | Phase-2/agnostic [#5,#7,#25] | Configs survive API-sourced data |

---

## What this unlocks

Capabilities that **do not exist today** and become available once the target lands — each tied to a specific move:

1. **New agency in zero core changes.** A `DatasourceInstanceConfig` (JSON) + a registered `DatasourcePlugin` is sufficient — no imperative store wiring, no `site-manifest` edit. (Driven by: N9, #18.)

2. **Headless / table-only deployment.** With `@geostat/charts` split out, a consumer that only renders tables or runs the engine server-side never bundles chart code. (Driven by: N1.)

3. **The Constructor has one typed contract.** `describeRegistry()` emits palette + property schemas + datasource catalog + chart/spec types as JSON — the visual builder reads one source, not scattered `META`. (Driven by: N2, registry-as-SSOT.)

4. **A new chart type is one interpreter + one renderer, validated automatically.** Register the interpreter (`@geostat/charts`) + the React renderer (`ChartRendererRegistry`); validation and the Constructor palette pick it up with zero edits elsewhere. No `KNOWN_*` Set to update, no union to widen. (Driven by: N3, #2, #16.)

5. **A real API backend drops in behind Suspense.** `AsyncDataStore` + the `use()` boundary means switching `bootstrapSite` to `fetch('/api/site')` makes pages *suspend* with skeletons instead of flashing empty — the Phase-1/2 seam finally has an async story. (Driven by: N4, #18, #32.)

6. **A misconfiguration is loud, not blank.** Unknown spec/chart type, missing store, absent mode branch, invalid node — each surfaces a typed `ValidationError` the Constructor shows inline, instead of a silent `[]`/placeholder. (Driven by: #27, #29, #33, #22, N6.)

7. **One trace per render.** The `ResolveObserver` seam carries every `interpretSpec` resolution; a render-trace middleware can render the full node→data waterfall in dev — debugging a wrong number is one trace, not a console hunt. (Driven by: N6, #1.)

8. **Multi-site with zero code fork.** Agnostic engine + `LocaleString` everywhere + token-only brand + datasource-by-config means ENstat/ArmStat is a new manifest + tokens + datasources, not a new build. (Driven by: #6, #7, #8, #9, N9.)

9. **Performance the platform already paid for, switched on.** `CachedStore` + batched `prefetch` become the default read path; the lazy children proxy is complete. (Driven by: N5, #20.)

---

## Tier 2 — Standard-Setting Moves

Tier 1 makes the platform excellent *engineering*. Tier 2 makes it **standard-setting** — the level of Grafana, Builder.io, and Form.io as platforms, and of ONS / Eurostat / IMF as statistics publishers. Each move is attributed to the platform that proved it. They are grouped by the capability they unlock, weighted (S/M/L effort · 🟩 foundational / 🟨 high-value / ⬜ polish), and ordered within each group by dependency.

### A. The self-describing component model — *the single highest-leverage move*

> **Builder.io `registerComponent({ inputs })` · Form.io component `editForm` schema.** A visual builder lives or dies on this: every component **carries its own typed editor contract** — which props exist, their types, validation, defaults, conditional visibility, and the slots it accepts. Today `NodeSliceMeta.schema` is `schema?: object` — an untyped placeholder. This is the gap between "we have a registry" and "we have a platform a non-coder can build on."

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N10** | **Typed `PropSchema` per slice.** Every node/panel/control/chrome slice declares a typed input schema: field name · type (`string`/`number`/`enum`/`color`/`localeString`/`dataSpec`/`nodeRef`/`expr`) · label · default · validation · `showWhen` (conditional prop visibility) · group. `@geostat/constructor` (N2) composes these into the property panel; the same schema validates a stored config on load. | 🟢 RESHAPE · M · 🟩 | Form.io `editForm` + Builder.io `inputs`. This *is* the Constructor. Without it, Phase 2 is hand-built per type; with it, the builder is generated. |
| **N11** | **Self-registration manifest export.** `describeRegistry()` (N2) emits the full design-system manifest as JSON: every type's PropSchema, slot contract, category, icon, preview, defaults, version. One artifact the visual builder, the validator, and the docs all read. | 🟢 ADD · S · 🟩 | Grafana plugin.json + Builder.io content model. One source of truth for "what can be built." |

### B. Data-model maturity

> **Grafana `DataFrame` · Vega-Lite columnar data.** The most consequential data decision a rendering platform makes is the shape data travels in.

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N12** | **Transforms become a registry, not a `switch`.** `applyStep`'s 15-case switch becomes `transformRegistry.get(op)` — each transform a registered unit with its own PropSchema, so the Constructor can add/reorder transforms visually and new transforms register without touching the core (exactly as spec resolvers and chart interpreters already do). | 🔵 RESHAPE · M · 🟨 | Grafana transformations registry. Consistency with the platform's own pattern — today transforms are the *one* pipeline that is a closed switch. |
| **N13** | **Consider a columnar `DataFrame` as the canonical engine shape (big bet — evaluate, don't rush).** Row-records (`DataRow[]`) are simple but carry per-row overhead and no field-level metadata. A columnar `{ fields: { name, type, config, values[] }[] }` shape gives field-level config, far better performance on large statistical tables, and a natural SDMX/Arrow mapping. **Flagged as a deliberate decision, not a default action:** it touches every resolver and renderer. Recommendation: prototype behind the existing `DataRow` boundary; adopt only if large-table perf or field-metadata needs prove it. | 🔵 RESHAPE · L · ⬜ (decision) | Grafana `DataFrame`, Apache Arrow, Vega columnar. The honest senior call: name the better long-term shape, gate it on evidence, don't force it. |

### C. Official-statistics obligations (Principle 8)

> **ONS · Eurostat · IMF · SDMX.** For a national statistics office these are not features — they are publishing obligations.

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N14** | **Provenance plane.** A `MetadataPort` so every figure resolves its source · vintage (reference + release date) · methodology link · `OBS_STATUS` · confidence. Surfaced uniformly (a chart/table/KPI info affordance), not per-shell ad hoc. `DataRow.status` already carries OBS_STATUS — generalize it to full provenance. | 🟢 ADD · M · 🟩 | SDMX DSD annotations · Eurostat metadata · IMF SDDS. A government figure with no traceable source is not publishable. |
| **N15** | **Accessibility as a tested contract + chart→table fallback.** Every chart ships an equivalent accessible data table (ONS publishes both for *every* chart). WCAG 2.1 AA enforced in CI via `axe-core`; every shell declares its a11y contract (roles, labels, keyboard path). | 🔵 RESHAPE · M · 🟩 | ONS chart accessibility standard · WCAG 2.1 AA (legal obligation for gov). `gaps.md` marks a11y "done" — elevate from done-once to enforced-always. |
| **N16** | **Export registry.** `exporterRegistry` (csv · xlsx · sdmx-json · png · svg) dispatched generically; every panel exportable from one affordance. Today export is a stub (`engine/plugins/CLAUDE.md`). | 🔵 RESHAPE · M · 🟨 | Eurostat / World Bank "download this data" standard. Open formats, including the statistical-native SDMX-JSON. |

### D. Correctness & reliability

> **Rust `Result` · Grafana dashboard `schemaVersion` migrations.** Correctness is the whole job for a statistics office.

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N17** | **One error contract: `Result<T, Diagnostic>`.** Resolvers, validators, and stores speak one diagnostic language instead of the current mix of `[]` + `console.warn` + `throw`. The disciplined form of Principle 6 (fail-loud): a misconfiguration is a typed value that flows to the Constructor, never a silent empty. | 🟢 ADD · M · 🟩 | Rust `Result` · fp-ts `Either` · Grafana `FieldErrors`. Makes "no silent failure" a type, not a convention. |
| **N18** | **Registry contract-test harness.** One generic fixture proves every `SpecResolver` / `ChartInterpreter` / `FilterControlSlice` / `DatasourcePlugin` honors its contract — run in CI, so adding a method to a port and forgetting an implementation fails the build (LSP enforcement). Plus golden-file tests pinning `interpretSpec → DataRow[]`. | 🟢 ADD · M · 🟨 | Grafana panel/datasource test suites · consumer-driven contracts. `gaps.md` #10: shells/pipeline under-tested. |
| **N19** | **Page-level schema versioning + migration chain.** Elevate per-slice `migrate`/`_version` into a page-level `schemaVersion` with an ordered migration chain and forward/back-compat tests — so configs authored in the Constructor survive every platform release. | 🔵 RESHAPE · M · 🟨 | Grafana dashboard `schemaVersion` + migration chain. Durability of stored JSON is a Phase-2 must. |

### E. Design system & experience

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N20** | **Themeable design system + WCAG contrast validation + light/dark/high-contrast.** `@geostat/styles` gains a typed `Theme` contract; tokens validated for WCAG contrast at build; high-contrast and dark themes ship (high-contrast is a gov a11y requirement). Theme is a manifest field — multi-site rebrands by config. | 🔵 RESHAPE · M · 🟨 | Grafana theming · Material/Carbon design systems · Eurostat/ONS visual identity. |
| **N21** | **Component catalog (Storybook).** Every shell rendered in isolation with its prop matrix — the living documentation every standard-setting design system ships, and the surface a11y/visual-regression tests run against. | 🟢 ADD · M · ⬜ | Builder.io/Grafana component galleries · Storybook as the industry default. |
| **N22** | **ICU message format + locale-aware collation.** `LocaleString` resolution gains ICU (plural/select/number/date) and locale-aware sorting (ka vs en collation differ). Open locale map already supports +et/hy/az. | 🔵 RESHAPE · S · ⬜ | ICU / FormatJS · CLDR collation. Correct multilingual statistics, not string concatenation. |

### F. Cross-cutting platform

| ID | Move | Op | Reason / precedent |
|----|------|----|----|
| **N23** | **Telemetry plane.** Extend the `ResolveObserver` (N6) into a `TelemetryPort`: render timings, data-fetch timings, error rates, behind one port the office wires to its own backend — plus a dev inspector overlay (click a node → see its spec, rows, timing). | 🟢 ADD · M · ⬜ | Grafana's own instrumentation · Builder.io visual inspector · OpenTelemetry-shaped port. |
| **N24** | **Security contract.** XSS-safe template rendering (no `dangerouslySetInnerHTML`; `{dim}` interpolation escapes), URL/param sanitization at the filter boundary, CSP headers, safe external-link policy (already `noopener`). A government surface is a target. | 🟢 ADD · S · 🟩 | OWASP · gov security baselines. Template + dataLink + URL-param are the three injection surfaces. |
| **N25** | **Large-data virtualization (conditional).** Row/column virtualization for big statistical tables (all years × regions × sectors) + memoized selectors. Conditional: adopt when a table's cell count crosses a budget — not premature. | 🟢 ADD · M · ⬜ | TanStack Virtual · Grafana table panel. Honest perf — measured, not assumed. |

### Tier-2 priority lens

If only the 🟩 foundational moves are taken, the platform is already standard-setting:
**N10 (self-describing components)** + **N11 (manifest export)** + **N14 (provenance)** + **N15 (accessibility)** + **N17 (Result contract)** + **N24 (security)**. These six are the spine. N10/N11 make the Constructor real; N14/N15 make it publishable by a statistics office; N17/N24 make it trustworthy. Everything else (🟨 high-value, ⬜ polish) compounds on that spine.

The one **big bet** (N13, columnar DataFrame) is deliberately the lowest-priority structural item: named because a senior should name it, gated on evidence because forcing it without proof would violate "don't worsen / don't invent" — the existing `DataRow` boundary is the correct place to prototype it behind.

---

## Harvested from refactor-plane (provenance + improvements folded in)

> During the 2026-06-02 doc consolidation, the former `refactor-plane/` corpus was read file-by-file. Ideas worth keeping — patterns the old design got *right* that the current plan under-specified, or refinements to a Tier move — are folded into this document and logged here so nothing is lost. `(none yet — populated during Stage 2 of the consolidation.)`

| From (refactor-plane) | Idea harvested | Folded into |
|---|---|---|
| `architecture/23-defaults-system` + `examples/defaults.md` | **`DefaultSpec` three-tier** (literal · ExprVal · `{from:'options',pick}`) + two-pass resolution + topo-sort + structural cascade invalidation. Fully designed, never implemented (current = flat `default: string`). | ROADMAP **Layer 3.2** (replaces the vague "pick last" note; closes cascade-reset + computed-default cases too) |
| `architecture/25-datasource-system` | _pending read — DatasourcePlugin envelope + classifier/display resolution priority → Layer 3.1 / 7.1 / N9_ | _to fold_ |
| `architecture/15-constructor` | _pending — node/transform registry introspection · JSON-schema forms · data-catalog API · save-validation contract · iframe canvas → N2 / N10 / N12 / Phase-2_ | _to fold_ |
| `architecture/17-data-cube` | _pending — CubeQuery N-D model → N30 (pushdown) / N26 (semantic)_ | _to fold_ |
| `architecture/22-derive-effects` | _pending — topo-sort shared by computed+derive · namespace-separation invariant → var/derive seam (gap #26)_ | _to fold_ |
| `architecture/04-render-pipeline` (archived) | _pending — "pure-sync + Suspense" conceptual model (I-2) → N4 (async data)_ | _to fold_ |

---

## Tier 3 — The North Star

Tier 1 closes the gaps (best-in-class **engineering**). Tier 2 meets the **official-statistics** bar. Tier 3 is what the architecture *wants to become* — the synthesis that **no single reference platform achieves alone**: Grafana's pushdown + Looker's semantics + Gutenberg's unification + Vega's multi-target + Contentful's governance, fitted to a national statistics office.

### The observation everything rests on

The platform's latent power is not that it renders JSON — it is that **every seam is already neutral**: `NodeDef` (knows no React), `ChartOutput` (knows no ApexCharts), `DataStore` (knows no transport), `DataRow` (knows no view). Tier 1/2 close holes. **Tier 3 exploits that neutrality** in directions a single platform never combines. Each move below names the *existing seam in our code* it builds on — none is greenfield.

### The synthesis — best of each, then better on top

| Platform | The idea we take | Tier-3 move |
|---|---|---|
| Looker · Cube · dbt | Semantic layer — metrics defined once | N26 |
| Vega-Lite · Grafana image renderer · React multi-target | Neutral tree → many render targets | N27 |
| Observable · Grafana Scenes · SolidJS signals | Reactive dataflow graph | N28 |
| WordPress Gutenberg · Notion | Everything is a node — one model | N29 |
| Grafana datasource query · Cube pre-aggregations | Compute pushdown + capability planner | N30 |
| Sanity · Contentful · Builder.io | Config as governed, versioned content | N31 |

### N26 — Semantic Layer *(the highest architectural elevation for a statistics office)*

| Facet | Detail |
|---|---|
| **Insight** | Configs today carry raw measure codes — `query: { measure: ['GDP_SVC','GDP_NET_TAX','GDP_IND','GDP_CON','GDP','...'] }` (`gdp.sections.ts`). That is **SQL in every panel**. What "GDP" *is* — its unit, aggregation, ISIC parent, methodology — is scattered across configs and adapters. |
| **Move** | A thin **metric registry**: every metric defined once over the SDMX DSD — `GDP: { code:'B1GQ', unit:'MLN_GEL', agg:'sum', parent, methodology, label:{ka,en} }`. Configs become `{ metric:'GDP', by:'sector' }`, not raw codes. |
| **Precedent** | Looker LookML · Cube semantic layer · dbt metrics. |
| **Exploits in our code** | The SDMX **DSD is already a semantic model** — you own it in `classifiers`/`DisplayMap`. This move makes it first-class instead of latent. `interpretSpec` gains a resolve step: metric → measure code(s). |
| **Payoff** | Change a metric once → every page consistent. Constructor offers *metrics*, not codes (a statistician picks "GDP", not "B1GQ"). Provenance (N14) attaches to the metric naturally. |
| **Migration** | Additive: a `MetricRegistry` + a `metric` spec resolver. Existing code-based specs keep working; migrate page-by-page. |
| **Weight** | M · 🟩 (game-changer) |

### N27 — Multi-Target Rendering *(headless engine → dashboard · PDF bulletin · API)*

| Facet | Detail |
|---|---|
| **Insight** | `ChartOutput` and `NodeDef` are already neutral — so the *same config* can render to more than the DOM. |
| **Move** | A `RenderTarget` abstraction: one config → `React DOM` (interactive) · `SSR/HTML` (static export) · **`PDF`** (official statistical bulletin) · `PNG/SVG` (embed) · `REST/JSON` (headless data). |
| **Precedent** | Vega multi-renderer (canvas/svg) · Grafana image renderer · React multi-target (DOM/RN). |
| **Exploits in our code** | The renderer-agnostic boundary already exists (`interpretChart → ChartOutput`, `NodeDef → renderNode`). A target is a new consumer of the *same* neutral tree, not a fork. |
| **Payoff** | **A statistics office publishes PDF bulletins.** The same config that drives the dashboard generates the official bulletin — zero duplicate authoring. Static export for archival; data API for re-users. |
| **Migration** | The DOM target is what exists. Add SSR/PDF targets as separate consumers of `renderNode`'s output; no engine change. |
| **Weight** | L · 🟨 (domain-defining) |

### N28 — Reactive Dataflow Graph

| Facet | Detail |
|---|---|
| **Insight** | A filter change today triggers a broad re-render; every `interpretSpec` re-runs. |
| **Move** | Model datasources, transforms, and views as nodes in an explicit reactive DAG; a change propagates only to **affected** nodes (fine-grained, signal-based). |
| **Precedent** | Vega dataflow · Grafana Scenes reactive scene graph · SolidJS/Vue signals. |
| **Exploits in our code** | The `EventBus` (`GeostatEventMap`) already exists but is used for UI events, not data reactivity — this makes it the propagation substrate. The computed-ref pattern in `useFilterState` is the seed of fine-grained tracking. |
| **Payoff** | Incremental recompute (only the panel whose dim changed) · cross-panel linking (click a bar → highlight the map) · streaming-ready for live releases. |
| **Migration** | Surgical, not a rewrite — introduce signals at the `SectionContext → interpretSpec` edge first; broaden only where measured re-renders justify it. (Anti-rec: no blanket RxJS.) |
| **Weight** | L · ⬜ (optimization — evidence-gated) |

### N29 — Everything-is-a-Node *(registry unification)*

| Facet | Detail |
|---|---|
| **Insight** | Six registries (node · chrome · control · skeleton · chart-renderer · mode) + a `FilterSchema` that lives *beside* the NodeDef tree rather than *in* it. The Constructor must learn six mental models. |
| **Move** | Move toward **one node graph** where "chrome", "control", "filter" are node *roles* with capability tags — one tree, one serialization, one renderer. |
| **Precedent** | WordPress Gutenberg (everything is a block) · Notion (block model). |
| **Exploits in our code** | `registerSlice` already dispatches by `sliceType` — the seam to unify behind a capability-tagged registry abstraction is there. |
| **Payoff** | The Constructor has *one* model, not six. New surface types cost nothing structurally. Serialization is uniform. |
| **Migration** | **North star, never big-bang.** Introduce the capability-tagged registry abstraction first; consolidate the six incrementally behind it. The risk of forcing this at once is exactly the "don't worsen" trap. |
| **Weight** | L · ⬜ (north-star direction) |

### N30 — Query Pushdown + Capability Planner

| Facet | Detail |
|---|---|
| **Insight** | `interpretSpec` computes in the browser (sum/group/pivot). `DataStore.caps` already declares `batching`/`streaming` — but nothing *plans* against it. |
| **Move** | Treat the spec as *intent*; a query planner decides **where** each operation runs — push aggregation to the SDMX API / SQL when the store is capable, browser as fallback. |
| **Precedent** | Grafana datasource query model · Cube pre-aggregations · any cost-based planner. |
| **Exploits in our code** | `StoreCaps` + `extractRequirements` (static spec analysis already implemented for prefetch) are the planner's inputs — half the machinery exists. |
| **Payoff** | Large statistical cubes (years × regions × sectors) no longer fully materialize in the browser; the API does the heavy aggregation. |
| **Migration** | Additive: the planner sits between `interpretSpec` and the store; default path is unchanged for stores without pushdown caps. |
| **Weight** | M · 🟨 |

### N31 — Config as Governed Content *(government-grade)*

| Facet | Detail |
|---|---|
| **Insight** | Phase 2 stores config JSON in a DB. For a statistics office, "who changed this published figure's page" is a **governance obligation**, and "how was this number computed" is a **trust obligation**. |
| **Move** | Config becomes versioned, diffable, branchable content: draft → review → publish workflow · preview · rollback · audit trail · approval — plus **full lineage** (pixel → `DataRow` → transform step → store query → source observation). |
| **Precedent** | Sanity / Contentful content versioning · Builder.io draft/publish · dbt/Grafana provenance. |
| **Exploits in our code** | The Phase-1/2 seam (`bootstrapSite`) + the to-be-added `datasources`/metric/provenance planes (N9/N26/N14) are the lineage spine — lineage is provenance followed one hop further, to the *config* that produced the figure. |
| **Payoff** | An auditor can answer "who published this, when, from what source, computed how" in one trace. Rollback of a bad release is one click. |
| **Migration** | Belongs to Phase 2 (Constructor) — design the content store as versioned from day one rather than retrofitting. |
| **Weight** | M · 🟨 (Phase-2 native) |

### Tier-3 unifying flow

```
   statistician defines a METRIC once            (N26 semantic layer)
            ▼
   composes metrics as NODES in the Constructor  (N29 one node graph)
            ▼
   they recompute REACTIVELY, pushed down         (N28 dataflow + N30 planner)
            ▼
   render to dashboard · PDF bulletin · API       (N27 multi-target)
            ▼
   governed: draft→approve→publish→lineage         (N31 governed content)
```

This is the architecture no single reference platform delivers whole — assembled from each one's best, fitted to official statistics, and made coherent by the neutrality the platform already has.

### Tier-3 anti-recommendations *(senior judgment is also knowing what not to build)*

- **No micro-frontend / iframe plugin sandbox now** — premature for one team; a capability manifest first, isolation only when a real marketplace demands it.
- **No blanket reactive runtime (RxJS)** — signals are lighter; reactivity (N28) is surgical, never dogmatic.
- **No heavyweight modeling language for N26** — a 10-line metric registry, not LookML. The value is the metric *existing*, not its syntax.
- **No everything-is-a-node big-bang (N29)** — abstraction first, incremental migration; forcing it at once is the "don't worsen" trap.
- **No forced columnar `DataFrame` (Tier-2 N13)** — evidence-gated, prototyped behind the existing `DataRow` boundary.

---

## Conformance to the generic protocols (verified, not claimed)

Per directive, this target + `IMPLEMENTATION-ROADMAP.md` conform — identically and validly — to the two portable schemes in `.claude/generic/protocol/`. Divergences are not hand-waved; they are tracked as moves **N32–N33**.

### Structure → `generic/engineering/structure.md`

| Law / convention | Our application | Status |
|---|---|---|
| Dependency Rule + acyclic (§1.1, §3) | `src → plugins → @geostat/react → @geostat/charts → @geostat/engine → @geostat/expr` | ✓ declared (CLAUDE.md) · **✗ NOT enforced** → **N32** |
| Ports & Adapters (§1.2) | `DataStore` port + adapters; open registries as ports | ✓ |
| Package-by-Feature + Screaming (§1.3–1.4) | `plugins/` 5-tier by capability · `packages/` by capability · domain-named | ✓ |
| Co-location (§1.5) | shell + node + skeleton + css + test co-located per slice | ✓ |
| One public surface (§1.7) | `index.ts` barrel per package/slice; internals private | ✓ |
| File naming (§5–§6) | PascalCase components · role-suffix (`*Shell`/`*Node`/`*Skeleton` · `nav.config.ts`) · unique basenames (Vite trap avoided) · ubiquitous language | ✓ |
| Junk-drawer ban (§7) | scoped per-panel `utils/` only; `src/shared/` minimal | ✓ |

### Refactoring → `generic/engineering/refactoring.md`

| Law / method | Our application | Status |
|---|---|---|
| §1 laws — behavior-preserving · always-releasable · replace-before-remove | ROADMAP Operating Rules 1, 2, 9 | ✓ |
| Two Hats / Tidy First (§1.2, §1.6) | ROADMAP is "not feature work" — pure structural; structural commits kept separate | ✓ (Operating Rule 10) |
| Safety net / characterization (§4) | 29 engine tests; **shells + render pipeline under-tested** (no jsdom) → **N33** | **✗** → **N33** |
| ADR per decision (§1.8) | `individual/decisions/` cadence | ✓ |
| Method-by-scale (§2) | per-phase mapping ↓ | ✓ |

### Method-by-scale per phase (§2 selection)

| Phase | Established method applied |
|---|---|
| 0 Integrity | Fowler catalog **micro-refactorings** — small, green, revert-on-red |
| 1 Purity · 2 Coupling/DRY | **Preparatory refactoring** + **Parallel Change** (Result type, evalVarMap dedup, row-type unify) |
| 3 Phase-2 datasources | **Strangler Fig** + **Parallel Change** (Expand: add `datasources` → Migrate: pages by id → Contract: remove `codesOf`) |
| 8.1 `@geostat/charts` split · 8.2 render seam · 8.4 filter-model | **Branch by Abstraction** (build behind the boundary, switch, retire) |
| Large/tangled clusters (3.x · 9 · 10) | **The Mikado Method** — discover prerequisites, revert to green, build the graph, execute leaves-first |

### The two conformance moves

| ID | Move | Op · Weight | Restores |
|----|------|-------------|----------|
| **N32** | **Enforce the dependency contract as a build gate** — `eslint-plugin-boundaries` (or `dependency-cruiser`) encoding `src→plugins→react→charts→engine→expr` + acyclic check; a layer violation fails `lint`/CI, not review. | 🟢 ADD · S · 🟩 | structure.md §3 — "build error, not review comment." Today declared-only → decays. |
| **N33** | **React test infrastructure** — jsdom + Testing Library so shells + the render pipeline get **characterization tests** before behavior-preserving refactors (e.g. the 0.3 storeKey cascade regression; gaps #10). | 🟢 ADD · M · 🟩 | refactoring.md §4 — no safe refactor without a safety net. |

Both are **foundational (🟩)** and belong early (Phase 0/1) — they *guard every later refactor*. N32 makes the structure self-enforcing; N33 makes the refactoring safe.

---

## Sequencing — the full plan, front to back

One arc, three tiers, each gated on the one below. Nothing in a higher tier starts until its foundation is clean; every step keeps the app booting and `tsc --noEmit = 0`.

### Tier 1 — Foundation (the 34 gaps + N1–N9) → `IMPLEMENTATION-ROADMAP.md` Phases 0–7
- **Phase 0 — Integrity** — registry single-source-of-truth, `storeKey` cascade, live-tree validation, encoding fix. *(Critical/breaking first.)*
- **Phase 1 — Engine Purity** — no Vite/locale/app content in the core; **N6** observability seam replaces the embedded console.
- **Phase 2 — Loose Coupling & DRY** — one row type, shared `evalVarMap`, honest codec; **N5, N7**.
- **Phase 3 — Phase-2 Readiness** — datasources first-class JSON, no module-load coupling, no functions in config; **N9**.
- **Phase 4 — Type Tightening** · **Phase 5 — Pipeline Robustness** · **Phase 6 — Readability** (**N3** chart render-seam) · **Phase 7 — Platform Power** (**N1** package split first, then **N2, N4, N9**).

### Tier 2 — Standard-setting spine (after the foundation is clean)
The six 🟩 foundational moves, in dependency order:
1. **N10 + N11** — self-describing components + manifest export *(rides on N2's `@geostat/constructor`)* — makes the Constructor real.
2. **N14** — provenance plane *(rides on the datasource/metadata seam from Phase 3)*.
3. **N15** — accessibility as a tested contract + chart→table fallback.
4. **N17** — `Result<T, Diagnostic>` error contract.
5. **N24** — security contract.
Then the 🟨 high-value moves (N12, N16, N18, N19, N20, N30-adjacent) and ⬜ polish (N21, N22, N23, N25) as capacity allows. **N13 (DataFrame) stays evidence-gated.**

### Tier 3 — North Star (the synthesis, once the spine holds)
In value-first order:
1. **N26 — Semantic Layer.** The single highest elevation; half-present in SDMX classifiers already. Start here.
2. **N27 — Multi-Target Rendering.** The PDF-bulletin payoff; pure consumer of the neutral tree.
3. **N30 — Query Pushdown.** Reuses `StoreCaps` + `extractRequirements`.
4. **N31 — Governed Content.** Phase-2-native; design versioned from day one.
5. **N28 — Reactive Dataflow** and **N29 — Everything-is-a-Node** as evidence-gated north-star directions — abstraction first, incremental migration, never big-bang.

**Invariants across all three tiers:** every layer independently deployable · every dependency points inward (`src → plugins → react → charts → engine → expr`) · every config `JSON.parse(JSON.stringify(x)) === x` · no silent failure · `tsc --noEmit = 0`. The platform is best-in-class engineering at the end of Tier 1, standard-setting for official statistics at the end of Tier 2, and category-defining at the end of Tier 3.
