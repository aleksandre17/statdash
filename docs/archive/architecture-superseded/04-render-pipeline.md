# Render Pipeline

> **Engine implementation** (renderNode step-by-step). Higher-level pattern → `docs/config-driven-rendering.md`.

---

## Full Pipeline

```
PageConfig (JSON)
  → PageLoader(pageId)
      usePageById(pageId)  → PageConfig (sync, from SiteProvider)
      <Suspense fallback={<PageSkeleton />}>
        <ErrorBoundary fallback={<PageError />}>
          <SiteRenderer def={pageConfig} />
        </ErrorBoundary>
      </Suspense>

  → SiteRenderer
      // ⚠️ DEPRECATED: const theme = useTheme() for shell dispatch → nodeRegistry.get() now
      const theme  = useTheme()    → ThemeConfig (skeletons only — shells moved to nodeRegistry)
      const stores = useStores()   → Record<string, DataStore> (from SiteProvider)
      const schema = defineFilters(def.filterSchema)
      <FilterProvider schema={schema}>
        {engine.renderNode(def, baseCtx)}
      </FilterProvider>
      baseCtx = { theme, stores, dims: schema.ctx.dims, derived: {}, rows: [], view: {}, scope: {...} }

  → engine.renderNode(node, ctx):
      1. node.derive   → engine.evalDerived(node.derive, ctx)
                          DataLookupOp → interpretSpec(op.data, ctx, stores) → lookup
                          ExprVal      → evalExpr (@geostat/expr)
                          ctx = { ...ctx, derived, scope: { dims, derived } }

      2. evalExpr<boolean>(node.visibleWhen ?? true, ctx.scope)
                          → false → return null (node + subtree skipped)
                          // NodeBase.visibleWhen = STRUCTURAL visibility.
                          // Node does not exist in the tree. ChildrenArg never sees it.
                          // Use when: completely different node sets per mode/state.

      3. interpretSpec(node.data, ctx) → InterpretResult   (per-node, not page-level)
             storeId = spec.storeId ?? pageNode.storeKey ?? 'default'
             store   = ctx.stores[storeId]
             per dim in spec.filter:
               resolved = evalExpr(v, ctx.scope)
               contract = ctx.dimContracts[k] ?? 'required'
               null + 'required' → return { status: 'blocked', dim: k }
               null + 'wildcard' → skip clause (all values for this dim)
               null + 'empty'    → return { status: 'empty', dim: k }
               value             → apply filter clause
             → return { status: 'ok', rows }

         result.status === 'ok'      → ctx = { ...ctx, rows: result.rows }
         result.status === 'blocked' → ctx = { ...ctx, rows: [] }
                                        // EmptyState("select {result.dim}") — awaiting user input
                                        // NOT an error. Per-node: sibling nodes unaffected.
         result.status === 'empty'   → ctx = { ...ctx, rows: [] }
                                        // EmptyState — dependent selector without parent value

         // Grafana: per-panel variable check. Panel A blocked ≠ Panel B blocked.
         // Our equivalent: per-node interpretSpec. Page-level isDataBlocked = wrong granularity.

      4. evalViewParams(node.view, ctx.scope)
                          subtitle/hero/defaultOpen/... = evalExpr(field, scope) per field
                          ctx = { ...ctx, view: resolvedView }

      5. childDefs = node.children ?? []

         // render + filter in one pass — engine owns visibility, shell never sees null
         const pairs = childDefs
           .map(c => ({ def: c, node: renderNode(c, ctx) }))
           .filter(p => p.node !== null)         // visibleWhen: false → excluded here

      6. slot wrapping (only visible children) + ViewParams.visibleWhen applied here:
                          // ViewParams.visibleWhen = VISUAL visibility.
                          // Node stays in DOM (CSS transition possible). Engine adds slot--hidden class.
                          // Use when: ONS-style animated collapse, progressive disclosure.
                          // Shell never handles either visibility — engine owns both.

                          hidden = ctx.view.visibleWhen === false   // resolved at step 4
                          <div className="slot slot--{position} {hidden ? 'slot--hidden' : ''}">
                            {p.node}
                          </div>
                          // CSS: .slot--hidden { visibility: hidden; pointer-events: none; }
         // null nodes never reach slot wrapping → no empty <div class="slot"> in DOM

      7. children: ChildrenArg = {
           defs:     pairs.map(p => p.def),
           rendered: pairs.map(p => p.slotted),
         }
         // Invariant: defs.length === rendered.length, rendered contains no null.
         // Shell iterates defs → every defs[i] has a matching rendered[i] to display.

      8. renderer = registry.get(node.type)
         if (!renderer) throw new Error(`Unknown node type: "${node.type}"`)
         //              ↑ NodeErrorBoundary catches this → error node shown

         const skeletonCtx: SkeletonContext = { type: node.type, layout: node.layout }
         const skeletonFn  = ctx.theme.skeletons?.[node.type]               // 1. brand override
                          ?? nodeRegistry.getMeta(node.type)?.skeleton       // 2. type default (registered with node)
         const fallback    = skeletonFn
           ? skeletonFn(skeletonCtx)
           : <div className={`node-skeleton node-skeleton--${node.type}`} /> // 3. generic fallback

         return (
           <Suspense fallback={fallback}>         ← per-node (Grafana/ONS pattern)
             <NodeErrorBoundary>                  ← per-node: one node fails, page continues
               {renderer(node, ctx, children)}
             </NodeErrorBoundary>
           </Suspense>
         )
         // Suspense is transparent when nothing suspends (zero cost on cache hit).
         // Shell call varies by renderer:
         //   SectionRenderer:   <Shell def={node} children={children} view={ctx.view} />
         //   ChartRenderer:     interpretChart(def, rows, ctx) → ChartOutput → <Shell def={node} output={output} />
         //                      palette in output? → data-driven colors (ctx.theme used here, not in shell)
         //                      no palette?        → shell's toApexOptions() uses CSS vars
         //   TableRenderer:     <Shell def={node} rows={ctx.rows} view={ctx.view} />
         //   KpiStripRenderer:  <Shell def={node} rows={ctx.rows} view={ctx.view} />
         //   FilterBarRenderer: inner component → useFilters() → <Shell def={node} bars={bars} />
         //   PageRenderers:     <Shell def={node} children={children} />
         // Full shell props: architecture/03-theme-system.md → Shell Props section
```

