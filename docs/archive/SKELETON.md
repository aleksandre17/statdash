# Implementation Skeleton — Geostat National Accounts

> Canonical architecture reference. One view of all agreements, rules, and patterns.
> Type reference: `types/all-types.md` · Decisions: `decisions/` · Principles: `docs/PRINCIPLES.md`
> Expression system: `architecture/06-expression-system.md`

---

## 4-Layer Architecture — The Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│  packages/          PLATFORM FOUNDATION                         │
│  @geostat/expr · @geostat/engine · @geostat/react               │
│  DEFAULTS ONLY — zero Geostat identity                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ imports
┌──────────────────────────────▼──────────────────────────────────┐
│  plugins/           PLUGIN LIBRARY                              │
│  nodes/ · chrome/ · controls/ · landing/                        │
│  Generic, token-driven shells. All registrable slices.          │
│  ZERO brand in code — brand = manifest.tokens (CSS vars).       │
│  Constructor reads this layer via nodeRegistry.list()           │
│  META.schema + META.preview + META.label → Constructor palette  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ capabilities available to
┌──────────────────────────────▼──────────────────────────────────┐
│  data/              SHARED DATA LAYER                           │
│  DataStore instances + adapters. Used by BOTH tracks.           │
│  STORE_MANIFEST exported → manifest.ts → SiteProvider          │
├─────────────────────────────────────────────────────────────────┤
│  pages/             TRACK A — JSON World                        │
│  NodeDef page configs. Constructor-compatible.                  │
│  Phase 2: folder deleted entirely — Constructor writes to DB.   │
├─────────────────────────────────────────────────────────────────┤
│  features/          TRACK B — React Application                 │
│  Feature-based React app (Feature-Sliced Design).               │
│  Full framework power. No JSON constraints.                     │
│  Constructor NEVER touches this layer.                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ imports from all layers
┌──────────────────────────────▼──────────────────────────────────┐
│  src/               BOOTSTRAP ONLY (5–6 files, never grows)     │
│  main.tsx · App.tsx · routes.tsx · theme.ts                     │
│  setupRegistrations.ts · manifest.ts                            │
└─────────────────────────────────────────────────────────────────┘
```

**Dependency rule — one direction only:**
```
src/ → pages/    → plugins/ → packages/
src/ → features/ → plugins/ → packages/
       both ↑ also import from data/ (shared DataStores)
       no upward imports (packages/ knows nothing above it)
```

**Constructor (Phase 2) relationship:**
```
Constructor reads  ← plugins/ (via nodeRegistry.list() → palette)
Constructor reads  ← META.schema (→ form editor) · META.preview (→ thumbnails)
Constructor writes → DB / API (page configs → replaces pages/ entirely)
App reads          ← manifest.ts → fetch('/api/site') in Phase 2
```

---

## Layer 1 — `engine/expr/`  (`@geostat/expr`)

> Pure TypeScript. Zero deps. Isolated expression evaluator.

```
engine/expr/
  src/
    types.ts          — Expr · ExprRef · ExprVal · DimVal · DeriveMap · ExprScope
    eval.ts           — evalExpr<T>(expr: ExprVal, scope: ExprScope): T
    derive.ts         — evalDerived(map: DeriveMap, scope): Record<string, DimVal>
                        DeriveMap = Array<{ key: string; expr: ExprVal }> — ordered, explicit
    template.ts       — evalTemplate(tmpl: string, scope): string  e.g. '{time} · მლნ ₾'
    guards.ts         — isExpr() · isExprRef() · isDimVal()
    errors.ts         — ExprEvalError
    ops/
      comparison.ts   — eq · ne · gt · lt · gte · lte · in · nin · null · exists
      logic.ts        — and · or · not · if (ternary)
      string.ts       — template · concat · startsWith · includes
      math.ts         — add · sub · mul · div · mod
      lookup.ts       — coalesce · get
      collection.ts   — some · every · filter · count · map
  index.ts
```

---

## Layer 1 — `engine/core/`  (`@geostat/engine`)

> Pure TypeScript. Zero React. Zero app content. Importable by any project.

```
engine/core/
  src/
    sdmx/
      types.ts              — DimVal · CtxRef · NeRef · NeCtxRef · FilterValue
                              Observation (= Readonly<Record<string,DimVal>>)
                              ObsQuery { measure, filter?, orderBy? }
                              Classifier · ClassifierEntry · DisplayMap
                              ClassifierRef ($cl) · DisplayRef ($d) · DimRef
                              DataBundle<F> { facts, classifiers?, display? }
      fromSDMX.ts           — fromSDMX(raw): Observation[]   ← only format boundary

    core/
      types.ts              — EngineRow (= Record<string,DimVal>) — pipe output, pre-encoding
                              DataRow (structured) — label · value · series? · pct? · color? ·
                                                     isTotal? · isSeparator? · level? · parentId? · status?
                              ObsQuery · DeriveEntry = ExprVal | DataLookupOp
                              DataLookupOp:
                                | { op:'tree-field'; data:DataSpec; ref:ExprVal; field:string; fallback?:DimVal }
                                | { op:'map-field';  data:DataSpec; ref:ExprVal; field:string; fallback?:DimVal }
                              NodeDeriveMap = Array<{ key: string; expr: DeriveEntry }>
      interpretSpec.ts      — interpretSpec(spec, ctx, stores): DataRow[]
                              — applies pipe (TransformStep[]) then encoding (EncodingSpec) if present
      evalNodeDerive.ts     — evalNodeDerive(map: NodeDeriveMap, ctx): Record<string, DimVal>

    data/
      store.ts              — interface DataStore { query(q: ObsQuery): EngineRow[];
                                                    invalidate(href?: string): void;
                                                    readonly classifiers?: Record<string,Classifier>
                                                    readonly display?:     Record<string,DisplayMap> }
                              SYNC — never async. Async = internal (throw Promise/Error)
                              DimResolver (internal) — code↔id, leafIds(), transitive closure

      specs.ts              — DataSpecBase { storeId?, href?, transform?, dims?, filter?,
                                             sort?, derive?, pipe?: TransformStep[], ttl?,
                                             encoding?: EncodingSpec }
                                   ← pipe: inline transform pipeline (TransformStep[])
                                   ← encoding: Grammar of Graphics channel mapping (EncodingSpec)
                              DataSpec union: query · row-list · timeseries · growth ·
                              ratio-list · pivot · by-param · url · account-sequence (extendSpec)

      transform.ts          — TransformStep discriminated union (15 operations):
                                melt · rename · cast · filter · sort · derive · aggregate ·
                                rollup · lookup · join · group · concat · template · addField · select
                              DeriveExpr union + ExprParser (string → DeriveExpr)
                              applyStep(rows, step, ctx?): EngineRow[]
                              applyPipeline(rows, steps, ctx?): EngineRow[]
                              PipelineContext { classifiers?, display?, section? }
                              FORMATTERS: Record<string, (n:number)=>string>
                              getFormatter(name): (n:number)=>string

      encoding.ts           — EncodingSpec { label, value?, series?, color?, pct?, negate?,
                                             seriesFormat?, seriesOrder?, tooltip?,
                                             id?, isSeparator?, isTotal?, level?, parentId? }
                              applyEncoding(rows, enc, lookup?): DataRow[]
                                  — pure function: EngineRow[] + EncodingSpec → DataRow[]
                                  — pct variants: { of: code } | { sumOf: field } | { field: name }
                                  — lookup callback: (code: string) => number   (OLAP point read)
                              NOTE: DataRow is the structured output of applyEncoding.
                                    EngineRow is the intermediate pipe output (pre-encoding).
                                    Both Chart and Table receive DataRow[] — same type, same encoding.

      codelist.ts           — isDimRef(v): v is DimRef
                              resolveDimRef(ref, classifiers, display, view): items|byCode|...
                                  — resolves $cl or $d ref against store's classifier/display registry
                              codelistOf(cls, view): entries   — Classifier → items/byCode/leaves/rollups

      resolve.ts            — resolveOptions(src, store, ctx): SelectOption[]
                              resolveChips(src, store, ctx):   ChipOption[]
                              resolveYears(src, store, ctx):   number[]
                                  — pure, no React; pipe-backed dynamic options for filter controls
                              OptionsSource: { type:'static', items } | { type:'inline', items:DimRef|Row[] }
                                           | { type:'query', query:ObsQuery } | { type:'api' }
                                           + optional pipe?: TransformStep[], valueField, labelField
                              ChipSource:   same shape + optional colorField
                              YearsSource:  same shape + field: string

      stores/
        StaticDataStore.ts  — in-memory, sync, zero network (dev/tests)
        HttpDataStore.ts    — fetch + cache, Suspense pattern
                              cache miss → throws Promise → Suspense → skeleton
                              fetch error → throws Error → NodeErrorBoundary → error node
        ExternalStore.ts    — wraps Observation[] + classifiers + display
                              val(code, ctx): number  — OLAP cell sum (carry-forward excluded)
                              query(q, ctx): EngineRow[]  — multi-dim query with CtxRef resolution
                              DimResolver: code↔id translation + hierarchy rollup (transitive closure)
                              Pattern: production datasets where Observation[] is pre-loaded (MSW/test)
        ApiStore.ts         — REST API + local cache, no Suspense (pre-fetch pattern)
                              prefetch(reqs: Requirement[]): Promise<void>   — batch-load before render
                              Pattern: endpoints that support batch KPI requests by measure+dims

    field/
      groupBySpan.ts        — groupBySpan<T>(items, getSpan): T[][]
      formatValue.ts        — formatValue(v, fmt): string

    chart/
      interpretChart.ts     — interpretChart(def, rows, ctx): ChartOutput
                              — rows: DataRow[] (already encoded — apply encoding before calling)
      toApexOptions.ts      — toApexOptions(output): ApexCharts.ApexOptions

    registry/
      engine.ts             — engine: {
                                renderNode(node, ctx): ReactNode
                                extend(nodeRegistry): void
                                extendSpec(type, resolver): void
                                registerTransform(name, fn): void
                                listTransforms(): string[]
                                registerBuiltinStore(id, store): void
                              }
  index.ts
    export { fromSDMX }
    export { interpretSpec }
    export { applyEncoding, applyPipeline, applyStep }
    export { groupBySpan, formatValue, getFormatter }
    export { interpretChart, toApexOptions }
    export { engine }
    export type { EngineRow, DataRow, DimVal, Observation, DataSpec, ObsQuery, DataStore }
    export type { EncodingSpec, TransformStep, PipelineContext }
    export type { Classifier, ClassifierEntry, DisplayMap, ClassifierRef, DisplayRef, DimRef, DataBundle }
    export type { OptionsSource, ChipSource, YearsSource, SelectOption, ChipOption }
    export type { ChartOutput, DeriveEntry, DataLookupOp, NodeDeriveMap }
```

**HttpDataStore — dual error paths:**
```ts
class HttpDataStore implements DataStore {
  query(q: ObsQuery): EngineRow[] {
    if (this.cache)      return applyObsQuery(this.cache, q)  // sync, cache hit
    if (this.fetchError) throw this.fetchError                // → NodeErrorBoundary
    if (!this.fetchPromise) {
      this.fetchPromise = fetch(this.href)
        .then(r => r.json())
        .then(raw => { this.cache = this.transform(raw) })    // transform: string key → fn
        .catch(err => { this.fetchError = err; this.fetchPromise = null })
    }
    throw this.fetchPromise  // → React Suspense (shows skeleton)
  }
}
// query() throws  →  caught by           →  user sees
// Promise         →  <Suspense>           →  Skeleton
// Error           →  <NodeErrorBoundary>  →  "მონაცემი მიუწვდომელია"
// (nothing)       →  —                   →  EngineRow[] returned → interpretSpec applies encoding
```

**Pipeline flow (interpretSpec, step by step):**
```
store.query(q)                    → EngineRow[]      (raw observation rows)
  └── applyPipeline(rows, pipe)   → EngineRow[]      (optional transform steps)
  └── applyEncoding(rows, enc)    → DataRow[]        (Grammar of Graphics mapping)
       └── label, value, series, pct, color, level, parentId assigned
