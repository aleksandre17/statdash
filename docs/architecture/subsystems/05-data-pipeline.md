# Data Pipeline

> **Client-side pipeline** (DataSpec → interpretSpec → DataRow[]). Full-stack context (DB → Java → HTTP) → `docs/pipeline.md`.

---

## Philosophy

```
component = declarer   ("მე ეს data მინდა" — DataSpec in config)
engine    = resolver   (DataSpec → DataRow[])
context   = carrier    (dims/filters injected at runtime)

კომპონენტი fetch-ს ვერ ხედავს. renderer ctx.rows-ს კითხულობს. logic engine-შია.
```

---

## DataSpec Union

```ts
type DataSpec =
  | QuerySpec          // named query with obs filters
  | RowListSpec        // multiple named indicators, one row each
  | TimeseriesSpec     // time dimension series for one indicator
  | GrowthSpec         // YoY / period growth calculation
  | RatioListSpec      // ratio between indicators
  | PivotSpec          // wide format for multi-series chart
  | ByModeSpec         // delegates to 'timeseries' or 'range' by ctx mode
  | UrlSpec            // fetch from arbitrary URL — { type: 'url', href: '...' }
  // type:'custom' REMOVED — use engine.extendSpec('mytype', resolver) instead

interface DataSpecBase {
  storeId?:   string                          // Phase 1: named store key (omit = use page storeKey)
  href?:      string                          // Phase 2: direct URL → HttpDataStore (Agreement C-4)
  transform?: string                          // open string — engine.registerTransform() key (not a closed union)
                                              // 'fromSDMX' = raw SDMX-JSON → Observation[]
  dims?:      Record<string, ExprVal>         // dimensional slice: { geo: {$ctx:'geo'}, time: {$ctx:'time'} }
  filter?:    Record<string, FilterValue>     // additional row filters:
                                              //   { isCarryForward: 0 }           ← literal (SNA dedup)
                                              //   { sector: { $ctx: 'sector' } }  ← CtxRef (runtime)
                                              //   { sector: { $ne: '_T' } }       ← NeRef (exclusion)
  sort?:      { field: string; dir: 'asc' | 'desc' }
  derive?:    DeriveMap                       // post-fetch row-level derived fields (ExprVal only)
  pipe?:      TransformStep[]                 // ★ inline transform pipeline (15 operations)
                                              // Applied AFTER store.query(), BEFORE encoding.
                                              // JSON-serializable ✅ — Constructor-safe ✅
                                              // See: examples/transform-pipeline.md
  encoding?:  EncodingSpec                    // ★ Grammar of Graphics field→channel mapping
                                              // Applied AFTER pipe → DataRow[] (structured).
                                              // Both Chart and Table receive same DataRow[].
                                              // JSON-serializable ✅ — Constructor-safe ✅
                                              // See: examples/encoding.md
}

// interpretSpec store resolution order:
//   1. spec.href    → HttpDataStore (no registration needed)
//   2. spec.storeId → ctx.stores[storeId]
//   3. (none)       → ctx.stores[pageStoreKey] ?? ctx.stores['default']
```

---

## DataSpec Examples

```ts
// timeseries — most common
{ type: 'timeseries', indicator: 'B1G',
  dims: { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } } }

// row-list — KPI strip
{ type: 'row-list', indicators: ['B1G', 'P3', 'P51G'],
  dims: { geo: { $ctx: 'geo' }, time: { $ctx: 'time' } } }

// pivot — multi-series chart (wide format)
{ type: 'pivot', indicator: 'B1G',
  rows: 'time', cols: 'geo' }

// by-mode — year/range adaptive
{ type: 'by-mode',
  year:  { type: 'timeseries', indicator: 'B1G' },
  range: { type: 'growth',     indicator: 'B1G' } }

// url — arbitrary endpoint, no store needed
{ type: 'url', href: '/api/regional/2024.json', transform: 'fromSDMX' }
```

---

## interpretSpec — core resolver

