# System Pipeline Tree — Geostat National Accounts Dashboard

> Standard: **Senior Application, Architecture & Design Engineer** — Readable · Clear · Organized · Growth-oriented · SOLID · Patterns · Agnostic · DRY
>
> Scope: the **current state** — every element/service of the platform, bottom (data) to top (rendered pixels), with its role and key collaborators. This is the map the rewrite is split against.
>
> Companion documents:
> - `IMPLEMENTATION-ROADMAP.md` — the 34-gap, 27-layer execution playbook (what to change).
> - This file — what exists today and how it connects (what we are changing *from*).
> - Gap references `[#N]` link an element to its roadmap gap.

---

## How to read this tree

The platform is a **JSON-driven rendering pipeline**: authored JSON (`NodeDef` tree) + raw statistical facts flow upward through an agnostic engine, a React rendering platform, and Geostat plugin shells, to become a rendered page. Two planes run in parallel:

- **Data plane** (bottom → top): `raw facts → adapter → DataStore → interpretSpec → transform → encoding → DataRow[] → chart/table interpret → ChartOutput → shell → DOM`.
- **Control plane** (filters): `URL ↔ FilterContext → useFilterState → SectionContext`, which parameterizes every `interpretSpec` call.

Dependency direction is strictly **inward** (Clean Architecture): `src → plugins → @geostat/react → @geostat/engine → @geostat/expr`. No inner layer imports an outer one. The layers below are numbered in dependency order (0 = innermost foundation, 7 = outermost output).

The five reference platforms this architecture is measured against: **Grafana** (panel/datasource plugin registries), **Builder.io** (JSON block tree), **Retool** (component + resource registry), **Vega-Lite** (grammar of graphics encoding), **ONS/Eurostat** (statistical UX standard).

---

## Layer 0 — Build & Workspace Foundation

The rails. Nothing renders without these; they are not in the runtime data path.

| Element | Role |
|---|---|
| **Vite** | Dev server + bundler. `VITE_STORE_MODE` env switches static vs mock-API data sourcing. |
| **TypeScript (strict)** | `tsc --noEmit = 0 errors` is the standing invariant on every change. |
| **Monorepo packages** (`engine/expr`, `engine`, `react`, `styles`) | Four published-shape libs with a strict inward dependency order. Path aliases `@geostat/*` resolve to `packages/*`. |
| `src/main.tsx` | Process entry. Runs `i18next.init()` synchronously (so `addResources` exists before slice registration), calls `setupRegistrations()`, mounts `<App/>`, optionally starts MSW worker. |
| `src/vite-env.d.ts` | Ambient Vite types (`import.meta.env`). |
| `src/mocks/` (MSW: `browser.ts`, `handlers/*`) | Layer-2 mock HTTP server — intercepts `/api/datasets/*` to simulate the Phase-2 network boundary (latency, loading, errors). |

> **Rewrite note:** engine purity requires `import.meta` never reaches `engine/core` `[#1, #34]`; the env switch lives only at `src/`.

---

## Layer 1 — Primitives & Contracts

The shared vocabulary. Zero dependencies (expr) or engine-foundation only. Everything above speaks these types.

### 1.1 `@geostat/expr` — zero-dep expression evaluator

| Element | Role |
|---|---|
| `src/types.ts` | The scalar universe: `DimVal`, `ExprVal`, `ExprScope` (`dims` / `derived` / `ctx`). The lingua franca of all derived values. |
| `src/eval.ts` | `evalExpr(expr, scope)` — recursive evaluator + **open op plugin registry** (`registerExprOp`). Engine registers domain ops (find, breadcrumbs, join-labels…) into it without expr knowing them. |
| `src/ops/*` (`math`, `logic`, `comparison`, `string`, `collection`, `lookup`) | Built-in pure operator implementations. |
| `src/derive.ts` | `evalDerived` — ordered key→expr map evaluation (each entry can reference earlier ones). |
| `src/template.ts` | `{key}` placeholder resolution against scope. |
| `src/guards.ts`, `src/errors.ts` | Type guards (`isDimVal`, `isExpr`…) + `ExprEvalError`. |

### 1.2 `@geostat/engine` — foundation primitives