renderNode step 3                 → ctx.rows = DataRow[]
                                    (Chart + Table receive same typed rows)
```

---

## Layer 1 — `engine/react/`  (`@geostat/react`) — DEFAULTS ONLY

> React adapter. DEFAULTS ONLY — zero Geostat identity. Zero brand. Reusable on any project.
> Geostat shells → plugins/. Geostat brand → plugins/ + src/theme.ts.

```
engine/react/
  src/
    engine/
      types.ts
        NodeBase          { type: string; variant?: string; visibleWhen?: ExprVal;
                            layout?: LayoutHints; derive?: NodeDeriveMap;
                            data?: DataSpec; view?: ViewParams }
        LayoutHints       { position?, order?, colSpan?, rowSpan?, align?, label?, role? }
                            colSpan: number — grid/columns columns this node occupies
                            rowSpan: number — grid rows this node occupies
                            align:   string — CSS align-self (stretch/start/center/end)
                            role:    open string — shell groups by distinct roles
        ChildrenArg       { defs: NodeDef[]; rendered: ReactNode[];
                            renderChild: (i: number) => ReactNode }
                            rendered:    eager — engine pre-renders all children
                            renderChild: lazy  — on demand, engine memoizes (tabs, virtual scroll)
        NodeRenderer<D>   (def: D, ctx: RenderContext, children: ChildrenArg) => ReactNode
        RenderContext     { theme: ThemeConfig; rows: DataRow[]; view: ResolvedViewParams;
                            dims: Record<string, DimVal>; derived: Record<string, DimVal>;
                            stores: Record<string, DataStore>; scope: ExprScope;
                            pageStoreKey?: string }
        ViewParams        { subtitle?:ExprVal; hero?:ExprVal; noCollapse?:ExprVal;
                            defaultOpen?:ExprVal; exportable?:ExprVal; visibleWhen?:ExprVal }
        ResolvedViewParams { subtitle?:string; hero?:boolean; noCollapse?:boolean;
                             defaultOpen?:boolean; exportable?:boolean }
        NodeTypeMap       interface — built-in keys here; app extends via module augmentation
                            NodeDef = NodeTypeMap[keyof NodeTypeMap]  (auto-extends)
        SectionNode       { type:'section'; children: NodeDef[] }
        ChartNode         { type:'chart'; def: ChartDef }
        TableNode         { type:'table' }
        FilterBarNode     { type:'filter-bar';
                            bars: Record<string, BarDef>   ← JSON config input
                            effects?: Effect[]; crossValidate?: CrossValidator[] }
        KpiStripNode      { type:'kpi-strip' }
        InnerPageNode     { type:'inner-page'; id:string; title:string;
                            storeKey?:string; children: NodeDef[] }
        TabPageNode       { type:'tab-page'; id:string; children: NodeDef[];
                            defaultTab?: number }
        ContainerPageNode { type:'container-page'; id:string; children: NodeDef[] }
        PageConfigBase    { id:string; type:string; title:string; storeKey?:string;
                            color?:string; children: NodeDef[] }
        ThemeConfig       { skeletons?: SkeletonMap }   — skeletons only; shells → registries
        ShellMap          typed built-ins + open for custom types  (reference type only)
        ChromeMap         AppHeader · AppSidebar · AppFooter + open  (reference type only)

      nodeRegistry.ts
        NodeRegistryMeta  {
          label?:    string         — 'სექცია'          Constructor palette label
          icon?:     string         — 'layout-section'  Constructor palette icon
          category?: string         — 'layout'|'data'|'page'  Constructor grouping
          variants?: string[]       — CSS modifier hints
          schema?:   Record<string, unknown>   JSON Schema → Constructor form editor
          preview?:  string         — '/previews/section.png'  Constructor thumbnail
          skeleton?: SkeletonFn     — nodeRegistry.getMeta(type)?.skeleton
        }
        RegistrySnapshot  — opaque snapshot for test isolation
        NodeRegistry {
          register<K extends keyof NodeTypeMap>(type: K, variant: string,
            renderer: NodeRenderer<NodeTypeMap[K]>, meta?: NodeRegistryMeta): void
          register(type: string, variant: string, renderer: NodeRenderer, meta?): void
          get<K>(type: K, variant: string): NodeRenderer<NodeTypeMap[K]> | undefined
          get(type: string, variant: string): NodeRenderer | undefined
          getMeta(type: string, variant?: string): NodeRegistryMeta | undefined
          getSchema(type: string): Record<string, unknown> | undefined
          list(type?: string): Array<{ type; variant } & Partial<NodeRegistryMeta>>
          dump(): Record<string, Record<string, NodeRenderer>>
          snapshot(): RegistrySnapshot
          restore(snap: RegistrySnapshot): void
        }
        createNodeRegistry(): NodeRegistry   — factory for test isolation
        nodeRegistry: NodeRegistry           — global singleton

      chromeRegistry.ts
        ChromeMeta        { label: string; preview?: string }
        ChromeRegistry {
          register(slot, key, component: () => ReactNode, meta?: ChromeMeta): void
          get(slot, key): (() => ReactNode) | undefined
          list(slot): Array<{ key: string } & Partial<ChromeMeta>>
          dump(): Record<string, Record<string, () => ReactNode>>
          snapshot(): RegistrySnapshot
          restore(snap: RegistrySnapshot): void
        }
        createChromeRegistry(): ChromeRegistry
        chromeRegistry: ChromeRegistry
        NullChromeSlot: () => null   — 'hidden' variant for any chrome slot

      filterControlRegistry.ts
        FilterCodec<T> {
          toUrl(value: T): string | null        — null = omit from URL (hidden filters)
          fromUrl(param: string | null): T | null
          isEmpty(value: T): boolean            — drives clear button + required check
          normalize(raw: unknown): T            — CRITICAL: URL string → T on every write
        }
        FilterControlMeta {                     — JSON-serializable ✅ (Constructor stores in DB)
          controlType:  string                  — registry key, matches ParamDef.type
          label:        string
          description?: string
          icon?:        string
          category?:    'time'|'geo'|'indicator'|'comparison'|string
          schema?:      ConstructorSchema       — ParamDef field descriptions → Constructor form editor
        }
        FilterControlSlice<T, C extends ParamDef> {
          Shell:        ComponentType<FilterControlProps<C>>
          META:         FilterControlMeta       — JSON ✅
          defaultValue: (config: C) => T        — config-aware factory
          codec:        FilterCodec<T>
          validate?:    (value: T, config: C, ctx: SectionContext) => string | null
          formatValue?: (value: T, config: C) => string  — active filter chip label
        }
        FilterControlProps<C> { filterKey: string; config: C }
        FilterControlRegistry {
          register(slice: FilterControlSlice): void   — stores full slice
          get(controlType: string): FilterControlSlice | undefined
          list(): FilterControlSlice[]
          snapshot(): RegistrySnapshot
          restore(snap: RegistrySnapshot): void
        }
        createFilterControlRegistry(): FilterControlRegistry
        filterControlRegistry: FilterControlRegistry

      evalViewParams.ts
        evalViewParams(view: ViewParams | undefined, scope: ExprScope): ResolvedViewParams

      renderNode.ts
        renderNode(node, ctx): ReactNode   — 8-step pipeline (see Rendering Pipeline section)

    styles/
      base.css    — skeleton shimmer + node-slot grid reset
                    consumed: import '@geostat/react/styles' in src/main.tsx

    theme/
      ThemeContext.tsx            — ThemeProvider · useTheme()
      DEFAULT_THEME.ts            — default shells + skeletons (brand-free, functional)
      mergeTheme.ts               — mergeTheme(base, overrides): ThemeConfig
      defaults/
        DefaultSectionShell.tsx   — (_def,_ctx,children) => <>{children.rendered}</>
        DefaultChartShell.tsx     — () => null  (chart needs library — no meaningful default)
        DefaultTableShell.tsx     — raw <table> with ctx.rows values (no styling)
        DefaultFilterBarShell.tsx — () => null  (controls need registry)
        DefaultInnerPageShell.tsx — <main>{children.rendered}</main>
        DefaultTabPageShell.tsx   — renders first child only
        Default*Shell.tsx         — one per built-in node type

      ⚠️ ZERO-BRAND CONSTRAINT — NON-NEGOTIABLE:
        DEFAULT shells = functional pass-throughs only.
        Zero Geostat CSS. Zero brand colors. Zero design.
        All visual design → plugins/ Geostat shells.
        engine/react/ must stay reusable by any project (ENstat, ArmStat, etc.)
        Violation: className="geostat-*" in any defaults/ file = engine/react/ contamination.

    filters/
      defineFilters.ts            — pure schema builder → FiltersResult (no hooks, JSON-in)
      useFilters.ts               — hook → FiltersResult (reads URL state, live dims)
      FilterProvider.tsx          — FilterContext
      useFilter.ts                — useFilter<T>(key): { value: T|undefined, set, reset }
                                    reads/writes FilterContext; no onChange prop drilling
      useStoreQuery.ts            — useStoreQuery(stores, storeId, spec): { data, isLoading }
      types.ts
        ParamDef union:
          | { type:'hidden';       defaultValue: ExprVal }
          | { type:'year-select';  defaultValue?:number; range?:[number,number] }
          | { type:'range';        defaultValue?:[number,number] }
          | { type:'select';       options:SelectOption[]; defaultValue?:string }
          | { type:'multi-select'; options:SelectOption[]; defaultValue?:string[] }
          | { type:'cascade';      storeId?:string; optionsQuery:DataSpec; defaultValue?:string }
        BarDef         { position:'sticky'|'float'; order?:number; filters:Record<string,ParamDef> }
        FilterBarSpec  { barId, position, order, filters:ActiveFilter[], errors }
        ActiveFilter   { key, paramDef, value }   — onChange REMOVED (useFilter() hook)
        FiltersResult  { ctx:SectionContext; bars:FilterBarSpec[];
                         isLoading:boolean; errors:Record<string,string> }
        FlatFilters<B> UnionToIntersection<B[keyof B]['filters']>

    page/
      SiteRenderer.tsx            — useTheme() + useStores() + useFilters() → baseCtx
      PageLoader.tsx              — usePageById(pageId) → SiteRenderer

    chrome/
      ChromeLayout.tsx            — generic slot dispatcher: slots[] + chromeRegistry + useSiteChrome
                                    zero hardcoded slot names — pure platform
                                    plugins/chrome/AppChrome uses this, knows specific slot names
      NullChromeSlot.ts           — () => null  (hidden variant for any chrome slot)

    context/
      SiteContext.tsx             — SiteProvider · useStores() · useSiteNav() ·
                                    usePageById() · useSiteChrome() · useSitePages()
                                    props: { stores:Record<string,DataStore>;
                                             pages: Record<string,PageConfig>;
                                             nav:   NavItem[];
                                             chrome?: Record<string,string> }
        SiteManifest  {
          stores: Record<string, DataStore>
          pages:  Record<string, PageConfig>
          nav:    NavItem[]
          chrome: Record<string, string>     // slot → key (Constructor sets, JSON)
          tokens: Record<string, string>     // CSS custom properties (Constructor sets)
        }

  index.ts
    // Types
    export type { ThemeConfig, ShellMap, ChromeMap }
    export type { NodeRegistryMeta, NodeRegistry, RegistrySnapshot, ChromeMeta }
    export type { SectionShellProps, ChartShellProps, TableShellProps,
                  FilterBarShellProps, KpiStripShellProps, PageShellProps, KpiCardProps }
    export type { NodeRenderer, ChildrenArg, NodeBase, NodeDef, SectionNode, ChartNode,
                  TableNode, FilterBarNode, KpiStripNode,
                  InnerPageNode, TabPageNode, ContainerPageNode, PageConfigBase, PageConfig }
    export type { RenderContext, ViewParams, ResolvedViewParams }
    export type { NavItem, NavSubItem, NavIconKey, SiteManifest }
    export type { FilterBarSpec, ParamDef, FiltersResult, FlatFilters }
    // Values
    export { DEFAULT_THEME, mergeTheme }
    export { engine }
    export { nodeRegistry, createNodeRegistry }
    export { chromeRegistry, createChromeRegistry }
    export { filterControlRegistry, createFilterControlRegistry }
    export { ChromeLayout, NullChromeSlot }
    // Components + Hooks
    export { ThemeProvider, useTheme }
    export { ShellOverrideProvider }
    export { createTestRegistryProvider }
    export { SiteRenderer, PageLoader }
    export { SiteProvider, useStores, useSiteNav, usePageById, useSiteChrome, useSitePages }
    export { applyTokens }
    export { useStoreQuery }
    // Filter API
    export { defineFilters, useFilters, FilterProvider, useFilter }
