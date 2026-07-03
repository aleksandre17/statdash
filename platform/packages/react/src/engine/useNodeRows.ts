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
import { extractRequirements, queryReadObs }      from '@statdash/engine'
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
  // AR-36: the resolved rows depend on ctx.vars too — a state-bound spec (the runtime
  // pivot's `{$ctx:_byDims}` aggregate grain, `{$ctx:_xDim}` encoding) is lowered by
  // resolveEncodingRefs/resolvePipeRefs (in resolveNodeRows) FROM ctx.vars. A selection
  // change mutates only the derived vars (not the query dims, since the pivot aggregates
  // client-side over a covering fetch), so the row memo/cache MUST key on the vars or it
  // returns stale rows (by-region ⇄ sector×geo never rotates). Generic (Law 1): keys on
  // the whole vars bag, so ANY vars-bound spec re-resolves — no dim/var-name literal.
  const varsKey = useMemo(() => JSON.stringify(ctx.vars ?? {}), [ctx.vars])

  const depKey = useMemo(
    () => (node.data ? specDimKey(node.data as DataSpec, ctx.sectionCtx) + '' + varsKey : ''),
    [node.data, ctx.sectionCtx, varsKey],
  )

  // ── Async promise-cache key — NODE-UNIQUE, not just data-dependency (N34c fix) ──
  //
  //  depKey fingerprints the DATA DEPENDENCIES (the covering fetch's code×dims via
  //  specDimKey, plus the derived vars). That is the correct trigger for WHEN to
  //  re-resolve — but it is NOT a unique identity for WHAT rows a node produces.
  //  extractRequirements collapses two nodes that issue the SAME covering fetch to
  //  the SAME fingerprint even when their client-side RECIPE differs (a by-`geo`
  //  map vs a `sector`-pivot both fetch `measure=GVA, geo=…`). The _promiseCache is
  //  MODULE-LEVEL and shared across every node instance, so those two siblings
  //  COLLIDE: the first to render populates the entry with ITS resolution and the
  //  second reads the same key and is served the FIRST node's rows (the regional
  //  cross-filter State-B bug — the sector pivot rendered the map's 11 by-region rows).
  //
  //  Fix: fold the node's ROW RECIPE into the cache key. node.data (spec: pipe +
  //  encoding + type) and node.transforms fully determine the output rows GIVEN the
  //  fetch — and being declarative config (Law 2), they are JSON-serialisable and
  //  reference-stable, so a memoised structural fingerprint is a stable, correct,
  //  dimension-AGNOSTIC (Law 1 — no dim/var-name literal) discriminator.
  //
  //  The key spans THREE axes, joined by a NUL-class control separator ('\x01') that
  //  JSON.stringify escapes and so can NEVER appear inside a stringified part:
  //    • recipeKey        — per-NODE axis (client-side recipe: pipe/encoding/transforms)
  //    • depKey           — per-STATE axis (covering fetch code×dims ⊕ derived vars)
  //    • ctx.pageStoreKey — per-STORE axis (C1). The SAME (recipe, data-state) resolved
  //      against DIFFERENT stores yields DIFFERENT rows, and renderNode overrides
  //      ctx.pageStoreKey per node subtree (effectiveStoreKey: explicit node.storeKey >
  //      metric dataSource > page cascade) — one value encoding all three store tiers.
  //      The sync memo (below) already lists node.storeKey/ctx.pageStoreKey in its
  //      identity; omitting the store here left the async key node-unique in name only —
  //      the same defect class this fix exists to close. We hash the store VALUE, never a
  //      hardcoded store name (Law 1).
  //
  //  Two nodes with a genuinely identical recipe AND identical data-state AND the same
  //  store still share one entry (correct in-flight dedup — the cache's purpose is kept).
  const recipeKey = useMemo(
    () => nodeRecipeKey(node.data, node.transforms),
    [node.data, node.transforms],
  )
  const cacheKey = recipeKey + '' + depKey + '' + (ctx.pageStoreKey ?? 'default')

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
  //  The whole warm-then-read is wrapped in one Promise, cached by cacheKey
  //  (recipeKey ⊕ depKey ⊕ pageStoreKey — node-unique across recipe/state/store, see
  //  above), and consumed via React.use() —
  //  Suspense shows the skeleton while it settles; NodeErrorBoundary catches a
  //  rejected warm.
  //
  if (!node.data) {
    return ctx.rows ?? []
  }

  if (!_promiseCache.has(cacheKey)) {
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
            // 'query' specs carry their own obs query that the QueryResolver read
            // issues. GAP 4: warm under the EXACT query the read uses — derived by
            // the SSOT `queryReadObs` (resolveQueryMeasures: metric expansion +
            // default-dim merge, NO time bound — clamped post-fetch). Warming the
            // raw `spec.query.measure` would miss a metric-id and, in range mode,
            // the wasted time:0 val reqs never matched the unbounded read → cold
            // cache → empty charts. Same `ctx.sectionCtx` (time unset in range
            // mode) ⇒ warm-key ≡ read-key in BOTH year and range modes.
            spec.type === 'query'
              ? [qa(queryReadObs(spec.query), ctx.sectionCtx)]
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
    _promiseCache.set(cacheKey, promise)
  }

  // React.use() with a Promise suspends until the promise settles.
  // Per React 19 docs, use() with a Resource CAN be called conditionally
  // (unlike hooks, it is not subject to the "no conditional hooks" rule).
  return use(_promiseCache.get(cacheKey)!)
}

// ── nodeRecipeKey — stable structural fingerprint of a node's ROW recipe ──────
//
//  The part of a node's identity that the data-dependency depKey (specDimKey ⊕
//  vars) does NOT capture: the CLIENT-SIDE recipe that shapes the fetched rows —
//  the DataSpec's type + pipe + encoding, plus node.transforms. Two nodes with the
//  same covering fetch but different recipes (a by-geo map vs a sector pivot) must
//  NOT share a promise-cache entry; this key is what tells them apart.
//
//  Declarative config (Law 2) ⇒ JSON-serialisable. Deterministic key ordering makes
//  the fingerprint stable regardless of how the spec object was built (hand-authored
//  JSON preserves order; a Constructor may not). Pure + dimension-agnostic (Law 1):
//  it hashes STRUCTURE, never a dim/var name. Memoised on the (stable) node.data /
//  node.transforms references by the caller, so it serialises once per node.
function nodeRecipeKey(data: unknown, transforms: unknown): string {
  return stableStringify({ data: data ?? null, transforms: transforms ?? null })
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  return '{' + Object.keys(obj).sort()
    .map(k => JSON.stringify(k) + ':' + stableStringify(obj[k]))
    .join(',') + '}'
}
