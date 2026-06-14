# multi-store-platform.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Multi-store platform — runtime simulation, both phases
 *
 * Phase 1: TypeScript configs, static observations, classifiers from imports (Tier 1)
 * Phase 2: manifest from API, observations lazy via Suspense, structure via structureUrl (Tier 2)
 *          or embedded in data response (Tier 3)
 *
 * Standard response envelope: ApiResponse<T> = { meta, structure?, data? }
 * Three-tier classifiers/display resolution: config → structureUrl → data response
 */

import type {
  DatasourcePlugin, DatasourceInstanceConfig, DatasourceStructure,
  ApiResponse, DataStore, SiteManifest, ObsQuery, EngineRow,
  Observation, Classifier, DisplayMap, AuthConfig, ResponseMeta,
} from '@geostat/engine'
import { engine }                            from '@geostat/engine'
import type { ContainerPageNode, RenderContext, NodeBase, ChildrenArg } from '@geostat/react'
import { SiteProvider, useStoreQuery }       from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// SuspenseStore — generic (no format knowledge)
// ═══════════════════════════════════════════════════════════════════════════
//
// Constructor args match the three resolution tiers:
//   Tier 1: initialClassifiers / initialDisplay — from config (in-manifest), instant
//   Tier 2: structureFetcher — called in buildStoreManifest, before React mounts
//   Tier 3: dataFetcher returns ApiResponse with structure embedded

class SuspenseStore implements DataStore {
  private observations: Observation[] | null = null
  private _classifiers: Record<string, Classifier>
  private _display:     Record<string, DisplayMap>
  private promise:      Promise<void> | null = null

  constructor(
    private readonly dataFetcher: () => Promise<ApiResponse<Observation[]>>,
    initialClassifiers: Record<string, Classifier> = {},   // Tier 1 or Tier 2 result
    initialDisplay:     Record<string, DisplayMap>  = {},  // Tier 1 or Tier 2 result
  ) {
    this._classifiers = initialClassifiers
    this._display     = initialDisplay
  }

  get classifiers(): Record<string, Classifier> { return this._classifiers }
  get display():     Record<string, DisplayMap>  { return this._display     }

  query(q: ObsQuery): EngineRow[] {
    if (this.observations === null) {
      if (!this.promise) {
        this.promise = this.dataFetcher().then(response => {
          this.observations = response.data ?? []
          // Tier 3: structure embedded in data response — merge, don't overwrite Tier 1/2
          if (response.structure?.classifiers && Object.keys(this._classifiers).length === 0)
            this._classifiers = response.structure.classifiers
          if (response.structure?.display && Object.keys(this._display).length === 0)
            this._display = response.structure.display
          this.promise = null
        })
      }
      throw this.promise   // React Suspense catches → skeleton shown
    }
    return filterObservations(this.observations, q)
  }

  invalidate(): void { this.observations = null; this.promise = null }

  async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try { await this.dataFetcher(); return { ok: true } }
    catch (e) { return { ok: false, message: String(e) } }
  }
}

declare function filterObservations(obs: Observation[], q: ObsQuery): EngineRow[]


// ═══════════════════════════════════════════════════════════════════════════
// fetchWithAuth — auth logic in one place (framework utility)
// ═══════════════════════════════════════════════════════════════════════════

function fetchWithAuth(url: string, auth?: AuthConfig): Promise<Response> {
  const headers: Record<string, string> = {}
  if (auth?.type === 'bearer') headers['Authorization'] = `Bearer ${auth.token}`
  if (auth?.type === 'basic')  headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
  if (auth?.type === 'apikey') headers[auth.header] = auth.value
  if (auth?.type === 'custom') Object.assign(headers, auth.headers)
  return fetch(url, { headers })
}

function expectOk(r: Response): Response {
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { retryable: r.status >= 500, status: r.status, attempts: 1 })
  return r
}


