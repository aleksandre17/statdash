# Migration — Blockers (Full Designs)

> Source of truth for BLOCKER 1–4 implementation specs.
> Status: BLOCKER 1 ✅ DONE · BLOCKER 2 ✅ DONE · BLOCKER 3 designed · BLOCKER 4 designed

---

## BLOCKER 1 — DataStore query() unification ✅ DONE 2026-05-16

**Files changed:**
- `engine/core/src/data/store.ts` — StoreQuery, StoreCaps, DataStore.query(), storeVal/storeObs/runBatch
- `engine/core/src/data/index.ts` + `engine/core/src/index.ts` — exports
- `engine/core/src/registry/resolvers.ts` — store.val → storeVal, store.observe → storeObs
- `engine/core/src/data/kpi.ts` — store.val → storeVal
- `engine/core/src/data/resolve.ts` — store.observe → storeObs

**StoreQuery — discriminated union (open for extension):**
```ts
export type StoreQuery =
  | { type: 'val';      code: string }
  | { type: 'obs';      measure: string | string[]
                        filter?:  Partial<Record<string, FilterValue>>
                        orderBy?: { field: string; dir: 'asc' | 'desc' } }
  | { type: 'schema'  }                          // Constructor palette: available indicators
  | { type: 'distinct'; dim: string              // filter dropdown unique values
                        filter?: Partial<Record<string, FilterValue>> }
// Extension: type:'sql'|'graphql' = new discriminant → interface unchanged
```

**StoreCaps:**
```ts
export interface StoreCaps {
  queryTypes: ReadonlyArray<StoreQuery['type']>
  batching:   boolean
  streaming:  boolean
}
```

**DataStore — unified interface:**
```ts
export interface DataStore {
  query(q: StoreQuery, ctx: SectionContext): EngineRow[]
  batchQuery?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]
  readonly caps?:        StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?:     Record<string, DisplayMap>
}
```

**Helpers (NOT on interface):**
```ts
storeVal(store, code, ctx): number
storeObs(store, q, ctx): Observation[]
runBatch(store, queries, ctx): EngineRow[][]
```

**Concrete caps:**
```ts
ExternalStore.caps = { queryTypes: ['val','obs','schema','distinct'], batching: false, streaming: false }
ApiStore.caps      = { queryTypes: ['val','obs'],                     batching: true,  streaming: false }
CachedStore.caps   = { ...source.caps, batching: false }
staticStore.caps   = { queryTypes: [],                               batching: false, streaming: false }
```

---

## BLOCKER 2 — RenderContext.store → stores + pageStoreKey ✅ DONE 2026-05-16

**Files changed:**
- `engine/react/src/engine/types.ts` — `store` → `stores + pageStoreKey`
- `engine/react/src/context/SiteContext.tsx` — `useStores()` hook
- `engine/react/src/engine/SiteRenderer.tsx` — `useStores()`, updated baseRenderCtx
- `engine/react/src/engine/RenderEngine.ts` — `resolveStore()` exported util
- `engine/react/src/engine/LandingPageRenderer.tsx` — LANDING_STORE updated
- `engine/react/src/engine/renderers/KpiStripRenderer.tsx` — resolveStore(ctx)
- `engine/react/src/index.ts` — exports useStores

**resolveStore():**
```ts
export function resolveStore(ctx: Pick<RenderContext, 'stores' | 'pageStoreKey'>): DataStore {
  const key = ctx.pageStoreKey ?? 'default'
  return ctx.stores[key] ?? ctx.stores[Object.keys(ctx.stores)[0]] ?? staticStore
}
```

---

## BLOCKER 3 — FilterBarNode schema ownership

**Problem (ISP violation):** FilterBarNode owns filter schema — display node owns state config.

**Current state (wrong):**
```ts
export interface FilterBarNode {
  type:     'filter-bar'
  bars:     BarNode[]
  context?: ContextMapping
  effects?: Effect[]
}
.register('filter-bar', FilterBarRenderer, { children: ['bars'] as const })
const { ctx, raw, timeModeKey, effects } = useFilterState(page.filterBar ?? EMPTY_FILTER_BAR)
```

**Target state (canonical):**
```ts
// engine/core/src/config/filter.ts
export interface BarDef {
  position: 'sticky' | 'float'
  order?:   number
  label?:   LocaleString
  filters:  Record<string, ParamDef>
}
export interface FilterSchemaInput {
  bars:           Record<string, BarDef>
  context?:       ContextMapping
  effects?:       Effect[]
  crossValidate?: CrossValidator[]
}

// FilterBarNode — display-only
export interface FilterBarNode {
  type:    'filter-bar'
  barIds?: string[]
}

// PageConfig
export interface PageConfig {
  filterSchema?: FilterSchemaInput   // schema at page level
  filterBar?:    FilterBarNode        // display placeholder only
}
```

**useFilterState:**
```ts
export function useFilterState(schema: FilterSchemaInput | null | undefined): FilterState {
  // flatParams = Object.values(schema?.bars ?? {}).flatMap(b => Object.entries(b.filters))
}
```