```

---

## Layer 2 — `plugins/`  Plugin Library

> Generic, token-driven shells. All registrable slices.
> Constructor reads this layer. Developer adds to this layer.
> RULE: only things that register into platform registries belong here.
> ZERO brand in code — brand = `manifest.tokens` (CSS variables). Constructor sets it.

**Membership test — "does it register into a registry?"**
```
nodeRegistry.register()         → plugins/nodes/
chromeRegistry.register()       → plugins/chrome/
filterControlRegistry.register()→ plugins/controls/
engine.extendSpec()             → plugins/ (transforms or feature nodes)
engine.registerTransform()      → plugins/ (transforms)
DataStore instance              → data/           ← NOT a registry registrant
page config (NodeDef)           → pages/          ← NOT a registry registrant
```

```
plugins/
  nodes/                     — node type shell implementations
  chrome/                    — chrome slot implementations + AppChrome dispatch
  controls/                  — filter control implementations
  landing/                   — feature-specific capability extension
  index.ts                   — re-exports all barrels (optional convenience)
```

---

### `plugins/nodes/`

```
plugins/nodes/
  section/
    SectionShell.tsx    — NodeRenderer<SectionNode>: role toggle · collapse · export
    SectionSkeleton.tsx — (ctx) => ReactNode
    SectionShell.css
    index.ts                   ← see example below
  chart/
    ChartShell.tsx      — ChartControl (useMemo) + ReactApexChart
    index.ts
  table/
    TableShell.tsx
    index.ts
  kpi-strip/
    KpiStripShell.tsx   — grid of KpiCards — iterates ctx.rows internally
    KpiStripSkeleton.tsx
    index.ts
  filter-bar/
    FilterBarShell.tsx  — FilterBarControl (hooks in inner component)
    index.ts
  inner-page/
    InnerPageShell.tsx  — AppChrome wrapper + page header
    index.ts
  tab-page/
    TabPageShell.tsx    — tab navigation + ChildrenArg.renderChild (lazy)
    index.ts
  container-page/
    default/
      ContainerLayout.tsx
      index.ts                 ← META: { type:'container-page', variant:'default' }
    landing/
      LandingShell.tsx  — landing layout (same type, different variant)
      index.ts                 ← META: { type:'container-page', variant:'landing' }

  layout/                      — spatial composition nodes (Constructor palette: 'layout' category)
    grid/
      GridShell.tsx     — CSS grid container; reads children[i].layout?.colSpan + rowSpan
      index.ts
    columns/
      ColumnsShell.tsx  — responsive columns; reads children[i].layout?.colSpan
      index.ts
    stack/
      StackShell.tsx    — flex column/row; reads children[i].layout?.order + align
      index.ts
    card/
      CardShell.tsx     — card surface (border, shadow, padding) — leaf or container
      index.ts
    types.ts            — module augmentation: GridNode · ColumnsNode · StackNode · CardNode
    index.ts            ← BARREL:
                            export * as grid    from './grid'
                            export * as columns from './columns'
                            export * as stack   from './stack'
                            export * as card    from './card'

  index.ts                     ← BARREL — exact content:
    export * as section              from './section'
    export * as chart                from './chart'
    export * as table                from './table'
    export * as kpiStrip             from './kpi-strip'
    export * as filterBar            from './filter-bar'
    export * as innerPage            from './inner-page'
    export * as tabPage              from './tab-page'
    export * as containerPageDefault from './container-page/default'
    export * as containerPageLanding from './container-page/landing'
    export * as layout               from './layout'   // grid · columns · stack · card
    // ← add new node type here (1 line)       ← DISCOVERABILITY
```

**Example — `plugins/nodes/section/index.ts`:**
```ts
import { SectionShell    } from './SectionShell'
import { SectionSkeleton } from './SectionSkeleton'
import type { NodeSliceMeta }      from '../types'

export { SectionShell    as Shell    }
export { SectionSkeleton as Skeleton }
export const META: NodeSliceMeta = {
  type:     'section',
  variant:  'default',
  label:    'სექცია',
  icon:     'layout-section',
  category: 'layout',
  schema: {                                 // ← Constructor reads → form editor
    type: 'object',
    properties: {
      view: {
        type: 'object',
        properties: {
          subtitle:     { type: 'string' },
          hero:         { type: 'boolean' },
          noCollapse:   { type: 'boolean' },
          exportable:   { type: 'boolean' },
        }
      }
    }
  },
  preview: '/previews/section.png',         // ← Constructor shows in palette thumbnail
}
// META is JSON-serializable: JSON.parse(JSON.stringify(META)) === META ✅
// Skeleton is a separate export (it's a function — NOT in META)
```

**Example — `plugins/nodes/section/SectionShell.tsx` (hooks rule):**
```tsx
import type { SectionNode } from '@geostat/react'
import type { NodeRenderer } from '@geostat/react'

// NodeRenderer = plain function, NOT a React component.
// Hooks must be in an inner component — engine calls this as a plain function.
export const SectionShell: NodeRenderer<SectionNode> =
  (def, ctx, children) => <SectionControl def={def} ctx={ctx} children={children} />

// Inner component — owns all hooks and state:
function SectionControl({ def, ctx, children }) {
  const roles = [...new Set(children.defs.map(d => d.layout?.role).filter(Boolean))]
  const [activeRole, setActiveRole] = useState(roles[0])
  const view = ctx.view  // engine already resolved ExprVal → ResolvedViewParams

  return (
    <section>
      {roles.length > 0 && (
        <RoleToggle roles={roles} defs={children.defs} active={activeRole}
                    onChange={setActiveRole} />
      )}
      {children.defs.map((d, i) => {
        const visible = !d.layout?.role || d.layout.role === activeRole
        return visible ? children.rendered[i] : null
      })}
    </section>
  )
}
// role toggle rule:
//   no role → always visible
//   has role → visible only if role === activeRole
//   role = ANY open string ('chart'/'table'/'map'/'pivot' etc.) — shell never hardcodes
```

---

### `plugins/chrome/`

```
plugins/chrome/
  AppHeader/
    default/
      FullHeader.tsx    — () => ReactNode · useSiteNav() · NavLink
      index.ts
    minimal/
      MinimalHeader.tsx — () => ReactNode · compact navigation
      index.ts
    compact/
      CompactHeader.tsx — () => ReactNode · icon-only nav
      index.ts
  AppSidebar/
    default/
      ExpandedSidebar.tsx
      index.ts
    collapsed/
      CollapsedSidebar.tsx
      index.ts
    hidden/
      index.ts                 ← NullChromeSlot only — no component file needed
  AppFooter/
    default/
      FullFooter.tsx
      index.ts
    minimal/
      MinimalFooter.tsx
      index.ts

  AppChrome.tsx                ← uses ChromeLayout from @geostat/react
                                 NOT a registrable slice — knows specific slot names
                                 (AppHeader · AppSidebar · AppFooter · AppBanner)

  index.ts                     ← BARREL — exact content:
    export * as appHeaderDefault    from './AppHeader/default'
    export * as appHeaderMinimal    from './AppHeader/minimal'
    export * as appHeaderCompact    from './AppHeader/compact'
    export * as appSidebarDefault   from './AppSidebar/default'
    export * as appSidebarCollapsed from './AppSidebar/collapsed'
    export * as appSidebarHidden    from './AppSidebar/hidden'
    export * as appFooterDefault    from './AppFooter/default'
    export * as appFooterMinimal    from './AppFooter/minimal'
    // ← add new chrome variant here (1 line)   ← DISCOVERABILITY
```

**Example — `plugins/chrome/AppHeader/default/index.ts`:**
```ts
import { FullHeader } from './FullHeader'
export { FullHeader as Shell }
export const META: ChromeSliceMeta = {
  slot:    'AppHeader',
  key:     'default',
  label:   'სრული სათაური',
  preview: '/previews/header-full.png',   // ← Constructor palette thumbnail
}
```

**Example — `plugins/chrome/AppSidebar/hidden/index.ts`:**
```ts
import { NullChromeSlot } from '@geostat/react'
export { NullChromeSlot as Shell }          // ← () => null, no component file needed
export const META: ChromeSliceMeta = {
  slot:  'AppSidebar',
  key:   'hidden',
  label: 'გამოთიშული',
}
// manifest.chrome.AppSidebar = 'hidden' → chromeRegistry.get('AppSidebar','hidden') → null
// AppChrome: {Sidebar && <Sidebar />} → null → no sidebar rendered ✅
// No conditional logic in AppChrome. No code change. Pure data decision.
```

**`engine/react/chrome/ChromeLayout.tsx` — generic dispatcher:**
```tsx
// engine/react — knows NOTHING about specific slot names
// plugins/chrome/AppChrome uses this and provides the slot list
import { chromeRegistry } from './registry'
import { useSiteChrome   } from '../context/SiteContext'

export function ChromeLayout({ slots, children }: {
  slots: string[]          // caller provides — ChromeLayout never hardcodes names
  children: ReactNode
}) {
  const config = useSiteChrome()   // manifest.chrome from SiteProvider
  return (
    <div className="chrome-layout">
      {slots.map(slot => {
        const C = chromeRegistry.get(slot, config?.[slot] ?? 'default')
        return C ? <C key={slot} /> : null   // () => ReactNode — no args
      })}
      <main className="chrome-main">{children}</main>
    </div>
  )
}
// CSS handles actual header/sidebar/footer positioning via .chrome-layout grid
```

**`plugins/chrome/AppChrome.tsx` — knows specific slot names:**
```tsx
// plugins/chrome — NOT a registrable slice — uses ChromeLayout from platform
import { ChromeLayout } from '@geostat/react'