// ═══════════════════════════════════════════════════════════════════════════
// buildStoreManifest — async, resolves Tier 2 before returning
// ═══════════════════════════════════════════════════════════════════════════
//
// engine.buildStoreManifest() internally does this:
//
//   async function buildStoreManifest(configs): Promise<Record<string, DataStore>> {
//     const entries = await Promise.all(configs.map(async config => {
//       const plugin = DATASOURCE_REGISTRY[config.plugin]
//
//       // Tier 2: structureUrl → fetch NOW, before React mounts
//       let classifiers = config.classifiers ?? {}
//       let display     = config.display     ?? {}
//       if (config.structureUrl && Object.keys(classifiers).length === 0) {
//         const response: ApiResponse = await fetchWithAuth(config.structureUrl, config.auth)
//           .then(r => expectOk(r).json())
//         classifiers = response.structure?.classifiers ?? {}
//         display     = response.structure?.display     ?? {}
//       }
//
//       return [config.id, plugin.create(config, classifiers, display)]
//     }))
//     return Object.fromEntries(entries)
//   }
//
// Tier 1 (config.classifiers): synchronous, no HTTP.
// Tier 2 (structureUrl): all structure fetches run in PARALLEL via Promise.all.
// Tier 3 (data response): SuspenseStore handles at first query() call.


// ═══════════════════════════════════════════════════════════════════════════
// Plugin implementations
// ═══════════════════════════════════════════════════════════════════════════

// sdmx-api plugin — handles SDMX-JSON ApiResponse envelope
const sdmxApiPlugin: DatasourcePlugin = {
  id: 'sdmx-api', displayName: 'SDMX API',

  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    // resolvedClassifiers/Display: already merged from Tier 1 + Tier 2 by buildStoreManifest
    return new SuspenseStore(
      () => fetchWithAuth(config.url!, config.auth)
            .then(expectOk).then(r => r.json() as Promise<ApiResponse<Observation[]>>),
      resolvedClassifiers,
      resolvedDisplay,
    )
  },

  async testConnection(config) {
    try {
      const r = await fetchWithAuth(config.url!, config.auth)
      return { ok: r.ok, message: r.ok ? undefined : `HTTP ${r.status}` }
    } catch (e) { return { ok: false, message: String(e) } }
  },

  async getMetadata(config) {
    const response: ApiResponse = await fetchWithAuth(config.structureUrl ?? config.url!, config.auth)
      .then(expectOk).then(r => r.json())
    // Map DatasourceStructure → DatasourceMetadata for Constructor UI
    const classifiers = response.structure?.classifiers ?? {}
    return {
      indicators: [],   // extracted from classifiers['measure'] in real impl
      dimensions: Object.keys(classifiers).map(key => ({
        key,
        label: key,
        values: (Array.isArray(classifiers[key]) ? classifiers[key] as any[] : [])
          .map((e: any) => ({ code: String(e.code), label: String(e.label ?? e.code) })),
      })),
    }
  },
}

// rest-json plugin — same envelope, generic JSON payload
const restJsonPlugin: DatasourcePlugin<{ dataPath?: string }> = {
  id: 'rest-json', displayName: 'REST JSON',
  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    return new SuspenseStore(
      () => fetchWithAuth(config.url!, config.auth)
            .then(expectOk).then(r => r.json())
            .then(raw => {
              // Supports both envelope format and raw array
              if (raw && typeof raw === 'object' && 'meta' in raw) return raw as ApiResponse<Observation[]>
              return { meta: { id: config.id, prepared: new Date().toISOString() }, data: raw as Observation[] }
            }),
      resolvedClassifiers,
      resolvedDisplay,
    )
  },
}

// static plugin — no HTTP, all data from options (Phase 1 / test)
const staticPlugin: DatasourcePlugin<{ observations: Observation[] }> = {
  id: 'static', displayName: 'Static (dev/test)',
  create(config, resolvedClassifiers = {}, resolvedDisplay = {}) {
    const obs = config.options?.observations ?? []
    return new SuspenseStore(
      () => Promise.resolve({ meta: { id: config.id, prepared: '' }, data: obs }),
      // Tier 1 wins: config.classifiers already merged into resolvedClassifiers
      resolvedClassifiers,
      resolvedDisplay,
    )
  },
}


// ═══════════════════════════════════════════════════════════════════════════
// setupEngine — called once at startup
// ═══════════════════════════════════════════════════════════════════════════

