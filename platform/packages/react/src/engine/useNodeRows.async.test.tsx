// @vitest-environment jsdom
//
// ── useNodeRows async boundary fitness tests [N34c] ─────────────────────────
//
//  Asserts the two-path behaviour of useNodeRows:
//    1. Sync fast-lane  — stores with caps.sync !== false resolve immediately,
//       no Suspense, promise cache untouched.
//    2. Async path      — stores with caps.sync === false go through the
//       promise cache + React.use() / Suspense.
//    3. Error envelope  — {state:'error'} is re-thrown by the adapter so
//       NodeErrorBoundary catches it and renders an error UI.
//    4. Cache keying    — a specDimKey change (filter change) creates a new
//       Promise entry; the old entry is superseded.
//
//  Test setup:
//    @testing-library/react render() + act() for Suspense resolution.
//    NodeErrorBoundary is used as the real error boundary (not a stub) to
//    verify the end-to-end path through renderNode's error isolation.
//

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, cleanup }      from '@testing-library/react'
import { createElement, Suspense }           from 'react'
import type { DataStore, EngineRow, QueryResult, SectionContext, StoreQuery } from '@statdash/engine'
import { staticStore }                       from '@statdash/engine'
import type { NodeBase, RenderContext }      from './types'
import { useNodeRows, __promiseCacheForTest } from './useNodeRows'
import { NodeErrorBoundary }                 from './NodeErrorBoundary'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a minimal RenderContext with an arbitrary store. */
function makeCtx(store: DataStore, extraDims?: Record<string, unknown>): RenderContext {
  const sectionCtx: SectionContext = {
    dims:     { time: 2024, ...extraDims },
  }
  return {
    sectionCtx,
    stores:         { main: store },
    pageStoreKey:   'main',
    filterParams:   {},
    vars:           {},
    locale:         'en',
    fallbackLocale: 'en',
    perspectiveKey: 'mode',
    perspective:           { current: 'year', available: [], set: () => {} },
    rows:           [],
    eventBus:       { publish: () => {}, subscribe: () => () => {} } as unknown as RenderContext['eventBus'],
    set:            () => {},
    resolveLinks:   () => [],
    renderNode:     () => null,
  } as unknown as RenderContext
}

/** Minimal NodeBase with a DataSpec sufficient for specDimKey computation. */
function makeNode(overrides?: Partial<NodeBase>): NodeBase {
  return {
    type: 'panel',
    id:   'n1',
    // A 'query' spec — extractRequirements yields a val req + the obs warm query.
    data: { type: 'query', query: { measure: 'GDP' } } as unknown as NodeBase['data'],
    ...overrides,
  } as NodeBase
}

/**
 * Build a fake async store (caps.sync === false) that honours Cache-Aside:
 *   - queryAsync resolves with the supplied QueryResult AND warms an internal
 *     cache keyed on the obs query measure.
 *   - querySync returns the warmed rows (so the post-warm sync engine read in
 *     useNodeRows succeeds) — and THROWS cold, mirroring ApiStore, so a test
 *     that reads without warming first reproduces the original bug.
 *
 * useNodeRows now warms via queryAsync, then reads synchronously through
 * resolveNodeRows/interpretSpec; this fake therefore feeds the warmed rows back
 * out of the 'query'/'obs' resolver path (storeObs → querySync).
 */
function makeAsyncStore(
  result: QueryResult | (() => Promise<QueryResult>),
): DataStore {
  const getResult = typeof result === 'function' ? result : () => Promise.resolve(result)
  let isWarm = false
  let warmRows: EngineRow[] = []
  return {
    ...staticStore,
    caps: { queryTypes: ['obs', 'val'], batching: false, streaming: false, sync: false },
    async queryAsync(_q: StoreQuery, _ctx: SectionContext): Promise<QueryResult> {
      const r = await getResult()
      if (r.state === 'done') { isWarm = true; warmRows = r.data }
      return r
    },
    querySync(q: StoreQuery, _ctx: SectionContext): EngineRow[] {
      if (!isWarm) {
        throw new Error('cold cache — caps.sync=false; queryAsync must warm first')
      }
      // obs reads return the warmed rows; val reads return a scalar from row 0.
      if (q.type === 'val') return [{ value: warmRows[0]?.['value'] ?? 0 }]
      return warmRows
    },
  } as DataStore
}