**FilterBarRenderer — display-only:**
```tsx
export function FilterBarRenderer(def: FilterBarNode, _ctx: RenderContext, _children: ReactNode): ReactNode {
  return <FilterBarControl barIds={def.barIds} />
}
function FilterBarControl({ barIds }: { barIds?: string[] }) {
  const { bars } = useFilters()   // reads from page-level FilterProvider
  const visible  = barIds ? bars.filter(b => barIds.includes(b.barId)) : bars
  return (
    <div className="filter-bar-host">
      {visible.map(bar => (
        <div key={bar.barId} className={`filter-bar filter-bar--${bar.position}`}>
          {bar.filters.map(filter => {
            const slice = filterControlRegistry.get(filter.paramDef.type)
            if (!slice) return null
            return <slice.Shell key={filter.key} filterKey={filter.key} config={filter.paramDef} />
          })}
        </div>
      ))}
    </div>
  )
}
```

**register-all.ts:**
```ts
// BEFORE: .register('filter-bar', FilterBarRenderer, { children: ['bars'] as const })
// AFTER:
.register('filter-bar', FilterBarRenderer)   // no children manifest
```

**Page config migration pattern:**
```ts
// BEFORE:
filterBar: {
  type: 'filter-bar',
  bars: [{ type: 'bar', id: 'main', position: 'sticky', items: [
    { key: 'time', type: 'year-select', default: '2023' },
    { key: 'geo',  type: 'cascade' },
  ]}],
  context: { timeMode: 'mode', dims: { time: 'time', geo: 'geo' } },
  effects: [...],
}

// AFTER:
filterSchema: {
  bars: {
    main: { position: 'sticky', order: 1, filters: {
      time: { type: 'year-select', defaultValue: 2023 },
      geo:  { type: 'cascade' },
    }},
  },
  context: { timeMode: 'mode', dims: { time: 'time', geo: 'geo' } },
  effects: [...],
},
filterBar: { type: 'filter-bar' },
```

**Files:**
- `engine/core/src/config/filter.ts` — add BarDef, FilterSchemaInput; FilterBarNode → display-only
- `engine/core/src/data/index.ts` + `engine/index.ts` — export new types
- `engine/react/src/engine/types.ts` — PageConfig.filterSchema
- `engine/react/src/engine/register-all.ts` — remove children: ['bars']
- `engine/react/src/engine/SiteRenderer.tsx` — useFilterState(page.filterSchema ?? null)
- `engine/react/src/filters/useFilterState.ts` — FilterSchemaInput | null
- `engine/react/src/engine/renderers/FilterBarRenderer.tsx` — display-only
- `src/features/accounts/accounts.page.ts` + `gdp.page.ts` + `regional.page.ts`

---

## BLOCKER 4 — SectionNode children[]

**Problem:** SectionNode has named fields chart?/table?/tabs?. renderNode() reads `.children ?? []` → empty.

**Current state (wrong):**
```ts
export interface SectionNode {
  chart?: ChartNode
  table?: TableNode
  tabs?:  TabsNode
}
.register('section', SectionRenderer, { children: ['chart', 'table', 'tabs'] as const })
```

**Target state:**
```ts
export interface SectionNode extends NodeBase {
  type:          'section'
  id:            string
  title:         LocaleString
  label?:        LocaleString
  anchor?:       string
  color?:        string
  data?:         DataSpec
  view?:         ViewParams
  prependLabel?: LocaleString
  children:      NodeDef[]
}

export interface TabNode {
  type:     'tab'
  key:      string
  label?:   LocaleString
  data?:    DataSpec
  view?:    ViewParams
  children: NodeDef[]
}

export interface GeorgraphNode {
  children?: NodeDef[]   // was: table?: TableNode
}
```

**register-all.ts:**
```ts
// BEFORE:
.register('section',   SectionRenderer,  { children: ['chart', 'table', 'tabs'] as const })
.register('tab',       TabRenderer,      { children: ['chart', 'table']          as const })
.register('georgraph', GeorgraphRenderer,{ children: ['table']                  as const })

// AFTER:
.register('section',   SectionRenderer,   { children: ['children'] as const })
.register('tab',       TabRenderer,       { children: ['children'] as const })
.register('georgraph', GeorgraphRenderer, { children: ['children'] as const })
```

**Page config migration:**
```ts
// BEFORE:
{ type: 'section', title: 'მშპ', data: {...},
  chart: { type: 'chart', chartType: 'line' },
  table: { type: 'table', columns: [...] } }

// AFTER:
{ type: 'section', title: { ka: 'მშპ', en: 'GDP' }, data: {...},
  children: [
    { type: 'chart', chartType: 'line' },
    { type: 'table', columns: [...] },
  ] }
```

**Files:**
- `engine/react/src/engine/types.ts` — SectionNode/TabNode/GeorgraphNode children[]
- `engine/react/src/engine/register-all.ts` — manifest ['children']
- `engine/react/src/engine/renderers/SectionRenderer.tsx` — verify toggle index (unchanged)
- `engine/react/src/engine/renderers/TabRenderer.tsx` — verify toggle index (unchanged)
- All page configs: accounts, gdp, regional