function setupEngine() {
  engine.registerDatasource(sdmxApiPlugin)
  engine.registerDatasource(restJsonPlugin)
  engine.registerDatasource(staticPlugin)
}


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 — TypeScript configs, static data, classifiers from imports
// ═══════════════════════════════════════════════════════════════════════════

// Imports from TypeScript — same data as old ExternalStore pattern
declare const ACCOUNTS_FACTS:       Observation[]
declare const ACCOUNTS_CLASSIFIERS: Record<string, Classifier>
declare const ACCOUNTS_DISPLAY:     Record<string, DisplayMap>
declare const GDP_FACTS:            Observation[]
declare const GDP_CLASSIFIERS:      Record<string, Classifier>
declare const GDP_DISPLAY:          Record<string, DisplayMap>
declare function fromAccountsFacts(f: Observation[]): Observation[]
declare function fromGDPFacts(f: Observation[]): Observation[]

// Phase 1: DATASOURCE_CONFIGS in TypeScript (no DB, no HTTP)
const PHASE1_DATASOURCE_CONFIGS: DatasourceInstanceConfig[] = [
  {
    id:          'accounts',
    plugin:      'static',
    classifiers: ACCOUNTS_CLASSIFIERS,   // Tier 1 — in code, instant
    display:     ACCOUNTS_DISPLAY,       // Tier 1 — in code, instant
    options:     { observations: fromAccountsFacts(ACCOUNTS_FACTS) },
  },
  {
    id:          'gdp',
    plugin:      'static',
    classifiers: GDP_CLASSIFIERS,        // Tier 1 — in code, instant
    display:     GDP_DISPLAY,            // Tier 1 — in code, instant
    options:     { observations: fromGDPFacts(GDP_FACTS) },
  },
]

// bootstrap — Phase 1
async function bootstrapPhase1() {
  setupEngine()

  // buildStoreManifest: all Tier 1 → synchronous inside the async wrapper
  // No HTTP requests. Instant.
  const stores = await engine.buildStoreManifest(PHASE1_DATASOURCE_CONFIGS)
  //   stores = { accounts: SuspenseStore { classifiers: ACCOUNTS_CLASSIFIERS, obs: Observation[] }
  //              gdp:      SuspenseStore { classifiers: GDP_CLASSIFIERS,      obs: GDP_FACTS     } }
  //   ← instant, no HTTP. static plugin resolves Promise.resolve(obs) synchronously.

  const manifest = buildPhase1Manifest()
  applyTokens(manifest.tokens ?? {})

  // React mounts: stores have classifiers → filter dropdowns ready on first render ✅
  // mount(<SiteProvider stores={stores} pages={manifest.pages} nav={manifest.nav} />)
}

declare function buildPhase1Manifest(): SiteManifest
declare function applyTokens(tokens: Record<string, string>): void


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — manifest from API, observations lazy, structure via Tier 2
// ═══════════════════════════════════════════════════════════════════════════

