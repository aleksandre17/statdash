# filter-bar-page.tsx

> Reference example (TypeScript) — documentation, not compiled source.

```tsx
/**
 * Example — FilterBar + Chrome Architecture
 *
 * Two canonical decisions documented here:
 *
 * Decision 1 — AppChrome: app-level, not per-route
 *   Platform:  Grafana (GrafanaApp shell), VS Code (activity bar), GitHub (navbar)
 *   Rule:      Chrome never remounts. Sits outside <Routes>, inside <BrowserRouter>.
 *
 * Decision 2 — Filter state: page-level (filterSchema), not node-level (FilterBarNode.bars)
 *   Platform:  Grafana (templating.list), React Hook Form (FormProvider), Retool (global variables)
 *   Rule:      filterSchema = source of truth. FilterBarNode = display placeholder only.
 *              ctx.dims feeds ALL data queries on the page. One FilterProvider, one source.
 */

import type {
  InnerPageNode, PageConfigBase, FilterBarNode,
  RenderContext, NodeRenderer, ChildrenArg,
  FilterBarSpec, DataRow,
} from '@geostat/react'
import { useFilters, useTheme, useStores, usePageById, filterControlRegistry } from '@geostat/react'
import { defineFilters, renderNode } from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// ❌ DEPRECATED PATTERN — FilterBarNode owns the schema
// ═══════════════════════════════════════════════════════════════════════════

// ❌ FilterBarNode with bars = schema + display config mixed together
const DEPRECATED_GDP_PAGE = {
  id: 'gdp', type: 'inner-page',
  children: [
    {
      type: 'filter-bar',
      bars: {                        // ← schema inside node
        main: { position: 'sticky', order: 1, filters: {
          time: { type: 'year-select', defaultValue: 2023 },
          geo:  { type: 'cascade',    options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' } },
        }},
      },
    },
    { type: 'kpi-strip', data: { type: 'row-list', indicators: ['B1G'] } },
  ],
}

// ❌ FilterBarShell created its own filter context — DISCONNECTED from ctx.dims
// function FilterBarControl_DEPRECATED({ def, ctx }) {
//   const { bars } = useFilters({ bars: def.bars, effects: def.effects })
//   //                           ↑ second context → ctx.dims sees stale dims → sections broken
// }

// ❌ AppChrome per-route — remounts on every navigation
// function PageLoader_DEPRECATED({ pageId }) {
//   return (
//     <AppChrome>                    ← remounts on nav → flash, animation loss
//       <SiteRenderer def={page} />
//     </AppChrome>
//   )
// }


// ═══════════════════════════════════════════════════════════════════════════
// ✅ CANONICAL PATTERN — filterSchema at page level, FilterBarNode display-only
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Page config: filterSchema = source of truth (Grafana: templating.list)
export const GDP_PAGE: InnerPageNode & PageConfigBase = {
  id:       'gdp',
  type:     'inner-page',
  title:    'მთლიანი შიდა პროდუქტი',
  path:     '/gdp',
  storeKey: 'gdp',

  // filterSchema — owned by PAGE, not by FilterBarNode
  // SiteRenderer reads this → defineFilters → useFilters → FilterProvider → ctx.dims
  // ALL children (KpiStrip, Section, Chart, Table) see the same dims. One source. ✅
  filterSchema: {
    bars: {
      main: {
        position: 'sticky',
        order:    1,
        filters: {
          time: { type: 'year-select', defaultValue: { from: 'options', pick: 'last' } },
          geo:  { type: 'cascade', options: { type: 'query', data: { type: 'query', indicator: 'GEO_LIST' }, valueField: 'code', labelField: 'label' }, defaultValue: 'ka' },
        },
      },
    },
  },

  children: [
    // ✅ FilterBarNode = display placeholder only. barIds absent → renders all bars from filterSchema.
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 } },

    { type: 'kpi-strip', layout: { position: 'flow', order: 2, span: 'full' },
      data: { type: 'row-list', indicators: ['B1G', 'P3', 'P51G'] },
      // ctx.dims.time and ctx.dims.geo available here ✅ (same FilterProvider)
    },
    { type: 'section', id: 'gdp-main', title: 'მშპ',
      layout: { position: 'flow', order: 3, span: 'full' },
      data: { type: 'timeseries', indicator: 'B1G', dims: { time: { $ctx: 'time' }, geo: { $ctx: 'geo' } } },
      children: [
        { type: 'chart', layout: { role: 'chart' } },
        { type: 'table', layout: { role: 'table' } },
      ],
    },
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// Split bars across two FilterBarNodes (year-bar sticky, range-bar floating)
// ═══════════════════════════════════════════════════════════════════════════

// Page with TWO bars, each FilterBarNode renders a subset via barIds
export const ACCOUNTS_PAGE: InnerPageNode & PageConfigBase = {
  id:   'accounts',
  type: 'inner-page',
  title: 'ეროვნული ანგარიშები',
  path:  '/accounts',

  filterSchema: {
    bars: {
      'year-bar': {
        position: 'sticky',
        order:    1,
        filters: {
          account: { type: 'select', options: { type: 'static', items: [] }, defaultValue: 'B1G' },
          year:    { type: 'year-select', defaultValue: 2023 },
          prices:  { type: 'select', options: { type: 'static', items: [] }, defaultValue: 'current' },
        },
      },
      'range-bar': {
        position: 'float',
        order:    2,
        filters: {
          fromYear: { type: 'year-select', defaultValue: { op: 'subtract', left: { $ctx: 'year' }, right: 4 } },
          toYear:   { type: 'year-select', defaultValue: { $ctx: 'year' } },
        },
      },
    },
    effects: [
      { when: { op: 'eq', left: { $ctx: 'prices' }, right: 'current' },
        set:  { priceBase: { $ctx: 'year' } } },
    ],
  },

  children: [
    // ✅ barIds: ['year-bar'] → renders only the year bar here (sticky)
    { type: 'filter-bar', layout: { position: 'sticky-top', order: 1 }, barIds: ['year-bar'] },

    { type: 'kpi-strip', layout: { position: 'flow', order: 2, span: 'full' },
      data: { type: 'row-list', indicators: ['B1G'] },
    },

    // ✅ barIds: ['range-bar'] → renders only the range bar here (floating near chart)
    { type: 'filter-bar', layout: { position: 'flow', order: 3 }, barIds: ['range-bar'] },

    { type: 'section', id: 'accounts-ts',
      data: { type: 'timeseries', indicator: 'B1G',
              dims: { time: { $ctx: 'year' }, fromYear: { $ctx: 'fromYear' }, toYear: { $ctx: 'toYear' } } },
      children: [{ type: 'chart', layout: { role: 'chart' } }, { type: 'table', layout: { role: 'table' } }],
    },
  ],
}
// Both FilterBarNodes read from the SAME FilterProvider → all dims shared → all queries see same state ✅
// No duplicate schema. No second context. One source of truth. ✅


// ═══════════════════════════════════════════════════════════════════════════
// FilterBarShell — display-only (reads from FilterProvider, no schema ownership)
// ═══════════════════════════════════════════════════════════════════════════

export const FilterBarShell: NodeRenderer<FilterBarNode> =
  (def, _ctx, _children) => <FilterBarControl barIds={def.barIds} />

function FilterBarControl({ barIds }: { barIds?: string[] }) {
  // ✅ no args → reads from page-level FilterProvider (set up by SiteRenderer)
  // FilterBarShell does NOT own filter state. It DISPLAYS it.
  const { bars } = useFilters()
  const visible  = barIds ? bars.filter((b: FilterBarSpec) => barIds.includes(b.barId)) : bars

  return (
    <div className="filter-bar-host">
      {visible.map((bar: FilterBarSpec) => (
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

// ─── Shell is fully replaceable — zero data coupling, pure display ───────────
//
// Data contract: useFilters() (no args) always returns the same bars from FilterProvider.
// Display contract: shell decides layout, animation, HTML structure — anything.
// The two contracts are independent. Changing shell never touches filter state.


// ═══════════════════════════════════════════════════════════════════════════
// Level 1 — Global default replacement (all filter-bar nodes on the site)
// ═══════════════════════════════════════════════════════════════════════════

// plugins/nodes/filter-bar/index.ts (setupRegistrations.ts calls registerSlice on this)
// Replace the entire layout and UX — FloatingPanel instead of sticky row:
export function GeostatFilterBarShell(def: FilterBarNode, _ctx: any, _children: ChildrenArg) {
  return <FilterBarDisplay barIds={def.barIds} />
}

function FilterBarDisplay({ barIds }: { barIds?: string[] }) {
  const { bars } = useFilters()   // reads from FilterProvider — always same data
  const visible  = barIds ? bars.filter((b: FilterBarSpec) => barIds.includes(b.barId)) : bars

  return (
    <div className="geostat-filter-bar">
      {visible.map((bar: FilterBarSpec) => (
        <div key={bar.barId} className={`geostat-bar geostat-bar--${bar.position}`}>
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

// Registration — replaces default for all filter-bar nodes on the site:
// nodeRegistry.register('filter-bar', 'default', GeostatFilterBarShell)


// ═══════════════════════════════════════════════════════════════════════════
// Level 2 — Variant (some pages use a different shell via FilterBarNode.variant)
// ═══════════════════════════════════════════════════════════════════════════

// plugins/nodes/filter-bar/floating/index.ts
// Floating panel layout — for pages where filter bar opens on demand:
export function FloatingFilterBarShell(def: FilterBarNode, _ctx: any, _children: ChildrenArg) {
  return <FloatingBarDisplay barIds={def.barIds} />
}

function FloatingBarDisplay({ barIds }: { barIds?: string[] }) {
  const { bars } = useFilters()   // same data from same FilterProvider ✅
  const visible  = barIds ? bars.filter((b: FilterBarSpec) => barIds.includes(b.barId)) : bars
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="filter-toggle" onClick={() => setOpen(o => !o)}>
        ფილტრები
      </button>
      {open && (
        <div className="filter-panel filter-panel--floating">
          {visible.map((bar: FilterBarSpec) => (
            <div key={bar.barId} className="filter-group">
              {bar.filters.map(filter => {
                const slice = filterControlRegistry.get(filter.paramDef.type)
                return slice ? <slice.Shell key={filter.key} filterKey={filter.key} config={filter.paramDef} /> : null
              })}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// Registration — separate variant, not replacing default:
// nodeRegistry.register('filter-bar', 'floating', FloatingFilterBarShell)
//
// Usage in page config — FilterBarNode opts into this shell via variant:
// { type: 'filter-bar', variant: 'floating', layout: { position: 'flow', order: 1 } }
// Nodes WITHOUT variant: 'floating' still use the default shell. ✅


// ═══════════════════════════════════════════════════════════════════════════
// Level 3 — Per-page scoped override (no global registry mutation)
// ═══════════════════════════════════════════════════════════════════════════

// ShellOverrideProvider wraps a subtree — only that subtree uses the override.
// Other pages, other routes: unaffected. ✅

function RegionalPageWithPrintLayout() {
  return (
    <ShellOverrideProvider shells={{ 'filter-bar/default': CompactFilterBarShell }}>
      <PageLoader pageId="regional" />
    </ShellOverrideProvider>
    // ↑ only regional page uses CompactFilterBarShell
    // all other pages: still use GeostatFilterBarShell (level 1 default) ✅
  )
}

// CompactFilterBarShell — inline layout, all controls in one row:
function CompactFilterBarShell(def: FilterBarNode, _ctx: any, _children: ChildrenArg) {
  return <CompactBarDisplay barIds={def.barIds} />
}

function CompactBarDisplay({ barIds }: { barIds?: string[] }) {
  const { bars } = useFilters()   // same FilterProvider ✅
  const visible  = barIds ? bars.filter((b: FilterBarSpec) => barIds.includes(b.barId)) : bars
  return (
    <div className="filter-bar-compact">
      {visible.flatMap((bar: FilterBarSpec) =>
        bar.filters.map(filter => {
          const slice = filterControlRegistry.get(filter.paramDef.type)
          return slice ? <slice.Shell key={filter.key} filterKey={filter.key} config={filter.paramDef} /> : null
        })
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Level 4 — Individual control replacement (year-select → year chips)
// ═══════════════════════════════════════════════════════════════════════════

// FilterBarShell stays the same. Only the year-select control changes.
// filterControlRegistry.register() replaces one control type globally:

// plugins/controls/year-chips/index.ts
export function YearChipsShell({ filterKey, config }: { filterKey: string; config: any }) {
  const { value, set } = useFilter<number>(filterKey)
  const years: number[] = config.range
    ? Array.from({ length: config.range[1] - config.range[0] + 1 }, (_, i) => config.range[0] + i)
    : []

  return (
    <div className="year-chips" role="group">
      {years.map(y => (
        <button
          key={y}
          className={`chip${value === y ? ' chip--active' : ''}`}
          onClick={() => set(y)}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

// Registration — replaces year-select control everywhere on the site:
// filterControlRegistry.register({
//   META: { sliceType: 'control', controlType: 'year-select', label: 'Year Chips' },
//   Shell:        YearChipsShell,
//   defaultValue: null,
//   codec:        yearCodec,
// })
//
// FilterBarShell code unchanged. FilterBarNode config unchanged. Data unchanged.
// Only the rendered control changes. ✅


// ─── Summary ──────────────────────────────────────────────────────────────
// Level 1: nodeRegistry.register('filter-bar', 'default', NewShell)        — global default
// Level 2: nodeRegistry.register('filter-bar', 'floating', FloatingShell)  — opt-in variant
//          FilterBarNode { variant: 'floating' } → FloatingShell
// Level 3: <ShellOverrideProvider shells={{ 'filter-bar/default': X }}>    — scoped, no mutation
// Level 4: filterControlRegistry.register({ controlType: 'year-select', Shell: X }) — per control
//
// In all 4 cases: useFilters() (no args) → same FilterProvider → same dims → same data queries. ✅
// Constructor sees: nodeRegistry.list() → palette shows all variants. JSON variant field → shell. ✅


// ═══════════════════════════════════════════════════════════════════════════
// SiteRenderer — filter schema → FilterProvider → ctx.dims
// ═══════════════════════════════════════════════════════════════════════════

function SiteRenderer({ def }: { def: PageConfigBase }) {
  const theme   = useTheme()
  const stores  = useStores()
  // filterSchema on page → single source of truth for all filter state
  // if no filterSchema (hidden-param-only page, or pure content) → empty bars, ctx.dims = {}
  const schema  = def.filterSchema ? defineFilters(def.filterSchema) : defineFilters({ bars: {} })
  const filters = useFilters(schema)

  const baseCtx: RenderContext = {
    theme,
    stores,
    pageStoreKey: def.storeKey,
    dims:         filters.ctx.dims,   // ← ALL renderers see this. One source. ✅
    derived:      {},
    rows:         [],
    view:         {} as any,
    scope:        { dims: filters.ctx.dims, derived: {} },
    dimContracts: {},
  }

  return (
    <FilterProvider value={filters}>
      {renderNode(def, baseCtx)}
      {/* FilterBarShell inside renderNode calls useFilters() → reads THIS FilterProvider */}
      {/* KpiStrip, Section, Chart: ctx.dims = filters.ctx.dims → same state ✅ */}
    </FilterProvider>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// App.tsx — AppChrome at app level (Grafana/VS Code/GitHub standard)
// ═══════════════════════════════════════════════════════════════════════════

// ✅ AppChrome outside Routes — never remounts on navigation
// Chrome variant controlled by manifest.chrome (Constructor sets globally or per-site)
// chromeRegistry.get('AppHeader', manifest.chrome['AppHeader'] ?? 'default') → component

function App_CANONICAL({ manifest }: { manifest: any }) {
  return (
    <SiteProvider stores={manifest.stores} pages={manifest.pages}
                  nav={manifest.nav} chrome={manifest.chrome}>
      <ThemeProvider theme={GEOSTAT_THEME}>
        <BrowserRouter>
          <AppChrome>             {/* reads chromeRegistry — NEVER remounts */}
            <Routes>
              {Object.values(manifest.pages as Record<string, PageConfigBase>).map(page => (
                <Route key={page.id} path={page.path!}
                       element={<PageLoader pageId={page.id} />} />
              ))}
            </Routes>
          </AppChrome>
        </BrowserRouter>
      </ThemeProvider>
    </SiteProvider>
  )
}
// Constructor adds page → manifest.pages → Route auto-appears → AppChrome wraps automatically ✅

function PageLoader({ pageId }: { pageId: string }) {
  const page = usePageById(pageId)
  if (!page) return null
  // no AppChrome here — chrome is app-level
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ErrorBoundary fallback={<PageError />}>
        <SiteRenderer key={page.id} def={page} />
      </ErrorBoundary>
    </Suspense>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════

// ✅ Page with hidden params (no filter bar UI) — filterSchema still drives ctx.dims
const HIDDEN_PARAMS_PAGE: InnerPageNode & PageConfigBase = {
  id: 'methodology', type: 'inner-page', title: 'მეთოდოლოგია', path: '/methodology',
  filterSchema: {
    bars: {
      hidden: { position: 'sticky', order: 0, filters: {
        sector: { type: 'hidden', defaultValue: '_T' },   // no UI — always drives queries
      }},
    },
  },
  children: [
    // no filter-bar node — no UI shown, but dims.sector = '_T' in all queries ✅
    { type: 'section', data: { type: 'timeseries', indicator: 'DESC', dims: { sector: { $ctx: 'sector' } } },
      children: [{ type: 'chart', layout: { role: 'chart' } }],
    },
  ],
}

// ✅ Page with no filterSchema at all — ctx.dims = {}, all queries use static dims
const STATIC_PAGE: InnerPageNode & PageConfigBase = {
  id: 'about', type: 'inner-page', title: 'ჩვენს შესახებ', path: '/about',
  // filterSchema absent → defineFilters({ bars: {} }) → ctx.dims = {} → no filter state needed
  children: [{ type: 'section', data: { type: 'row-list', indicators: ['ABOUT'] }, children: [] }],
}

// ✅ Shell customisation — data unchanged, display fully replaced
// nodeRegistry.register('filter-bar', 'chip', ChipFilterBarShell)
// FilterBarNode { variant: 'chip' } → ChipFilterBarShell renders pills instead of selects
// ChipFilterBarShell still calls useFilters() (no args) → same FilterProvider → same dims ✅


// declare to satisfy type checker in example context:
declare function useFilters(schema?: any): { bars: FilterBarSpec[]; ctx: { dims: Record<string, any> } }
declare function useFilter<T>(key: string): { value: T | null; set: (v: T) => void }
declare function defineFilters(schema: any): any
declare function renderNode(def: any, ctx: any): any
declare function useTheme(): any
declare function useStores(): any
declare function usePageById(id: string): PageConfigBase | null
declare const filterControlRegistry: { get(type: string): { Shell: any } | undefined }
declare const nodeRegistry: { register(type: string, variant: string, shell: any): void; list(): any[] }
declare const GEOSTAT_THEME: any
declare function SiteProvider(props: any): any
declare function ThemeProvider(props: any): any
declare function BrowserRouter(props: any): any
declare function AppChrome(props: any): any
declare function ShellOverrideProvider(props: any): any
declare function Routes(props: any): any
declare function Route(props: any): any
declare function Suspense(props: any): any
declare function ErrorBoundary(props: any): any
declare function FilterProvider(props: any): any
declare function PageLoader(props: { pageId: string }): any
declare function PageSkeleton(): any
declare function PageError(): any
declare function useState<T>(init: T): [T, (v: T | ((p: T) => T)) => void]
declare const React: any
declare function yearCodec(): any
```