---

## Engine Entry Points

```ts
// Main entry — renders full tree
engine.renderNode(root: NodeDef, ctx: RenderContext): ReactNode

// Extension — registers app-specific types
engine.extend(nodeRegistry: NodeRegistry): void
```

---

## SiteRenderer — React → Engine bridge

```tsx
// ⚠️ DEPRECATED — SiteRenderer with useTheme() for shell dispatch
// engine/react/src/page/SiteRenderer.tsx
function SiteRenderer({ def }: { def: PageConfig }) {
  const theme  = useTheme()    // React Context → ThemeConfig (skeletons only now — shells moved to nodeRegistry)
  const stores = useStores()   // React Context → Record<string, DataStore>

  // Filter schema may live in the page config (Phase 2) or be computed
  const schema = def.filterSchema
    ? defineFilters(def.filterSchema)
    : defineFilters({ bars: {} })  // no filters

  const filtersResult = useFilters(schema)

  const baseCtx: RenderContext = {
    theme,
    stores,
    dims:    filtersResult.ctx.dims,
    derived: {},
    rows:    [],
    view:    {},
    scope:   { dims: filtersResult.ctx.dims, derived: {} },
  }

  return (
    <FilterProvider value={filtersResult}>
      {engine.renderNode(def, baseCtx)}
    </FilterProvider>
  )
}
```

---

## Data Inheritance Through Tree

```
node declares data?  → interpretSpec → ctx.rows updated for this subtree
node has no data?    → inherits parent ctx.rows

PageConfig (storeKey: 'gdp')
  └─ SectionNode (data: { type: 'timeseries', indicator: 'B1G' })
       ├─ ChartNode  (no data → inherits ctx.rows from section)
       └─ TableNode  (data: { type: 'pivot' } → own ctx.rows for this subtree)
```

---

## App.tsx Bootstrap