// Manifest returned by GET /api/site — all JSON, from DB, zero code files
const PHASE2_MANIFEST_FROM_API: SiteManifest = {
  datasources: [
    {
      // Tier 2: structureUrl → fetched at bootstrap, before React mounts
      // filter dropdowns ready immediately. observations: lazy (Suspense).
      id:           'accounts',
      plugin:       'sdmx-api',
      url:          'https://api.geostat.ge/sdmx/v1/data/NA_GE',
      structureUrl: 'https://api.geostat.ge/sdmx/v1/datastructure/NA_GE',
      auth:         { type: 'bearer', token: 'tok_accounts' },
      //   structureUrl response: ApiResponse
      //   → { meta: { id:'NA_GE', ... }, structure: { classifiers: {...}, display: {...} } }
    },
    {
      // Tier 1: classifiers/display already in DB, come back in manifest
      // Constructor ran getMetadata() once → wrote classifiers to DB → in manifest forever
      id:           'gdp',
      plugin:       'sdmx-api',
      url:          'https://api.geostat.ge/sdmx/v1/data/GDP_GE',
      auth:         { type: 'bearer', token: 'tok_gdp' },
      classifiers:  { time: [{ code: 2020 }, { code: 2021 }, { code: 2022 }] }, // from DB
      display:      { measure: { B1G: { label: 'მშპ', color: '#005A9C' } } },   // from DB
      //   buildStoreManifest: config.classifiers present → Tier 1 wins → no structureUrl fetch
    },
    {
      // Tier 3: single URL, structure embedded in data response
      // simplest config — one URL — but filter dropdowns wait for data load
      id:     'regional',
      plugin: 'sdmx-api',
      url:    'https://api.geostat.ge/sdmx/v1/data/REGIONAL_GE',
      auth:   { type: 'bearer', token: 'tok_regional' },
      //   url response: ApiResponse<Observation[]>
      //   → { meta: {...}, structure: { classifiers: {...}, display: {...} }, data: [...] }
      //   classifiers available after FIRST data load
    },
  ],
  pages: {
    gdp: {
      type:     'container-page',
      id:       'gdp',
      title:    'მშპ',
      storeKey: 'gdp',      // default for all children → ctx.pageStoreKey = 'gdp'
      children: [
        {
          type: 'section',
          data: { type: 'timeseries', indicator: 'B1G' },
          // storeId absent → stores['gdp'] (Tier 1 classifiers: instant, obs: lazy)
        },
        {
          type: 'section',
          data: { type: 'timeseries', storeId: 'regional', indicator: 'GVA_TOTAL' },
          // storeId: 'regional' → stores['regional'] (Tier 3: obs + classifiers together)
        },
      ],
    } as unknown as ContainerPageNode,
  },
  nav:    [{ key: 'gdp', href: '/gdp', label: 'მშპ' }],
  tokens: { '--color-primary': '#005A9C' },
  chrome: { AppHeader: 'default' },
}

// bootstrap — Phase 2
async function bootstrapPhase2() {
  setupEngine()

  // Step 1: GET /api/site — one request, full manifest
  const manifest: SiteManifest = await fetch('/api/site').then(r => r.json())

  // Step 2: buildStoreManifest — async, resolves all Tier 2 in parallel
  const stores = await engine.buildStoreManifest(manifest.datasources)
  //
  // Internally — per datasource config, in parallel:
  //
  //   accounts (Tier 2 — structureUrl):
  //     fetch('https://api.geostat.ge/sdmx/v1/datastructure/NA_GE', Bearer tok_accounts) 🌐
  //     → ApiResponse → response.structure.classifiers + display
  //     → SuspenseStore(dataFetcher, classifiers, display)
  //
  //   gdp (Tier 1 — config.classifiers present):
  //     no HTTP — classifiers = config.classifiers, display = config.display
  //     → SuspenseStore(dataFetcher, GDP_CLASSIFIERS_FROM_DB, GDP_DISPLAY_FROM_DB)
  //
  //   regional (Tier 3 — neither):
  //     no HTTP — classifiers = {}, display = {}
  //     → SuspenseStore(dataFetcher, {}, {})
  //     (classifiers populated at first data query)
  //
  // All Tier 2 fetches run PARALLEL via Promise.all — total wait = slowest structure fetch.
  // After await: stores ready, all Tier 1 + Tier 2 classifiers populated.

  // Step 3: tokens BEFORE createRoot — no FOUC
  applyTokens(manifest.tokens ?? {})

  // Step 4: React mounts — classifiers for accounts + gdp ready → filter dropdowns work ✅
  //   accounts: classifiers from structureUrl fetch (Tier 2) ✅
  //   gdp:      classifiers from manifest config (Tier 1) ✅
  //   regional: classifiers empty until first data load (Tier 3)
  //
  // mount(
  //   <SiteProvider stores={stores} pages={manifest.pages} nav={manifest.nav}>
  //     <Router />
  //   </SiteProvider>
  // )
}


// ═══════════════════════════════════════════════════════════════════════════
// Runtime: user navigates to /gdp — step-by-step
// ═══════════════════════════════════════════════════════════════════════════

