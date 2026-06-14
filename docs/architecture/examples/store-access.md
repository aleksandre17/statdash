# store-access.ts

> Reference example (TypeScript) — documentation, not compiled source.

```ts
/**
 * Example — Store access patterns (E-3 resolution)
 *
 * Every registered node can independently access any store.
 * Two paths: declarative (DataSpec) and imperative (ctx.stores).
 * storeKey on NodeBase cascades to descendants (CSS cascade / React Context pattern).
 */

import type {
  ContainerPageNode, SectionNode, NodeDef,
  DataStore, RenderContext, ChildrenArg,
  NodeBase, DataRow,
} from '@geostat/react'


// ═══════════════════════════════════════════════════════════════════════════
// Path 1 — declarative: DataSpec.storeId (Constructor-ready, JSON-serializable)
// ═══════════════════════════════════════════════════════════════════════════
//
// Any node with data: DataSpec can reference any registered store via storeId.
// interpretSpec resolves: href → storeId → pageStoreKey → 'default'

const MULTI_STORE_PAGE: ContainerPageNode = {
  type:     'container-page',
  id:       'dashboard',
  title:    'Dashboard',
  storeKey: 'gdp',              // page default — all children fall back to 'gdp'

  children: [
    // ── Uses page default (storeKey: 'gdp') ──────────────────────────────
    {
      type: 'kpi-strip',
      data: { type: 'row-list', indicators: ['B1G', 'P3'] },
      // storeId absent → pageStoreKey: 'gdp' ✅
    },

    // ── Section with its own storeKey — cascades to all children ─────────
    {
      type:     'section',
      storeKey: 'accounts',     // overrides pageStoreKey for this subtree
      children: [
        { type: 'chart' },      // ctx.rows inherited from section — no store query ✅
        { type: 'table' },      // ctx.rows inherited from section — no store query ✅
        {
          type: 'kpi-strip',
          data: { type: 'row-list', indicators: ['B1G'] },
          // storeId absent → pageStoreKey: 'accounts' (nearest ancestor) ✅
        },
      ],
    } as SectionNode,

    // ── Explicit storeId overrides nearest ancestor storeKey ─────────────
    {
      type: 'section',
      data: {
        type:    'timeseries',
        storeId: 'regional',    // explicit — ignores pageStoreKey: 'gdp'
        indicator: 'GVA_TOTAL',
      },
      children: [
        { type: 'chart' },      // ctx.rows from regional store ✅
        { type: 'table' },
      ],
    } as SectionNode,
  ],
}


// ═══════════════════════════════════════════════════════════════════════════
// Dot-notation store keys — naming convention, no framework magic
// ═══════════════════════════════════════════════════════════════════════════
//
// Store keys are plain strings. 'accounts.user' is valid — just a key.
// Dot-notation = human-readable namespacing convention. No path resolution.

declare const accountsStore:     DataStore
declare const accountsUserStore: DataStore
declare const gdpStore:          DataStore

const STORES = {
  'gdp':            gdpStore,
  'accounts':       accountsStore,
  'accounts.user':  accountsUserStore,   // 'accounts.user' = flat string key ✅
}

// Node config referencing 'accounts.user':
const USER_NODE: NodeBase & { type: 'user-card' } = {
  type:    'user-card',
  storeId: 'accounts.user',             // flat key — no path resolution needed
  data:    { type: 'query', indicator: 'USER_PROFILE' },
} as unknown as NodeBase & { type: 'user-card' }
// → interpretSpec → stores['accounts.user'].query({ indicators: ['USER_PROFILE'] }) ✅

// Same store, different data via query parameters — no sub-store needed:
const USER_NODE_ALT: NodeDef = {
  type: 'user-card',
  data: {
    type:      'query',
    storeId:   'accounts',              // same store
    indicator: 'USER_PROFILE',          // indicator differentiates the data ✅
  },
} as unknown as NodeDef


// ═══════════════════════════════════════════════════════════════════════════
// Cascade filter options — OptionsSource.type='query' pattern
// ═══════════════════════════════════════════════════════════════════════════
//
// Cascade options: OptionsSource — any DataSpec, any store.
// options.data.storeId routes to the named store; absent → page default store.

const FILTER_WITH_YEAR_OPTIONS = {
  type: 'filter-bar',
  bars: {
    main: {
      position: 'sticky',
      filters: {
        // Available years loaded from gdp store:
        time: {
          type:    'cascade',
          options: {
            type:       'query',
            data:       { type: 'query', storeId: 'gdp', indicator: 'YEAR_LIST' },
            valueField: 'code',
            labelField: 'label',
            // → [{ code: 2020, label: '2020' }, { code: 2021, label: '2021' }, ...]
          },
        },
        // Available regions loaded from regional store:
        geo: {
          type:    'cascade',
          options: {
            type:       'query',
            data:       { type: 'query', storeId: 'regional', indicator: 'GEO_LIST' },
            valueField: 'code',
            labelField: 'label',
          },
        },
      },
    },
  },
} as unknown as NodeDef
// useFilters() → resolveOptions(param.options, ctx, store) → year DataRow[] → select options ✅


// ═══════════════════════════════════════════════════════════════════════════
// Path 2 — imperative: ctx.stores (renderer-level, multi-store, reactive)
// ═══════════════════════════════════════════════════════════════════════════
//
// ctx.stores: Record<string, DataStore> — ALL registered stores, every renderer.
// Use when: multiple stores in one node, or reactive loading state needed.

import { useStoreQuery } from '@geostat/react'

// Renderer receives ctx.stores — full store registry always available:
function MultiStoreRenderer(def: NodeBase, ctx: RenderContext, children: ChildrenArg) {
  return <MultiStoreInner def={def} stores={ctx.stores} />
}

// Inner component (hooks allowed here — not in renderer body):
function MultiStoreInner({ def, stores }: { def: NodeBase; stores: Record<string, DataStore> }) {
  // Access any store — independently, simultaneously:
  const gdp      = useStoreQuery(stores, 'gdp',           { type: 'row-list', indicators: ['B1G'] })
  const accounts = useStoreQuery(stores, 'accounts',      { type: 'row-list', indicators: ['D1']  })
  const regional = useStoreQuery(stores, 'regional',      { type: 'timeseries', indicator: 'GVA_TOTAL' })
  const users    = useStoreQuery(stores, 'accounts.user', { type: 'query', indicator: 'USER_PROFILE' })

  if (gdp.isLoading || accounts.isLoading) return null  // skeleton handled by engine Suspense

  // Combine data from multiple stores in one renderer ✅
  return <div>{/* render gdp.data + accounts.data + regional.data */}</div>
}

// declare to satisfy type check:
declare const React: { createElement: (...args: unknown[]) => unknown }
declare function MultiStoreInner(props: { def: NodeBase; stores: Record<string, DataStore> }): unknown
declare const div: unknown


// ═══════════════════════════════════════════════════════════════════════════
// storeKey cascade — full example
// ═══════════════════════════════════════════════════════════════════════════
//
// Nearest ancestor storeKey wins → ctx.pageStoreKey for descendants.
// Engine: if (node.storeKey) ctx = { ...ctx, pageStoreKey: node.storeKey }

//  page storeKey:'gdp'
//    ├── kpi-strip (no storeId, no storeKey) → pageStoreKey: 'gdp' ✅
//    ├── section storeKey:'accounts'
//    │     ├── chart (no storeId)            → ctx.rows inherited, no query ✅
//    │     ├── table (no storeId)            → ctx.rows inherited, no query ✅
//    │     └── kpi-strip (no storeId)        → pageStoreKey: 'accounts' ✅ (nearest: section)
//    └── section (no storeKey)
//          └── chart storeId:'regional'      → uses 'regional' explicitly ✅ (overrides page)


// ═══════════════════════════════════════════════════════════════════════════
// What NOT to do
// ═══════════════════════════════════════════════════════════════════════════

// ❌ storeId: 'regional' assuming it means 'gdp.regional'
//    storeId is always absolute — 'regional' looks up stores['regional'], not stores['gdp.regional']
//    If you want 'gdp.regional', register it explicitly: stores: { 'gdp.regional': regionalStore }
//    and use storeId: 'gdp.regional'

// ❌ Path composition: storeId resolved relative to pageStoreKey
//    'accounts' + 'user' → 'accounts.user'  ← not supported, not needed
//    Use explicit storeId: 'accounts.user' (flat key, always absolute)

// ❌ Accessing store outside renderer: DataSpec in config = declarative.
//    store.query() calls belong in renderer inner component or interpretSpec — not in config.

// ✅ One store, multiple data shapes: different indicator/dims in DataSpec, same storeId
// ✅ Multiple stores: useStoreQuery with different storeIds in renderer inner component
// ✅ Dot-notation keys: 'accounts.user', 'gdp.regional' — valid flat strings, no magic
// ✅ storeKey on any node: cascades to descendants, nearest ancestor wins
```