```ts
// engine/core/core/interpretSpec.ts

function interpretSpec(
  spec:  DataSpec,
  ctx:   RenderContext,
  stores?: Record<string, DataStore>   // passed from ctx.stores
): InterpretResult   // → DataRow[] on 'ok'

// Pipeline inside interpretSpec (4 steps):
//   1. store.query(q)              → EngineRow[]  (raw observation rows from store)
//   2. applyPipeline(rows, pipe)   → EngineRow[]  (optional spec.pipe transform steps)
//   3. applyEncoding(rows, enc)    → DataRow[]    (optional spec.encoding channel mapping)
//   4. return { status:'ok', rows }               (or blocked/empty if dim contract fails)

// EngineRow = Record<string, DimVal>  — renderer-agnostic, no well-known field names
// DataRow   = { id, label, value, series?, pct?, color?, level?, parentId?, … }
//           — structured, typed, ready for Chart and Table renderers

// Store resolution order:
//   1. spec.href    → HttpDataStore (built-in — no registration needed)
//   2. spec.storeId → ctx.stores[storeId]     (named store, Phase 1)
//   3. (neither)    → ctx.stores[pageStoreKey] ?? ctx.stores['default']
//
// Phase 2 pages (Constructor): all DataSpecs carry href → step 1 always wins.
// Phase 1 pages (hand-crafted): DataSpecs carry storeId or rely on pageStoreKey.

// Filter resolution — runtime (FilterValue supports CtxRef, NeRef, NeCtxRef):
const resolvedFilter: Partial<Record<string, FilterValue>> = spec.filter ?? {}
// { isCarryForward: 0 }           ← literal — passed through as-is
// { sector: { $ctx: 'sector' } } ← CtxRef — resolved against ctx.dims at query time
// { sector: { $ne: '_T' } }      ← NeRef  — exclude '_T' from sector dim

// Returns InterpretResult — pure, synchronous
```

### null dim — DimContract semantics

> null has no single meaning. The **contract** declared in `FilterSchemaInput.contracts` decides.

```ts
type DimContract = 'required' | 'wildcard' | 'empty'
// default when omitted: 'required'
```

```
FilterSchemaInput.contracts: {
  'geo':  'required',   // null → interpretSpec returns { status: 'blocked', dim: 'geo' } → rows=[]
  'time': 'wildcard',   // null → skip filter clause → all years returned
  'sub':  'empty',      // null → interpretSpec returns { status: 'empty', dim: 'sub' } → rows=[]
}
```

**interpretSpec → InterpretResult (per-node discriminated union):**

```ts
// interpretSpec returns InterpretResult — evaluated per node, not per page.
// SectionA needing geo=null does not block SectionB whose query only needs time.
// (Grafana: per-panel variable check — Panel A blocked ≠ Panel B blocked.)

function interpretSpec(spec: DataSpec, ctx: RenderContext): InterpretResult

type InterpretResult =
  | { status: 'ok';      rows: DataRow[] }
  | { status: 'blocked'; dim: string }   // required dim = null for THIS node's query
  | { status: 'empty';   dim: string }   // 'empty' contract + null

// contracts-aware filter resolution inside interpretSpec:
for (const [k, v] of Object.entries(spec.filter ?? {})) {
  const resolved = evalExpr(v, ctx.scope)
  const contract = ctx.dimContracts[k] ?? 'required'

  if (resolved === null) {
    if (contract === 'required') return { status: 'blocked', dim: k }
    if (contract === 'wildcard') continue     // skip clause → all values
    if (contract === 'empty')    return { status: 'empty',   dim: k }
  }
  resolvedFilter[k] = resolved
}
return { status: 'ok', rows: store.query(resolvedFilter) }
```

**renderNode step 3 acts on result:**
```
status: 'ok'      → ctx.rows = result.rows → normal render
status: 'blocked' → ctx.rows = []           → EmptyState("select {result.dim}")
status: 'empty'   → ctx.rows = []           → EmptyState (dependent selector)
```

**crossValidate — complementary, not replaced:**
```
contracts:     simple per-dim rules (required/wildcard/empty) ← covers 90% of cases
crossValidate: complex cross-dim rules (A and B together, range from ≤ to)
```

**Effects can set dims to null intentionally:**
```ts
effects: [
  { when: { op: 'eq', left: { $ctx: 'mode' }, right: 'range' },
    set:  { time: null } }   // clear year when switching to range
  // 'time' contract='required' → interpretSpec returns 'blocked' until user selects range
  // 'time' contract='wildcard' → immediately shows all-years aggregate
]
```

---

## DataStore — interface + implementations

```ts
// engine/core/data/store.ts
interface DataStore {
  query(q: ObsQuery): DataRow[]
  invalidate(href?: string): void   // href omitted → clear all; href provided → clear one
  // SYNC — never async. Store manages its own cache. Engine never awaits.
  // Three outcomes:
  //   return DataRow[]  → cache hit          → render proceeds
  //   throw Promise     → cache miss/loading → React Suspense → skeleton shown
  //   throw StoreError  → fetch failed       → NodeErrorBoundary → error shell
}
```