// engine traverses GDP_PAGE (storeKey:'gdp' → ctx.pageStoreKey = 'gdp')
//
// Section A — data: { type:'timeseries', indicator:'B1G' }
//   interpretSpec:
//     spec.storeId = absent → stores['gdp'] (ctx.pageStoreKey)
//     stores['gdp'].query({ … })
//     → observations = null → throw Promise       ← data fetch starts
//        GET https://…/data/GDP_GE  🌐
//        ApiResponse → { meta, data: Observation[] }
//        (structure absent — was already Tier 1 from manifest)
//
// Section B — data: { type:'timeseries', storeId:'regional', indicator:'GVA_TOTAL' }
//   interpretSpec:
//     spec.storeId = 'regional' → stores['regional']
//     stores['regional'].query({ … })
//     → observations = null → throw Promise       ← data fetch starts
//        GET https://…/data/REGIONAL_GE  🌐
//        ApiResponse → { meta, structure: { classifiers, display }, data: Observation[] }
//        (Tier 3: classifiers populate HERE, on first data load)
//
// React Suspense: both throw → <PageSkeleton />
// ∥  GDP fetch fires
// ∥  REGIONAL fetch fires
// Both parallel — no waterfall.
//
// GDP arrives:    gdpStore.observations populated, promise cleared
// REGIONAL arrives: regionalStore.observations + classifiers populated, promise cleared
//
// React re-renders:
//   Section A: gdpStore.query() → cache hit → DataRow[] → chart ✅
//   Section B: regionalStore.query() → cache hit → DataRow[] → chart ✅
//   filter dropdowns (gdp + accounts): already ready from bootstrap ✅
//   filter dropdowns (regional): now ready (classifiers from Tier 3 data response) ✅


// ═══════════════════════════════════════════════════════════════════════════
// Request timeline — Phase 2 full session
// ═══════════════════════════════════════════════════════════════════════════

//   t=0    GET /api/site                            ← 1 request: manifest
//   t=x    manifest arrives
//   t=x    GET …/datastructure/NA_GE               ← 1 request: accounts structure (Tier 2)
//          (gdp: Tier 1 — no request. regional: Tier 3 — no request yet.)
//   t=y    structure arrives → accounts classifiers ready
//   t=y    React mounts
//            accounts filter: ✅ classifiers ready (Tier 2)
//            gdp filter:      ✅ classifiers ready (Tier 1)
//            regional filter: ⏳ classifiers pending (Tier 3 — will load with data)
//
//   user navigates to /gdp
//   t=y    GET …/data/GDP_GE                        ← 1 request: gdp observations
//   t=y    GET …/data/REGIONAL_GE                   ← 1 request: regional obs + structure (Tier 3)
//   t=z    data arrives → page renders
//            regional filter: ✅ classifiers now ready
//
//   user navigates to /accounts
//   t=z    GET …/data/NA_GE                         ← 1 request: accounts observations
//   t=z'   data arrives → page renders
//
//   user navigates back to /gdp
//          gdpStore.query() → cache hit → instant ✅
//          regionalStore.query() → cache hit → instant ✅
//
//   Total HTTP requests: 5
//     1 manifest + 1 accounts-structure + 1 gdp-data + 1 regional-data + 1 accounts-data
//   Zero eager data prefetch at startup.
//   Structure pre-fetched only for Tier 2 datasources (configurable per datasource).


// ═══════════════════════════════════════════════════════════════════════════
// Renderer — multi-store access (imperative, for complex nodes)
// ═══════════════════════════════════════════════════════════════════════════

function CrossStoreRenderer(def: NodeBase, ctx: RenderContext, _children: ChildrenArg) {
  return <CrossStoreInner stores={ctx.stores} />
}

function CrossStoreInner({ stores }: { stores: Record<string, DataStore> }) {
  const gdp      = useStoreQuery(stores, 'gdp',      { type: 'row-list', indicators: ['B1G'] } as any)
  const regional = useStoreQuery(stores, 'regional', { type: 'timeseries', indicator: 'GVA_TOTAL' } as any)
  return <div>{/* render gdp.rows + regional.rows */}</div>
}

declare const React: { createElement: (...a: unknown[]) => unknown }
declare function CrossStoreInner(p: { stores: Record<string, DataStore> }): unknown
```