| Element | Role |
|---|---|
| `core/context.ts` | `SectionContext { timeMode, dims, locale? }` — the OLAP cube coordinate every resolver reads. `Unit`, `ChartType`, `Indicator`, `TimeMode`. **`dims` is a generic map — no privileged dimension** (`ctx.dims['time']`, never `ctx.year`). |
| `core/error.ts` | `EngineError` + codes. |
| `core/types.ts` | `DataLookupOp`, `DeriveEntry`, `NodeDeriveMap` — engine-level derive ops that extend ExprVal with data access. |
| `core/layout.ts` | `groupBySpan<T>` — generic 12-column packing algorithm; type-agnostic (boundary wrappers supply the span fn). |
| `core/evalNodeDerive.ts` | Evaluates `NodeDeriveMap` (ExprVal + DataLookupOp) against rows. |
| `sdmx.ts` | SDMX observation model (ISO 17369): `Observation`, `ObsQuery`, `DimVal`, `CtxRef`/`NeRef`, `Classifier`/`ClassifierEntry`, `DisplayMap`, `DimRef`, `DataBundle`. The wire/storage shape. |
| `i18n/types.ts` | `LocaleString = string \| Record<string,string>` + `resolveLocaleString`/`resolveLabel`. Inline bilingual content (Sanity pattern). |
| `mode/types.ts` | `ModeId` (open string), `ModeDef`, `ModeContext` — UI time-mode system, zero React/Geostat. |

> **Rewrite note:** `Unit` should be open `[#6]`; `ModeDef.label` should be `LocaleString` `[#9]`; `ChartType` union should derive from the registry `[#2]`.

---

## Layer 2 — Engine Data Core (`@geostat/engine`)

The agnostic compute core. Pure TypeScript, no React, no Geostat. Turns a `DataSpec` + `SectionContext` + `DataStore` into `DataRow[]`, and a `ChartDef` + `DataRow[]` into a neutral `ChartOutput`. **This is the heart of the platform.**

### 2.1 Data access — Repository pattern

| Element | Role |
|---|---|
| `data/store.ts` → `DataStore` interface | The single port between resolvers and any data source. `query(StoreQuery, ctx)` — discriminated union (`val`/`obs`/`schema`/`distinct`); open for new capabilities without interface change (Grafana `DataSourceApi` / Cube `CubeApi`). |
| `StaticStore` | Empty default (returns `[]`). |
| `ApiStore` | REST + local cache; `prefetch(reqs)` batch-loads. |
| `CachedStore` | Memoization decorator over any `DataStore`. |
| `ExternalStore` | Wraps an `Observation[]` dataset; OLAP slice/sum, schema/distinct queries, `isCarryForward` dedup. **The store all three datasets use today.** |
| `DimResolver` (in store.ts) | Per-dim code↔id translation + hierarchy rollup (Kimball surrogate keys). |
| `storeVal` / `storeObs` / `runBatch` | Ergonomic helpers resolvers call instead of `store.query` directly. |
| `data/source.ts` | `OptionsSource` / `ChipSource` / `YearsSource` — universal options abstraction (static / query / api). |
| `data/resolve.ts` | `resolveOptions` / `resolveChips` / `resolveYears` — sync resolution of the above (pure, testable). |
| `data/codelist.ts` | Codelist views over a `Classifier` (`codesOf`, `itemsOf`, `leavesOf`, `resolveDimRef`…) — `{ $cl }` / `{ $d }` ref resolution. |

### 2.2 Spec resolution — Strategy + Registry

| Element | Role |
|---|---|
| `data/spec.ts` → `interpretSpec(spec, ctx, store)` | **The single data entry point.** Dispatches a `DataSpec` to its registered `SpecResolver`. Also `extractRequirements` (static prefetch analysis). |
| `registry/engine.ts` → `EngineRegistry` | Open plugin registry: `registerSpec` / `registerChart` → `spec(type)` / `chart(type)`. `defaultRegistry` is the singleton. New type = one `register` call, zero core change. |
| `registry/resolvers.ts` | The 9 built-in `SpecResolver`s: `query`, `row-list`, `timeseries`, `growth`, `ratio-list`, `by-mode`, `pivot`, `transform`, `custom`. Each its own unit, no switch. |
| `config/section.ts` → `DataSpec` | The discriminated union of spec shapes (declarative, JSON-serializable). Also the **dead Track-B types** (`SectionDef`/`WidgetDef`/…). |
| `config/filter.ts` | `FilterSchemaInput`, `ParamDef`/`ParamNode` union, `Condition`/`WhenMap`, `Validator`/`CrossValidator`/`Effect`, `FilterDerive`, `VarMap` + pure evaluators (`evalWhen`, `autoParse`, `applyEffects`, `evalFilterDerive`). |