### StaticDataStore — dev / tests

```ts
// engine/core/data/stores/StaticDataStore.ts
class StaticDataStore implements DataStore {
  constructor(private obs: Observation[]) {}
  query(q: ObsQuery): DataRow[]        { return filterObs(this.obs, q) }
  invalidate(_href?: string): void     { /* no-op — in-memory, always fresh */ }
}

// Usage:
createStaticStore(fromRawSQL(RAW_GDP_DATA))
createStaticStore(fromSDMX(mockSdmxResponse))
```

### HttpDataStore — `engine/react/` (not engine)

> **Architectural note:** `HttpDataStore` belongs in `engine/react/`, not `engine/core/`.
> `throw Promise` (Suspense) is React-specific. `DataStore` interface stays in `@geostat/engine` (generic).
> `HttpDataStore` is a React-layer implementation of that interface.

```ts
// engine/react/data/HttpDataStore.ts

const MAX_RETRIES = 3
const retryDelay  = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000)  // 1s → 2s → 4s → 8s cap

// HTTP status → retryable?
const isRetryable = (status?: number, err?: Error): boolean =>
  !status                              // network error (no status) → transient → retry
  || status >= 500                     // 5xx server error → transient → retry
  // 4xx (400/401/403/404) → permanent → no retry

type CacheEntry = { rows: DataRow[]; cachedAt: number; ttl: number }
type ErrorEntry = { error: StoreError; scheduledRetry?: ReturnType<typeof setTimeout> }

// Open map — any project registers its own transforms.
const TRANSFORM_MAP: Record<string, (raw: unknown) => Observation[]> = {
  'fromSDMX': fromSDMX,
  'raw':      (r) => r as Observation[],
}

class HttpDataStore implements DataStore {
  private cache       = new Map<string, CacheEntry>()
  private pending     = new Map<string, Promise<void>>()
  private errors      = new Map<string, ErrorEntry>()
  private controllers = new Map<string, AbortController>()
  private listeners   = new Set<() => void>()   // notify React to re-render after retry

  query(q: { href: string; transform?: string; ttl?: number }): DataRow[] {
    const entry = this.cache.get(q.href)

    // ── Cache hit ──────────────────────────────────────────────────────────
    if (entry) {
      const age = (Date.now() - entry.cachedAt) / 1000
      if (!entry.ttl || age < entry.ttl) return entry.rows   // fresh → return immediately

      // Stale-while-revalidate: return cached data, re-fetch in background
      if (!this.pending.has(q.href)) this.fetch(q)
      return entry.rows
    }

    // ── Permanent or exhausted error ───────────────────────────────────────
    const errEntry = this.errors.get(q.href)
    if (errEntry && !errEntry.scheduledRetry) throw errEntry.error   // → NodeErrorBoundary

    // ── Fetch (cache miss or transient retry) ──────────────────────────────
    if (!this.pending.has(q.href)) this.fetch(q)
    throw this.pending.get(q.href)!   // → React Suspense → skeleton shown
  }

  private fetch(q: { href: string; transform?: string; ttl?: number }): void {
    const controller = new AbortController()
    this.controllers.set(q.href, controller)

    const existingErr = this.errors.get(q.href)
    const attempts    = (existingErr?.error.attempts ?? 0) + 1

    const p = fetch(q.href, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) {
          const err        = Object.assign(new Error(`HTTP ${r.status}: ${q.href}`), {
            retryable: isRetryable(r.status),
            attempts,
            status:    r.status,
          }) as StoreError
          throw err
        }
        return r.json()
      })
      .then(raw => {
        const parse = TRANSFORM_MAP[q.transform ?? 'raw']
        this.cache.set(q.href, { rows: obsToRows(parse(raw)), cachedAt: Date.now(), ttl: q.ttl ?? 0 })
        this.errors.delete(q.href)
        this.pending.delete(q.href)
        this.controllers.delete(q.href)
        this.notify()
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return   // intentional cancel — no error state

        const storeErr: StoreError = Object.assign(
          err instanceof Error ? err : new Error(String(err)),
          { retryable: isRetryable((err as StoreError).status, err), attempts,
            status: (err as StoreError).status }
        )

        this.pending.delete(q.href)
        this.controllers.delete(q.href)

        if (storeErr.retryable && attempts < MAX_RETRIES) {
          // Schedule automatic retry with exponential backoff
          const timer = setTimeout(() => {
            this.errors.delete(q.href)
            this.notify()   // trigger re-render → query() called again → new fetch
          }, retryDelay(attempts))
          this.errors.set(q.href, { error: storeErr, scheduledRetry: timer })
        } else {
          this.errors.set(q.href, { error: storeErr })   // exhausted or permanent
        }
        this.notify()
      })

    this.pending.set(q.href, p)
  }

  invalidate(href?: string): void {
    if (href) {
      this.abort(href)
      this.cache.delete(href)
      this.errors.delete(href)
    } else {
      this.controllers.forEach((_, h) => this.abort(h))
      this.cache.clear()
      this.errors.clear()
    }
    this.notify()
  }

  private abort(href: string): void {
    this.controllers.get(href)?.abort()
    this.controllers.delete(href)
    this.pending.delete(href)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify(): void {
    this.listeners.forEach(fn => fn())
  }
}

// Registered once at app startup (engine/react/):
engine.registerBuiltinStore('http', new HttpDataStore())
```