export function AppChrome({ children }: { children: ReactNode }) {
  // slot order = render order. CSS handles layout (grid/flex).
  return (
    <ChromeLayout slots={['AppHeader', 'AppBanner', 'AppSidebar', 'AppFooter']}>
      {children}
    </ChromeLayout>
  )
}
// manifest.chrome.AppHeader = 'minimal'
// → ChromeLayout: chromeRegistry.get('AppHeader', 'minimal') → MinimalHeader
// → no code change, no deploy ✅
// Add new slot: plugins/chrome/ + register → add to slots[] here → done ✅
```
// Chrome components: () => ReactNode — ZERO PROPS.
// Data from useSiteNav() / useLocation() / useSiteChrome() INSIDE the component.
// Passing props here → crash (chromeRegistry.get(slot, key)() has no args).
```

**Constructor changes chrome — zero code change:**
```
manifest.chrome.AppHeader = 'minimal'
→ fetchSiteManifest() → SiteProvider(chrome: { AppHeader: 'minimal' })
→ chromeRegistry.get('AppHeader', 'minimal') → MinimalHeader
→ no code change, no deploy ✅
```

---

### `plugins/controls/`

```
plugins/controls/
  year-select/
    YearSelectShell.tsx      — Shell component, useFilter(key) hook inside
    index.ts                 ← Shell + META + defaultValue + codec + validate? + formatValue?
  cascade/
    CascadeControl.tsx
    index.ts
  select/
    SelectControl.tsx
    index.ts
  range/
    RangeControl.tsx
    index.ts
  multi-select/
    MultiSelectControl.tsx
    index.ts

  index.ts                   ← BARREL — exact content:
    export * as yearSelect  from './year-select'
    export * as cascade     from './cascade'
    export * as select      from './select'
    export * as range       from './range'
    export * as multiSelect from './multi-select'
    // ← add new control type here (1 line)   ← DISCOVERABILITY
```

**Example — `plugins/controls/year-select/index.ts`:**
```ts
export { YearSelectShell as Shell }
export const META: FilterControlMeta = {
  controlType: 'year-select',
  label:       'Year Selector',
  category:    'time',
}
export const defaultValue = (config: YearSelectDef) =>
  config.range?.[1] ?? new Date().getFullYear()
export const codec: FilterCodec<number> = {
  toUrl:     v  => String(v),
  fromUrl:   s  => s ? parseInt(s, 10) : null,
  isEmpty:   v  => v == null || !Number.isFinite(v),
  normalize: raw => parseInt(String(raw), 10),   // URL string → number always
}
export const validate    = (v: number, c: YearSelectDef) =>
  c.range && (v < c.range[0] || v > c.range[1]) ? `${c.range[0]}–${c.range[1]}` : null
export const formatValue = (v: number) => String(v)
// FilterBarShell: filterControlRegistry.get('year-select') → full slice
//   slice.codec.isEmpty(v)   → clear button visibility
//   slice.validate(v, cfg)   → inline error
//   slice.formatValue(v)     → active filter chip label
```

---

### `plugins/landing/`

> Feature-specific capability extension: adds new node types to nodeRegistry.
> Module augmentation: declares 'landing-hero' + 'landing-stats' in NodeTypeMap.

```
plugins/landing/
  types.ts                   — module augmentation
  nodes/
    hero/
      HeroShell.tsx  — NodeRenderer<LandingHeroNode>
      index.ts
    stats/
      StatsShell.tsx — NodeRenderer<LandingStatsNode>
      LandingStatsControl.tsx  — inner component (hooks live here)
      index.ts
    index.ts                   ← BARREL:
      export * as hero  from './hero'
      export * as stats from './stats'
      // ← add new landing node here (1 line)
```

**Example — `plugins/landing/types.ts`:**
```ts
// Module augmentation — no cast, no packages/ change:
declare module '@geostat/react' {
  interface NodeTypeMap {
    'landing-hero':  LandingHeroNode
    'landing-stats': LandingStatsNode
  }
}

export interface LandingHeroNode extends NodeBase {
  type:   'landing-hero'
  layout?: LayoutHints
  view?:  ViewParams
}

export interface LandingStatsNode extends NodeBase {
  type:    'landing-stats'
  data?:   DataSpec
  layout?: LayoutHints
}
// → LandingHeroNode ∈ NodeDef ✅ (no `as unknown as NodeDef`)
// → nodeRegistry.register('landing-hero', 'default', HeroShell) — typed overload ✅
```

**Example — `plugins/landing/nodes/hero/index.ts`:**
```ts
import { HeroShell } from './HeroShell'
export { HeroShell as Shell }
export const META: NodeSliceMeta = {
  type:     'landing-hero',
  variant:  'default',
  label:    'ჰირო სექცია',
  icon:     'home',
  category: 'landing',
  schema:   { type: 'object', properties: { view: { ... } } },
  preview:  '/previews/hero.png',
}
```

---

### `plugins/nodes/layout/`  Spatial Composition

> Layout nodes: node types whose PRIMARY purpose is spatial composition.
> Same registration pattern as all other nodes — open registry.
> Constructor palette category: `'layout'`.
> CSS tokens for all spacing/color — zero hardcoded values.

**`plugins/nodes/layout/types.ts` — module augmentation:**
```ts
declare module '@geostat/react' {
  interface NodeTypeMap {
    'grid':    GridNode
    'columns': ColumnsNode
    'stack':   StackNode
    'card':    CardNode
  }
}

export interface GridNode extends NodeBase {
  type:      'grid'
  columns?:  number          // grid template columns count (default: 12)
  gap?:      string          // CSS value or token: 'var(--spacing-md)' (default)
  children:  NodeDef[]
}

export interface ColumnsNode extends NodeBase {
  type:      'columns'
  count?:    number          // column count (default: 2)
  gap?:      string          // default: 'var(--spacing-md)'
  children:  NodeDef[]
}

export interface StackNode extends NodeBase {
  type:       'stack'
  direction?: 'row' | 'column'   // default: 'column'
  gap?:       string             // default: 'var(--spacing-md)'
  wrap?:      boolean            // flex-wrap (default: false)
  children:   NodeDef[]
}

export interface CardNode extends NodeBase {
  type:     'card'
  children?: NodeDef[]          // optional — card can be leaf or container
}
// JSON.parse(JSON.stringify(node)) === node ✅ — all fields are primitives
```

**`plugins/nodes/layout/grid/index.ts`:**
```ts
import { GridShell } from './GridShell'
export { GridShell as Shell }
export const META: NodeSliceMeta = {
  type:     'grid',
  variant:  'default',
  label:    'გრიდი',
  icon:     'layout-grid',
  category: 'layout',
  schema: {
    type: 'object',
    properties: {
      columns: { type: 'number', default: 12 },
      gap:     { type: 'string', default: 'var(--spacing-md)' },
    }
  },
  preview: '/previews/grid.png',
}
```

**`plugins/nodes/layout/grid/GridShell.tsx` (component wrapper pattern):**
```tsx
import type { GridNode } from '../types'
import type { NodeRenderer } from '@geostat/react'

export const GridShell: NodeRenderer<GridNode> =
  (def, ctx, children) => <GridControl def={def} children={children} />

function GridControl({ def, children }: { def: GridNode; children: ChildrenArg }) {
  return (
    <div
      className="layout-grid"
      style={{
        display:               'grid',
        gridTemplateColumns:   `repeat(${def.columns ?? 12}, 1fr)`,
        gap:                   def.gap ?? 'var(--spacing-md)',
      }}
    >
      {children.defs.map((d, i) => (
        <div
          key={i}
          style={{
            gridColumn: d.layout?.colSpan ? `span ${d.layout.colSpan}` : undefined,
            gridRow:    d.layout?.rowSpan ? `span ${d.layout.rowSpan}` : undefined,
            alignSelf:  d.layout?.align   ?? undefined,
          }}
        >
          {children.rendered[i]}
        </div>
      ))}
    </div>
  )
}
// GridShell knows: CSS grid, colSpan, rowSpan, align, gap, --spacing-md token.
// GridShell does NOT know: GDP, Geostat, B1G, time, geo. Fully agnostic. ✅
// Zero hardcoded colors. CSS tokens only.
```

**Constructor builds diverse layouts — same palette, different JSON:**
```ts
// Layout A — default vertical (no layout nodes needed):
{ type: 'inner-page', children: [
  { type: 'filter-bar', bars: { main: { position: 'sticky', filters: { time: { type: 'year-select' } } } } },
  { type: 'kpi-strip',  data: { type: 'row-list', indicators: ['B1G', 'D1'] } },
  { type: 'section',    data: { type: 'timeseries', indicator: 'B1G' },
    children: [
      { type: 'chart', layout: { role: 'chart' } },
      { type: 'table', layout: { role: 'table' } },
    ]
  },
]}

// Layout B — 2-column sections:
{ type: 'inner-page', children: [
  { type: 'filter-bar', bars: { main: { position: 'sticky', filters: { time: { type: 'year-select' } } } } },
  { type: 'kpi-strip', data: { type: 'row-list', indicators: ['B1G', 'D1', 'B2G', 'P51G'] } },
  { type: 'columns', count: 2, children: [
    { type: 'section', layout: { colSpan: 1 }, data: { type: 'timeseries', indicator: 'B1G' },
      children: [{ type: 'chart', layout: { role: 'chart' } }] },
    { type: 'section', layout: { colSpan: 1 }, data: { type: 'timeseries', indicator: 'D1' },
      children: [{ type: 'chart', layout: { role: 'chart' } }] },
  ]},
]}

// Layout C — hero + sidebar (landing page):
{ type: 'container-page', variant: 'landing', children: [
  { type: 'stack', direction: 'row', gap: 'var(--spacing-lg)', children: [
    { type: 'landing-hero',  layout: { colSpan: 8 } },
    { type: 'stack', direction: 'column', layout: { colSpan: 4 }, children: [
      { type: 'card', children: [{ type: 'kpi-strip', data: { type: 'row-list', indicators: ['B1G'] } }] },
      { type: 'card', children: [{ type: 'kpi-strip', data: { type: 'row-list', indicators: ['P3'] }  }] },
    ]},
  ]},
]}
// All three: JSON.parse(JSON.stringify(config)) === config ✅
// All three: same plugins/, same code, different JSON tree ✅
// Constructor builds all from same palette — zero code ✅
```

**IA Convention (platform: convention, not enforcement):**
```
Statistical publication standard (ONS · Eurostat · World Bank):
  1. Filter bar    — context setting  (filterBarNode — position: 'sticky')
  2. KPI strip     — key numbers      (kpiStripNode)
  3. Main sections — breakdown/charts (sectionNode × N)
  4. Methodology   — transparency     (sectionNode — collapsed by default)

This ordering = JSON children order in NodeDef tree.
Platform renders in order. Platform does NOT enforce order — Constructor templates do.
Constructor "Statistical Page" template pre-fills this order.
New page = Constructor applies template = correct IA from first click.
```

---

### RegistrableSlice Pattern

