// @vitest-environment jsdom
//
// ── useNodeStream — live subscription hook tests ────────────────────────────
//
//  Coverage:
//    1. Non-streaming store  → returns sync rows (resolveNodeRows fast-lane)
//    2. Streaming store      → initial rows from sync, then updated rows from
//                              subscription callback
//    3. Cleanup              → unsubscribe called on unmount
//    4. Re-subscribe         → unsubscribe + new subscribe when depKey changes
//    5. Polling fallback     → setInterval fires when polling.interval is set
//                              and store is NOT streaming
//    6. Polling skip         → setInterval NOT used when store IS streaming
//
//  Strategy:
//    resolveNodeRows is mocked to isolate hook logic from interpretSpec internals.
//    subscribe? callback receives QueryResult — we push { state:'done', data } objects.
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act }                                  from '@testing-library/react'
import type { DataStore, EngineRow, QueryResult }           from '@statdash/engine'
import type { NodeBase }                                    from './types'
import type { RenderContext }                               from './types'

// ── Mock resolveNodeRows module ───────────────────────────────────────────────
//
//  We control what resolveNodeRows returns per-test, isolating the hook from
//  interpretSpec internals. resolveStore returns the store from ctx directly.
//
const mockResolveNodeRows = vi.fn<(node: NodeBase, ctx: RenderContext) => EngineRow[]>()
const mockResolveStore    = vi.fn<(ctx: Pick<RenderContext, 'stores' | 'pageStoreKey'>) => DataStore>()

vi.mock('./resolveNodeRows', () => ({
  resolveNodeRows: (...args: [NodeBase, RenderContext]) => mockResolveNodeRows(...args),
  resolveStore:    (...args: [Pick<RenderContext, 'stores' | 'pageStoreKey'>]) => mockResolveStore(...args),
}))

// Import AFTER mocking
const { useNodeStream } = await import('./useNodeStream')

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ROW_A: EngineRow = { value: 1 }
const ROW_B: EngineRow = { value: 2 }

const SECTION_CTX = {
  timeMode: 'year' as const,
  dims:     { time: '2023' },
}

/** Non-streaming DataStore stub. */
function makeSyncStore(): DataStore {
  return {
    querySync: () => [ROW_A],
    caps:      { queryTypes: ['obs'], batching: false, streaming: false, sync: true },
  } as DataStore
}

/** Streaming DataStore stub with subscribe() that fires cb immediately. */
function makeStreamingStore(initialRows: EngineRow[] = [ROW_A]) {
  let _cb: ((r: QueryResult) => void) | null = null
  const unsub = vi.fn()

  const store: DataStore = {
    querySync: () => initialRows,
    caps:      { queryTypes: ['obs'], batching: false, streaming: true, sync: true },
    subscribe: vi.fn((_q, _ctx, cb) => {
      _cb = cb
      // Contract: fire immediately with current rows
      cb({ state: 'done', data: initialRows })
      return unsub
    }),
  } as unknown as DataStore

  /** Push a new set of rows to the subscriber. */
  function push(rows: EngineRow[]) {
    _cb?.({ state: 'done', data: rows })
  }

  return { store, unsub, push }
}

/** Minimal RenderContext. resolveStore is mocked so stores/pageStoreKey are pass-through. */
function makeCtx(store: DataStore): RenderContext {
  return {
    stores:       { default: store },
    pageStoreKey: 'default',
    sectionCtx:   SECTION_CTX,
    rows:         [],
  } as unknown as RenderContext
}

/** NodeBase with no DataSpec. */
const NODE_NO_DATA: NodeBase = { type: 'chart' }

