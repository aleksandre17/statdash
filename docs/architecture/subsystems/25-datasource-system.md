# Datasource System — Architecture

> Plugin registry + instance configs + lazy data loading + standard response envelope.
> Grafana datasource model + SDMX-JSON structure + JSON:API envelope — combined.
> Framework-level: agnostic to format (SDMX, REST-JSON, CSV, SQL, static, …).

---

## Standard API Response Envelope

Every endpoint the platform calls returns the same outer shape.
Plugins parse it. Engine doesn't care what's inside `data` — only `structure` matters universally.

```ts
interface ApiResponse<T = unknown> {
  meta:       ResponseMeta          // always present — id, timestamp, label, version
  structure?: DatasourceStructure   // classifiers + display — present when applicable
  data?:      T                     // observations or other payload
}

interface ResponseMeta {
  id:       string   // 'NA_GE', 'GDP_GE' — dataset identifier
  prepared: string   // ISO 8601 — when this response was generated
  label?:   string   // human-readable — Constructor datasource list
  version?: string   // 'preliminary', '2024Q3' — data revision
}

interface DatasourceStructure {
  classifiers?: Record<string, Classifier>
  display?:     Record<string, DisplayMap>
}
```

**Three response modes** — same envelope, different fields present:

| Mode | Fields | When | Cache |
|------|--------|------|-------|
| `structure-only` | `meta + structure` | structureUrl endpoint | long (rarely changes) |
| `data-only` | `meta + data` | url endpoint (when structure separate) | short (changes often) |
| `combined` | `meta + structure + data` | url endpoint (one-shot) | short (structure re-fetches with data) |

Aligned with: SDMX-JSON (`meta + data + structure`) · JSON:API (`meta` always present) · Grafana DataFrames (metadata travels with data in combined mode).

---

## Resolution priority for classifiers/display

Three tiers — highest priority wins:

```
Tier 1  config.classifiers / config.display   → in-manifest (zero HTTP, instant)
             ↓ absent
Tier 2  config.structureUrl                   → fetched at bootstrap, before React mounts
             ↓ absent
Tier 3  config.url → response.structure        → arrives with observations (Suspense timing)
```

**Tier 1** — Phase 1 (TypeScript import) and Phase 2 (DB, from previous `getMetadata()` run).
**Tier 2** — Phase 1.5 (real URL, structure from separate endpoint, filters ready before data).
**Tier 3** — simplest config (one URL), filters wait for data load.

`buildStoreManifest` is **async** — awaits all Tier 2 structure fetches before returning.
React mounts after `await` → classifiers ready → filter dropdowns populated on first render. ✅

---

## Context — the problem with hardcoded stores

Old pattern (Phase 1 stopgap — acceptable only during development):

```ts
// src/data/gdp/store.ts — hardcoded per dataset
export const gdpStore = new ExternalStore(GDP_FACTS, { classifiers, display })

// src/data/store-manifest.ts — hardcoded registration
export const STORE_MANIFEST = { gdp: gdpStore, accounts: accountsStore }
```

This is NOT a JSON-config platform. In a real platform:
- Constructor adds a datasource → zero code files change
- Different tenant → different datasource URLs → zero code files change
- Datasource format changes (SDMX → REST) → swap plugin, zero page configs change

Pattern: Grafana datasource model. Retool resource model. Both use plugin + config separation.

---

## Three-level separation

```
Plugin type     — registered once in code  (framework level, engine/core)
                  e.g. SdmxApiPlugin, RestJsonPlugin, CsvPlugin
        ↓
Instance config — JSON stored in DB        (per datasource, Constructor writes)
                  e.g. { id:'gdp', plugin:'sdmx-api', url:'https://…', auth:{…} }
        ↓
DataStore       — runtime object           (built at bootstrap, lives in SiteProvider)
                  DataStore.query() ← interpretSpec calls this
```

**Rule:** Plugin type = code. Instance config = data. DataStore = runtime.
Constructor only touches the middle layer — zero code change.

---

## DatasourcePlugin interface

