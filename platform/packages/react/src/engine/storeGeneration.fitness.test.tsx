// @vitest-environment jsdom
//
// ── Store-generation cache identity — the readiness contract (G3 / canvas) ────
//
//  THE BUG THIS PINS (regional-page "some switch, some don't"):
//    The async row cache (`useNodeRows._promiseCache`) is MODULE-LEVEL and keyed by
//    recipe ⊕ data-state ⊕ store-KEY. On the runtime runner the store map is built
//    once at boot, so that key is complete. But the authoring canvas builds its live
//    store map REACTIVELY (useLivePreviewStores) and REBUILDS it whenever the session
//    sources / canBuildLive change — minting a NEW ApiStore GENERATION with a COLD
//    cache under the SAME key. Keyed only by the store-key STRING, a node whose entry
//    was warmed against the PRIOR generation REUSED that resolved promise against the
//    new cold store — serving the old generation's rows (or a poisoned rejection),
//    while nodes whose depKey happened to move got a fresh warm. That split is exactly
//    the owner's "some switch, some don't — at some moment it switches, then it doesn't".
//
//    Fix: the cacheKey folds a per-store-INSTANCE generation id (storeGenId). A stable
//    store keeps its id (byte-identical steady state — the runner is unchanged); a
//    rebuilt store gets a fresh id ⇒ a fresh warm against its own cache.
//
//  This test drives EVERY data-bound element kind on a multi-store page THROUGH the
//  real renderNode pipeline against an async (caps.sync=false) store, then swaps the
//  store map for a NEW generation (new instances, DIFFERENT data, SAME keys) and
//  asserts every element re-binds to the NEW generation's data — never the stale one.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup }               from '@testing-library/react'
import { createElement, type ReactNode }      from 'react'
import { staticStore }                        from '@statdash/engine'
import type { DataStore, EngineRow, QueryResult, SectionContext, StoreQuery } from '@statdash/engine'
import { renderNode }                         from './renderNode'
import { nodeRegistry }                       from './register-all'
import { __promiseCacheForTest }              from './useNodeRows'
import type { RenderContext, NodeBase, NodeDef } from './types'

// A leaf data shell — reflects ctx.rows' first value into the DOM so we can read
// which store generation bound. Registered for every element type under test so the
// engine dispatch (zero type branching) drives each identically.
function valueShell(_def: NodeBase, ctx: RenderContext): ReactNode {
  const rows = ctx.rows ?? []
  return createElement('span', { 'data-testid': `v-${(_def as { id?: string }).id}` }, String(rows[0]?.['value'] ?? 'none'))
}

// A deterministic async store (caps.sync=false) — mirrors CachedStore(ApiStore)'s
// Cache-Aside contract: queryAsync warms, querySync serves the warm slice (throws
// cold). `value` is the generation's signature so a stale read is visible.
function makeGenStore(value: number): DataStore {
  let warm = false
  const rows: EngineRow[] = [{ geo: 'GE', value } as EngineRow]
  return {
    ...staticStore,
    caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: false },
    async queryAsync(): Promise<QueryResult> { warm = true; return { state: 'done', data: rows } },
    querySync(q: StoreQuery, _ctx: SectionContext): EngineRow[] {
      if (!warm) throw new Error('cold — queryAsync must warm first')
      return q.type === 'val' ? [{ value }] : rows
    },
  } as DataStore
}

// The representative multi-store page: pageStoreKey routes every node to the
// 'regional' store (the regional-page shape); each element kind carries its own spec.
function ctxFor(store: DataStore): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2024 } },
    stores:         { gdp: staticStore, accounts: staticStore, regional: store },
    pageStoreKey:   'regional',
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:    { current: 'year', available: [], set: () => {} },
    rows:           [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     (n: NodeDef, o?: Partial<RenderContext>): ReactNode =>
      renderNode(n as NodeBase, o ? { ...holder.ctx, ...o } : holder.ctx),
  } as unknown as RenderContext
  return holder.ctx
}

// Every data-bound element kind on the regional page, each with a distinct spec so
// the recipe axis differs (no cross-node collision) — query (section/geograph body),
// val (kpi/row-list). All inherit pageStoreKey 'regional'.
const ELEMENTS: NodeBase[] = [
  { type: 'gen-el', id: 'section', data: { type: 'query', query: { measure: 'GVA', filter: { geo: { $ne: '_T' } } } } } as unknown as NodeBase,
  { type: 'gen-el', id: 'geograph', data: { type: 'query', query: { measure: 'GVA' } } } as unknown as NodeBase,
  { type: 'gen-el', id: 'kpi', data: { type: 'row-list', rows: [{ code: 'GVA' }] } } as unknown as NodeBase,
]

beforeEach(() => {
  __promiseCacheForTest.clear()
  nodeRegistry.register('gen-el', 'default', valueShell, { category: 'data' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('store-generation cache identity — every element rebinds on rebuild', () => {
  it('gen-1 binds; after a store REBUILD (new instance, same keys), every element shows gen-2 data', async () => {
    // Generation 1 — every element warms + binds 111.
    const gen1 = makeGenStore(111)
    let r!: ReturnType<typeof render>
    await act(async () => {
      r = render(createElement('div', null, ...ELEMENTS.map((n) => renderNode(n, ctxFor(gen1)))) as React.ReactElement)
    })
    for (const el of ELEMENTS) {
      expect(r.getByTestId(`v-${el.id}`).textContent).toBe('111')
    }

    // The canvas rebuilds the live store map: a BRAND-NEW instance, DIFFERENT data,
    // SAME { gdp, accounts, regional } keys + SAME pageStoreKey. Pre-fix, the stale
    // gen-1 promises (keyed without instance identity) were reused → 111 forever.
    cleanup()
    const gen2 = makeGenStore(999)
    await act(async () => {
      r = render(createElement('div', null, ...ELEMENTS.map((n) => renderNode(n, ctxFor(gen2)))) as React.ReactElement)
    })
    for (const el of ELEMENTS) {
      expect(r.getByTestId(`v-${el.id}`).textContent).toBe('999')
    }
  })

  it('a STABLE store keeps one cache entry per element (byte-identical steady state — no churn)', async () => {
    const store = makeGenStore(42)
    const ctx   = ctxFor(store)
    await act(async () => {
      render(createElement('div', null, ...ELEMENTS.map((n) => renderNode(n, ctx))) as React.ReactElement)
    })
    const afterFirst = __promiseCacheForTest.size
    // Re-render the SAME elements against the SAME store instance — same genId ⇒ same
    // keys ⇒ NO new promises (the store-instance axis must not churn a stable store).
    cleanup()
    await act(async () => {
      render(createElement('div', null, ...ELEMENTS.map((n) => renderNode(n, ctx))) as React.ReactElement)
    })
    expect(__promiseCacheForTest.size).toBe(afterFirst)
  })
})
