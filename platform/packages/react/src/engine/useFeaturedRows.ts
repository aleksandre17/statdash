// ── useFeaturedRows — async-store-aware featured-slide resolution ─────────
//
//  The featured-slider sibling of useKpiRows. A featured item resolves its LIVE
//  value through interpretKpi (core/data/featured.ts lowers it to a point KpiSpec)
//  — so it inherits the SAME Cache-Aside warm-then-read treatment (ADR-STORE-001):
//
//    sync store  → interpretFeatured(items, ctx, storeFor) inline (memoized).
//    async store → WARM every extractFeaturedRequirements req (val + obs) via
//                  queryAsync, suspend on a cached promise, THEN interpretFeatured
//                  reads the now-warm store synchronously.
//
//  CROSS-DATASET ROUTING — the one thing this hook adds over useKpiRows. A slider's
//  items can span datasets (accounts / gdp / regional), so each card must read from
//  ITS OWN store. `storeFor(dataSource)` resolves the metric's `dataSource` to its
//  store (reusing resolveStore, which wraps it in the SHARED CachedStore instance so
//  warm + read hit one cache). extractFeaturedRequirements tags every requirement
//  with its dataSource, so the warm loop warms each req against the exact store the
//  synchronous read will use — no cache-miss, no cold throw (the kpi-strip invariant,
//  extended across datasets).
//
//  Must be called at the top level of a shell render function (React hooks rule);
//  defineShell wraps render in a component, so this is safe.
//
import { use, useMemo, useCallback }                     from 'react'
import {
  interpretFeatured, extractFeaturedRequirements, getMetric,
}                                                        from '@statdash/engine'
import type {
  FeaturedItemSpec, FeaturedSlideDef, FeaturedRequirement,
  DataStore, QueryResult,
}                                                        from '@statdash/engine'
import type { RenderContext }                            from './types'
import { resolveStore }                                  from './resolveNodeRows'

// ── Promise cache — keyed on the featured requirement fingerprint ─────────
//  Module-level (survives StrictMode double-invoke / unmount-remount), last-write
//  -wins Map with a hard cap (mirrors useKpiRows._promiseCache).
const _promiseCache = new Map<string, Promise<FeaturedSlideDef[]>>()
const CACHE_MAX = 200

/** Exported for testing only — do not use in production code. */
export const __featuredPromiseCacheForTest = _promiseCache

/** Stable fingerprint of the (dataSource, code, dims) the resolved slides will read. */
function featuredDepKey(
  reqs:  FeaturedRequirement[],
  items: FeaturedItemSpec[],
  dims:  Record<string, unknown>,
): string {
  if (reqs.length === 0) {
    return `static:${items.map(i => i.metric).join(',')}:${JSON.stringify(dims)}`
  }
  return reqs
    .map(({ dataSource, req }) =>
      `${dataSource ?? ''}#${req.code}:${
        Object.entries(req.dims)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(',')
      }`,
    )
    .sort()
    .join('|')
}

/**
 * Resolve a featured-slider's FeaturedItemSpec[] to FeaturedSlideDef[],
 * async-store-safe and cross-dataset-aware. NodeErrorBoundary (in renderNode)
 * catches a rejected warm.
 */
export function useFeaturedRows(items: FeaturedItemSpec[], ctx: RenderContext): FeaturedSlideDef[] {
  const { sectionCtx } = ctx

  // Per-item store router. resolveStore wraps the raw store in the SHARED
  // CachedStore (keyed on the raw instance) so the async warm (queryAsync) and the
  // post-resume sync read (querySync) share one cache — end-to-end Cache-Aside.
  const storeFor = useCallback(
    (dataSource?: string): DataStore =>
      resolveStore({ stores: ctx.stores, pageStoreKey: dataSource ?? ctx.pageStoreKey }),
    [ctx.stores, ctx.pageStoreKey],
  )

  const reqs = useMemo<FeaturedRequirement[]>(
    () => { try { return extractFeaturedRequirements(items, sectionCtx) } catch { return [] } },
    [items, sectionCtx],
  )

  // Async iff ANY store a card routes to reports caps.sync === false. Distinct
  // dataSources come from the items' metrics (getMetric — the SSOT the interpreter
  // routes on), so the sync/async decision matches interpretFeatured's routing.
  const isSync = useMemo(() => {
    const seen = new Set<string | undefined>()
    for (const it of items) seen.add(getMetric(it.metric)?.dataSource)
    for (const ds of seen) {
      const s = storeFor(ds)
      if (s.caps && s.caps.sync === false) return false
    }
    return true
  }, [items, storeFor])

  const syncResult = useMemo(
    () => (isSync ? interpretFeatured(items, sectionCtx, storeFor) : null),
    [isSync, items, sectionCtx, storeFor],
  )

  // ── Fast-lane: sync stores (every Phase-1 store) — promise cache untouched ──
  if (isSync) return syncResult as FeaturedSlideDef[]

  // ── Async path: caps.sync === false (live network stores) ─────────────────
  // Locale folds into the key: interpretFeatured localizes each card AFTER the
  // store read and the val cache is locale-agnostic, so without locale a toggle
  // would be served the pre-toggle promise → stale labels (same reasoning as
  // useKpiRows). Keys on the locale VALUE, never a literal (Law 1).
  const depKey = featuredDepKey(reqs, items, sectionCtx.dims) + '' + (ctx.locale ?? '')

  if (!_promiseCache.has(depKey)) {
    const warm: Promise<QueryResult[]> = Promise.all(
      reqs.flatMap(({ dataSource, req }): Promise<QueryResult>[] => {
        const store = storeFor(dataSource)
        const qa    = store.queryAsync ? store.queryAsync.bind(store) : undefined
        if (!qa) return []
        // req.dims is the AUTHORITATIVE resolved dim-set the sync read will use
        // (atTime(t, withFilter(ctx, filter)) — pins time AND honours dim deletes);
        // warm under it VERBATIM (only non-dims SectionContext fields come from
        // sectionCtx), exactly as useKpiRows does, else warm/read keys diverge.
        const reqCtx = { ...sectionCtx, dims: req.dims }
        return [
          qa({ type: 'val', code: req.code }, reqCtx),
          qa({ type: 'obs', measure: req.code }, reqCtx),
        ]
      }),
    )

    const promise = warm.then(results => {
      const failed = results.find(r => r.state === 'error')
      if (failed) throw new Error(failed.error ?? 'featured warm failed')
      return interpretFeatured(items, sectionCtx, storeFor)
    })

    if (_promiseCache.size >= CACHE_MAX) {
      const firstKey = _promiseCache.keys().next().value
      if (firstKey !== undefined) _promiseCache.delete(firstKey)
    }
    _promiseCache.set(depKey, promise)
  }

  return use(_promiseCache.get(depKey)!)
}
