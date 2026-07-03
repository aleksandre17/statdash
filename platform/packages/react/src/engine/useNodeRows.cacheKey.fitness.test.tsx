// @vitest-environment jsdom
//
// ── FF-NODEROWS-CACHE-NODE-UNIQUE — promise-cache key must be NODE-unique ─────
//
//  Regression lock for the regional cross-filter State-B bug (AR-36). The async
//  `_promiseCache` in useNodeRows is MODULE-LEVEL and shared across every node.
//  It was keyed on `depKey` = specDimKey(node.data) ⊕ varsKey — a DATA-DEPENDENCY
//  fingerprint that captures the covering FETCH (code×dims) + derived vars, but NOT
//  the client-side RECIPE (the DataSpec's pipe/encoding, node.transforms). Two
//  sibling nodes issuing the SAME covering fetch but shaping it differently — a
//  by-`geo` map and a `sector` pivot both fetching `measure=GVA, geo=…` — produced
//  BYTE-IDENTICAL depKeys and COLLIDED: the first to render populated the shared
//  entry with ITS rows, and the second was served the first node's resolution. Live
//  symptom: selecting a region left the composition panel showing the map's 11
//  by-region rows instead of the sector breakdown.
//
//  The fix folds a stable structural fingerprint of the node's row recipe into the
//  cache key. This test reproduces the collision precondition (two nodes, identical
//  query ⇒ identical specDimKey, DIFFERENT recipe) on the REAL async path
//  (ApiStore→CachedStore, mocked fetch) through renderNode, and asserts each node
//  resolves ITS OWN rows.
//
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup }            from '@testing-library/react'
import { createElement, Fragment, type ReactNode } from 'react'
import { ApiStore, CachedStore }           from '@statdash/engine'
import type { RawObsRow, EngineRow, DataStore } from '@statdash/engine'
import { renderNode }                      from './renderNode'
import { nodeRegistry }                    from './register-all'
import { __promiseCacheForTest }           from './useNodeRows'
import type { RenderContext, NodeBase, NodeDef } from './types'

// A leaf shell that reflects ctx.rows as one <li> per row (value text).
function dataShell(_def: NodeBase, ctx: RenderContext): ReactNode {
  const rows = ctx.rows ?? []
  return createElement(
    'ul',
    { 'data-testid': `shell-${(_def as { id?: string }).id}` },
    ...rows.map((r, i) =>
      createElement('li', { key: i }, String((r as unknown as Record<string, unknown>).value ?? '')),
    ),
  )
}

const BASE = 'https://api.test'
const mapRow = (raw: RawObsRow): EngineRow => ({ ...raw.dim_key, value: raw.obs_value ?? 0 })
function makeLiveStore(): DataStore {
  const api = new ApiStore(BASE, 'GDP_ANNUAL', ['geo'], {}, mapRow)
  return new CachedStore(api) as unknown as DataStore
}
function okResponse(rows: RawObsRow[]): () => Response {
  return () => new Response(JSON.stringify({ data: rows }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}
const RAW_ROWS: RawObsRow[] = [
  { time_period: '2024', dim_key: { geo: 'GE' }, obs_value: 111, obs_status: 'A', obs_attribute: {} },
  { time_period: '2024', dim_key: { geo: 'AM' }, obs_value: 222, obs_status: 'A', obs_attribute: {} },
]

function makeCtx(store: DataStore): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2024, geo: '' } },
    stores:         { main: store },
    pageStoreKey:   'main',
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

beforeEach(() => {
  __promiseCacheForTest.clear()
  nodeRegistry.register('cachekey-data', 'default', dataShell, { category: 'data' })
  vi.spyOn(global, 'fetch').mockImplementation(async () => okResponse(RAW_ROWS)())
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('FF-NODEROWS-CACHE-NODE-UNIQUE', () => {
  it('two sibling nodes with identical fetch (same specDimKey) but different recipe do NOT collide', async () => {
    // Node A: no transform ⇒ BOTH rows (values 111, 222).
    const nodeA = {
      type: 'cachekey-data',
      id:   'a',
      data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
    } as NodeBase
    // Node B: SAME query (⇒ identical specDimKey), but a `filter` recipe → ONE row (111).
    const nodeB = {
      type: 'cachekey-data',
      id:   'b',
      data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
      transforms: [{ op: 'filter', where: { geo: 'GE' } }] as unknown as NodeBase['transforms'],
    } as NodeBase
    const ctx = makeCtx(makeLiveStore())

    let result!: ReturnType<typeof render>
    await act(async () => {
      result = render(
        createElement(Fragment, null,
          renderNode(nodeA, ctx) as React.ReactElement,
          renderNode(nodeB, ctx) as React.ReactElement,
        ),
      )
    })

    const a = result.getByTestId('shell-a')
    const b = result.getByTestId('shell-b')

    // Node A keeps BOTH rows; Node B's filter recipe keeps ONE. A collision would
    // make B mirror A (or vice-versa) — the pre-fix failure mode.
    expect(a.querySelectorAll('li').length).toBe(2)
    expect(b.querySelectorAll('li').length).toBe(1)
    expect(a.textContent).toContain('111')
    expect(a.textContent).toContain('222')
    expect(b.textContent).toContain('111')
    expect(b.textContent).not.toContain('222')

    // Distinct recipes ⇒ distinct cache entries (not one shared/colliding entry).
    expect(__promiseCacheForTest.size).toBe(2)
  })

  it('two nodes with identical recipe + identical fetch but DIFFERENT store do NOT collide (C1 — store axis)', async () => {
    // Same recipe (no transforms) AND same query ⇒ IDENTICAL recipeKey AND depKey.
    // The ONLY thing that differs is the resolved store: renderNode lowers each node's
    // explicit `storeKey` into ctx.pageStoreKey (effectiveStoreKey precedence). The same
    // (recipe, data-state) resolved against DIFFERENT stores yields DIFFERENT rows, so
    // the cache key MUST include the store axis or the two nodes COLLIDE — the same
    // defect class the recipe fix closes. Pre-C1 (no store term) this is size === 1.
    const storeMain  = makeLiveStore()
    const storeOther = makeLiveStore()
    const ctx = makeCtx(storeMain)
    ;(ctx as unknown as { stores: Record<string, DataStore> }).stores = {
      main: storeMain, other: storeOther,
    }

    const nodeMain = {
      type: 'cachekey-data',
      id:   'main',
      storeKey: 'main',
      data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
    } as NodeBase
    const nodeOther = {
      type: 'cachekey-data',
      id:   'other',
      storeKey: 'other',
      data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
    } as NodeBase

    await act(async () => {
      render(
        createElement(Fragment, null,
          renderNode(nodeMain, ctx) as React.ReactElement,
          renderNode(nodeOther, ctx) as React.ReactElement,
        ),
      )
    })

    // Identical recipe + identical depKey, DIFFERENT store ⇒ TWO distinct entries.
    expect(__promiseCacheForTest.size).toBe(2)
    // And the two keys are genuinely distinct (store term is present in the key).
    expect(new Set(__promiseCacheForTest.keys()).size).toBe(2)
  })
})