```ts
// Three discriminated shapes — mutually exclusive META discriminants:
interface NodeSliceMeta extends NodeRegistryMeta {
  type:     string    // nodeRegistry key — matches NodeDef.type
  variant?: string    // 'default' if omitted
}
interface ChromeSliceMeta extends ChromeMeta {
  slot: string        // chromeRegistry slot name
  key:  string        // variant key within slot
}
interface FilterControlMeta {
  controlType:  string
  label:        string
  description?: string
  icon?:        string
  category?:    'time' | 'geo' | 'indicator' | 'comparison' | string
  schema?:      ConstructorSchema   // JSON ✅
}

// Runtime fields on slice — NOT in META (same pattern as Skeleton on NodeSlice):
interface FilterControlSlice<T = unknown, C extends ParamDef = ParamDef> {
  Shell:        ComponentType<{ filterKey: string; config: C }>
  META:         FilterControlMeta   // JSON ✅
  defaultValue: (config: C) => T
  codec:        FilterCodec<T>
  validate?:    (value: T, config: C, ctx: SectionContext) => string | null
  formatValue?: (value: T, config: C) => string
}

interface NodeSlice    { Shell: NodeRenderer;       Skeleton?: SkeletonFn; META: NodeSliceMeta }
interface ChromeSlice  { Shell: () => ReactNode;    META: ChromeSliceMeta }
interface ControlSlice { Shell: ComponentType<any>; META: FilterControlMeta
                         defaultValue: (c: ParamDef) => unknown
                         codec: FilterCodec; validate?: Function; formatValue?: Function }

type RegistrableSlice = NodeSlice | ChromeSlice | ControlSlice

// Type guards — runtime dispatch + TypeScript narrowing:
const isNodeSlice    = (s: RegistrableSlice): s is NodeSlice    => 'type'        in s.META
const isChromeSlice  = (s: RegistrableSlice): s is ChromeSlice  => 'slot'        in s.META
const isControlSlice = (s: RegistrableSlice): s is ControlSlice => 'controlType' in s.META
```

**⚠️ Known tradeoff — barrel pattern vs typed overload:**
```
Barrel: mod.Shell as NodeRenderer cast needed in registerSlice().
        Typed overload register<K extends keyof NodeTypeMap> cannot be used via barrel.
Explicit: full typed overload — TypeScript validates renderer ↔ node type match.
At current scale (22 slices): explicit is equally readable + has stronger type safety.
Barrel pays off at 50+ slices. Reassess at 50.
NEVER use import.meta.glob — type assertion, not check.
```

---

### Constructor ↔ Extensions — Full Relationship

```ts
// plugins/ → Constructor:
//   nodeRegistry.list() → palette (all registered types with META)
//   nodeRegistry.getSchema(type) → form editor fields
//   META.preview → palette thumbnail image

// Constructor Phase 2 palette build:
const palette = nodeRegistry.list()
// → [
//   { type:'section', variant:'default', label:'სექცია',
//     icon:'layout-section', category:'layout',
//     schema:{ type:'object', properties:{ view:{...} } },
//     preview:'/previews/section.png' },
//   { type:'chart',   variant:'default', label:'გრაფიკი',  ... },
//   { type:'landing-hero', variant:'default', label:'ჰირო', ... },
//   ...
// ]

// Constructor builds form for 'section' node:
const schema = nodeRegistry.getSchema('section')
// → JSON Schema → renders view.subtitle, view.hero, view.exportable fields in sidebar

// Constructor saves to DB:
const nodeDef: SectionNode = {
  type:    'section',
  variant: 'default',          // user selected from palette
  data:    { type: 'timeseries', indicator: 'B1G' },
  children: [...]
}
// JSON.parse(JSON.stringify(nodeDef)) === nodeDef ✅ (all JSON, no functions)

// Constructor also reads chrome options:
const chromePalette = {
  AppHeader:  chromeRegistry.list('AppHeader'),
  // → [{ key:'default', label:'სრული' }, { key:'minimal', label:'მინიმალური' }, ...]
  AppSidebar: chromeRegistry.list('AppSidebar'),
  // → [{ key:'default' }, { key:'collapsed' }, { key:'hidden', label:'გამოთიშული' }]
}
// Constructor: user selects 'minimal' header → saves manifest.chrome.AppHeader = 'minimal'
```

---

## Layer 3 — Developer Usage Layer

> Three parallel top-level folders. No shared `app/` wrapper.
> Constructor has ZERO involvement in this layer.

```
data/              — SHARED: DataStore instances + adapters (Track A + Track B both import)
pages/             — TRACK A: JSON NodeDef page configs (Constructor-compatible)
features/          — TRACK B: Feature-based React application (full framework power)
```

**Track A vs Track B — when to choose:**
```
Track A (pages/):
  + Constructor edits it in Phase 2 (zero developer involvement)
  + Consistent rendering via engine + registered Shells
  + JSON-serializable → stored in DB → fetched at runtime
  - Constrained: must express page as NodeDef tree

Track B (features/):
  + Full React power: custom hooks, custom layout, any logic
  + Uses platform primitives directly (useStores, interpretSpec, useFilters)
  + Can use plugin Shells as regular React components
  - Constructor cannot touch it — developer owns forever
  - More code per page vs JSON config

Both share: data/ (same DataStores), plugins/ (same Shells), packages/ (same hooks)
```

---

### Mode A — JSON Configs (Constructor-compatible)

> PageConfig = NodeDef tree. JSON-serializable. Constructor reads+writes these in Phase 2.
> Phase 2: this entire folder is DELETED — Constructor writes to DB, manifest.ts fetches from API.

```
pages/
  gdp.config.ts
  accounts.config.ts
  regional.config.ts
  landing.config.ts
  index.ts         ← pagesRecord(): Record<string, PageConfig>
```

**Example — `pages/gdp.config.ts`:**
```ts
import type { InnerPageNode } from '@geostat/react'

export const gdpPage: InnerPageNode = {
  type:     'inner-page',
  id:       'gdp',
  title:    'მთლიანი შიდა პროდუქტი',
  storeKey: 'gdp',                         // default store for all children
  children: [
    {
      type: 'filter-bar',
      bars: {
        main: {
          position: 'sticky',
          filters: {
            time: { type: 'year-select', defaultValue: 2024 },
            geo:  { type: 'cascade',
                    storeId:      'geo-store',
                    optionsQuery: { type: 'query', indicator: 'GEO_LIST' },
                    defaultValue: 'GE' },
          }
        }
      }
    },
    {
      type: 'kpi-strip',
      data: { type: 'row-list', indicators: ['B1G', 'D1', 'B2G', 'P51G'] }
    },
    {
      type: 'section',
      data: { type: 'timeseries', indicator: 'B1G',
              dims: { geo: { $ctx: 'geo' } } },
      view: { subtitle: 'მლნ ₾', exportable: true },
      children: [
        { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' },
          def: { type: 'line',
                 encoding: { x: { field: 'time' }, y: { field: 'value' } } } },
        { type: 'table', layout: { role: 'table', label: 'ცხრილი' } },
      ]
    },
    {
      type: 'section',
      data: { type: 'account-sequence',           // ← custom DataSpec (extendSpec)
              sequence: 'production', year: { $ctx: 'time' } },
      children: [
        { type: 'table', layout: { role: 'table' } },
      ]
    },
  ]
}
// JSON.parse(JSON.stringify(gdpPage)) === gdpPage ✅
// Constructor can store this in DB and reconstruct it ✅
```

**Example — `pages/index.ts`:**
```ts
import { gdpPage       } from './gdp.config'
import { accountsPage  } from './accounts.config'
import { regionalPage  } from './regional.config'
import { landingPage   } from './landing.config'
import type { PageConfig } from '@geostat/react'

export function pagesRecord(): Record<string, PageConfig> {
  return {
    'gdp':      gdpPage,
    'accounts': accountsPage,
    'regional': regionalPage,
    'landing':  landingPage,
  }
}
// Phase 2: entire function deleted.
// manifest.ts: fetch('/api/site') returns { pages: Record<string,PageConfig>, ... }
```

**Example — `pages/landing.config.ts`:**
```ts
import type { ContainerPageNode } from '@geostat/react'
// LandingHeroNode is in NodeTypeMap via plugins/landing/types.ts module augmentation
// No cast needed: 'landing-hero' ∈ NodeDef ✅

export const landingPage: ContainerPageNode = {
  type:    'container-page',
  variant: 'landing',              // ← triggers LandingShell, not ContainerLayout
  id:      'landing',
  children: [
    {
      type: 'landing-hero',        // ← registered by plugins/landing/
      view: { hero: true, subtitle: 'საქართველოს ეროვნული სტატისტიკა' }
    },
    {
      type: 'landing-stats',
      data: { type: 'row-list', indicators: ['B1G', 'P3', 'D1'] }
    },
  ]
}
```

---

### Track B — `features/`  React Application

> Feature-Sliced Design. Full React power. Platform primitives used directly.
> Constructor NEVER touches this layer. Developer owns entirely.

```
features/
  gdp-explorer/
    api/
      useGdpData.ts          — useStores() + interpretSpec() + useMemo
      useGdpComparison.ts    — derived data hook
    components/
      GdpChart.tsx           — can use ChartShell from plugins/ directly
      GdpFiltersPanel.tsx    — defineFilters + useFilters (same as Track A)
      GdpIndicatorCard.tsx
    hooks/
      useGdpFilters.ts       — filter schema + URL state
      useGdpExport.ts
    types/
      gdp-explorer.types.ts
    index.ts                 ← public API only (GdpExplorerPage)
  accounts-analysis/
    ...
  shared/                    ← cross-feature shared code
    ui/
      PageHeader.tsx
      StatCard.tsx
    hooks/
      useExport.ts
    utils/
      formatters.ts
```

**Thin page component — logic in hooks, not in component:**
```tsx
// features/gdp-explorer/GdpExplorerPage.tsx
export function GdpExplorerPage() {
  const filters = useGdpFilters()              // defineFilters + useFilters
  const data    = useGdpData(filters.ctx)      // useStores + interpretSpec
  const export_ = useGdpExport(data.rows)

  return (
    <div className="gdp-explorer">
      <GdpFiltersPanel filters={filters} />
      <GdpChart        rows={data.rows} isLoading={data.isLoading} />
      <GdpTable        rows={data.rows} onExport={export_.trigger} />
    </div>
  )
}
```

**Data hook — platform primitives, React way:**
```ts
// features/gdp-explorer/api/useGdpData.ts
export function useGdpData(ctx: SectionContext) {
  const store = useStores()['gdp']

  return useMemo(() => ({
    rows:      interpretSpec({ type: 'timeseries', indicator: 'B1GQ' }, ctx, store),
    isLoading: false,
  }), [ctx, store])
}
```

**Filter hook — same defineFilters as Track A:**
```ts
// features/gdp-explorer/hooks/useGdpFilters.ts
const schema = defineFilters({      // module-level constant, JSON-serializable
  bars: {
    main: {
      position: 'sticky',
      filters: {
        time: { type: 'year-select', defaultValue: 2024 },
        geo:  { type: 'cascade', storeId: 'geo-store',
                optionsQuery: { type: 'query', indicator: 'GEO_LIST' } },
      }
    }
  }
})

export function useGdpFilters(): FiltersResult {
  return useFilters(schema)
}
```

**Using plugin Shells directly (Track B benefit):**
```tsx
// features/gdp-explorer/components/GdpChart.tsx
// Shell used as a plain React component — no engine.renderNode needed
import { ChartShell } from '../../../plugins/nodes/chart'

export function GdpChart({ rows, isLoading }: GdpChartProps) {
  const def: ChartNode = {
    type: 'chart',
    def:  { type: 'line', encoding: { x: { field: 'time' }, y: { field: 'value' } } }
  }
  const ctx = useBuildCtx(rows)   // local hook: builds RenderContext from rows
  return ChartShell(def, ctx, EMPTY_CHILDREN)
}
```

---

### `data/`  Shared Data Layer