/** Wrap `useNodeRows` in a component so it can be rendered. */
function Wrapper({ node, ctx }: { node: NodeBase; ctx: RenderContext }) {
  const rows = useNodeRows(node, ctx)
  return createElement('ul', null,
    rows.length === 0
      ? createElement('li', { 'data-testid': 'empty' }, 'empty')
      : rows.map((r, i) =>
          createElement('li', { key: i, 'data-testid': `row-${i}` }, String(r.value ?? i)),
        ),
  )
}

/** Render the Wrapper inside Suspense + NodeErrorBoundary (mirrors renderNode). */
function renderHook(node: NodeBase, ctx: RenderContext, fallback = 'loading') {
  const suspenseEl = createElement(
    Suspense,
    { fallback: createElement('div', { 'data-testid': 'skeleton' }, fallback) },
    createElement(Wrapper, { node, ctx }),
  )
  return render(
    createElement(NodeErrorBoundary, { node, children: suspenseEl }),
  )
}

// Clear the promise cache before every test so tests are isolated.
beforeEach(() => {
  __promiseCacheForTest.clear()
  cleanup()
})

// ── 1. Sync fast-lane ──────────────────────────────────────────────────────

describe('useNodeRows — sync fast-lane (caps.sync !== false)', () => {

  it('returns rows synchronously without suspending', () => {
    // staticStore has caps.sync: true — should resolve on first render, no skeleton.
    const store = { ...staticStore } as DataStore
    const node  = makeNode({ data: { type: 'row-list', rows: [{ code: 'GDP' }] } as unknown as NodeBase['data'] })
    const ctx   = makeCtx(store)

    // No act() needed — sync stores resolve immediately.
    renderHook(node, ctx)

    // Skeleton must not appear (no suspension occurred)
    expect(screen.queryByTestId('skeleton')).toBeNull()
  })

  it('does not touch the promise cache for sync stores', () => {
    const store = { ...staticStore } as DataStore
    const node  = makeNode()
    const ctx   = makeCtx(store)

    renderHook(node, ctx)

    expect(__promiseCacheForTest.size).toBe(0)
  })

  it('a store with no caps is treated as sync', () => {
    const noCapStore: DataStore = { querySync: () => [] }
    const node  = makeNode()
    const ctx   = makeCtx(noCapStore)

    renderHook(node, ctx)

    expect(__promiseCacheForTest.size).toBe(0)
    expect(screen.queryByTestId('skeleton')).toBeNull()
  })

})

// ── 2. Async path — suspends then resolves ─────────────────────────────────

