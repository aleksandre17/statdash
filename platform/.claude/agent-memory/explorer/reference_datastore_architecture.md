---
name: datastore_architecture
description: DataStore interface, implementations (ExternalStore, ApiStore, CachedStore), Phase 1↔2 pattern
metadata:
  type: reference
---

# DataStore Architecture & Phase 1→2 Migration

## No Traditional Database (Phase 1: Static)

**Current:** Entirely in-memory with TypeScript data files.

**Pipeline:**
```
raw.ts (TypeScript exports)
  ↓ adapter.ts (normalize)
  ↓ Observation[] (canonical form)
  ↓ ExternalStore (in-memory, querySync fast-lane)
  ↓ SiteProvider (storeKey → DataStore)
  ↓ interpretSpec (DataSpec → rows)
```

---

## DataStore Interface (Engine Contract)

```typescript
interface DataStore {
  // Synchronous fast-lane (all Phase 1 stores sync)
  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[]

  // Async primary path (optional; sync stores wrap querySync)
  queryAsync?(q: StoreQuery, ctx: SectionContext): Promise<QueryResult>

  // Batch queries (Grafana targets[] pattern)
  batchQuerySync?(queries: StoreQuery[], ctx: SectionContext): EngineRow[][]
  batchQueryAsync?(queries: StoreQuery[], ctx: SectionContext): Promise<QueryResult[]>

  // Live subscription (optional, streaming only)
  subscribe?(q: StoreQuery, ctx: SectionContext, onResult: (r: QueryResult) => void): Unsubscribe

  // Metadata
  readonly caps?: StoreCaps
  readonly classifiers?: Record<string, Classifier>
  readonly display?: Record<string, DisplayMap>
  readonly metadata?: MetadataPort
}

// StoreQuery (discriminated union, open for extension)
type StoreQuery =
  | { type: 'val'; code: string }
  | { type: 'obs'; measure: string|string[]; filter?: {...}; orderBy?: {...} }
  | { type: 'schema'; indicator?: string }
  | { type: 'distinct'; dim: string; filter?: {...} }

// QueryResult envelope (async)
interface QueryResult<T = EngineRow> {
  state:  'loading' | 'done' | 'error'
  data:   T[]
  error?: string
  meta?:  ResultMeta
}
```

---

## ExternalStore (In-Memory, Phase 1)

```typescript
export class ExternalStore implements DataStore {
  readonly observations: Observation[]
  readonly classifiers:  Record<string, Classifier>
  readonly display:      Record<string, DisplayMap>
  readonly caps: StoreCaps = {
    queryTypes: ['val', 'obs', 'schema', 'distinct'],
    batching:   false,
    streaming:  false,
    sync:       true
  }

  constructor(observations: Observation[], options?: ExternalStoreOptions)

  querySync(q: StoreQuery, ctx: SectionContext): EngineRow[] {
    switch (q.type) {
      case 'val':      // OLAP: match measure + ALL dims in ctx.dims, sum
      case 'obs':      // Filter observations, resolve CtxRef, apply orderBy
      case 'schema':   // Unique (measure, label, color, unit) tuples
      case 'distinct': // Unique dim values, optionally filtered
    }
  }
}
```

**Usage per dataset:**
```typescript
// gdp/store.ts
export const gdpStore = new ExternalStore(
  fromGDPFacts(GDP_FACTS),
  { classifiers: GDP_CLASSIFIERS, display: GDP_DISPLAY }
)

// accounts/store.ts
export const accountsStore = new ExternalStore(
  fromAccountsFacts(ACCOUNTS_FACTS),
  { classifiers: ACCOUNTS_CLASSIFIERS, display: ACCOUNTS_DISPLAY }
)
```

---

## Phase 2 Implementations (Not Yet Built)

**ApiStore** (REST API + local cache):
```typescript
class ApiStore implements DataStore {
  readonly caps = { queryTypes: ['val', 'obs'], batching: true, streaming: false, sync: true }
  
  private cache = new Map<string, number>()
  
  async prefetch(reqs: Requirement[]): Promise<void>    // batch preload
  querySync(q, ctx): EngineRow[]                        // read from cache
  invalidate(code?: string): void                        // clear cache
}
```