> DataStore instances + adapters. Shared by Track A and Track B.
> NOT registry registrants → NOT in plugins/.
> Single source of truth for all datasets.

```
data/
  gdp/
    gdp.adapter.ts       — fromSDMX(raw): Observation[] → DataRow[]  (format boundary)
    gdp.store.ts         — export const gdpStore = new StaticDataStore(GDP_ADAPTED)
  accounts/
    accounts.adapter.ts
    accounts.store.ts
    account-sequence.ts  — accountSequenceResolver (custom DataSpec for SNA sequences)
  regional/
    regional.adapter.ts
    regional.store.ts
  index.ts               ← STORE_MANIFEST
  nav.ts                 ← NAV: NavItem[]
```

**Example — `data/index.ts`:**
```ts
import { StaticDataStore } from '@geostat/engine'
import { gdpStore       } from './gdp/gdp.store'
import { accountsStore  } from './accounts/accounts.store'
import { regionalStore  } from './regional/regional.store'
import type { DataStore } from '@geostat/engine'

export const STORE_MANIFEST: Record<string, DataStore> = {
  'gdp':      gdpStore,
  'accounts': accountsStore,
  'regional': regionalStore,
}
// Phase 2 store swap (zero config change):
//   Phase 1: new StaticDataStore(GDP_ADAPTED)
//   Phase 2: new HttpDataStore('/api/datasets/gdp', fromSDMX)
//   engine sees same DataStore interface. DataSpec unchanged. ✅
```

**Example — `data/gdp/gdp.adapter.ts`:**
```ts
import { fromSDMX } from '@geostat/engine'
import GDP_RAW     from './gdp-raw.json'

// fromSDMX = the ONLY boundary between API format and our types.
// Store swap in Phase 2 = change this file only. Zero config change.
export const GDP_ADAPTED = fromSDMX(GDP_RAW)
```

**Example — `data/nav.ts`:**
```ts
import type { NavItem } from '@geostat/react'

export const NAV: NavItem[] = [
  { key: 'landing',  href: '/',         label: 'მთავარი'    },
  { key: 'gdp',      href: '/gdp',      label: 'მშპ'        },
  { key: 'accounts', href: '/accounts', label: 'ანგარიშები' },
  { key: 'regional', href: '/regional', label: 'რეგიონები'  },
]
// Phase 2: Constructor writes nav to DB → fetchSiteManifest() returns it
// Agreement I-1: nav is independent of PageConfig — never in PageConfig.children
```

---

## Layer 4 — `src/`  Bootstrap Only

> 5–6 files. Never grows. Wires the other three layers together.
> src/ can import from: packages/ + plugins/ + app/

```
src/
  main.tsx
  App.tsx
  routes.tsx
  theme.ts
  setupRegistrations.ts
  manifest.ts
```

**`src/main.tsx`:**
```ts
import '@geostat/react/styles'               // skeleton shimmer + grid reset
import './shared/styles/tokens.css'          // design tokens
import { setupRegistrations } from './setupRegistrations'
import { fetchSiteManifest  } from './manifest'
import { applyTokens        } from '@geostat/react'
import { createRoot         } from 'react-dom/client'
import { App                } from './App'

setupRegistrations()                          // ALL registrations before React renders
const manifest = await fetchSiteManifest()   // Phase 1: static | Phase 2: fetch('/api/site')
applyTokens(manifest.tokens ?? {})           // CSS vars on :root before createRoot → no FOUC
createRoot(document.getElementById('root')!).render(<App manifest={manifest} />)
```

**`src/App.tsx`:**
```tsx
import { ThemeProvider, SiteProvider } from '@geostat/react'
import { GEOSTAT_THEME } from './theme'
import { Router, Routes } from './routes'
import type { SiteManifest } from '@geostat/react'

export function App({ manifest }: { manifest: SiteManifest }) {
  return (
    <ThemeProvider theme={GEOSTAT_THEME}>
      <SiteProvider
        stores={manifest.stores}
        pages={manifest.pages}
        nav={manifest.nav}
        chrome={manifest.chrome}
      >
        <Router>
          <Routes />
        </Router>
      </SiteProvider>
    </ThemeProvider>
  )
}
```

**`src/routes.tsx`:**
```tsx
import { Routes, Route }  from 'react-router-dom'
import { PageLoader, useSitePages } from '@geostat/react'
// Mode B only — explicit, developer-owned, Constructor never touches:
import { GdpExplorerPage  } from '../features/gdp-explorer'
import { CustomReportPage } from '../features/custom-report'

export function AppRoutes() {
  const pages = useSitePages()   // manifest.pages: Record<string, PageConfig>

  return (
    <Routes>
      {/* Mode A — dynamic from manifest.pages (Constructor adds page → route appears) */}
      {Object.entries(pages).map(([id, page]) => (
        <Route
          key={id}
          path={page.path ?? `/${id}`}
          element={<PageLoader pageId={id} />}
        />
      ))}

      {/* Mode B — explicit routes (developer-owned, no JSON, no Constructor) */}
      <Route path="/custom-report" element={<CustomReportPage />} />
    </Routes>
  )
}
// Mode A: Constructor adds page to manifest.pages → route appears automatically. ✅
// Mode B: Developer adds <Route> here + creates features/{name}/index.ts (manual).
// Phase 2: routes.tsx unchanged — manifest.pages comes from API, same structure. ✅
```

**`src/theme.ts`:**
```ts
import { mergeTheme, DEFAULT_THEME } from '@geostat/react'
import { KpiStripSkeleton   } from '../plugins/nodes/kpi-strip/KpiStripSkeleton'

export const GEOSTAT_THEME = mergeTheme(DEFAULT_THEME, {
  skeletons: {
    'kpi-strip': KpiStripSkeleton,
    // brand override — Geostat card shape + colors
    // all other types → nodeRegistry.getMeta(type)?.skeleton (Level 2)
    // Level 3 fallback: engine generic node-skeleton div
  }
})
// ThemeConfig = skeletons only.
// Shells → nodeRegistry (not ThemeConfig).
// Chrome → chromeRegistry (not ThemeConfig).
```

**`src/setupRegistrations.ts`:**
```ts
import { nodeRegistry, chromeRegistry, filterControlRegistry } from '@geostat/react'
import { engine, HttpDataStore, fromSDMX                     } from '@geostat/engine'
import * as Nodes        from '../plugins/nodes'
import * as Chrome       from '../plugins/chrome'
import * as Controls     from '../plugins/controls'
import * as LandingNodes from '../plugins/landing/nodes'
import { accountSequenceResolver } from '../data/accounts/account-sequence'
import type { RegistrableSlice   } from '../plugins/types'

// DISCOVERABILITY RULE: ALL registrations here. None in slice files.
// Adding a node:    plugins/nodes/<type>/ + 1 line in plugins/nodes/index.ts
// Adding chrome:    plugins/chrome/<Slot>/<key>/ + 1 line in plugins/chrome/index.ts
// Adding control:   plugins/controls/<type>/ + 1 line in plugins/controls/index.ts
// Zero changes to this file for new slices.

export function setupRegistrations() {

  // ── Registrable slices ────────────────────────────────────────────────────
  ;[
    ...Object.values(Nodes),
    ...Object.values(Chrome),
    ...Object.values(Controls),
    ...Object.values(LandingNodes),
    // ← new feature domain: import * as FooNodes from '../plugins/foo/nodes'
    //                        ...Object.values(FooNodes)  (2 lines total)
  ].forEach(registerSlice)

  // ── Engine extensions ─────────────────────────────────────────────────────
  engine.extendSpec('account-sequence', accountSequenceResolver)
  engine.registerTransform('fromSDMX',  fromSDMX)
  engine.registerTransform('raw',       x => x)
  engine.registerBuiltinStore('http',   new HttpDataStore())
}

function registerSlice(mod: RegistrableSlice): void {
  if (isNodeSlice(mod)) {
    nodeRegistry.register(
      mod.META.type,
      mod.META.variant ?? 'default',
      mod.Shell,
      {
        ...mod.META,
        ...(mod.Skeleton && { skeleton: mod.Skeleton }),
        // Skeleton = function, NOT in META (META must be JSON-serializable for Constructor)
        // registerSlice adds it here so nodeRegistry has the skeleton fn
      }
    )
  } else if (isChromeSlice(mod)) {
    chromeRegistry.register(mod.META.slot, mod.META.key, mod.Shell, mod.META)
  } else if (isControlSlice(mod)) {
    filterControlRegistry.register(mod)   // stores full slice: Shell + META + codec + ...
  }
}

const isNodeSlice    = (s: RegistrableSlice): s is NodeSlice    => 'type'        in s.META
const isChromeSlice  = (s: RegistrableSlice): s is ChromeSlice  => 'slot'        in s.META
const isControlSlice = (s: RegistrableSlice): s is ControlSlice => 'controlType' in s.META
```

**`src/manifest.ts`:**
```ts
import { STORE_MANIFEST } from '../data'
import { pagesRecord    } from '../pages'
import { NAV            } from '../data/nav'
import type { SiteManifest } from '@geostat/react'

// THE SEAM — Phase 1 → Phase 2 transition point:
export async function fetchSiteManifest(): Promise<SiteManifest> {
  // Phase 1 (now): static TypeScript files
  return {
    stores: STORE_MANIFEST,
    pages:  pagesRecord(),
    nav:    NAV,
    chrome: {
      AppHeader:  'default',
      AppSidebar: 'default',
      AppFooter:  'default',
    },
    tokens: {
      // Phase 1: hardcoded base tokens (identical to tokens.css defaults)
      // Phase 2: Constructor writes tenant-specific tokens → stored in DB
      '--color-primary':   '#005A9C',
      '--color-accent':    '#E8812A',
      '--color-text':      '#1A1A2E',
      '--font-base':       "'BPG Arial', Arial, sans-serif",
    },
  }

  // Phase 2 (Constructor live):
  // return fetch('/api/site').then(r => r.json())
  // ← this ONE LINE change is the entire Phase 1 → Phase 2 migration.
  // pages/ folder deleted. data/nav.ts deleted. STORE_MANIFEST stays.
  // tokens: Constructor's brand panel writes these — ENstat gets different colors, zero code.
}
```

---

## Dependency Graph

```
engine/expr/    @geostat/expr     — zero deps
      ↑
engine/core/  @geostat/engine   — imports @geostat/expr (evalExpr, evalDerived)
      ↑
engine/react/   @geostat/react    — imports @geostat/expr (renderNode visibleWhen)
                                      imports @geostat/engine (engine, interpretSpec)
      ↑
plugins/          national-accounts/plugins
                  — imports @geostat/react (NodeRenderer, ChromeLayout, registries, hooks)
                  — imports @geostat/engine (DataSpec types)
      ↑
app/              national-accounts/app
                  — imports @geostat/react (NodeDef types)
                  — imports @geostat/engine (DataStore, StaticDataStore, fromSDMX)
                  — imports plugins/ types (NodeTypeMap augmentation)
      ↑
src/              national-accounts/src
                  — imports all three packages + plugins/ + app/
```

---

## Rendering Pipeline