### 2.3 Transform pipeline — Tidy Data + Vega-Lite transform

| Element | Role |
|---|---|
| `data/transform.ts` | `TransformStep` union (melt, rename, cast, filter, sort, concat, template, addField, select, derive, aggregate, rollup, lookup, join, group) + `applyPipeline`/`applyStep`. Declarative, JSON-serializable, composable. Includes the `DeriveExpr` tree + recursive-descent string-formula parser, and the `FORMATTERS` registry. |
| `data/aggregate.ts` | `groupAggregate` — generic group-by reduce. |

### 2.4 Encoding — Grammar of Graphics

| Element | Role |
|---|---|
| `data/encoding.ts` | `EngineRow` (neutral, `Record<string,DimVal>`), `EncodingSpec` (field→visual-channel map, Vega-Lite analogue), `DataRow` (structured post-encoding row), `applyEncoding`. The seam between raw rows and renderable rows. |
| `field/config.ts`, `field/utils.ts` | `FieldConfig` (Grafana field overrides): thresholds, color modes, decimals, unit + `formatFieldValue`/`resolveThresholdColor`/`resolveFieldConfig`. |

### 2.5 Chart interpretation — neutral output

| Element | Role |
|---|---|
| `chart/engine.ts` → `interpretChart(def, rows, ctx)` | Dispatches a `ChartDef` to its `ChartInterpreter`; falls back to `placeholderOutput`. Registry wired lazily via `setChartRegistry`. |
| `chart/types.ts` | `ChartDef` (input) + `ChartOutput`/`ChartSeries`/`ChartDataPoint` (neutral output — no ApexCharts). |
| `registry/interpreters.ts` | The built-in `ChartInterpreter`s: bar/hbar, hbar-diverging, line, area, pie/donut, waterfall, contribution, combo, treemap, + map/sankey placeholders. Produce neutral `ChartOutput`. |

### 2.6 KPIs, links, validation

| Element | Role |
|---|---|
| `data/kpi.ts`, `config/kpi.ts` | `interpretKpis` + `KpiSpec`/`KpiDef` — KPI card data resolution (value/trend specs). |
| `links/*` | `DataLinkDef` + `resolveDataLinks` — declarative drill-down/navigation (Grafana DataLinks). |
| `validation/pipeline.ts` | `validateDataSpec`/`validateChartDef` — Constructor-facing self-validation (structured `ValidationResult`, no throws). Live-tree `validatePageTree` → ROADMAP N10/N18. |
| `validation/types.ts` | `ValidationError`/`ValidationResult`/`ValidationCode`. |
| `i18n/format.ts` | `formatterRegistry` — per-locale number/date `LocaleFormatter` (Registry + Strategy). |

> **Rewrite note (the engine cluster of the audit):** `interpretSpec` carries DEV logging `[#1,#34]`; `CustomResolver` runs a config function `[#3]`; `validation/pipeline.ts` has registry-mirror Sets `[#16,#33]` and validates the dead `SectionDef` `[#27]`; `EngineRow`≡`RawRow` `[#28]`; validators carry Georgian + functions `[#8,#4]`; currency fallback not locale-aware `[#24]`; `by-mode` silent fallback `[#22]`.

---

## Layer 3 — React Rendering Platform (`@geostat/react`)

The adapter between the agnostic engine and React. Owns the registries, the `renderNode` dispatch pipeline, the context/hook surface, and the platform default (no-op) shells. **Zero Geostat content, zero `src/` import — defaults only.**

### 3.1 Registries — Strategy + Plugin dispatch