```tsx
// src/app/App.tsx
function App() {
  const [manifest, setManifest] = useState<SiteManifest | null>(null)

  useEffect(() => {
    fetchSiteManifest().then(setManifest)
  }, [])

  if (!manifest) return <BootSkeleton />

  return (
    <ThemeProvider theme={GEOSTAT_THEME}>
      <SiteProvider
        stores={manifest.stores}
        pages={manifest.pages}
        nav={manifest.nav}
      >
        <BrowserRouter>
          <Routes />
        </BrowserRouter>
      </SiteProvider>
    </ThemeProvider>
  )
}
```

---

## Routes — uniform pattern

```tsx
// src/app/routes.tsx
function Routes() {
  return (
    <Switch>
      <Route path="/"         element={<PageLoader pageId="landing" />} />
      <Route path="/gdp"      element={<PageLoader pageId="gdp" />} />
      <Route path="/accounts" element={<PageLoader pageId="accounts" />} />
      <Route path="/regional" element={<PageLoader pageId="regional" />} />
    </Switch>
  )
  // No Layout wrapper — InnerPageShell uses AppChrome internally
  // No special cases — all pages are <PageLoader pageId="..." />
}
```

---

## Chrome Flow

```
App.tsx
  ThemeProvider(GEOSTAT_THEME)
    SiteProvider(stores, pages, nav)
      Router
        PageLoader(pageId)
          SiteRenderer
            engine.renderNode({ type: 'inner-page', ... })
              InnerPageRenderer
                // ⚠️ DEPRECATED: ctx.theme.shells dispatch → nodeRegistry.get('inner-page', 'default')
                → nodeRegistry.get('inner-page', 'default')
                → GeostatInnerPageShell
                    AppChrome
                      // ⚠️ DEPRECATED: useTheme() for chrome → chromeRegistry.get(slot, key)
                      chromeRegistry.get('AppHeader', chromeConfig['AppHeader'] ?? 'default')
                      <GeostatAppHeader />    ← () => ReactNode, reads useSiteNav()
                      <main>{children}</main>
                      <GeostatAppFooter />
```

---

## "Pure sync" + Suspense — conceptual model (I-2)

> The engine is pure sync. Suspense is a **React side channel** — not async code.

```
Engine code:     sync — renderNode() never awaits, never returns Promise
DataStore:       sync interface — query(): DataRow[]  (no async, no Promise return)
HttpDataStore:   throws Promise  ← React Suspense protocol (side channel into React)
React:           catches thrown Promise → shows fallback → retries when resolved

The distinction:
  "async code"     = code that uses await / returns Promise
  "React Suspense" = throw promise = React reads it as "not ready yet, retry later"
  These are different things. Engine has neither.
```

```ts
// ✅ This is sync (engine perspective):
function renderNode(node, ctx): ReactNode {
  const rows = ctx.store.query(spec)   // SYNC call — may throw Promise internally
  return registry.render(node, ctx)    // SYNC return
}

// What HttpDataStore.query() actually does:
query(q): DataRow[] {
  if (this.cache) return this.cache        // ← sync path (cache hit)
  throw this.fetchPromise                  // ← React side channel (cache miss)
  // Engine never sees the throw — React catches it at the Suspense boundary
}

// Engine is innocent. It calls store.query() and expects DataRow[].
// React's Suspense mechanism intercepts the throw before engine sees it.
// After data loads: React re-renders → query() returns DataRow[] → sync path ✅
```

**Rule:** Never add `async/await` to renderNode or interpretSpec. Suspense is React's concern — not engine's.

---

## node.derive — NodeDeriveMap examples (G-1)

`node.derive?: NodeDeriveMap` — Array of ordered entries. Two entry types:

### Pure ExprVal (no data access)

```ts
// SectionNode.derive — computed dims before rendering children
{
  type: 'section',
  derive: [
    // boolean flag: is the filter in year mode?
    { key: 'isYearMode',  expr: { op: 'eq', left: { $ctx: 'mode' }, right: 'year' } },
    // display string from dims
    { key: 'regionLabel', expr: { op: 'get', path: ['$ctx', 'geoLabel'] } },
  ],
  children: [...]
}
// ctx.derived['isYearMode']  → true | false
// ctx.derived['regionLabel'] → 'საქართველო'
// children receive updated ctx.scope = { dims, derived }
```

### DataLookupOp (data access in derive)