```ts
interface DatasourcePlugin<TOptions = Record<string, unknown>> {
  id:          string       // 'sdmx-api' | 'rest-json' | 'csv' | 'sql' | 'static' | …
  displayName: string       // shown in Constructor datasource picker UI
  create:      (config: DatasourceInstanceConfig<TOptions>) => DataStore
  // Optional — Constructor UI integration:
  testConnection?: (config: DatasourceInstanceConfig<TOptions>) => Promise<{ ok: boolean; message?: string }>
  getMetadata?:    (config: DatasourceInstanceConfig<TOptions>) => Promise<DatasourceMetadata>
}
```

`create()` is the factory — called once per instance config. Returns a DataStore.
The plugin decides how to interpret `config.url`, `config.auth`, `config.options`.
Engine is blind to these details — it only calls `store.query()`.

**Key:** `TOptions` is open (`Record<string, unknown>` default). Each plugin defines its own
options shape. Engine never reads options — plugin reads, engine ignores.

---

## DatasourceInstanceConfig — JSON-serializable

```ts
interface DatasourceInstanceConfig<TOptions = Record<string, unknown>> {
  id:           string          // maps to storeKey: 'gdp', 'accounts', 'regional'
  plugin:       string          // plugin id registered via engine.registerDatasource()
  url?:         string          // primary endpoint (plugin interprets)
  auth?:        AuthConfig      // authentication (JSON-safe discriminated union)
  classifiers?: Record<string, Classifier>   // structural metadata — top-level, universal
  display?:     Record<string, DisplayMap>   // UI overlay — top-level, universal
  options?:     TOptions        // plugin-private open record — engine ignores
}

type AuthConfig =
  | { type: 'none' }
  | { type: 'bearer';  token: string }
  | { type: 'basic';   username: string; password: string }
  | { type: 'apikey';  header: string;   value: string }
  | { type: 'custom';  headers: Record<string, string> }
```

Stored in DB alongside pages, nav, tokens. Constructor writes. Engine reads at bootstrap.
JSON.parse(JSON.stringify(config)) === config → guaranteed. ✅

---

## Classifiers and Display — same architecture as static

### Why top-level, not in `options`

`options` is plugin-private — only the plugin that created the store reads it.
`classifiers` and `display` are **universal** — `DataStore` interface has them as standard fields,
engine reads them for `$cl`/`$d` resolution regardless of which plugin created the store.

Burying them in `options` would require every engine consumer to know the plugin type. That violates the abstraction.

```
options    — plugin reads, engine ignores.    (plugin-specific shape)
classifiers — engine reads, plugin populates. (universal DataStore field)
display     — engine reads, plugin populates. (universal DataStore field)
```

### The parallel with ExternalStore

```ts
// BEFORE — static ExternalStore:
new ExternalStore(observations, { classifiers: ACCOUNTS_CLASSIFIERS, display: ACCOUNTS_DISPLAY })

// AFTER — SuspenseStore via plugin (same positions, same purpose):
//   config.classifiers = ACCOUNTS_CLASSIFIERS
//   config.display     = ACCOUNTS_DISPLAY
create(config) {
  return new SuspenseStore(fetcher, config.classifiers ?? {}, config.display ?? {})
}
```

Architecture is identical. Only the source changes (TypeScript file → DB field).

### Why classifiers/display must be synchronous (not lazy)

Observations → lazy. Fetched when the page renders. OK to show skeleton while loading.

Classifiers/display → **synchronous at filter render time**.

Filter bar renders at page load, BEFORE any data sections.
`OptionsSource { type: 'inline', items: { $cl: 'time' } }` calls `resolveDimRef(store.classifiers, …)`
`OptionsSource { type: 'inline', items: { $d: 'account' } }` calls `resolveDimRef(store.display, …)`

If classifiers aren't ready → filter dropdowns empty → bad UX.

Therefore: classifiers and display arrive in the manifest (fast — one GET /api/site),
not via lazy data fetches. They're ready before any page renders.

### Phase flow for classifiers/display