/** NodeBase with a minimal DataSpec. */
const NODE_WITH_DATA: NodeBase = {
  type: 'chart',
  data: { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('useNodeStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockResolveNodeRows.mockReturnValue([ROW_A])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ── 1. Non-streaming store → sync fast-lane ──────────────────────────────

  it('returns sync rows from resolveNodeRows when store is not streaming', () => {
    const store = makeSyncStore()
    mockResolveStore.mockReturnValue(store)
    const ctx   = makeCtx(store)

    const { result } = renderHook(() => useNodeStream(NODE_WITH_DATA, ctx))
    // Sync fast-lane: no state, returns resolveNodeRows directly
    expect(result.current).toEqual([ROW_A])
    expect(mockResolveNodeRows).toHaveBeenCalled()
  })

  it('returns empty rows when node has no DataSpec and store is not streaming', () => {
    const store = makeSyncStore()
    mockResolveStore.mockReturnValue(store)
    mockResolveNodeRows.mockReturnValue([])
    const ctx   = makeCtx(store)

    const { result } = renderHook(() => useNodeStream(NODE_NO_DATA, ctx))
    expect(result.current).toEqual([])
  })

  // ── 2. Streaming store → subscription-driven rows ────────────────────────

  it('starts with initial rows from querySync, then receives pushed rows', () => {
    const { store, push } = makeStreamingStore([ROW_A])
    mockResolveStore.mockReturnValue(store)
    mockResolveNodeRows.mockReturnValue([ROW_A])
    const ctx = makeCtx(store)

    const { result } = renderHook(() => useNodeStream(NODE_WITH_DATA, ctx))

    // After the effect fires subscribe() → cb immediately fires with ROW_A
    act(() => {})
    expect(result.current).toEqual([ROW_A])

    // Push an update
    act(() => { push([ROW_B]) })
    expect(result.current).toEqual([ROW_B])
  })

  // ── 3. Cleanup: unsubscribe called on unmount ─────────────────────────────

  it('calls unsubscribe when the component unmounts', () => {
    const { store, unsub } = makeStreamingStore([ROW_A])
    mockResolveStore.mockReturnValue(store)
    mockResolveNodeRows.mockReturnValue([ROW_A])
    const ctx = makeCtx(store)

    const { unmount } = renderHook(() => useNodeStream(NODE_WITH_DATA, ctx))
    act(() => {})
    expect(unsub).not.toHaveBeenCalled()

    unmount()
    expect(unsub).toHaveBeenCalledOnce()
  })

  // ── 4. Re-subscribe when the node's data changes ─────────────────────────

  it('unsubscribes and re-subscribes when the node data changes', () => {
    const { store, unsub } = makeStreamingStore([ROW_A])
    mockResolveStore.mockReturnValue(store)
    mockResolveNodeRows.mockReturnValue([ROW_A])
    const ctx = makeCtx(store)

    // Two nodes with different DataSpecs — specDimKey will differ because the
    // DataSpec object reference changes (specDimKey falls back to full dims JSON
    // for specs it cannot extract requirements from, which is stable here — but
    // we change node.storeKey to force a dep change on the effect).
    const NODE_V1: NodeBase = {
      type:     'chart',
      storeKey: 'v1',
      data:     { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
    }
    const NODE_V2: NodeBase = {
      type:     'chart',
      storeKey: 'v2',
      data:     { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
    }

    const { rerender } = renderHook(
      ({ node }: { node: NodeBase }) => useNodeStream(node, ctx),
      { initialProps: { node: NODE_V1 } },
    )
    act(() => {})
    expect(store.subscribe).toHaveBeenCalledOnce()

    rerender({ node: NODE_V2 })
    act(() => {})
    // unsub from first subscription must be called on cleanup
    expect(unsub).toHaveBeenCalledOnce()
    // new subscription must be created
    expect(store.subscribe).toHaveBeenCalledTimes(2)
  })

  // ── 5. Polling fallback: non-streaming + polling.interval ────────────────

  it('polls resolveNodeRows on an interval when polling.interval is set and store is not streaming', () => {
    let callCount = 0
    const store   = makeSyncStore()
    mockResolveStore.mockReturnValue(store)
    // Alternate return values per call
    mockResolveNodeRows.mockImplementation(() => {
      callCount++
      return callCount % 2 === 0 ? [ROW_B] : [ROW_A]
    })
    const ctx = makeCtx(store)

    const NODE_POLLING: NodeBase = {
      type: 'chart',
      data: { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
      view: { polling: { interval: 1000 } },
    }

    const { result } = renderHook(() => useNodeStream(NODE_POLLING, ctx))
    // Initial render (callCount=1 → ROW_A set in useState)
    act(() => {})

    // Tick once: callCount=2 → ROW_B
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toEqual([ROW_B])

    // Tick again: callCount=3 → ROW_A
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toEqual([ROW_A])
  })

  it('clears the interval on unmount when polling', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const store    = makeSyncStore()
    mockResolveStore.mockReturnValue(store)
    const ctx = makeCtx(store)

    const NODE_POLLING: NodeBase = {
      type: 'chart',
      data: { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
      view: { polling: { interval: 500 } },
    }

    const { unmount } = renderHook(() => useNodeStream(NODE_POLLING, ctx))
    act(() => {})

    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  // ── 6. Streaming store: polling effect does NOT fire ─────────────────────

  it('does not set a polling interval when the store is streaming-capable', () => {
    const setSpy        = vi.spyOn(globalThis, 'setInterval')
    const { store }     = makeStreamingStore([ROW_A])
    mockResolveStore.mockReturnValue(store)
    mockResolveNodeRows.mockReturnValue([ROW_A])
    const ctx = makeCtx(store)

    const NODE_POLLING: NodeBase = {
      type: 'chart',
      data: { type: 'row-list', rows: [] } as unknown as import('@statdash/engine').DataSpec,
      view: { polling: { interval: 500 } },
    }

    renderHook(() => useNodeStream(NODE_POLLING, ctx))
    act(() => {})

    // setInterval must not be called — streaming takes priority
    expect(setSpy).not.toHaveBeenCalled()
  })
})