```ts
// Look up a single field from a DataSpec result
type DataLookupOp =
  | { op: 'tree-field'; data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  // tree-field: resolve data → find row where row[ref.key] === evalExpr(ref.val)
  //             → return row[field]
  | { op: 'map-field';  data: DataSpec; ref: ExprVal; field: string; fallback?: DimVal }
  // map-field:  resolve data → build Map<ref→field> → lookup by current ctx value

// Example — look up a geo label from a reference dataset:
{
  key: 'currentGeoLabel',
  expr: {
    op:       'map-field',
    data:     { type: 'query', storeId: 'geo-ref' },  // reference store
    ref:      { $ctx: 'geo' },                         // current filter value = lookup key
    field:    'label',                                  // field to return
    fallback: 'N/A',
  }
}
// ctx.derived['currentGeoLabel'] → 'თბილისი' (looked up from geo-ref store)
```

**Rule:** DataLookupOp is engine-only — evaluated BEFORE renderer runs. Renderer receives `ctx.derived` with resolved values. Never call interpretSpec in a renderer directly.

---

## evalViewParams — ViewParams field mapping (G-2)

Step 4 of renderNode: `evalViewParams(node.view, ctx.scope) → ResolvedViewParams`

Every field in `ViewParams` is `ExprVal` — resolved via `evalExpr(field, scope)`:

| Field | Resolves to | Purpose |
|---|---|---|
| `subtitle` | `string` | Section subtitle (can reference `{$ctx: 'year'}`) |
| `hero` | `boolean` | Full-width prominent display |
| `noCollapse` | `boolean` | Section always stays open |
| `defaultOpen` | `boolean` | Section open on first render |
| `exportable` | `boolean` | Show export button |
| `visibleWhen` | `boolean` | View-level visibility (complements `NodeBase.visibleWhen`) |

```ts
// Example — subtitle with dynamic year from ctx.dims
{
  type: 'section',
  view: {
    subtitle:    { $ctx: 'year' },              // → '2023' at runtime
    defaultOpen: true,                           // plain boolean = valid ExprVal (DimVal)
    exportable:  { op: 'eq', left: { $ctx: 'mode' }, right: 'year' },  // conditional
  }
}

// ResolvedViewParams passed to shell:
// { subtitle: '2023', defaultOpen: true, exportable: true }
// Shell: <GeostatSectionShell def={node} view={resolvedView} children={...} />
```

**Shell receives `ResolvedViewParams` — never raw `ViewParams`.** Engine resolves before dispatch.

---

## DataStore — interface + Suspense pattern (G-4)

```ts
// DataStore interface — all implementations satisfy this
interface DataStore {
  query(q: ObsQuery): DataRow[]   // SYNC return. Never async on the interface.
}

interface ObsQuery {
  indicators?: string[]
  dims?:       Record<string, string | string[]>
  timeRange?:  [number, number]
  limit?:      number
}
```

### StaticDataStore — always sync, in-memory

```ts
// Built from fromSDMX() at startup — data is already in memory
const accountsStore: DataStore = {
  query({ indicators, dims }) {
    return rawData
      .filter(row => !indicators || indicators.includes(row.indicator))
      .filter(row => !dims?.geo || dims.geo === row.geo)
  }
}
```

### HttpDataStore — sync interface, Suspense internally

```ts
// Reads from internal cache. If cache miss → throws Promise (React Suspense)
// React catches the thrown Promise → shows <PageSkeleton /> → retries after fetch
class HttpDataStore implements DataStore {
  private cache: DataRow[] | null = null
  private promise: Promise<void> | null = null

  query(q: ObsQuery): DataRow[] {
    if (this.cache) return applyObsQuery(this.cache, q)   // ← sync path

    if (!this.promise) {
      this.promise = fetch(this.href)
        .then(r => r.json())
        .then(data => { this.cache = fromSDMX(data) })
    }

    throw this.promise   // ← Suspense: React catches this, shows fallback, retries
  }
}
```

### Loading / Error boundaries

```
PageLoader → <Suspense fallback={<PageSkeleton />}>
               <ErrorBoundary fallback={<PageError />}>
                 <SiteRenderer />
               </ErrorBoundary>
             </Suspense>

engine.renderNode → pure sync — no async, no Promise in engine itself
HttpDataStore.query → throws Promise on cache miss → Suspense catches → skeleton shown
                   → fetch completes → cache filled → retry → DataRow[] returned sync
StaticDataStore.query → always returns DataRow[] (never throws Promise)
```