**Phase 1 (TypeScript):**
```ts
// src/data/datasources.ts
import { ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY } from './accounts/raw'

export const DATASOURCE_CONFIGS: DatasourceInstanceConfig[] = [
  {
    id:          'accounts',
    plugin:      'static',
    classifiers: ACCOUNTS_CLASSIFIERS,   // ← TypeScript import, same as today
    display:     ACCOUNTS_DISPLAY,       // ← TypeScript import, same as today
    options:     { observations: fromAccountsFacts(ACCOUNTS_FACTS) },
  },
]
// Same data, different shape. ExternalStore → plugin config.
```

**Phase 1.5 (real API, classifiers still from TypeScript):**
```ts
{
  id:          'accounts',
  plugin:      'sdmx-api',
  url:         'https://api.geostat.ge/sdmx/v1/data/NA_GE',
  auth:        { type: 'bearer', token: ENV.API_TOKEN },
  classifiers: ACCOUNTS_CLASSIFIERS,   // ← still TypeScript — fast, no extra request
  display:     ACCOUNTS_DISPLAY,       // ← still TypeScript — fast, no extra request
}
// Observations: lazy (HTTP on page render)
// Classifiers:  instant (TypeScript module load)
```

**Phase 2 — Tier 1 (full DB-driven, classifiers in manifest):**
```ts
// Constructor ran getMetadata() once → wrote classifiers to DB.
// GET /api/site returns:
{
  id:          'gdp',
  plugin:      'sdmx-api',
  url:         'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
  auth:        { type: 'bearer', token: '***' },
  classifiers: { time: [{ code: 2020 }, { code: 2021 }], measure: [{ code: 'B1G' }] },
  display:     { measure: { B1G: { label: 'მშპ', color: '#005A9C' } } },
}
// buildStoreManifest: config.classifiers present → Tier 1 wins → no extra HTTP.
// Classifiers instantly available when React mounts. Observations: lazy (Suspense).
```

**Phase 2 — Tier 2 (structureUrl, classifiers fetched at bootstrap):**
```ts
// structureUrl: separate fast endpoint — SDMX /datastructure/ pattern.
// Structure rarely changes → long cache headers, CDN-cacheable.
// GET /api/site returns:
{
  id:           'accounts',
  plugin:       'sdmx-api',
  url:          'https://api.geostat.ge/sdmx/v1/data/NA_GE',
  structureUrl: 'https://api.geostat.ge/sdmx/v1/datastructure/NA_GE',
  auth:         { type: 'bearer', token: '***' },
}
// buildStoreManifest: structureUrl present, config.classifiers absent → Tier 2 fetch.
// await fetch(structureUrl) → ApiResponse → response.structure.classifiers + display
// → SuspenseStore gets classifiers BEFORE React mounts → filter dropdowns ready ✅
```

**Phase 2 — Tier 3 (single URL, structure embedded in data response):**
```ts
// Simplest config — one URL. API returns structure + observations together.
{
  id:     'regional',
  plugin: 'sdmx-api',
  url:    'https://api.geostat.ge/sdmx/v1/data/REGIONAL_GE',
  auth:   { type: 'bearer', token: '***' },
}
// buildStoreManifest: no classifiers, no structureUrl → Tier 3.
// SuspenseStore starts with classifiers:{}.
// First query(): throws Promise → fetch → ApiResponse { meta, structure, data }
//   → SuspenseStore.observations = data
//   → SuspenseStore.classifiers  = response.structure.classifiers (merged here)
// Filter dropdowns empty until first page render. Acceptable for Tier 3 datasources.
```

### DatasourceMetadata — bridge to classifiers

`plugin.getMetadata()` returns `DatasourceMetadata` (indicators + dimensions for Constructor query builder UI).
Constructor maps `DatasourceMetadata.dimensions` → `Record<string, Classifier>` and stores in DB.
This is a one-time setup step per datasource. After that: classifiers come from DB manifest (Tier 1).

