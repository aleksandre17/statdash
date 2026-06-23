// ── useNodeRows — fine-grained reactive data resolution [N28] ──────────────
//
//  Drop-in alternative to ctx.rows for shells that want surgical reactivity.
//
//  How:
//    useMemo keyed on specDimKey — the fingerprint of data dependencies.
//    React re-runs the memo only when specDimKey changes.
//    Unrelated dim changes → same key → memo returns cached rows instantly.
//
//  When to use:
//    Expensive sections (large row counts, complex pipe transforms).
//    Shells that subscribe to a narrow dim slice (e.g. a single geo region).
//
//  When NOT to use:
//    Most nodes — ctx.rows is pre-computed in renderNode (zero overhead).
//    Nodes with no DataSpec — ctx.rows cascade is correct.
//
//  Rules:
//    Must be called at the top level of a shell render function (React hooks rule).
//    defineShell wraps render in ShellWrapper (a React component), so this is safe.
//
//  Async path (N34c):
//    Stores with caps.sync === false (future network stores) cannot supply rows
//    synchronously. For those stores, useNodeRows suspends via React.use() over
//    a cached Promise<EngineRow[]>. The Suspense + NodeErrorBoundary scaffolding
//    already present in renderNode.ts catches the suspension and errors.
//    ALL current Phase-1 stores have caps.sync !== false → synchronous fast-lane
//    is used, promise cache is never touched, Phase-1 behaviour is bit-identical.
//

import { use, useMemo }                         from 'react'
import type { DataRow, EngineRow, DataSpec, StoreQuery } from '@statdash/engine'
import { asyncFromSync }                         from '@statdash/engine'
import type { NodeBase, RenderContext }          from './types'
import { resolveNodeRows, resolveStore }         from './resolveNodeRows'
import { specDimKey }                            from './specDimKey'

// ── Promise cache — keyed on specDimKey (N34c) ────────────────────────────
//
//  WeakMap is not viable (string keys). Last-write-wins Map with a hard cap
//  prevents unbounded growth under rapid filter changes. On overflow the oldest
//  entry (insertion-order — Map guarantees FIFO iteration) is evicted.
//
//  The cache is module-level so it survives component unmount/remount (React
//  strict-mode double-invocation, navigation back/forward). A superseded key
//  (filter change produces a new specDimKey) maps to a new Promise; the old
//  entry is evicted if the cache is full.
//
const _promiseCache = new Map<string, Promise<EngineRow[]>>()
const CACHE_MAX = 200

/** Exported for testing only — do not use in production code. */
export const __promiseCacheForTest = _promiseCache

/**
 * Fine-grained reactive alternative to `ctx.rows`.
 *
 * Memoizes `resolveNodeRows(node, ctx)` keyed on the spec's actual data
 * dependencies (via `specDimKey`). When an unrelated dim changes the memo
 * returns the cached rows without re-running interpretSpec or the pipe.
 *
 * For stores with `caps.sync === false` (future network stores), the hook
 * suspends via `React.use()` until the Promise resolves. On error it throws
 * so `NodeErrorBoundary` in `renderNode` catches the failure.
 *
 * ```ts
 * // In a defineShell render:
 * const rows = useNodeRows(def, ctx)   // instead of ctx.rows
 * ```
 */
export function useNodeRows(node: NodeBase, ctx: RenderContext): DataRow[] {
  const store = resolveStore(ctx)
  const isSync = !store.caps || store.caps.sync !== false

  // ── Unconditional memos (hooks rules — must not be inside a conditional) ──
  //
  //  Both memos are always computed. For the async path (isSync === false) these
  //  values are used to derive the promise-cache key; for the sync path they are
  //  the actual result. No React hooks rules are violated.
  //
  const depKey = useMemo(
    () => (node.data ? specDimKey(node.data as DataSpec, ctx.sectionCtx) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.data, ctx.sectionCtx],
  )

  const syncRows = useMemo(
    () => (isSync ? resolveNodeRows(node, ctx) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSync, depKey, node.storeKey, ctx.pageStoreKey, node.transforms],
  )

  // ── Fast-lane: sync-capable stores (ALL current Phase-1 stores) ──────────
  //
  //  caps.sync !== false covers: absent caps, caps.sync = true, caps.sync = undefined.
  //  This branch is taken by every existing store (staticStore, ExternalStore,
  //  CachedStore, ApiStore). The promise cache is never consulted.
  //
  if (isSync) {
    return syncRows as DataRow[]
  }

  // ── Async path: store has caps.sync === false (future network stores) ─────
  //
  //  1. If no DataSpec is present, return inherited rows synchronously.
  //  2. Compute the promise-cache key from specDimKey (already in depKey).
  //  3. If no cached Promise exists for this key, create one via queryAsync.
  //     asyncFromSync is used as a fallback if queryAsync is absent (defensive).
  //  4. React.use() can be called conditionally (it is NOT a hook — it is a
  //     React 19 API that suspends for Promises and reads from contexts).
  //     The Suspense boundary in renderNode catches the suspension.
  //     On rejection, NodeErrorBoundary renders the error UI.
  //
  if (!node.data) {
    return ctx.rows ?? []
  }

  if (!_promiseCache.has(depKey)) {
    const queryAsync = store.queryAsync
      ? (q: StoreQuery) => store.queryAsync!(q, ctx.sectionCtx)
      : (q: StoreQuery) => asyncFromSync(store)(q, ctx.sectionCtx)

    // Construct the StoreQuery by spreading the DataSpec fields under { type:'obs' }.
    // Network stores that implement queryAsync interpret the full spec payload;
    // asyncFromSync fallback stores route it through querySync as-is.
    // Cast is safe: an async-only store (caps.sync === false) must implement
    // queryAsync and must handle whatever shape it advertises in its DataSpec.
    const query = { type: 'obs', ...(node.data as Record<string, unknown>) } as StoreQuery

    const promise = queryAsync(query).then(result => {
      if (result.state === 'error') throw new Error(result.error ?? 'query failed')
      return (result.data ?? []) as EngineRow[]
    })

    // Evict oldest entry on overflow (LRU approximation — Map insertion order)
    if (_promiseCache.size >= CACHE_MAX) {
      const firstKey = _promiseCache.keys().next().value
      if (firstKey !== undefined) _promiseCache.delete(firstKey)
    }
    _promiseCache.set(depKey, promise)
  }

  // React.use() with a Promise suspends until the promise settles.
  // Per React 19 docs, use() with a Resource CAN be called conditionally
  // (unlike hooks, it is not subject to the "no conditional hooks" rule).
  const rows = use(_promiseCache.get(depKey)!)
  return rows as unknown as DataRow[]
}
