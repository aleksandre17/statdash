// @vitest-environment jsdom
//
// ── renderNode × async store — THROUGH-renderNode integration test ──────────
//
//  The missing regression test (ADR-STORE-001). It renders a data node THROUGH
//  the real `renderNode` pipeline, backed by an ASYNC, ApiStore-style store
//  (CachedStore over ApiStore, fetch mocked — exactly the stats-registrations.ts
//  wiring), and asserts the rows BIND into the shell.
//
//  WHY this test exists / the gap it closes:
//    The async contract was previously tested where it ISN'T used (ApiStore in
//    isolation, useNodeRows in isolation) and used where it ISN'T wired (renderNode
//    only ever tested with sync stores). Neither test went through renderNode with
//    an async store, so the two compounding faults shipped:
//      1. CachedStore masked caps.sync (hardcoded true) and had no queryAsync.
//      2. renderNode resolved rows synchronously, never routing async stores
//         through useNodeRows' queryAsync warm path.
//    Pre-fix this test FAILS: CachedStore reports sync:true → renderNode takes the
//    sync fast-lane → ApiStore.querySync throws cold → NodeErrorBoundary renders
//    'Failed to load component', so the data marker never appears.
//    Post-fix: capability-transparent CachedStore (sync:false + queryAsync) →
//    renderNode async path → useNodeRows warms the cache → sync read binds rows.
//
//  Engine-agnostic (Law 3): registers its own minimal data shell on the singleton
//  registry renderNode reads; the store is a real @statdash/engine ApiStore with a
//  mocked global fetch (no app adapters, no tenant-specific content).
//

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup }            from '@testing-library/react'
import { createElement, type ReactNode }   from 'react'
import { ApiStore, CachedStore }           from '@statdash/engine'
import type { RawObsRow, EngineRow, DataStore } from '@statdash/engine'
import { renderNode }                      from './renderNode'
import { nodeRegistry }                    from './register-all'
import { __promiseCacheForTest }           from './useNodeRows'
import type { RenderContext, NodeBase, NodeDef } from './types'

// ── A leaf data shell — renders ctx.rows as one marker per row ──────────────
//
//  This is what proves the rows BOUND: renderNode resolves the node's DataSpec
//  and injects the result into ctx.rows; the shell reflects it into the DOM.
function dataShell(_def: NodeBase, ctx: RenderContext): ReactNode {
  const rows = ctx.rows ?? []
  return createElement(
    'ul',
    { 'data-testid': 'data-shell' },
    ...rows.map((r, i) =>
      createElement('li', { key: i, 'data-testid': `row-${i}` }, String(r['value'] ?? '')),
    ),
  )
}

// ── Build a real ApiStore wrapped in CachedStore (mirrors stats-registrations) ─
const BASE = 'https://api.test'
const mapRow = (raw: RawObsRow): EngineRow => ({ ...raw.dim_key, value: raw.obs_value ?? 0 })

function makeLiveStore(): DataStore {
  const api = new ApiStore(BASE, 'GDP_ANNUAL', ['geo'], {}, mapRow)
  return new CachedStore(api) as unknown as DataStore
}

// A FRESH Response per call — a Response body can only be read once, and the
// async warm issues several queryAsync calls (val + obs) → several fetches.
function okResponse(rows: RawObsRow[]): () => Response {
  return () => new Response(JSON.stringify({ data: rows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const RAW_ROWS: RawObsRow[] = [
  { time_period: '2024', dim_key: { geo: 'GE' }, obs_value: 111, obs_status: 'A', obs_attribute: {} },
  { time_period: '2024', dim_key: { geo: 'AM' }, obs_value: 222, obs_status: 'A', obs_attribute: {} },
]

// ── Minimal RenderContext carrying the live store under key 'main' ──────────
function makeCtx(store: DataStore): RenderContext {
  const holder = { ctx: null as unknown as RenderContext }
  holder.ctx = {
    sectionCtx:     { dims: { time: 2024, geo: '' }, timeMode: 'year' },
    stores:         { main: store },
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    timeModeKey:    'mode',
    mode:           { current: 'year', available: [], set: () => {} },
    effects:        [],
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
  nodeRegistry.register('async-data', 'default', dataShell, { category: 'data' })
  vi.spyOn(global, 'fetch')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('renderNode — async store binds rows through the full pipeline', () => {

  it('a query node backed by CachedStore(ApiStore) resolves rows (no cold-throw)', async () => {
    vi.mocked(fetch).mockImplementation(async () => okResponse(RAW_ROWS)())

    const node: NodeBase = {
      type: 'async-data',
      // @ts-expect-error runtime DataSpec for the test node
      data: { type: 'query', query: { measure: 'GDP' } },
    }
    const ctx = makeCtx(makeLiveStore())

    let result!: ReturnType<typeof render>
    await act(async () => {
      result = render(renderNode(node, ctx) as React.ReactElement)
    })

    // The data BOUND — both rows rendered, NOT the NodeErrorBoundary fallback.
    expect(result.queryByText('Failed to load component')).toBeNull()
    expect(result.getByTestId('data-shell')).toBeTruthy()
    expect(result.getByTestId('row-0').textContent).toBe('111')
    expect(result.getByTestId('row-1').textContent).toBe('222')

    // The async path warmed the cache via queryAsync (the fetch happened).
    expect(fetch).toHaveBeenCalled()
  })

  it('a kpi-style val node binds its scalar through the async warm path', async () => {
    vi.mocked(fetch).mockImplementation(async () => okResponse(RAW_ROWS)())

    // A row-list spec → val reqs (extractRequirements) → warmed via queryAsync.
    const node: NodeBase = {
      type: 'async-data',
      data: { type: 'row-list', rows: [{ code: 'GDP' }] },
    }
    const ctx = makeCtx(makeLiveStore())

    let result!: ReturnType<typeof render>
    await act(async () => {
      result = render(renderNode(node, ctx) as React.ReactElement)
    })

    expect(result.queryByText('Failed to load component')).toBeNull()
    expect(result.getByTestId('data-shell')).toBeTruthy()
    // row-list resolves one row carrying the warmed scalar value.
    expect(result.getByTestId('row-0')).toBeTruthy()
    expect(fetch).toHaveBeenCalled()
  })

})