```
Constructor datasource setup:
  1. Admin enters url + auth → [Test connection] → ok
  2. [Fetch structure] → plugin.getMetadata(config) → ApiResponse → DatasourceMetadata
  3. Constructor maps dimensions → Classifier[] — admin reviews/edits in UI
  4. Admin configures display (labels, colors) per code
  5. [Save] → writes to DB: { id, plugin, url, auth, classifiers, display }  ← Tier 1
  6. Next manifest fetch: classifiers + display in manifest response ✅
     (structureUrl no longer needed — Tier 1 takes over)
```

---

## Plugin registration (setupEngine.ts)

```ts
// src/app/setupEngine.ts

import { engine }            from '@geostat/engine'
import { sdmxApiPlugin }     from '@geostat/engine/plugins/sdmx-api'
import { restJsonPlugin }    from '@geostat/engine/plugins/rest-json'
import { staticPlugin }      from '@geostat/engine/plugins/static'
// import { csvPlugin }      from '@geostat/engine/plugins/csv'
// import { sqlPlugin }      from '@geostat/engine/plugins/sql'

export function setupEngine() {
  // Datasource plugins — each handles a different data format/protocol
  engine.registerDatasource(sdmxApiPlugin)    // SDMX-JSON API + Suspense
  engine.registerDatasource(restJsonPlugin)   // generic REST JSON → DataRow[]
  engine.registerDatasource(staticPlugin)     // inline Observation[] (dev/test)
  // engine.registerDatasource(csvPlugin)
  // engine.registerDatasource(sqlPlugin)

  // Node types
  engine.extend(nodeRegistry)
  nodeRegistry.register('landing-page', LandingPageRenderer)

  // DataSpec extensions
  engine.extendSpec('account-sequence', accountSequenceResolver)

  // Transform functions (for href path)
  engine.registerTransform('fromSDMX', fromSDMX)
}
```

Called once before `ReactDOM.createRoot`. Plugins available globally after this.

---

## Plugin implementations — examples

All plugins parse `ApiResponse<T>` envelope. `buildStoreManifest` calls `create(config, resolvedClassifiers, resolvedDisplay)` — classifiers/display already merged from Tier 1 + Tier 2 before `create()` is called. Plugin only handles data fetching and Tier 3 merging.

### sdmx-api plugin

```ts
// engine/core/src/plugins/sdmx-api.ts

export const sdmxApiPlugin: DatasourcePlugin = {
  id: 'sdmx-api', displayName: 'SDMX API',

  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    return new SuspenseStore(
      () => fetchWithAuth(config.url!, config.auth)
            .then(expectOk).then(r => r.json() as Promise<ApiResponse<Observation[]>>),
      resolvedClassifiers,   // Tier 1 or Tier 2 — already resolved by buildStoreManifest
      resolvedDisplay,       // SuspenseStore merges Tier 3 from response.structure if these are empty
    )
  },

  async testConnection(config) {
    const r = await fetchWithAuth(config.url!, config.auth).catch(e => ({ ok: false, message: String(e) }))
    if (!('ok' in r)) return r
    return { ok: r.ok, message: r.ok ? undefined : `HTTP ${(r as Response).status}` }
  },

  async getMetadata(config) {
    // Uses structureUrl if available (faster, structure-only response)
    const url = config.structureUrl ?? config.url!
    const response: ApiResponse = await fetchWithAuth(url, config.auth).then(expectOk).then(r => r.json())
    const classifiers = response.structure?.classifiers ?? {}
    return {
      indicators: [],   // extracted from classifiers['measure'] in real impl
      dimensions: Object.keys(classifiers).map(key => ({
        key, label: key,
        values: (Array.isArray(classifiers[key]) ? classifiers[key] as any[] : [])
          .map((e: any) => ({ code: String(e.code), label: String(e.label ?? e.code) })),
      })),
    }
  },
}
```

### rest-json plugin

```ts
// engine/core/src/plugins/rest-json.ts

interface RestJsonOptions { dataPath?: string }

export const restJsonPlugin: DatasourcePlugin<RestJsonOptions> = {
  id: 'rest-json', displayName: 'REST JSON',

  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    return new SuspenseStore(
      () => fetchWithAuth(config.url!, config.auth).then(expectOk).then(r => r.json())
            .then(raw => {
              // Supports both standard envelope and raw array
              if (raw && typeof raw === 'object' && 'meta' in raw) return raw as ApiResponse<Observation[]>
              return { meta: { id: config.id, prepared: new Date().toISOString() }, data: raw as Observation[] }
            }),
      resolvedClassifiers,
      resolvedDisplay,
    )
  },
}
```