describe('useNodeRows — async path (caps.sync === false)', () => {

  it('shows skeleton while suspended, then renders resolved rows', async () => {
    const rows: EngineRow[] = [{ value: 42 } as EngineRow]
    const store = makeAsyncStore({ state: 'done', data: rows })
    const node  = makeNode()
    const ctx   = makeCtx(store)

    await act(async () => {
      renderHook(node, ctx)
    })

    // After resolution the skeleton should be gone.
    expect(screen.queryByTestId('skeleton')).toBeNull()
    // Row value rendered
    expect(screen.getByTestId('row-0').textContent).toBe('42')
  })

  it('populates the promise cache with one entry', async () => {
    const store = makeAsyncStore({ state: 'done', data: [] })
    const node  = makeNode()
    const ctx   = makeCtx(store)

    await act(async () => { renderHook(node, ctx) })

    expect(__promiseCacheForTest.size).toBe(1)
  })

  it('a pipeline with a STEWARD source.query head warms + resolves (W-P5a exact-obs warm)', async () => {
    // A directly-authored `pipeline` whose head is `{op:'source', query}` reads via the
    // QueryResolver (delegated by PipelineResolver). Its exact obs query must be warmed
    // (specHeadObs) so the post-warm sync read is served — else a cold cache / empty grid.
    const rows: EngineRow[] = [{ value: 99 } as EngineRow]
    const store = makeAsyncStore({ state: 'done', data: rows })
    const node  = makeNode({
      data: {
        type: 'pipeline',
        pipe: [{ op: 'source', query: { measure: 'GDP' } }],
        encoding: { label: 'time', value: 'value' },
      } as unknown as NodeBase['data'],
    })
    const ctx = makeCtx(store)

    await act(async () => { renderHook(node, ctx) })

    expect(screen.queryByTestId('skeleton')).toBeNull()
    expect(screen.getByTestId('row-0').textContent).toBe('99')
  })

  it('node with no data returns empty rows without suspending', async () => {
    const store = makeAsyncStore({ state: 'done', data: [] })
    const node  = makeNode({ data: undefined })
    const ctx   = makeCtx(store)

    await act(async () => { renderHook(node, ctx) })

    expect(screen.queryByTestId('skeleton')).toBeNull()
    expect(screen.getByTestId('empty').textContent).toBe('empty')
    // No promise created for a node with no DataSpec
    expect(__promiseCacheForTest.size).toBe(0)
  })

})

// ── 3. Async path — error envelope ────────────────────────────────────────

describe('useNodeRows — async error path', () => {

  it('{state:"error"} causes the promise to reject, NodeErrorBoundary renders error UI', async () => {
    const store = makeAsyncStore({ state: 'error', data: [], error: 'server unavailable' })
    const node  = makeNode()
    const ctx   = makeCtx(store)

    // Suppress React's console.error output for the expected error.
    const origError = console.error
    console.error = () => {}
    try {
      await act(async () => { renderHook(node, ctx) })
    } finally {
      console.error = origError
    }

    // NodeErrorBoundary renders a fallback element — the shell must NOT crash
    // the whole tree. Assert the STRUCTURAL fallback markers (the title + retry
    // button), not a literal string: the labels now route through the i18n
    // contract (useTSafe('feedback')), so they are locale-dependent and proven by
    // the tenant-app render gate; here we only prove the boundary fired + degraded
    // gracefully with NO SiteProvider above it (the safe-resolver contract).
    expect(screen.queryByTestId('skeleton')).toBeNull()
    expect(document.querySelector('.node-error')).not.toBeNull()
    expect(document.querySelector('.node-error__retry')).not.toBeNull()
  })

})

// ── 4. Cache keying — filter change → new promise ─────────────────────────

describe('useNodeRows — promise cache keying', () => {

  it('a different specDimKey (filter change) creates a new cache entry', async () => {
    const store = makeAsyncStore({ state: 'done', data: [] })

    // First render: ctx with dims { time: 2024 }
    const node  = makeNode()
    const ctx1  = makeCtx(store, { geo: 'GE' })

    await act(async () => { renderHook(node, ctx1) })
    const sizeAfterFirst = __promiseCacheForTest.size
    expect(sizeAfterFirst).toBe(1)

    // Second render: ctx with different dim value → different specDimKey
    const ctx2 = makeCtx(store, { geo: 'AZ' })
    await act(async () => { renderHook(node, ctx2) })

    // Each unique key gets its own promise entry
    expect(__promiseCacheForTest.size).toBe(2)
  })

  it('same specDimKey re-uses the cached promise (no new entry)', async () => {
    const store = makeAsyncStore({ state: 'done', data: [] })
    const node  = makeNode()
    const ctx   = makeCtx(store)

    await act(async () => { renderHook(node, ctx) })
    const sizeAfterFirst = __promiseCacheForTest.size

    // Same node + same ctx → same specDimKey → no new cache entry
    await act(async () => { renderHook(node, ctx) })
    expect(__promiseCacheForTest.size).toBe(sizeAfterFirst)
  })

})