---

## Error Handling — Per-Node ErrorBoundary (G-5)

> **Grafana standard:** each panel has its own ErrorBoundary — one panel fails, the rest of the page continues.
> **ONS/Eurostat standard:** explicit "Data unavailable" empty state with source note.

### Three failure modes

| Mode | Trigger | Shell response |
|---|---|---|
| **Render error** | JS exception inside renderer/shell | `<NodeErrorFallback>` replaces the node |
| **Data error** | `store.query()` throws a non-Promise | Same `<NodeErrorFallback>` |
| **Empty data** | `ctx.rows.length === 0` after `interpretSpec` | `<NodeEmptyState>` (explicit, not silent) |

### Per-node ErrorBoundary — wrapping pattern

```tsx
// engine wraps every rendered node in a lightweight ErrorBoundary:
//
//   return (
//     <NodeErrorBoundary key={node.type} node={node}>
//       {this.nodes.render(node, enrichedCtx, children)}
//     </NodeErrorBoundary>
//   )
//
// NodeErrorBoundary — standard React class component:
// Receives store (optional) to call store.invalidate() on manual retry.
class NodeErrorBoundary extends React.Component<
  { node: NodeDef; store?: DataStore; children: ReactNode },
  { error: StoreError | Error | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  handleRetry = () => {
    const { node, store } = this.props
    // invalidate the specific href(s) this node depends on → triggers re-fetch
    if (store && node.data && 'href' in node.data) {
      store.invalidate((node.data as { href: string }).href)
    }
    this.setState({ error: null })   // clear error state → re-render children
  }

  render() {
    const { error } = this.state
    if (error) {
      const retryable = (error as StoreError).retryable ?? false
      return (
        <div className="node-error" role="alert" aria-label="განყოფილება მიუწვდომელია">
          <span className="node-error__icon">!</span>
          <span className="node-error__msg">მონაცემი მიუწვდომელია</span>
          {retryable && (
            <button className="node-error__retry" onClick={this.handleRetry}>
              თავიდან ცდა
            </button>
          )}
          {/* retryable=false (4xx) → no retry button — the data simply doesn't exist */}
        </div>
      )
    }
    return this.props.children
  }
}
```

### Empty-state pattern (ONS "Data unavailable")

```tsx
// Renderer checks ctx.rows before rendering content — never silently blank:
//
// function SectionRenderer(node, ctx, children) {
//   if (ctx.rows.length === 0) {
//     return (
//       <NodeEmptyState
//         message="მონაცემი არ მოიძებნა"
//         hint="შეცვალეთ ფილტრის პარამეტრები"   // ONS: actionable hint
//       />
//     )
//   }
//   return <Shell def={node} children={children} />
// }
//
// NodeEmptyState is a pure display component — no data fetching, no side effects.
// It surfaces source/filter context so the user understands why it is empty.
```

### Boundary hierarchy

```
<Suspense fallback={<PageSkeleton />}>           ← page-level: ultimate fallback (defence in depth)
  <ErrorBoundary fallback={<PageError />}>       ← page-level: unrecoverable crashes
    <SiteRenderer />
      engine.renderNode(root)
        per node:
          <Suspense fallback={skeleton()}>       ← per-node (Grafana/ONS standard)
            <NodeErrorBoundary>                  ← per-node: one node fails, page continues
              renderer(node, ctx, children)
                <NodeEmptyState />               ← no rows: explicit, not blank (ONS/Eurostat)
            </NodeErrorBoundary>
          </Suspense>
  </ErrorBoundary>
</Suspense>
```

**Loading granularity:**
- Page skeleton = only on hard refresh / cold cache (all stores empty)
- Per-node skeleton = standard UX: fast nodes render, slow nodes show skeleton independently
- Suspense transparent on cache hit — zero overhead after first load

**Reference:** Grafana per-panel, ONS per-section, Builder.io per-component — consensus.

**Rule:** never silently render nothing when data is absent. Empty state is always explicit (ONS/Eurostat).

---

## Unknown Node Type — engine fallback (K-2)