### static plugin (Phase 1 / test — no HTTP)

```ts
// engine/core/src/plugins/static.ts

interface StaticOptions { observations: Observation[] }

export const staticPlugin: DatasourcePlugin<StaticOptions> = {
  id: 'static', displayName: 'Static (dev/test)',

  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    const obs = config.options?.observations ?? []
    // Promise.resolve — never suspends. Classifiers from Tier 1 (config fields).
    return new SuspenseStore(
      () => Promise.resolve({ meta: { id: config.id, prepared: '' }, data: obs }),
      resolvedClassifiers,   // config.classifiers — Tier 1, from TypeScript import
      resolvedDisplay,
    )
  },
}
```

---

## SuspenseStore — generic, format-agnostic

```ts
// engine/core/src/data/suspense-store.ts

class SuspenseStore implements DataStore {
  private observations: Observation[] | null = null
  private _classifiers: Record<string, Classifier>
  private _display:     Record<string, DisplayMap>
  private promise:      Promise<void>  | null = null

  constructor(
    private readonly fetcher: () => Promise<ApiResponse<Observation[]>>,  // full envelope
    classifiers: Record<string, Classifier> = {},   // Tier 1 or Tier 2 (pre-resolved)
    display:     Record<string, DisplayMap>  = {},
  ) {
    this._classifiers = classifiers
    this._display     = display
  }

  // After Tier 3 data load, classifiers getter returns the merged set.
  get classifiers(): Record<string, Classifier> { return this._classifiers }
  get display():     Record<string, DisplayMap>  { return this._display     }

  query(q: ObsQuery): EngineRow[] {
    if (this.observations === null) {
      if (!this.promise) {
        this.promise = this.fetcher()
          .then(res => {
            this.observations = res.data ?? []
            // Tier 3: merge structure if classifiers weren't pre-resolved (Tier 1/2)
            if (res.structure?.classifiers && Object.keys(this._classifiers).length === 0)
              this._classifiers = res.structure.classifiers
            if (res.structure?.display && Object.keys(this._display).length === 0)
              this._display = res.structure.display
            this.promise = null
          })
          .catch(err => { this.promise = null; throw new StoreError(err, isRetryable(err)) })
      }
      throw this.promise   // React Suspense catches — shows skeleton
    }
    return filterAndEncode(this.observations, q, this._classifiers)
  }

  invalidate(): void {
    this.observations = null
    this.promise      = null
  }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try { await this.fetcher(); return { ok: true } }
    catch (e) { return { ok: false, message: String(e) } }
  }
}
```

**Key:** `fetcher` is injected by the plugin — `SuspenseStore` has no knowledge of SDMX,
REST, CSV, or any format. Format knowledge lives in the plugin's `create()` only.
Tier 3 merge happens here because only SuspenseStore sees the full `ApiResponse`.

---

## fetchWithAuth — framework utility

```ts
// engine/core/src/data/fetch-auth.ts

function fetchWithAuth(url: string, auth?: AuthConfig): Promise<Response> {
  const headers: Record<string, string> = {}

  if (auth) {
    if (auth.type === 'bearer')  headers['Authorization'] = `Bearer ${auth.token}`
    if (auth.type === 'basic')   headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
    if (auth.type === 'apikey')  headers[auth.header] = auth.value
    if (auth.type === 'custom')  Object.assign(headers, auth.headers)
  }

  return fetch(url, { headers })
}
```

Plugins call `fetchWithAuth(config.url, config.auth)` — auth logic in one place.
Engine internals never touch auth details.

---

## Lazy loading — what reference platforms say

### Question
Should all stores fetch data at startup, or lazy per page?

### Reference platform answers