| Element | Role |
|---|---|
| `engine/NodeRegistry.ts` | `type+variant → NodeRenderer` dispatch + stored meta (label, icon, schema, defaults, slots, validate, migrate, errorFallback). The Constructor palette source. |
| `engine/register-all.ts` | The `nodeRegistry` singleton + `createNodeRegistry` factory (test isolation). |
| `engine/chromeRegistry.ts` | `slot+variant → chrome shell` dispatch (zero-prop shells). |
| `engine/filterControlRegistry.ts` | `controlType → FilterControlSlice` (Shell + codec + defaultValue). |
| `engine/skeletonRegistry.ts` | `type+variant → SkeletonFn` (loading fallback). |
| `engine/ChartRendererRegistry.ts` | `chartType → React renderer` (the actual chart component, separate from the engine's neutral interpreter). |
| `engine/middleware/*` | `RenderMiddleware` AOP registry (`before`/`after` hooks around node render). |
| `engine/registerSlice.ts` | The **registration hub**: dispatches a `RegistrableSlice` by `META.sliceType` (node/page/panel → nodeRegistry+skeleton+i18n; chrome → chromeRegistry; control → filterControlRegistry). |

### 3.2 Render pipeline — Composite traversal

| Element | Role |
|---|---|
| `engine/renderNode.ts` | **The dispatch core.** 12-step pipeline: migrate → visibleWhen → validate → middleware.before → resolveRows → node-vars → view/fieldConfig cascade → shell lookup → lazy children proxy + named slots → ErrorBoundary → Suspense → middleware.after. Zero `if/switch` on `node.type`. |
| `engine/resolveNodeRows.ts` | Per-node data resolution: `interpretSpec` + `applyEncoding` + transform pipeline. `resolveStore(ctx)` picks the active store. |
| `engine/SiteRenderer.tsx` → `NodePageRenderer` | Wires hooks (`useFilterState`, mode, vars, eventBus, resolveLinks) into a `RenderContext`, then `renderNode(page, ctx)`. The page-component entry. |
| `engine/evalVarMap.ts` | Shared `VarMap` evaluation (page-level + node-level) against an `ExprScope`. |
| `engine/defineShell.tsx` | `ShellProps` resolver + HOC: turns a render fn into a `NodeRenderer`, resolving styles/placement/merged-view so shells stay thin. |
| `engine/resolveChrome.ts` | 4-layer chrome resolution (page override → site default → variant → 'default'). |
| `engine/ChromeRegion.tsx` / `ChromeSlot.tsx` | Render chrome entries per layout region / nested slot dispatch. |
| `engine/NodeErrorBoundary.tsx` | Per-node crash isolation (per-slice fallback). |
| `engine/navUtils.ts` | Extract nav-section list from a page's children. |
| `engine/wrapStyleContext.tsx` / `layoutItemContext.tsx` | Distribute `NodeStyles` from transparent wrap nodes / grid placement to descendant shells. |
| `engine/types.ts` | `NodeBase`, `NodeDef`, `NodeTypeMap` (open module augmentation), `RenderContext`, `ChildrenArg`/`SlotChildren`, `NodeRenderer`, slice META types, `PageConfigBase`/`NodePageConfig`. The platform type contract. |

### 3.3 Contexts & hooks — state planes

| Element | Role |
|---|---|
| `context/SiteContext.tsx` | `SiteProvider` — resource injection (stores, pages, nav, chrome, locale, i18n) + hooks (`usePageStore`, `useStores`, `useLocale`, `useFmt`, `useResolveLocale`, `useT`). |
| `context/FilterContext.tsx` | **Control plane source of truth.** React state owns filter values; URL is write-only sync target. `set`/`setMany`/`get`. |
| `context/FiltersContext.tsx` | Bridges page `filterSchema` → bar nodes for `FilterBarShell`. |
| `filters/useFilterState.ts` | Derives `SectionContext` + raw values from the schema (computed-ref for stable identity). |
| `context/ModeContext.tsx` | React layer over the engine mode system. |
| `context/PageStoreContext.tsx` | Current page's resolved `DataStore`. |
| `context/GlobalState.tsx` | Cross-page reactive state (Retool Global State) — e.g. persisted section view toggle. |
| `context/FrameContext.tsx` | Page-frame provider for chrome adaptation. |
| `context/ChromeOverrideContext` / `ChromeSlotConfigContext` / `ChromeConfig` | Per-page chrome overrides / per-instance slot config / brand config shape. |
| `context/SectionNavContext.tsx` | Section anchor nav state. |
| `events/EventBus.ts`, `events/events.ts` | Typed pub/sub (`GeostatEventMap`) for cross-node communication (Grafana EventBus). |
| `components/feedback/EmptyState.tsx`, `feedback/` | Empty/error states. |
| `components/icons.tsx`, `components/filters/CascadeSelect.tsx` | Shared icon registry + cascade primitive. |

### 3.4 Theme defaults — Null Object shells

| Element | Role |
|---|---|
| `theme/defaults/*` (`DefaultChartShell`, `DefaultTableShell`, `DefaultSectionShell`, `DefaultKpiStripShell`, `DefaultFilterBarShell`, `DefaultInnerPageShell`, `DefaultTabPageShell`) | No-op / pass-through shells so the platform renders before any Geostat plugin registers a concrete shell. Zero brand. |

### 3.5 `@geostat/styles` — token-driven styling

| Element | Role |
|---|---|
| `tokens.ts` | Design-token registry (CSS custom properties; brand = tokens, not hardcode). |
| `resolve.ts`, `resolvers/*` (`node`, `panel`, `layout`, `view`, `condition`) | Resolve `NodeStyles` → CSS, responsive value normalization, view-state (`resolveViewState`). |
| `utils/*` (`codegen`, `compose`, `helpers`, `validate`), `types.ts` | CSS codegen, style composition, validation, the style type system. |

> **Rewrite note:** `renderNode` lazy proxy is incomplete `[#20]`; `node.storeKey` cascade unimplemented in `resolveNodeRows`/`renderNode` `[#15,#23]`; `SiteRenderer` duplicates `evalVarMap` `[#26]`; middleware registry returns a live array `[#21]`; `EventBus`/`NodeRegistry` carry `any` `[#13,#14]`; `RenderContext` blurs config/runtime boundary `[#19]`; codec contract lies `[#30]`.

---

## Layer 4 — Plugins (Geostat shells)

Concrete shells registered into the Layer-3 registries. Generic by design (brand = tokens), but this is where Geostat's visual vocabulary lives. New shell = one `registerSlice` call, zero `packages/` change (OCP).

### 4.1 Chrome — `plugins/chrome/`

| Element | Role |
|---|---|
| `AppChrome.tsx` | 4-layer chrome orchestrator (header/sidebar/footer/banner regions). |
| `app-header/{default,transparent,hidden}` | Top bar variants. |
| `app-footer/{default,hidden}`, `app-banner/hidden` | Footer / banner variants. |
| `inner-sidebar/{default,hidden}` | Section-nav sidebar (nav icon registry). |
| `locale-switcher/default` | ka/en switch. |

### 4.2 Controls — `plugins/controls/` (filter control slices)

| Element | Role |
|---|---|
| `year-select`, `select`, `multi-select`, `cascade`, `range`, `hidden` | Each = Shell + `FilterCodec` (toUrl/fromUrl/isEmpty/normalize) + defaultValue. Dispatched by `filterControlRegistry` from `FilterBarShell`. |

### 4.3 Nodes — `plugins/nodes/` (content + layout)

| Element | Role |
|---|---|
| `filter-bar` | Display-only bar; reads schema from `FiltersContext` (schema lives on the page, not the node). |
| `mode-bar` | Time-mode (year/range/compare) toggle. |
| `page-header` | Title / badge / breadcrumbs block. |
| `section` | Collapsible content card + chart/table view toggle. Wraps panels. |
| `links` | Methodology footer links. |
| `hero`, `stats-carousel` | Landing-page slices. |
| `repeat` | Builder.io RepeatData — renders children per item (per-iteration context injection). |
| `georgraph` | Leaflet choropleth map node. |
| `layout/{row,columns,grid,stack,wrap,card,divider,spacer}` | Generic layout primitives; `wrap` is transparent (style distributor). |

### 4.4 Pages — `plugins/pages/` (root node types)

| Element | Role |
|---|---|
| `inner-page` | Standard data page (sidebar + sections). The GDP/Accounts/Regional shell. |
| `tab-page` | Tabbed page; `TabsNode` = param-driven content tabs. |
| `container-page/{default,landing}` | Bare container / landing layout. |

### 4.5 Panels — `plugins/panels/` (the heavy visualizers)

| Element | Role |
|---|---|
| `chart/` | `ChartShell` → `interpretChart` → `toApexOptions` (ApexCharts adapter) → `<Chart>`. Custom renderers: `DonutChart`, `HBarDivergingChart`, `TreemapChart`, `ApexRenderer`, `ChartPlaceholder`. The render-library boundary. |
| `table/` | `TableShell` → `DataTable` (Grammar-of-Graphics table: columns, pivot, footer aggregation, bar gauge). |
| `kpi-strip/` | `KpiStripShell` → `KpiCard` (value + trend + status badge + methodology link). |

> **Rewrite note:** `SectionShell` is 152 lines with inline SVG + hardcoded aria `[#31]`; `toApexOptions` (910 L) and `DataTable` (408 L) exceed size budgets `[#31]`; control codecs use `null as unknown as string` `[#30]`.

---

## Layer 5 — App, Bootstrap & Data Sources (`src/`)

The outermost layer — the only place app-specific code lives. Assembles the manifest, registers all plugins, wires routes, and provides the concrete datasets.

### 5.1 Bootstrap & routing

| Element | Role |
|---|---|
| `setupRegistrations.ts` | Registers all chrome/pages/panels/nodes/controls slices + modes into the registries; installs dev middleware. Called once at startup. |
| `app/App.tsx` | Bootstraps the manifest (`bootstrapSite`), mounts `SiteProvider` + routes. |
| `app/LocaleGuard.tsx` | `/:locale/*` URL locale routing (Eurostat pattern). |
| `app/PageLoader.tsx` | Reads `pageId` from URL → `loadPage(id)` → `NodePageRenderer`. + skeleton/404. |

### 5.2 Manifest — the Phase-1/2 seam

| Element | Role |
|---|---|
| `data/site-manifest.ts` | **THE SEAM.** `bootstrapSite()` returns `{ manifest, stores }`. Phase 1 builds locally; Phase 2 = one-line `fetch('/api/site')`. `SiteManifest` shape (pages, nav, chrome, chromeConfig, i18n). |
| `data/store-manifest.ts` | `storeKey → DataStore` static registry (gdp/accounts/regional). |
| `data/pages/registry.ts` | `loadPage`/`listPages` over the 4 page configs. |
| `data/nav.config.ts` | Sidebar nav entries (separate from page configs). |
| `data/chrome-config.ts`, `data/site-config.ts` | Geostat brand identity + global chrome/i18n config. |

### 5.3 Datasets — the data-plane source

| Element | Role |
|---|---|
| `data/gdp/{raw,adapter,store}.ts` | GDP facts → `Observation[]` (`fromGDPFacts`) → `ExternalStore` + classifiers/display. |
| `data/accounts/{raw,adapter,store}.ts` | SNA accounts; `fromSDMX` + `fromAccountsFacts` (the one true SDMX boundary). |
| `data/regional/{raw,adapter,store}.ts` | Regional GVA (auto-generated raw). |
| `i18n/formatters.ts` | App-side `Intl` formatter registration. |

> **Rewrite note (Root B):** `SiteManifest` has no `datasources` field; stores are built imperatively, not from JSON `[#18]`. Adapters use `as unknown as Observation[]` / `as Record<string,any>` `[#10]`. `App.tsx` renders `null` during bootstrap `[#32]`.

---

## Layer 6 — Track A Page Configs (authored JSON)

The content layer: pure `NodeDef` trees. **This is what the Constructor will generate in Phase 2** (then `src/pages/` is deleted; `manifest.ts` fetches from API). Today they are TypeScript objects, JSON-serializable by contract.

| Element | Role |
|---|---|
| `pages/gdp.{config,filters,kpis,sections}.ts` | GDP page: production/expenditure/income, per-capita, growth. |
| `pages/accounts.{config,filters,kpis,sections}.ts` | SNA sequence: production/income/capital accounts, T-account diverging hero. |
| `pages/regional.{config,filters,kpis,sections}.ts` | Regional GVA: map + sector breakdown, multi-region compare; the heaviest `VarMap`. |
| `pages/landing.{config,hero,stats}.ts` | Landing page: hero + stats carousel. |

> **Rewrite note:** every config computes `FIRST`/`LAST` via `codesOf(CLASSIFIERS.time)` at module-load — breaks under API-sourced classifiers `[#5]`. Some labels are plain strings that should be `LocaleString` `[#7]`.

---

## Layer 7 — Rendered UI (output)

The pixels. Not code we own line-by-line — the composed result of every layer below.

| Output | Produced by |
|---|---|
| Page chrome (header/sidebar/footer) | `AppChrome` + chrome shells, token-styled. |
| Filter bar (sticky) | `FilterBarShell` + control shells, URL-synced. |
| KPI strip | `KpiStripShell` → `KpiCard`. |
| Sections (chart ↔ table toggle) | `SectionShell` → `ChartShell`/`TableShell` → ApexCharts / DOM table / Leaflet. |
| Methodology footer | `LinksShell`. |

---

## Full Pipeline Flow — bottom to top

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 0 — Build & Workspace                                                    │
│   Vite (VITE_STORE_MODE)   tsc strict   packages/{expr,engine,react,styles}    │
│   main.tsx (i18next.init → setupRegistrations → mount App)   MSW (mock /api)   │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 1 — Primitives & Contracts                                               │
│   @geostat/expr: ExprVal · evalExpr · registerExprOp · ops/* · template        │
│   @geostat/engine core: SectionContext{timeMode,dims} · SDMX Observation       │
│     · Classifier/DisplayMap · LocaleString · ModeId/ModeDef · DimVal           │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 2 — Engine Data Core (@geostat/engine)  — pure, agnostic                 │
│                                                                                │
│   DataStore (port) ── Static · Api · Cached · External(+DimResolver)           │
│        │  storeVal / storeObs                                                   │
│        ▼                                                                        │
│   interpretSpec(spec, ctx, store) ──► EngineRegistry.spec(type)                │
│        │                               └─ SpecResolver: query · row-list ·     │
│        │                                  timeseries · growth · ratio-list ·   │
│        │                                  by-mode · pivot · transform · custom │
│        ▼                                                                        │
│   applyPipeline(TransformStep[])  (melt·filter·sort·derive·lookup·group·…)     │
│        ▼                                                                        │
│   applyEncoding(EncodingSpec)  ──►  DataRow[]   (Grammar of Graphics)          │
│        │                                                                        │
│        ├──► interpretChart(def, rows, ctx) ─► ChartInterpreter ─► ChartOutput  │
│        │        (bar·hbar·diverging·line·area·pie·donut·waterfall·             │
│        │         contribution·combo·treemap · map/sankey placeholder)          │
│        └──► (table path: DataRow[] consumed directly)                          │
│                                                                                │
│   side: interpretKpis · resolveDataLinks · validate{DataSpec,ChartDef} ·       │
│         FieldConfig · formatterRegistry                                         │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │  DataRow[] / ChartOutput
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 3 — React Rendering Platform (@geostat/react)  — adapter, no brand       │
│                                                                                │
│   registries: NodeRegistry · chromeRegistry · filterControlRegistry ·          │
│               skeletonRegistry · ChartRendererRegistry · middlewareRegistry    │
│                         ▲ registerSlice (hub, by META.sliceType)               │
│                                                                                │
│   renderNode(node, ctx)  ── 12-step pipeline ───────────────────────────────  │
│     migrate → visibleWhen → validate → mw.before → resolveNodeRows             │
│     → node-vars → view/fieldConfig cascade → nodeRegistry.get(type,variant)    │
│     → lazy children proxy + named slots → ErrorBoundary → Suspense → mw.after  │
│         │                                                                       │
│         └─ resolveNodeRows → interpretSpec + applyEncoding + transforms         │
│            resolveStore(ctx) → active DataStore                                 │
│                                                                                │
│   SiteRenderer/NodePageRenderer → RenderContext (sectionCtx, stores, vars,     │
│     eventBus, resolveLinks, mode)                                              │
│   control plane:  URL ◄─► FilterContext → useFilterState → SectionContext      │
│   contexts: Site · Filter(s) · Mode · PageStore · GlobalState · Frame · Chrome │
│   defineShell (ShellProps) · evalVarMap · resolveChrome · EventBus             │
│   theme/defaults: no-op shells   ·   @geostat/styles: tokens + resolvers       │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │  nodeRegistry.get(type) → shell
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 4 — Plugins (Geostat shells)  — registered, OCP, token-styled            │
│   chrome:   AppChrome · header{default,transparent,hidden} · footer · sidebar  │
│             · banner · locale-switcher                                         │
│   controls: year-select · select · multi-select · cascade · range · hidden     │
│   nodes:    filter-bar · mode-bar · page-header · section · links · hero ·     │
│             stats-carousel · repeat · georgraph · layout{row,columns,grid,     │
│             stack,wrap,card,divider,spacer}                                     │
│   pages:    inner-page · tab-page · container-page{default,landing}            │
│   panels:   chart(→toApexOptions→ApexCharts; Donut/HBarDiverging/Treemap) ·    │
│             table(→DataTable) · kpi-strip(→KpiCard)                            │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │  registerSlice(...) at startup
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 5 — App / Bootstrap & Data (src/)  — app-specific, outermost             │
│   setupRegistrations → App → SiteProvider → routes → LocaleGuard → PageLoader   │
│   site-manifest.ts (THE SEAM: bootstrapSite → {manifest, stores})              │
│     store-manifest (gdp/accounts/regional)  ·  nav.config  ·  chrome-config     │
│   datasets:  raw facts → adapter (fromGDPFacts/fromSDMX) → ExternalStore        │
│              (+ classifiers/display)                                            │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │  pages: Record<id, NodePageConfig>
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 6 — Track A Page Configs (authored JSON NodeDef trees)                   │
│   gdp · accounts · regional · landing   ×   {config, filters, kpis, sections}  │
│   (Phase 2: Constructor generates these → DB → API; src/pages/ deleted)        │
└───────────────────────────────────┬────────────────────────────────────────────┘
                                    │  renderNode(page, ctx)
┌───────────────────────────────────▼────────────────────────────────────────────┐
│ LAYER 7 — Rendered UI                                                          │
│   Chrome (header/sidebar/footer) · sticky FilterBar · KPI strip ·              │
│   Sections [chart ↔ table] · GeoMap · Methodology footer                       │
│   → ONS/Eurostat-standard statistical page, ka/en, URL-permalinked            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-cutting planes (orthogonal to the layer stack)

| Plane | Spans | Mechanism |
|---|---|---|
| **Control / filters** | 3 → 2 | `URL ↔ FilterContext → useFilterState → SectionContext` parameterizes every `interpretSpec`. |
| **i18n** | 1 → 7 | `LocaleString` + `formatterRegistry` (engine) · `useResolveLocale`/`useT`/`useFmt` (react) · i18next slice resources (plugins) · `/:locale/*` routing (app). |
| **Styling** | 3 → 7 | `@geostat/styles` tokens + resolvers; brand = CSS custom properties only. |
| **Events** | 3 → 4 | `EventBus<GeostatEventMap>` cross-node pub/sub. |
| **Extension** | all | Open registries (`EngineRegistry`, `nodeRegistry`, `filterControlRegistry`, `modeRegistry`, expr ops) + `NodeTypeMap` module augmentation — new type = one register call, zero core change. |
| **Phase-1/2 seam** | 5 | `site-manifest.ts` `bootstrapSite()` is the single switch: static JSON → `fetch('/api/site')`. |

---

## How this tree splits the rewrite

The `IMPLEMENTATION-ROADMAP.md` phases map directly onto these layers:

| Roadmap phase | Primary layer(s) | Theme |
|---|---|---|
| Phase 0 — Integrity | 2, 3 | Registry single-source-of-truth, storeKey cascade, live-tree validation |
| Phase 1 — Engine Purity | 2 | No Vite/locale/app content in engine |
| Phase 2 — Loose Coupling & DRY | 2, 3 | One home per concern (row types, evalVarMap, codec) |
| Phase 3 — Phase-2 Readiness | 5, 6, 2 | Datasources first-class JSON; no module-load coupling; no functions in config |
| Phase 4 — Type Tightening | 2, 3, 5 | Close `any`/cast holes; LocaleString sweep |
| Phase 5 — Pipeline Robustness | 3, 2 | Complete proxy; middleware; surface silent failures |
| Phase 6 — Readability | 4, 2, 5 | Split oversized shells; delete dead Track-B; bootstrap skeleton |
| Phase 7 — Platform Power | 5, 2, 4 | Datasource plugin API; complete Constructor metadata |

Each layer in this tree is independently testable, independently deployable, and depends only inward — so the rewrite proceeds one layer at a time without the layers below ever breaking.
