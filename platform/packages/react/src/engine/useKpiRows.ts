// ── useKpiRows — async-store-aware KPI resolution ─────────────────────────
//
//  The KPI sibling of useNodeRows. A kpi-strip does NOT consume ctx.rows /
//  useNodeRows — it reads the store through interpretKpis (KpiSpec[] → storeVal),
//  an entirely separate read surface from the DataSpec pipeline. So the DataSpec
//  warm path (useNodeRows) never covers it. This hook gives the KPI surface the
//  SAME Cache-Aside warm-then-read treatment (ADR-STORE-001):
//
//    sync store  (caps.sync !== false) → interpretKpis(specs, ctx, store) inline.
//                                        Byte-identical to the legacy direct call.
//    async store (caps.sync === false)  → WARM every extractKpiRequirements req
//                                        (val + obs) via queryAsync, suspend on a
//                                        cached promise, THEN interpretKpis runs
//                                        synchronously against the now-warm store.
//
//  CRITICAL — the comparison period. A 'yoy' KPI reads atTime(year) AND
//  atTime(year-1); extractKpiRequirements (core) enumerates BOTH, so the warm
//  set is the EXACT superset of interpretKpis' synchronous reads — querySync is
//  never cold for any KPI (this is the fix for the kpi-strip year-1 cold-throw).
//
//  Must be called at the top level of a shell render function (React hooks rule).
//  defineShell wraps render in a React component, so this is safe.
//

import { use, useMemo }                              from 'react'
import { interpretKpis, extractKpiRequirements }     from '@statdash/engine'
import type { KpiSpec, QueryResult, Requirement }    from '@statdash/engine'
import type { KpiDef }                               from '@statdash/engine'
import type { RenderContext }                        from './types'
import { resolveStore }                              from './resolveNodeRows'

// ── Promise cache — keyed on the KPI requirement fingerprint ──────────────
//
//  Module-level (survives StrictMode double-invoke / unmount-remount), last-write
//  -wins Map with a hard cap. A new fingerprint (filter/mode change) maps to a new
//  promise; the oldest entry is evicted on overflow (Map FIFO iteration order).
//
const _promiseCache = new Map<string, Promise<KpiDef[]>>()
const CACHE_MAX = 200

/** Exported for testing only — do not use in production code. */
export const __kpiPromiseCacheForTest = _promiseCache

/** Stable fingerprint of the (code, dims) the resolved KPIs will read. */
function kpiDepKey(reqs: Requirement[], specs: KpiSpec[], dims: Record<string, unknown>): string {
  if (reqs.length === 0) {
    // No extractable reqs (all-static KPIs) — key on specs identity + dims so the
    // memo still stabilises (never under-fires).
    return `static:${specs.map(s => s.id).join(',')}:${JSON.stringify(dims)}`
  }
  return reqs
    .map(r =>
      `${r.code}:${
        Object.entries(r.dims)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(',')
      }`,
    )
    .sort()
    .join('|')
}

/**
 * Resolve a kpi-strip's KpiSpec[] to KpiDef[], async-store-safe.
 *
 * For sync stores this is a thin memoized wrapper over interpretKpis. For async
 * stores (caps.sync === false) it warms every requirement the KPIs will read —
 * INCLUDING the year-1 comparison period of a 'yoy' — then suspends via use()
 * until the warm settles, after which interpretKpis reads the warm cache
 * synchronously. NodeErrorBoundary (in renderNode) catches a rejected warm.
 */
export function useKpiRows(specs: KpiSpec[], ctx: RenderContext): KpiDef[] {
  const { sectionCtx } = ctx
  const store = useMemo(
    () => resolveStore(ctx),
    // resolveStore reads only stores + pageStoreKey — keying on those keeps the
    // CachedStore instance stable across unrelated ctx changes (mirrors useNodeRows).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.stores, ctx.pageStoreKey],
  )
  const isSync = !store.caps || store.caps.sync !== false

  // Always-computed (hooks rules): for sync stores this is the result; for async
  // stores its reqs feed the promise-cache key (the synchronous read runs later).
  const reqs = useMemo<Requirement[]>(
    () => { try { return extractKpiRequirements(specs, sectionCtx) } catch { return [] } },
    [specs, sectionCtx],
  )

  const syncKpis = useMemo(
    () => (isSync ? interpretKpis(specs, sectionCtx, store) : null),
    [isSync, specs, sectionCtx, store],
  )

  // ── Fast-lane: sync stores (every Phase-1 store) — promise cache untouched ──
  if (isSync) return syncKpis as KpiDef[]

  // ── Async path: caps.sync === false (live network stores) ─────────────────
  const depKey = kpiDepKey(reqs, specs, sectionCtx.dims)

  if (!_promiseCache.has(depKey)) {
    // Bind queryAsync — it reads `this` (CachedStore.queryAsync → this.source); a
    // bare reference would drop `this`. The CachedStore dedups concurrent identical
    // fetches, so a StrictMode double-invoke reuses one in-flight fetch per key.
    const qa = store.queryAsync ? store.queryAsync.bind(store) : undefined

    const warm: Promise<QueryResult[]> = qa
      ? Promise.all(
          reqs.flatMap((r): Promise<QueryResult>[] => {
            // r.dims is the AUTHORITATIVE resolved dim-set the synchronous read will
            // use — extractKpiRequirements built it as atTime(t, withFilter(ctx, filter)),
            // which already pins the time AND honours a wildcard filter that DELETES a
            // dim (e.g. a national-total KPI on a region-pinned page sets geo:''). It is
            // therefore the EXACT ctx interpretKpi's storeVal read derives its cacheKey
            // from. We must warm under r.dims VERBATIM — spreading sectionCtx.dims under
            // it (the old `{ ...sectionCtx.dims, ...r.dims }`) silently REINTRODUCES the
            // deleted dim, so the warm key carried geo=R2 while the read key carried no
            // geo → cache miss → ApiStore.querySync cold-throw (the range/dynamics
            // kpi-strip "Failed to load component"). Only the non-dims SectionContext
            // fields (timeMode, locale, …) come from sectionCtx; dims is r.dims alone.
            const reqCtx = { ...sectionCtx, dims: r.dims }
            // Warm BOTH shapes a KPI read may take: val (storeVal point reads —
            // every KpiValueSpec/KpiTrendSpec lowers to storeVal) and obs (so an
            // obs-shaped read of the same slice also hits the warm cache).
            return [
              qa({ type: 'val', code: r.code }, reqCtx),
              qa({ type: 'obs', measure: r.code }, reqCtx),
            ]
          }),
        )
      : Promise.resolve([])

    const promise = warm.then(results => {
      const failed = results.find(r => r.state === 'error')
      if (failed) throw new Error(failed.error ?? 'kpi warm failed')
      // Cache warm — interpretKpis' storeVal reads now resolve synchronously.
      return interpretKpis(specs, sectionCtx, store)
    })

    if (_promiseCache.size >= CACHE_MAX) {
      const firstKey = _promiseCache.keys().next().value
      if (firstKey !== undefined) _promiseCache.delete(firstKey)
    }
    _promiseCache.set(depKey, promise)
  }

  return use(_promiseCache.get(depKey)!)
}