**Grafana:**
- Datasource instances: created at startup (plugin.create() — cheap, no HTTP).
- Data: lazy per panel. Each panel's query fires when the panel renders.
- Navigation to a dashboard: only that dashboard's panels query their datasources.
- Cache: per query+timeRange hash. Navigate back → cache hit → instant render.
- Prefetch on hover: optional Grafana plugin optimization — not core.

**Retool:**
- Resources (datasources): registered globally at startup (no data fetch).
- Queries: run on component mount. Not at startup. Not for every resource — only those
  on the active page.

**Builder.io:**
- Content: fetched per-page on navigation.
- Data sources: queried on component render.

### Our answer: structure at bootstrap, data lazy per page

```
bootstrap (async — awaits Tier 2):
  await engine.buildStoreManifest(manifest.datasources)
    Tier 1 (config.classifiers): synchronous — instant, no HTTP
    Tier 2 (config.structureUrl): fetch NOW, all in parallel
      GET …/datastructure/NA_GE  🌐  (accounts — Tier 2)
      (gdp: Tier 1 — no request. regional: Tier 3 — no request.)
    await all structure fetches complete
    plugin.create(config, resolvedClassifiers, resolvedDisplay) per config
    → SuspenseStore { observations: null, classifiers: ready }

React mounts:
  filter dropdowns: ✅ classifiers available (Tier 1 + Tier 2)
  data: not loaded yet

user navigates to /gdp:
  engine traverses GDP_PAGE
    → interpretSpec → gdpStore.query()
    → observations = null → throw Promise ← data fetch fires NOW
    React Suspense: skeleton shown
    fetch completes → ApiResponse { meta, data: Observation[] }
    re-render → query() cache hit → DataRow[] → chart

user navigates to /accounts:
  → accountsStore.query() → throw Promise → data fetch fires
  (gdpStore data not re-fetched — cached)

user navigates back to /gdp:
  → gdpStore.query() → cache hit → instant render ✅
```

**Result (Phase 2, mixed tiers):**

| Time | Event | HTTP |
|------|-------|------|
| t=0  | GET /api/site (manifest) | 1 |
| t=x  | GET …/datastructure/NA_GE (accounts Tier 2) | 1 |
| t=y  | React mounts — filters ready | 0 |
| t=y  | user → /gdp → GET …/data/GDP_GE | 1 |
| t=y  | user → /gdp → GET …/data/REGIONAL_GE (Tier 3 includes structure) | 1 |
| t=z  | user → /accounts → GET …/data/NA_GE | 1 |
| t=z' | user → /gdp → cache hit | 0 |
| **Total** | | **5** |

Structure pre-fetched only for Tier 2 datasources. Data: zero prefetch. Grafana's exact model.

### invalidate() — manual cache clear

```ts
// User clicks "Refresh" button or data update webhook arrives:
gdpStore.invalidate()   // clears cache
// Next render: query() throws Promise → fresh fetch → new data
```

---

## SiteManifest — full JSON structure

```json
{
  "datasources": [
    {
      "id":     "accounts",
      "plugin": "sdmx-api",
      "url":    "https://api.geostat.ge/sdmx/v1/data/NA_GE",
      "auth":   { "type": "bearer", "token": "***" }
    },
    {
      "id":     "gdp",
      "plugin": "sdmx-api",
      "url":    "https://api.geostat.ge/sdmx/v1/data/GDP_GE",
      "auth":   { "type": "bearer", "token": "***" }
    },
    {
      "id":     "regional",
      "plugin": "sdmx-api",
      "url":    "https://api.geostat.ge/sdmx/v1/data/REGIONAL_GE",
      "auth":   { "type": "bearer", "token": "***" }
    }
  ],
  "pages": {
    "gdp": {
      "type":     "container-page",
      "id":       "gdp",
      "title":    "მშპ",
      "storeKey": "gdp",
      "children": [ … ]
    }
  },
  "nav":    [ … ],
  "tokens": { "--color-primary": "#005A9C" },
  "chrome": { "AppHeader": "default" }
}
```