**Error classification summary:**
```
Network error (no status)  → retryable: true  → auto-retry up to 3×, then StoreError thrown
5xx server error           → retryable: true  → same
4xx client error           → retryable: false → StoreError thrown immediately, no retry
AbortError                 → silent           → no error state (intentional cancel)
```

**transform string → function mapping (JSON-safe):**
```
'fromSDMX' → fromSDMX()    (SDMX-JSON wire → Observation[])
'raw'       → identity      (already Observation[])
```
Constructor stores `transform: 'fromSDMX'` as string in DB. Engine resolves at runtime.

---

## Multi-Store — ctx.stores registry

```ts
// RenderContext:
stores: Record<string, DataStore>

// interpretSpec picks:
const storeId = spec.storeId ?? pageNode.storeKey ?? 'default'
const store   = ctx.stores[storeId]

// Page uses different stores:
// gdp page → storeKey: 'gdp'    → ctx.stores['gdp']
// section needs geo data → storeId: 'geo-store' → ctx.stores['geo-store']

// Store manifest (src/data/store-manifest.ts):
export const STORE_MANIFEST: Record<string, DataStore> = {
  'gdp':       new ApiDataStore('/api/sdmx/GDP'),
  'accounts':  new ApiDataStore('/api/sdmx/ACCOUNTS'),
  'regional':  new ApiDataStore('/api/sdmx/REGIONAL'),
  'geo-store': new ApiDataStore('/api/geo'),
  'default':   new StaticDataStore([]),
}
```

---

## fromSDMX — the boundary adapter

```ts
// engine/core/sdmx/fromSDMX.ts
function fromSDMX(raw: SdmxJsonResponse): Observation[]

// This is the ONLY place where SDMX wire format → Observation[].
// After this: DataRow[] everywhere.
// DB uses SDMX codes (P1, B1g, S1). fromSDMX() translates at the boundary.
// Swap API format? Only this function changes.
```

---

## Data Inheritance Tree

```
node has data?    → interpretSpec → ctx.rows for this node's subtree
node has no data? → inherits parent ctx.rows

PageConfig (storeKey: 'gdp')
  └─ SectionNode (data: { type: 'timeseries', indicator: 'B1G' })
       ├─ ChartNode  (no data → inherits SectionNode ctx.rows)
       └─ TableNode  (data: { type: 'pivot' } → own ctx.rows, overrides for its subtree)
```

---

## Direct Data Access — escape hatch

```ts
// Declarative:  DataSpec in config → interpretSpec(spec, ctx) → ctx.rows
// Imperative:   ctx.stores + useStoreQuery hook → DataRow[]

// Component wrapper pattern (required — NodeRenderer is not a React component):
function MyRenderer(def: MyNode, ctx: RenderContext): ReactNode {
  return <MyControl def={def} stores={ctx.stores} dims={ctx.dims} />
}

function MyControl({ def, stores, dims }: { def: MyNode, stores: Record<string, DataStore>, dims: Record<string, DimVal> }) {
  const { data, isLoading } = useStoreQuery(stores, def.storeId ?? 'gdp', {
    type: 'query',
    indicator: def.indicator,
    dims: { geo: dims['geo'], time: dims['time'] },
  })
  if (isLoading) return <Skeleton />
  return <Table rows={data} />
}

// useStoreQuery:
function useStoreQuery(
  stores:  Record<string, DataStore>,
  storeId: string,
  spec:    DataSpec,
): { data: DataRow[], isLoading: boolean, error?: Error }
// useSWR / React Query wrapper — cache + revalidation built-in
```