> **Grafana standard:** unregistered panel type → shows "Unknown panel type: X" error panel. Page continues.
> **Builder.io:** unregistered component → shows placeholder with type name.
> Never crash. Always degrade gracefully to the nearest error boundary.

```ts
// engine.renderNode — step 8:
const renderer = registry.get(node.type)

if (!renderer) {
  // Throw descriptive Error → caught by NodeErrorBoundary wrapping this node.
  // Sibling nodes continue rendering. Only this node shows error state.
  throw new Error(
    `[engine] Unknown node type: "${node.type}". ` +
    `Register it via nodeRegistry.register("${node.type}", renderer) in setupEngine.ts.`
  )
}

return renderer(node, ctx, children)
```

**Result:**

| Scenario | What happens |
|---|---|
| Known type, shell exists | Renders normally |
| Known type, no shell in theme | Renderer returns `null` (shell not configured — silent, intentional) |
| Unknown type (not registered) | `throw new Error` → NodeErrorBoundary catches → error node shown |
| Unknown type, no NodeErrorBoundary | Error bubbles to page-level ErrorBoundary → PageError shown |

**Rule:** Engine ALWAYS has NodeErrorBoundary wrapping every `renderer(...)` call. Unregistered type = developer error, not user error — show the type name in the error message for debuggability.

---

## KpiStrip — data-driven pattern (G-8)

> **Grafana:** Stat panel = one value per panel, data-driven, not hardcoded.
> **ONS/Eurostat:** KPI strip = row per indicator, rendered uniformly.

### Config pattern

```ts
// KpiStrip node — one KpiCard per row in ctx.rows
{
  type: 'kpi-strip',
  data: {
    type:       'row-list',           // one row per indicator (latest value)
    indicators: ['B1G', 'P3', 'P5'], // GDP, Final Consumption, Gross Investment
    dims:       { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } },
  },
}
// engine resolves data → ctx.rows = [
//   { indicator: 'B1G', value: 48732.4, label: 'მთლიანი შიდა პროდუქტი', unit: 'მლნ ₾', trend: 'up',   delta: 3.2  },
//   { indicator: 'P3',  value: 31204.1, label: 'საბოლოო მოხმარება',       unit: 'მლნ ₾', trend: 'up',   delta: 1.8  },
//   { indicator: 'P5',  value:  8943.7, label: 'მთლიანი ინვესტიციები',    unit: 'მლნ ₾', trend: 'down', delta: -0.4 },
// ]
// KpiStripShell iterates ctx.rows → one KpiCard per row
```

### KpiStripRenderer

```ts
// KpiStrip renderer — pure dispatch, shell handles layout
function KpiStripRenderer(
  node:     KpiStripNode,
  ctx:      RenderContext,
  children: ReactNode,   // pre-rendered by engine (none for leaf nodes)
): ReactNode {
  // ctx.rows already resolved by engine (step 1 of renderNode)
  // renderer does NOT call interpretSpec — that's the engine's job
  // ⚠️ DEPRECATED: ctx.theme.shells dispatch → nodeRegistry.get(type, variant) in renderNode()
  const Shell = ctx.theme.shells['kpi-strip']
  return <Shell def={node} rows={ctx.rows} />
}

// KpiStripShell iterates rows → KpiCard per row:
function GeostatKpiStripShell({ def, rows }: KpiStripShellProps) {
  return (
    <div className="kpi-strip">
      {rows.map(row => (
        <KpiCard
          key={row.indicator as string}
          label={row.label   as string}
          value={row.value   as number}
          unit={row.unit     as string}
          trend={row.trend   as 'up' | 'down' | 'flat'}
          delta={row.delta   as number | undefined}
        />
      ))}
    </div>
  )
}
```

### row-list DataSpec — field contract

```
DataRow fields for row-list:
  indicator  string   — SDMX code (B1G, P3, P5)
  value      number   — latest value for current filter dims
  label      string   — human label (from indicator metadata or CODE_MAP)
  unit       string   — "მლნ ₾", "%", etc
  trend?     'up'|'down'|'flat'  — direction vs prior period
  delta?     number   — % change vs prior period (optional — only if available)
```

**Rule:** KpiStrip shell never hardcodes indicator list. Always driven by `ctx.rows`. Adding / removing an indicator = change the `indicators` array in the DataSpec. Zero shell code change.