All fields JSON-safe. `datasources` replaces old `stores` (which was NOT JSON-safe).

---

## Bootstrap sequence (main.tsx)

```ts
async function bootstrap() {
  // Step 1: register plugin types (code, runs once)
  setupEngine()

  // Step 2: fetch manifest — one HTTP request, all config in one response
  const manifest = await fetch('/api/site').then(r => r.json()) as SiteManifest

  // Step 3: tokens before React — no FOUC
  applyTokens(manifest.tokens ?? {})

  // Step 4: build stores — ASYNC, awaits Tier 2 structure fetches
  //   Tier 1 (config.classifiers): sync — instant.
  //   Tier 2 (config.structureUrl): fetch now, all parallel via Promise.all.
  //   Tier 3 (neither): SuspenseStore { classifiers:{} } — fills on first data load.
  //   After await: all Tier 1 + Tier 2 classifiers populated, observations: null.
  const stores = await engine.buildStoreManifest(manifest.datasources)

  // Step 5: mount React — classifiers ready, data lazy
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ThemeProvider theme={GEOSTAT_THEME}>
      <SiteProvider stores={stores} pages={manifest.pages} nav={manifest.nav} chrome={manifest.chrome}>
        <BrowserRouter><AppRoutes /></BrowserRouter>
      </SiteProvider>
    </ThemeProvider>
  )
}
// HTTP before React mounts: 1 manifest + N structure fetches (Tier 2 datasources only)
// HTTP data requests: 0 — fired lazily on page render via Suspense
```

---

## Phase 1 → Phase 2 migration

### Phase 1 (now — development)

```ts
// src/data/datasources.ts  (TypeScript, not DB)
import { GDP_FACTS, GDP_CLASSIFIERS, GDP_DISPLAY }               from './gdp/raw'
import { ACCOUNTS_FACTS, ACCOUNTS_CLASSIFIERS, ACCOUNTS_DISPLAY } from './accounts/raw'
import { fromGDPFacts, fromAccountsFacts }                        from './adapters'

export const DATASOURCE_CONFIGS: DatasourceInstanceConfig[] = [
  {
    id:          'gdp',
    plugin:      'static',
    classifiers: GDP_CLASSIFIERS,    // Tier 1 — top-level, universal field
    display:     GDP_DISPLAY,        // Tier 1 — top-level, universal field
    options:     { observations: fromGDPFacts(GDP_FACTS) },
  },
  {
    id:          'accounts',
    plugin:      'static',
    classifiers: ACCOUNTS_CLASSIFIERS,
    display:     ACCOUNTS_DISPLAY,
    options:     { observations: fromAccountsFacts(ACCOUNTS_FACTS) },
  },
]

// main.tsx — Phase 1 bootstrap
const stores = await engine.buildStoreManifest(DATASOURCE_CONFIGS)
// All Tier 1 → synchronous. No HTTP. static plugin: Promise.resolve(obs) — instant.
// After await: stores ready, classifiers populated, React can mount.
```

### Phase 1.5 (real API, hardcoded URLs)

```ts
export const DATASOURCE_CONFIGS: DatasourceInstanceConfig[] = [
  { id: 'gdp',      plugin: 'sdmx-api', url: 'https://api.geostat.ge/sdmx/v1/data/GDP_GE',      auth: { type: 'bearer', token: ENV.API_TOKEN } },
  { id: 'accounts', plugin: 'sdmx-api', url: 'https://api.geostat.ge/sdmx/v1/data/NA_GE',       auth: { type: 'bearer', token: ENV.API_TOKEN } },
  { id: 'regional', plugin: 'sdmx-api', url: 'https://api.geostat.ge/sdmx/v1/data/REGIONAL_GE', auth: { type: 'bearer', token: ENV.API_TOKEN } },
]
// main.tsx: same as Phase 1 — buildStoreManifest(DATASOURCE_CONFIGS)
// Now fetches from real API, Suspense handles loading.
```

### Phase 2 (Constructor live — datasource configs from DB)