```
PageConfig (JSON / DB in Phase 2)
  → PageLoader(pageId)
      → <Suspense fallback={<PageSkeleton />}>
          <ErrorBoundary fallback={<PageError />}>
            <SiteRenderer>
                 useTheme()    → baseCtx.theme = GEOSTAT_THEME
                 useStores()   → baseCtx.stores
                 page.filterSchema
                   ? defineFilters(page.filterSchema) → useFilters(schema)
                   : useFilters({ bars: EMPTY_FILTER_BAR })
                 filtersResult.ctx.dims → baseCtx.dims
      → engine.renderNode(pageConfig, baseCtx)

renderNode(node, ctx):
  step 1. node.derive      → evalNodeDerive(NodeDeriveMap, ctx) → ctx = { ...ctx, derived }
  step 2. node.visibleWhen → evalExpr<boolean>(scope) → false → return null
  step 3. node.data        → interpretSpec(spec, ctx) → ctx.rows
  step 4. node.view        → evalViewParams(view, scope) → ctx.view (ResolvedViewParams)
  step 5. childDefs        = node.children ?? []
  step 6. rendered         = childDefs.map(c => renderNode(c, ctx))   ← recursive
  step 7. children: ChildrenArg = { defs: childDefs, rendered,
                                    renderChild: i => renderNode(childDefs[i], ctx) }
  step 8. Shell = nodeRegistry.get(node.type, node.variant ?? 'default')
             //   ↑ pure table lookup — no if/switch — variant comes from JSON config
             //   ShellOverrideProvider context checked first (scoped override wins)
             //   undefined → engine throws Error(`No renderer: ${type}/${variant}`)
          <Suspense fallback={skeletonFn(skeletonCtx)}>
            <NodeErrorBoundary>
              {Shell(node, ctx, children)}   ← NodeRenderer<T> — plain function call
            </NodeErrorBoundary>
          </Suspense>

skeletonFn resolution (three levels):
  1. ctx.theme.skeletons?.[type]            — brand override (GEOSTAT_THEME.skeletons)
  2. nodeRegistry.getMeta(type)?.skeleton   — type default (from plugins/ META + Skeleton)
  3. generic node-skeleton div              — engine fallback (always works)
```

**Skeleton is a function, NOT JSON:**
```
nodeRegistry.getMeta('section')?.skeleton   → SectionSkeleton (function)
META.skeleton                               → undefined (not in META — not JSON-serializable)
registerSlice adds { skeleton: mod.Skeleton } to the registration meta — separate from META ✅
```

---

## Chrome Flow

```
App.tsx
  ThemeProvider(GEOSTAT_THEME)
    SiteProvider({ stores, pages, nav, chrome: manifest.chrome })
      Router
        <Route path="/gdp" element={<PageLoader pageId="gdp" />} />
          SiteRenderer
            renderNode({ type: 'inner-page', id: 'gdp', ... })
              nodeRegistry.get('inner-page', 'default')  → InnerPageShell
                InnerPageShell(def, ctx, children)
                  <AppChrome>                        ← plugins/chrome/AppChrome.tsx
                    const config = useSiteChrome()   ← manifest.chrome from SiteContext
                    chromeRegistry.get('AppHeader',  config?.AppHeader  ?? 'default')
                    chromeRegistry.get('AppSidebar', config?.AppSidebar ?? 'default')
                    chromeRegistry.get('AppFooter',  config?.AppFooter  ?? 'default')
                    {Header  && <Header  />}          ← () => ReactNode, no args
                    <main>{children.rendered}</main>
                    {Footer  && <Footer  />}
```

**Chrome components — zero props rule:**
```tsx
// ✅ Correct:
function FullHeader() {
  const nav      = useSiteNav()   // from SiteContext
  const location = useLocation()  // from react-router
  return <header>...</header>
}

// ❌ Wrong — props = crash (chromeRegistry calls with no args):
function FullHeader({ nav }: { nav: NavItem[] }) { ... }
// chromeRegistry.get('AppHeader', 'default')() → no args passed → nav = undefined
```

---

## Key Rules

```
Shell dispatch    → nodeRegistry.get(type, variant ?? 'default')    NOT ctx.theme.shells
Chrome dispatch   → chromeRegistry.get(slot, key ?? 'default')      NOT useTheme().chrome
ThemeConfig       → skeletons only. shells + chrome → registries.

All register()    → src/setupRegistrations.ts only (discoverability rule)
                    NEVER scattered register() in slice files or feature files

Chrome components → () => ReactNode — ZERO PROPS
                    data from useSiteNav() / useLocation() inside component

SiteManifest.chrome  → Record<string,string>: slot → key (Constructor sets, JSON-serializable)
FilterBarNode.bars   → Record<string, BarDef>  ← JSON config input
FilterBarShellProps.bars → FilterBarSpec[]     ← runtime output from useFilters()

NodeRenderer     → plain function, NOT React component (hooks forbidden in renderer body)
                   hooks → inner component wrapper (component wrapper pattern)

view prop        → engine resolves ExprVal → ResolvedViewParams BEFORE renderer
                   shell reads ctx.view — NEVER reads def.view directly

ctx.dims['time'] ✅    ctx.year          ❌  (hardcoded dim names)
ctx.dims['geo']  ✅    ctx.regionId      ❌

data: DataSpec   ✅    getRows: fn       ❌  (function, not JSON)
bars: BarDef     ✅    bars: ReactNode[] ❌  (JSX in config)

DataStore.query()  → SYNC DataRow[] always. Async = throw Promise/Error internally.
DeriveMap          → Array<{ key, expr }> — NOT Record (explicit order)
ctx.stores         → Record<string, DataStore> — NOT ctx.store (multi-store)
NavItem[]          → independent of PageConfig (nav.ts, NOT in PageConfig.children)

Test isolation     → createNodeRegistry() + createTestRegistryProvider() — not global mutation
Scoped override    → ShellOverrideProvider — not nested ThemeProvider

JSON.parse(JSON.stringify(config)) === config  ← Phase 2 compatibility test — every decision
META functions     → ❌ (META must be JSON-serializable for Constructor DB storage)
Skeleton in META   → ❌ (Skeleton = separate named export, added by registerSlice)
```

---

## SectionControl — Generic Role Toggle

```ts
interface SectionShellProps {
  def:      SectionNode
  children: ChildrenArg    // { defs: NodeDef[], rendered: ReactNode[] }
  view:     ResolvedViewParams
}

// Config: open roles, not hardcoded 'chart'/'table':
{ type: 'section',
  children: [
    { type: 'chart', layout: { role: 'chart', label: 'გრაფიკი' } },
    { type: 'table', layout: { role: 'table', label: 'ცხრილი'  } },
    // same section with map/table roles works identically:
    // { type: 'map-view', layout: { role: 'map', label: 'რუკა' } },
  ]
}

// SectionShell — generic (never hardcodes 'chart' or 'table'):
const roles = [...new Set(children.defs.map(d => d.layout?.role).filter(Boolean))]
// no role → child always visible
// has role → visible only if role === activeRole
// toggle button label = layout.label ?? role
```

---

## Data Collaboration

### Store Resolution — interpretSpec picks from ctx.stores

```ts
interface PageConfigBase { storeKey?: string }  // page default
interface DataSpecBase   { storeId?: string; href?: string }

// Resolution order in interpretSpec:
// 1. href      → HttpDataStore ('http' built-in store)
// 2. storeId   → ctx.stores[storeId]
// 3. (omitted) → ctx.stores[pageStoreKey] ?? ctx.stores['default']
```

### Data Inheritance Tree

```
node has data?   → interpretSpec → ctx.rows for this subtree
node has no data → inherits parent ctx.rows

InnerPageNode (storeKey: 'gdp')
  └─ SectionNode (data: timeseries → own ctx.rows)
       ├─ ChartNode  (no data → inherits ctx.rows from SectionNode)
       └─ TableNode  (data: pivot → own ctx.rows, overrides for this subtree only)
```

### Concrete Scenarios

```ts
// ① Section → Chart + Table, same data (most common):
{ type: 'section',
  data: { type: 'timeseries', indicator: 'B1G' },
  children: [
    { type: 'chart', layout: { role: 'chart' } },   // inherits ctx.rows
    { type: 'table', layout: { role: 'table' } },   // inherits ctx.rows
  ]
}

// ② Chart and Table need different data:
{ type: 'section',
  children: [
    { type: 'chart', data: { type: 'timeseries', indicator: 'B1G' } },
    { type: 'table', data: { type: 'pivot',      indicator: 'B1G' } },
  ]
}

// ③ KPI strip — own data (type:'row-list'):
{ type: 'kpi-strip',
  data: { type: 'row-list', indicators: ['B1G', 'P3', 'P51G'] },
  // interpretSpec → 3 rows → KpiStripShell iterates ctx.rows → 3 KpiCards
}

// ④ Cascade filter — options also a DataSpec:
{ type: 'filter-bar',
  bars: {
    main: {
      position: 'sticky',
      filters: {
        region: {
          type:         'cascade',
          storeId:      'geo-store',
          optionsQuery: { type: 'query', indicator: 'GEO_LIST' },
        }
      }
    }
  }
}

// ⑤ Filter → data injection ($ctx references):
{ type: 'timeseries',
  indicator: 'B1G',
  dims: { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } }
  // interpretSpec resolves $ctx → ctx.dims['geo'], ctx.dims['time']
  // filter changes → ctx.dims changes → interpretSpec re-runs → new rows → re-render
}

// ⑥ Direct URL — no store needed:
{ type: 'url',
  href:       '/api/regional/2024.json',
  transform?: 'fromSDMX'   // registered via engine.registerTransform()
}
```

### NodeRenderer — hooks rule (component wrapper pattern)

```ts
// ✅ Pattern: renderer = plain fn, inner component = React component
function ChartShell(def: ChartNode, ctx: RenderContext, _children: ChildrenArg) {
  return <ChartControl def={def} ctx={ctx} />  // inner component owns hooks
}
function ChartControl({ def, ctx }: { def: ChartNode; ctx: RenderContext }) {
  const output = useMemo(
    () => interpretChart(def.def, ctx.rows, ctx),
    [def.def, ctx.rows]
  )
  return <ReactApexChart options={toApexOptions(output)} />
}

// ❌ Wrong — hooks in renderer body:
function ChartShell(def, ctx, _children) {
  const output = useMemo(...) // ← React hook in plain function call = crash
  return <ReactApexChart ... />
}
```

---

## Phase 2 Swap Points — zero config change

```ts
// 1. Site manifest — only line that changes:
//    src/manifest.ts Phase 1: return { stores: STORE_MANIFEST, pages: pagesRecord(), nav: NAV }
//    src/manifest.ts Phase 2: return fetch('/api/site').then(r => r.json())
//    pages/ folder: deleted entirely. data/nav.ts: deleted.

// 2. Store swap (per dataset — zero config change):
//    Phase 1: export const gdpStore = new StaticDataStore(GDP_ADAPTED)
//    Phase 2: export const gdpStore = new HttpDataStore('/api/datasets/gdp', fromSDMX)
//    engine sees same DataStore interface. DataSpec unchanged.

// 3. Chrome config — Constructor writes, zero code change:
//    manifest.chrome.AppHeader = 'minimal'
//    → chromeRegistry.get('AppHeader', 'minimal') → MinimalHeader
//    → no code change, no deploy

// 4. PageConfig — Constructor generates, zero code change:
//    Constructor builds NodeDef JSON → saves to DB → fetchSiteManifest() returns it
//    <PageLoader pageId="gdp" /> — unchanged

// 5. Brand tokens — Constructor writes, zero code change:
//    manifest.tokens['--color-primary'] = '#C8102E'   → applyTokens() → CSS :root updated
//    All components reading var(--color-primary) immediately see new value ✅

// Phase 2 compatibility test (every decision):
JSON.parse(JSON.stringify(value))
// ✅ { type: 'section', data: { type: 'timeseries' } }  — NodeDef, JSON
// ✅ { type: 'year-select', defaultValue: 2024 }         — ParamDef, JSON
// ✅ Array<{ key, expr: ExprVal }>                       — DeriveMap, JSON
// ✅ { AppHeader: 'minimal', AppSidebar: 'hidden' }      — SiteManifest.chrome, JSON
// ✅ { '--color-primary': '#005A9C' }                    — SiteManifest.tokens, JSON
// ❌ (ctx) => ctx.rows.filter(...)                       — function, NOT JSON
// ❌ <MyComponent />                                     — JSX, NOT JSON
// ❌ new StaticDataStore(data)                           — class instance, NOT JSON
```