---

## Three Paths — one output

```
Declarative named  →  DataSpec (type: 'timeseries', storeId: 'gdp')
                      → interpretSpec → ctx.rows
                      → renderer reads ctx.rows

Declarative URL    →  DataSpec (type: 'url', href: '/api/...')
                      → HttpDataStore (built-in) → ctx.rows
                      → renderer reads ctx.rows

Imperative         →  ctx.stores + useStoreQuery hook → DataRow[]
                      → component renders directly

სამივე → DataRow[] → renderer ვერ ხვდება სხვაობას
```

---

## SDMX Rules

```
DB stores:     SDMX codes (P1, B1g, S11) — never Georgian names
UI receives:   DataRow[] (post-fromSDMX) — human-readable or indicator codes
extra_dims:    JSONB column — flexible, no hardcoded dim columns per dataset
isCarryForward: 0 filter — SNA standard deduplication
```

---

## Three Independent Layers — Never Mix

> Moved from `docs/ARCHITECTURE.md`.

```
DataSpec (WHAT)  +  SectionContext (WHERE in cube)  +  DataStore (SOURCE)
        ↓                        ↓                           ↓
                  interpretSpec(spec, ctx, store): DataRow[]
                            ↓               ↓
                        DataTable          Chart
```

- **DataSpec** — intent. Store-ს არ "იცნობს".
- **DataStore** — source. UI-ს არ "იცნობს".
- **interpretSpec** — ერთადერთი კანონიერი bridge. pure function, no side effects.
- **SectionContext** — OLAP cube coordinate: `dims: Record<string, DimVal>`

### SDMX + Vega-Lite Parallel

| ჩვენი | SDMX ISO 17369 | Vega-Lite |
|---|---|---|
| `DataSpec` | DSD — Data Structure Definition | `data` + `transform` |
| `ObsQuery` | SDMX REST filter params | `filter` / `calculate` |
| `DataStore` | DataFlow API endpoint | `data.url` |
| `DataRow[]` | DataSet — tidy observations | tidy values array |
| `ChartDef` | — | `mark` + `encoding` |

### ObsQuery — Universal Query Language

```ts
// Formal interface — what interpretSpec builds and passes to store.query():
interface ObsQuery {
  indicators?: string[]                           // indicator code(s): ['B1G'] | ['B1G', 'P3']
  dims?:       Record<string, string | string[]>  // resolved dims — interpretSpec resolves ExprVal before query
  timeRange?:  [number, number]                   // optional time window: [2020, 2024]
  limit?:      number                             // max rows returned
}
```

// interpretSpec translates DataSpec → ObsQuery(s) → store.query() (illustrative):
```ts
// row-list: { indicators: ['B1G', 'P3', 'P51G'] }
→ store.query({ indicators: ['B1G', 'P3', 'P51G'], dims: { time: '2023', geo: 'GE' } })

// growth: { indicator: 'B1G', years: [2020..2025] }
→ store.query({ indicators: ['B1G'], timeRange: [2020, 2025] })

// ratio-list: { indicator: 'D1', denom: 'B1G' }
→ store.query({ indicators: ['D1'], ... })  +  store.query({ indicators: ['B1G'], ... })

// multi-indicator / pivot / timeseries
→ multiple store.query() calls, results merged
```

### extractRequirements → Prefetch Pipeline (Eurostat/WorldBank)

```ts
const queries: ObsQuery[] = extractRequirements(spec, ctx)  // static analysis
await store.observeAll(queries, ctx)                         // batch prefetch
const rows = interpretSpec(spec, ctx, cachedStore)           // sync, zero waterfall
```

`extractRequirements` — already in `data/spec.ts`, unused. Quality layer component.

### Store Swap = Zero Config Change

```ts
staticStore(localJson)                               // dev / Phase 1
CachedStore(ApiStore('https://api.geostat.ge'))      // prod / Phase 2
staticStore(mockFixtures)                            // unit tests
```

### Config-Store Boundary Rules

```
DataSpec-ში დაშვებულია:          DataSpec-ში აკრძალულია:
  indicator codes (strings) ✅     val() / fetch() calls      ❌
  ObsQuery descriptors      ✅     async functions            ❌
  DimVal literals           ✅     store references           ❌
  CtxRef { $ctx: 'time' }   ✅     ctx.dims access            ❌
  years: number[]           ✅     computed values at defn    ❌
```