```ts
// main.tsx — one line changes
const manifest = await fetch('/api/site').then(r => r.json()) as SiteManifest
// manifest.datasources = [{ id:'gdp', plugin:'sdmx-api', url:'…', auth:{…} }, …]
const stores = engine.buildStoreManifest(manifest.datasources)
// Zero src/data/ files. Datasource config lives in DB. Constructor writes it.
```

### Phase 2+ (multi-tenant)

```
Geostat tenant:  GET /api/site → datasources:[{ url:'gdp.geostat.ge/…' }]
ENstat tenant:   GET /api/site → datasources:[{ url:'data.stat.ee/…'   }]
ArmStat tenant:  GET /api/site → datasources:[{ url:'armstat.am/…'     }]

Same plugins registered in setupEngine(). Different instance configs per tenant.
Zero code change. Just DB records.
```

---

## Constructor UI — datasource management

```
Constructor Datasource Panel:
  [+ Add datasource]
  → type picker: engine.listDatasources() → ['sdmx-api', 'rest-json', 'csv', …]
  → plugin-specific config form (url, auth, options)
  → [Test connection] → plugin.testConnection(config) → { ok, message }
  → [Save]           → writes DatasourceInstanceConfig to DB
  → [Browse data]    → plugin.getMetadata(config) → indicators + dimensions → query builder
```

Constructor writes JSON configs. Engine reads at next page load. Zero deploys.

---

## Implementation checklist

```
New types (engine/core):
☐ engine/core/src/data/api-response.ts    — ApiResponse<T>, ResponseMeta, DatasourceStructure
☐ engine/core/src/data/suspense-store.ts  — SuspenseStore(dataFetcher, classifiers, display)
                                                 Tier 3 merge: response.structure if classifiers empty
☐ engine/core/src/data/fetch-auth.ts      — fetchWithAuth(url, auth?), expectOk(r)

Plugin implementations (engine/core):
☐ engine/core/src/plugins/sdmx-api.ts     — parses ApiResponse envelope, structureUrl → getMetadata
☐ engine/core/src/plugins/rest-json.ts    — ApiResponse + raw array fallback
☐ engine/core/src/plugins/static.ts       — Promise.resolve(obs), classifiers from config (Tier 1)

Engine registry (engine/core):
☐ engine/core/src/registry/engine.ts
    registerDatasource(plugin)
    listDatasources() → string[]
    buildStoreManifest(configs): Promise<Record<string, DataStore>>
      — Tier 1: config.classifiers (sync)
      — Tier 2: structureUrl fetch (parallel, awaited)
      — plugin.create(config, resolvedClassifiers, resolvedDisplay)

Application (src/):
☐ src/data/datasources.ts    — DATASOURCE_CONFIGS: DatasourceInstanceConfig[] (Phase 1 TypeScript)
☐ src/app/setupEngine.ts     — engine.registerDatasource(sdmxApiPlugin/restJsonPlugin/staticPlugin)
☐ src/main.tsx               — const stores = await engine.buildStoreManifest(configs)  ← async
☐ Migrate src/data/*/store.ts   — ExternalStore → DATASOURCE_CONFIGS entry (top-level classifiers/display)
☐ Delete src/data/store-manifest.ts — replaced by datasources.ts + buildStoreManifest()
```

---

## Code reference

```
types/all-types.md
  — ApiResponse<T>, ResponseMeta, DatasourceStructure    (response envelope)
  — AuthConfig                                           (bearer/basic/apikey/custom/none)
  — DatasourceInstanceConfig<TOptions>                   (url, structureUrl, classifiers, display, options)
  — DatasourcePlugin<TOptions>                           (create, testConnection?, getMetadata?)
  — DatasourceMetadata                                   (Constructor query builder)
  — DataStore                                            (+ testConnection?, getMetadata? optional)
  — EngineInstance                                       (registerDatasource, listDatasources, buildStoreManifest async)
  — SiteManifest                                         (datasources: DatasourceInstanceConfig[])

examples/multi-store-platform.md   — Phase 1 + Phase 2 runtime simulation, all three tiers
architecture/07-filter-system.md   — filter options via OptionsSource (same stores, same classifiers)
```