---

## Multi-Site — same plugins/, different manifests

> New site = new manifest + new tokens. **Zero new code.**
> plugins/ is a generic library. Any statistical agency uses it as-is.

```
Same plugins/ (deployed once):
  nodes/ · chrome/ · controls/ · landing/   ← shared by all sites

Different manifests (per site, from Constructor):
  Geostat manifest: { pages: {...}, nav: [...], chrome: {...}, tokens: { '--color-primary': '#005A9C' } }
  ENstat manifest:  { pages: {...}, nav: [...], chrome: {...}, tokens: { '--color-primary': '#003F87' } }
  ArmStat manifest: { pages: {...}, nav: [...], chrome: {...}, tokens: { '--color-primary': '#CC0000' } }
```

```ts
// src/manifest.ts — the only org-specific code (one file per deployment):
export async function fetchSiteManifest() {
  return fetch('/api/site').then(r => r.json())
  // Constructor for Geostat → /api/site returns Geostat manifest
  // Constructor for ENstat  → /api/site returns ENstat manifest (different DB row)
  // Same plugins/, same src/main.tsx, same everything. Different DB record.
}
```

**Why brand-in-code violates this:**
```
// ❌ Wrong — org name in shell:
// plugins/nodes/section/SectionShell.tsx
<section className="geostat-section">  ← hardcoded org name

// ✅ Right — token consumption:
<section className="section">
// .section { border-left: 3px solid var(--color-primary); }  ← CSS token
// manifest.tokens['--color-primary'] = whatever Constructor set → automatic
```

**What Constructor's brand panel writes:**
```ts
// Constructor UI: "Brand" tab → color pickers, font selector, spacing
// Writes to DB: UPDATE site_manifests SET tokens = '{"--color-primary":"#C8102E",...}'
// On next page load: fetchSiteManifest() → applyTokens(tokens) → CSS :root updated
// Zero code change. Zero deploy. ✅
```

---

## Step-by-Step Guides

### Add a new node type (e.g. 'map-view')

```
Step 1: Create plugins/nodes/map-view/
  GeostatMapViewShell.tsx      — NodeRenderer<MapViewNode>
  GeostatMapViewSkeleton.tsx   — optional skeleton
  GeostatMapViewShell.css
  index.ts

Step 2: Write plugins/nodes/map-view/index.ts:
  import { GeostatMapViewShell    } from './GeostatMapViewShell'
  import { GeostatMapViewSkeleton } from './GeostatMapViewSkeleton'
  export { GeostatMapViewShell    as Shell    }
  export { GeostatMapViewSkeleton as Skeleton }
  export const META: NodeSliceMeta = {
    type: 'map-view', variant: 'default',
    label: 'რუკა', icon: 'map', category: 'geo',
    schema: { ... }, preview: '/previews/map-view.png',
  }

Step 3: Add ONE LINE to plugins/nodes/index.ts:
  export * as mapView from './map-view'

Step 4 (if new type): Module augmentation in appropriate types.ts:
  declare module '@geostat/react' {
    interface NodeTypeMap { 'map-view': MapViewNode }
  }

Done:
  setupRegistrations.ts:    unchanged ✅
  nodeRegistry.list():      includes { type:'map-view', ... } ✅
  Constructor palette:      auto-updated ✅
  tsc --noEmit:             validates NodeRenderer<MapViewNode> ✅
  JSON.parse(JSON.stringify(META)) === META: ✅
```

### Add a new chrome variant (e.g. AppHeader 'print')

```
Step 1: Create plugins/chrome/AppHeader/print/
  GeostatPrintHeader.tsx    — () => ReactNode (no props!)
  index.ts:
    import { GeostatPrintHeader } from './GeostatPrintHeader'
    export { GeostatPrintHeader as Shell }
    export const META: ChromeSliceMeta = {
      slot: 'AppHeader', key: 'print',
      label: 'ბეჭდვა', preview: '/previews/header-print.png',
    }

Step 2: Add ONE LINE to plugins/chrome/index.ts:
  export * as appHeaderPrint from './AppHeader/print'

Step 3: Constructor sets manifest.chrome.AppHeader = 'print'
  → ShellOverrideProvider wraps print view with { AppHeader: 'print' }
  → chromeRegistry.get('AppHeader', 'print') → GeostatPrintHeader

Done: AppChrome.tsx unchanged ✅  setupRegistrations.ts unchanged ✅
```

### Add a layout node variant (e.g. 'stack' with 'masonry' variant)

```
Step 1: Create plugins/nodes/layout/masonry/
  MasonryShell.tsx    — NodeRenderer<ColumnsNode> (same type, different layout)
  index.ts:
    import { MasonryShell } from './MasonryShell'
    export { MasonryShell as Shell }
    export const META: NodeSliceMeta = {
      type: 'columns', variant: 'masonry',   ← same type, new variant
      label: 'მეზონრი', icon: 'layout-masonry', category: 'layout',
      schema: { type: 'object', properties: { count: { type: 'number' } } },
    }

Step 2: Add ONE LINE to plugins/nodes/layout/index.ts:
  export * as masonry from './masonry'

Step 3: Constructor picks variant='masonry' in palette:
  { type: 'columns', variant: 'masonry', count: 3, children: [...] }

Done: setupRegistrations.ts unchanged ✅  GridShell unchanged ✅
```

### Add a new data source

```
Step 1: Create data/trade/
  trade.adapter.ts   — fromSDMX(raw): Observation[] → DataRow[]
  trade.store.ts     — export const tradeStore = new StaticDataStore(TRADE_ADAPTED)

Step 2: Add to data/index.ts:
  import { tradeStore } from './trade/trade.store'
  export const STORE_MANIFEST = {
    ...existing,
    'trade': tradeStore,
  }

Step 3: Use in page config (Mode A):
  { type: 'inner-page', id: 'trade', storeKey: 'trade', children: [...] }

Done: plugins/ unchanged ✅  setupRegistrations.ts unchanged ✅
```

### Add a Track B feature page

```
Step 1: Create features/regional-comparison/
  index.ts                         — export { RegionalComparisonPage }
  RegionalComparisonPage.tsx       — thin: wires hooks → components
  api/useComparisonData.ts         — useStores() + interpretSpec()
  hooks/useComparisonFilters.ts    — defineFilters + useFilters
  components/ComparisonChart.tsx
  types/comparison.types.ts

Step 2: Add route to src/routes.tsx:
  <Route path="/regional-comparison" element={<RegionalComparisonPage />} />

Step 3: Add to data/nav.ts (optional):
  { key: 'comparison', href: '/regional-comparison', label: 'შედარება' }

Done: plugins/ unchanged ✅  pages/ unchanged ✅
      Constructor cannot edit this page — developer owns it entirely ✅
```

---

## Anti-Patterns

```ts
// ❌ hooks in NodeRenderer body:
function SectionShell(def, ctx, children) {
  const [open, setOpen] = useState(true)  // ← crash: renderer is a plain function call
}
// ✅ hooks in inner component:
function SectionShell(def, ctx, children) {
  return <SectionControl def={def} ctx={ctx} children={children} />
}
function SectionControl({ def, ctx, children }) {
  const [open, setOpen] = useState(true)  // ✅ React component, hooks valid
}

// ❌ functions/JSX in config:
{ type: 'section', render: (ctx) => <div>{ctx.rows.length}</div> }
// ✅ logic in renderer, data in DataSpec:
{ type: 'section', data: { type: 'row-list', indicators: ['B1G'] } }

// ❌ hardcoded dim names:
const year = ctx.year      // ← doesn't exist
const geo  = ctx.regionId  // ← doesn't exist
// ✅ open dim names:
const year = ctx.dims['time'] as number
const geo  = ctx.dims['geo']  as string

// ❌ import.meta.glob for slice discovery:
const mods = import.meta.glob<RegistrableSlice>('../nodes/**/index.ts', { eager: true })
// type assertion, not check — missing Shell → runtime crash, not compile error
// ✅ barrel: export * as section from './section'  — tsc validates at compile time

// ❌ register() in slice file (side-effect on import):
// plugins/nodes/section/SectionShell.tsx:
nodeRegistry.register('section', 'default', SectionShell)
// ✅ ALL register() calls via src/setupRegistrations.ts → registerSlice()

// ❌ closed union where open needed:
type ChromeVariant = 'default' | 'minimal'  // Constructor cannot add new variants
// ✅ open string: key: string  in ChromeSliceMeta

// ❌ chrome component with props:
function FullHeader({ nav }: { nav: NavItem[] }) { ... }
// chromeRegistry.get(slot, key)() → no args → crash
// ✅ zero props: function FullHeader() { const nav = useSiteNav(); ... }

// ❌ app content in packages/:
// engine/react/src/engine/types.ts:
interface NodeTypeMap { 'landing-hero': LandingHeroNode }  // ← Geostat content in platform!
// ✅ module augmentation in plugins/landing/types.ts — packages/ zero change

// ❌ FilterBarNode.bars as FilterBarSpec[]:
{ type: 'filter-bar', bars: [{ barId: 'main', ... }] }  // runtime object — NOT JSON config
// ✅ FilterBarNode.bars as Record<string, BarDef>:
{ type: 'filter-bar', bars: { main: { position: 'sticky', filters: { ... } } } }

// ❌ def.view in renderer:
function SectionShell(def, ctx, children) {
  const subtitle = evalExpr(def.view?.subtitle, ctx.scope)  // engine already did this!
}
// ✅ ctx.view (engine resolved at step 4):
function SectionShell(def, ctx, children) {
  const subtitle = ctx.view?.subtitle  // already a string | undefined
}

// ❌ Hardcoded colors in layout shell:
function GridShell(...) {
  return <div style={{ background: '#005A9C' }}>  // ← org color in layout shell
}
// ✅ CSS tokens only:
function GridShell(...) {
  return <div style={{ gap: 'var(--spacing-md)' }}>  // ← token consumer ✅

// ❌ IA order enforced in platform:
// engine/react/src/engine/renderNode.ts:
if (node.type === 'filter-bar') order = 0  // ← platform dictates IA order
// ✅ IA order = JSON children order. Constructor templates enforce convention.
//    Platform renders in whatever order JSON specifies.

// ❌ Layout in page shell instead of layout node:
function InnerPageShell(def, ctx, children) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr' }}>  // ← fixed layout!
      {children.rendered}
    </div>
  )
}
// ✅ Layout = layout node in tree. InnerPageShell renders children in flow.
//    Constructor adds <grid> node when 2-column needed.

// ❌ Skeleton function in META:
export const META: NodeSliceMeta = {
  type: 'section',
  skeleton: (ctx) => <Skeleton />  // function — NOT JSON-serializable
}
// ✅ Skeleton as separate named export:
export { SectionSkeleton as Skeleton }  // registerSlice adds to registration
export const META: NodeSliceMeta = { type: 'section', ... }  // pure JSON ✅
```