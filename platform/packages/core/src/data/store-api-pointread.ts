// ── ApiStore point-read resolution — OLAP cell from a cached slice ──────────
//
//  One concern: resolve a `val`/`valAt` (an OLAP point read) from ApiStore's
//  already-warmed cache, WITHOUT a network round-trip and WITHOUT duplicating the
//  OLAP matching loop.
//
//  Why this exists (the live-deploy regression it fixes):
//    C2 warms ONE UNBOUNDED slice per code for timeseries/growth/point-series
//    `'all'` (the enumerated dim — usually time — stripped). But the resolver then
//    fans out ONE point read per coordinate (storeValAt → val at ctx ⊕ {time:yearᵢ}),
//    whose wire key folds in `from=yearᵢ&to=yearᵢ` → it keys DISTINCTLY from the
//    warmed unbounded slice → exact-key MISS → the old querySync threw cold. The
//    render never happened live even though every needed row was already cached.
//
//  The fix (Ports & Adapters, SSOT): on an exact-key miss, resolve the value from an
//  already-cached SUPERSET slice — a slice whose wire params constrain a SUPERSET of
//  the read's rows (the C2-warmed unbounded slice qualifies) — by filter+sum over its
//  rows using `matchedValues`, the SAME matcher ExternalStore uses. ONE implementation
//  of "resolve a value from a set of rows"; no OLAP logic is copied into ApiStore.
//
//  Byte-identical to ExternalStore's `_val`/`_valAt`: same matchedValues → same
//  rollupValues → same roundAgg, differing only in the row source (a cached slice vs
//  a full cube). FF-WARM-COVERS-RENDER asserts this parity.

import type { SectionContext } from '../core/context'
import { TIME_DIM }            from '../core/context'
import type { DimVal }         from '../sdmx'
import type { EngineRow }      from './encoding'
import type { RollupOp, StoreQuery } from './store'
import { matchedValues }       from './store-filter'
import { roundAgg }            from './round'
import { rollupValues }        from './grain'

/** The subset of a cache entry the point-read resolver needs. */
interface CachedSlice {
  rows:   EngineRow[]
  params: Record<string, string>
}

/**
 * Resolve a `val`/`valAt` point read from the cache.
 *   returns a number  — resolved from the exact-key slice OR a cached superset.
 *   returns undefined  — cold miss (no exact key, no covering superset).
 *
 * `exactKey`/`readParams` are supplied by the caller (ApiStore owns cacheKeyFor +
 * toObsParams — the wire-identity SSOT), so this module stays a pure resolver.
 */
export function resolveCachedPointRead(
  cache:      ReadonlyMap<string, CachedSlice>,
  q:          Extract<StoreQuery, { type: 'val' | 'valAt' }>,
  ctx:        SectionContext,
  exactKey:   string,
  readParams: Record<string, string>,
): number | undefined {
  const slice = findResolvableSlice(cache, exactKey, readParams)
  if (!slice) return undefined

  const at         = q.type === 'valAt' ? q.at : undefined
  const rollup: RollupOp = (q.type === 'valAt' ? q.rollup : undefined) ?? 'sum'
  const coordinate = at ? { ...ctx.dims, ...at } as Record<string, DimVal> : { ...ctx.dims }

  // Match only the coordinate dims the cached slice did NOT already scope
  // server-side: a dim in the slice's wire `filter` (or the time dim, when the slice
  // is bounded to a single period) is already applied by the server, so re-matching
  // it client-side is redundant AND unsafe (the server returns LEAF codes for a
  // hierarchical parent filter — an identity re-match would drop them).
  const matchDims = clientMatchDims(coordinate, slice.params)
  return roundAgg(rollupValues(matchedValues(slice.rows, q.code, matchDims), rollup))
}

/** The exact-key slice, else the first cached SUPERSET slice (undefined = none). */
function findResolvableSlice(
  cache:      ReadonlyMap<string, CachedSlice>,
  exactKey:   string,
  readParams: Record<string, string>,
): CachedSlice | undefined {
  const exact = cache.get(exactKey)
  if (exact) return exact
  for (const entry of cache.values()) {
    if (isSupersetParams(entry.params, readParams)) return entry
  }
  return undefined
}

/**
 * True ⟺ a slice fetched under `cached` constrains a SUPERSET of the rows the read
 * (`read`) wants — i.e. `cached`'s constraints are a SUBSET of `read`'s:
 *   • same dataset,
 *   • `cached`'s time bound (if any) CONTAINS `read`'s bound (unbounded ⊇ any), and
 *   • every dim `cached` pins in its wire `filter`, `read` pins identically (`read`
 *     may pin MORE — e.g. the enumerated `over` dim or a tighter time bound).
 * Resolving `read` over such a slice by filter+sum is exact (no row is missing).
 */
function isSupersetParams(cached: Record<string, string>, read: Record<string, string>): boolean {
  if (cached['dataset'] !== read['dataset']) return false

  // Time bound containment (numeric period compare). An unbounded cached slice (no
  // from/to) spans every read bound. A bounded cached slice must contain read's bound.
  if (cached['from'] !== undefined || cached['to'] !== undefined) {
    const cFrom = cached['from'] !== undefined ? Number(cached['from']) : -Infinity
    const cTo   = cached['to']   !== undefined ? Number(cached['to'])   :  Infinity
    const rFrom = read['from']   !== undefined ? Number(read['from'])   : -Infinity
    const rTo   = read['to']     !== undefined ? Number(read['to'])     :  Infinity
    if (!(cFrom <= rFrom && cTo >= rTo)) return false
  }

  const cFilter = cached['filter'] ? JSON.parse(cached['filter']) as Record<string, unknown> : {}
  const rFilter = read['filter']   ? JSON.parse(read['filter'])   as Record<string, unknown> : {}
  for (const [dim, val] of Object.entries(cFilter)) {
    if (JSON.stringify(rFilter[dim]) !== JSON.stringify(val)) return false
  }
  return true
}

/** Coordinate dims still needing a client match (those NOT scoped by the slice). */
function clientMatchDims(
  coordinate: Record<string, DimVal>,
  params:     Record<string, string>,
): Record<string, DimVal> {
  const filterDims = params['filter'] ? new Set(Object.keys(JSON.parse(params['filter']) as object)) : new Set<string>()
  // A slice bounded to a SINGLE period (from===to) already scoped time to that value
  // server-side; a broader/unbounded slice has not, so time is matched client-side.
  const timePinned = params['from'] !== undefined && params['from'] === params['to']
  const out: Record<string, DimVal> = {}
  for (const [dim, val] of Object.entries(coordinate)) {
    if (dim === TIME_DIM) { if (!timePinned) out[dim] = val; continue }
    if (!filterDims.has(dim)) out[dim] = val
  }
  return out
}