**CachedStore** (memoization wrapper over any DataStore):
```typescript
class CachedStore implements DataStore {
  private valCache = new Map<string, number>()
  
  constructor(private source: DataStore) { }
  querySync(q, ctx): EngineRow[]                        // delegate, cache 'val' type
  warm(reqs: Requirement[]): void                       // pre-populate cache
  invalidate(code?: string): void
}
```

---

## Store Manifest & Registration

**store-manifest.ts (Phase 1):**
```typescript
export const STORE_MANIFEST: Record<string, DataStore> = {
  gdp:      gdpStore,
  accounts: accountsStore,
  regional: regionalStore,
}
```

**No coupling between page & store:**
- Page declares: `storeKey: 'gdp'` (string intent)
- Manifest provides: `'gdp': gdpStore` (instance)
- SiteProvider resolves: `stores[pageConfig.storeKey]` (runtime injection)

---

## Phase 1 → 2 Bootstrap Pattern

### SiteManifest (Contract Shared Across Phases)

```typescript
interface SiteManifest {
  datasources?: DatasourceInstanceConfig[]  // Phase 2: engine.buildStoreManifest()
  pages: Record<string, NodePageConfig>
  nav: NavEntry[]
  chrome: Record<string, ChromeEntry>
  chromeConfig: ChromeConfig
  i18n: I18nConfig
}

interface SiteBootstrap {
  manifest: SiteManifest
  stores: Record<string, DataStore>  // storeKey → instance
}
```

### Phase 1 Bootstrap (Now)

```typescript
async function fetchStatic(): Promise<SiteBootstrap> {
  await Promise.resolve()  // yield — matches async contract
  return {
    manifest: buildManifest(),           // listPages() + NAV + CHROME + I18N
    stores: STORE_MANIFEST               // { gdp: gdpStore, ... }
  }
}
```

### Phase 2 Bootstrap (Two-Line Switch)

```typescript
// apps/geostat/src/main.tsx
async function fetchApi(): Promise<SiteBootstrap> {
  const manifest = await fetch('/api/site').then(r => r.json())  // ← API call
  const stores = await engine.buildStoreManifest(manifest.datasources)  // ← build stores
  return { manifest, stores }
}

// App.tsx: unchanged
const { manifest, stores } = await fetchBootstrap()  // same signature
app.mount(SiteProvider({ manifest, stores }))
```

**Changed files:** only in `apps/geostat/src/main.tsx` (1 function swap). Everything else stays.

---

## Data Flow (End-to-End Query)

```
User: select year 2024
  ↓
Filter bar → SectionContext { timeMode: 'year', dims: { time: 2024 } }
  ↓
DataSpec: { measure: 'GDP', filter: { time: { $ctx: 'time' } } }
  ↓
interpretSpec(spec, ctx, store)
  ├─ Resolve CtxRef: { $ctx: 'time' } → 2024
  ├─ store.querySync({ type: 'obs', measure: 'GDP', filter: { time: 2024 } }, ctx)
  │
  └─ ExternalStore.querySync()
     ├─ Filter observations: measure === 'GDP' && time === 2024
     ├─ Match ALL ctx.dims
     ├─ Sum values if multi-match
     └─ Return Observation[] → EngineRow[]
  
  ├─ Apply pipe transforms (derive, lookup, sort)
  ├─ Apply encoding (label, value, color)
  │
  └─ Resolve display refs: $d:'measure' → GDP_DISPLAY['GDP'] → label, color
  
  ↓
Render chart/table with data + styling
```

---

## Architecture Principles

1. **New query type → new discriminant** — DataStore interface never changes
2. **Sync default (Phase 1)** — async only when needed (streaming, network)
3. **One StoreQuery per query** — batch at caller level (runBatch helper)
4. **CtxRef resolution at query time** — context carries all filter state
5. **Display refs ($d) at render time** — engine never caches labels/colors
6. **Classifiers as structural metadata** — for code↔id translation + rollup expansion

---

## Migration Checklist (When Phase 2 Ready)

- [ ] Build Fastify backend (`apps/api/`)
- [ ] Implement datasource config API (`GET /api/site`)
- [ ] Implement dataset fetch endpoints (`GET /api/datasets/{name}`)
- [ ] Build `engine.buildStoreManifest()` to instantiate ApiStore per datasource
- [ ] Write MSW handlers for dev (VITE_STORE_MODE=api switch)
- [ ] Update main.tsx bootstrap (1 function swap)
- [ ] Verify all tests pass with both Phase 1 (static) and Phase 2 (api) modes
