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
import type { DataRow, DataSpec, QueryResult, Requirement } from '@statdash/engine'
import { extractRequirements }                   from '@statdash/engine'
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
const _promiseCache = new Map<string, Promise<DataRow[]>>()
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

  // ── Async path: store has caps.sync === false (live network stores) ───────
  //
  //  Cache-Aside, per ADR-STORE-001 (NOT eager whole-cube prefetch). Two steps:
  //
  //    1. WARM — await store.queryAsync for every query the spec will issue. The
  //       queries are derived from the SAME static analysis the sync resolvers
  //       use (extractRequirements → val reqs; plus the spec's obs query for
  //       'query' specs), so we fetch exactly the slice the node needs. The store
  //       (a capability-transparent CachedStore over ApiStore) memoizes each
  //       result into the cache its querySync reads.
  //
  //    2. READ — once warm, run resolveNodeRows SYNCHRONOUSLY. It drives the full
  //       engine (desugar → resolver → encoding → transforms) exactly as the sync
  //       fast-lane does; every storeObs/storeVal hits the now-warm cache instead
  //       of throwing on a cold async source. This is why the read goes through
  //       resolveNodeRows and not a hand-built StoreQuery: only interpretSpec
  //       applies encoding/pipeline/multi-measure resolution.
  //
  //  The whole warm-then-read is wrapped in one Promise, cached by depKey, and
  //  consumed via React.use() — Suspense shows the skeleton while it settles;
  //  NodeErrorBoundary catches a rejected warm.
  //
  if (!node.data) {
    return ctx.rows ?? []
  }

  if (!_promiseCache.has(depKey)) {
    const spec = node.data as DataSpec

    // Static analysis → the exact (code, dims) slices this spec reads. For a
    // 'query' spec extractRequirements yields one val req per measure×year; we
    // ALSO warm the obs query so obs-shaped reads (QueryResolver.storeObs) hit a
    // warm cache. Both are keyed identically to what querySync will look up.
    const reqs: Requirement[] = (() => {
      try { return extractRequirements(spec, ctx.sectionCtx) }
      catch { return [] }
    })()

    // Warm BOTH shapes the resolvers may read per code:
    //   • val  — storeVal point reads (row-list, ratio-list, timeseries, growth)
    //   • obs  — storeObs reads (the 'query' resolver; row-list label/color lookup)
    // The (code, dims) of each req keys the warm exactly like the later sync read.
    // Bind to `store` — store.queryAsync is a method that reads `this` (e.g.
    // CachedStore.queryAsync → this.source); a bare reference would drop `this`.
    const qa = store.queryAsync ? store.queryAsync.bind(store) : undefined
    const warm: Promise<QueryResult[]> = qa
      ? Promise.all(
          reqs.flatMap((r): Promise<QueryResult>[] => {
            const reqCtx = { ...ctx.sectionCtx, dims: { ...ctx.sectionCtx.dims, ...r.dims } }
            return [
              qa({ type: 'val', code: r.code }, reqCtx),
              qa({ type: 'obs', measure: r.code }, reqCtx),
            ]
          }).concat(
            // 'query' specs carry their own obs query (measure/filter/orderBy)
            // that extractRequirements lowers to val reqs — warm the obs form too.
            spec.type === 'query'
              ? [qa(
                  { type: 'obs', measure: spec.query.measure, filter: spec.query.filter, orderBy: spec.query.orderBy },
                  ctx.sectionCtx,
                )]
              : [],
          ),
        )
      : Promise.resolve([])

    const promise = warm.then(results => {
      const failed = results.find(r => r.state === 'error')
      if (failed) throw new Error(failed.error ?? 'query failed')
      // Cache is warm — the sync engine path now reads it without throwing.
      return resolveNodeRows(node, ctx)
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
  return use(_promiseCache.get(depKey)!)
}
