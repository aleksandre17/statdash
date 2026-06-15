---
name: config_manifest_bootstrap
description: SiteManifest, SiteBootstrap interfaces and the Phase 1 to Phase 2 evolution contract
metadata:
  type: reference
---

# SiteManifest & SiteBootstrap — Bootstrap Contract

## SiteManifest
JSON-serializable site configuration. Phase 1 built locally; Phase 2 fetched from API.

```ts
export interface SiteManifest {
  /** All page configs — keyed by pageId, drives dynamic routes */
  pages:        Record<string, NodePageConfig>
  
  /** Sidebar nav entries */
  nav:          NavEntry[]
  
  /** Chrome slot → variant key or full ChromeEntry (Constructor writes; default = 'default') */
  chrome:       Record<string, ChromeEntry>
  
  /** Brand identity data injected into chrome shells via useChromeConfig() */
  chromeConfig: ChromeConfig
  
  /** Locale configuration */
  i18n:         I18nConfig
}
```

---

## SiteBootstrap
Runtime shell data: manifest + resolved DataStore instances.

```ts
export interface SiteBootstrap {
  manifest: SiteManifest
  /** DataStore instances — keyed by storeKey, injected into SiteProvider */
  stores:   Record<string, DataStore>
}
```

Phase 1: both built locally  
Phase 2: manifest fetched from API; stores built via `engine.buildStoreManifest(manifest.datasources)`

---

## bootstrapSite()

Entry point called in main.tsx:

```ts
export async function bootstrapSite(): Promise<SiteBootstrap> {
  return import.meta.env.VITE_STORE_MODE === 'api'
    ? fetchApi()
    : fetchStatic()
}
```

### Layer 1: static (VITE_STORE_MODE=static, default)
- In-memory ExternalStore
- No network; instant; dev default
- Returns: `{ manifest: buildManifest(), stores: STORE_MANIFEST }`

### Layer 2: mock API (VITE_STORE_MODE=api)
- MSW intercepts `fetch('/api/datasets/*')`
- Simulates latency, loading states, error scenarios
- Switch: `npm run dev:api`
- Builds ExternalStore from raw datasets + adapters (fromGDPFacts, fromSDMX, fromRegionalFacts)

---

## STORE_MANIFEST (Phase 1 static registry)

Defined in `store-manifest.ts`:

```ts
export const STORE_MANIFEST: Record<string, DataStore> = {
  gdp:      gdpStore,
  accounts: accountsStore,
  regional: regionalStore,
}
```

Maps storeKey (from PageDef.storeKey) to resolved DataStore instances.

**Pattern:** Grafana datasource manifest.
- Page config holds `storeKey: 'gdp'` (declaration)
- Store manifest holds `'gdp': gdpStore` (single registration)
- SiteProvider resolves at runtime (zero coupling)

**Adding new datasource (Phase 1):**
1. Create `src/data/<name>/store.ts`
2. Add entry to STORE_MANIFEST
3. App.tsx, SiteProvider, Page.tsx — no changes

---

## Phase 1 → Phase 2: The Single Switch

Current (Phase 1) — `site-manifest.ts`:
```ts
function buildManifest(): SiteManifest {
  return {
    pages:        pagesRecord(listPages()),
    nav:          NAV,
    chrome:       GLOBAL_CHROME,
    chromeConfig: CHROME_CONFIG,
    i18n:         I18N_CONFIG,
  }
}

async function fetchStatic(): Promise<SiteBootstrap> {
  await Promise.resolve()
  return { manifest: buildManifest(), stores: STORE_MANIFEST }
}
```

Future (Phase 2) — two lines change:
```ts
async function fetchStatic(): Promise<SiteBootstrap> {
  const manifest = await fetch('/api/site').then(r => r.json())
  const stores   = await engine.buildStoreManifest(manifest.datasources)
  return { manifest, stores }
}
```

Everything else stays.

---

## Three Datasources

From store-manifest.ts:

| storeKey   | Adapter          | Raw Data         | Classifiers                  |
|-----------|------------------|------------------|------------------------------|
| gdp       | fromGDPFacts     | GDP_DISPLAY      | GDP_CLASSIFIERS (time)      |
| accounts  | fromSDMX         | ACCOUNTS_DISPLAY | ACCOUNTS_CLASSIFIERS (time, account, measure) |
| regional  | fromRegionalFacts| regionalRaw      | REGIONAL_CLASSIFIERS (time, geo, sector) |

Each datasource:
- Exports a static store (gdpStore, accountsStore, regionalStore)
- Has an adapter that transforms raw JSON → Facts
- Has classifiers (static metadata: codes, labels, colors, order)

Phase 2: Adapters load only at HTTP boundary; ExternalStore constructor takes raw data + classifiers.

---

## Navigation and Chrome

**NAV** — sidebar navigation entries (from nav.config.ts)  
**GLOBAL_CHROME** — chrome slot definitions (from chrome-config.ts)  
**CHROME_CONFIG** — brand identity (from site-config.ts)  
**I18N_CONFIG** — locale list (from site-config.ts)

These are bundled in SiteManifest for consistent bootstrap.
