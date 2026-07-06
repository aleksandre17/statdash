// ── KPI coordinate resolution — shared read-side helpers ────────────────
//
//  The coordinate primitives BOTH the value interpreter (kpi.ts) and the
//  displayed-slice preliminary derivation (kpi-preliminary.ts) resolve a KPI's
//  read coordinate with. Extracted here so the two consumers share ONE definition
//  (DRY) without a circular import — a KPI's value and its OBS_STATUS must be read
//  at the IDENTICAL coordinate, so the coordinate logic lives in one place.
//
//    resolveTime     — a TimeRef ($ctx | literal | absent) → the pinned year.
//    resolveFilterVal — ONE KPI filter dim value ($ctx-scoped | $ne | literal).
//    withFilter      — a KpiValueSpec.filter → a SectionContext scoped to it.
//

import type { SectionContext } from '../core/context'
import { TIME_DIM }             from '../core/context'
import type { DimVal }          from '../sdmx'
import type { TimeRef, DimFilter, DimFilterRef } from './kpi-spec'

export function resolveTime(ref: TimeRef | undefined, ctx: SectionContext): number {
  if (ref === undefined)                        return ctx.dims[TIME_DIM] as number
  if (typeof ref === 'object' && '$ctx' in ref) return ctx.dims[ref.$ctx] as number
  return ref as number
}

// Resolve ONE KPI filter dim value against the live ctx.dims. A `$ctx` ref FOLLOWS
// the current selection (cross-filter); an empty selection falls back to the ref's
// `default` (e.g. '_T' national total). A literal passes through unchanged. This is
// the read-side twin of the store's resolveFilter `$ctx` handling — a KPI filter
// dim can now scope to the selection instead of pinning a literal.
export function resolveFilterVal(v: DimFilter[string], ctx: SectionContext): DimVal | '' {
  if (v !== null && typeof v === 'object') {
    if ('$ctx' in v) {
      const ref = v as Extract<DimFilterRef, { $ctx: string }>
      const sel = ctx.dims[ref.$ctx]
      if (sel !== '' && sel !== null && sel !== undefined) return sel as DimVal
      return ref.default ?? ''
    }
    // A bare `{$ne}` (no positive $ctx) is a pure exclusion → wildcard POSITIVE; the
    // exclusion itself is collected by withFilter and applied at match time.
    if ('$ne' in v) return ''
  }
  return v as DimVal
}

export function withFilter(ctx: SectionContext, filter?: DimFilter): SectionContext {
  if (!filter) return ctx
  const dims = { ...ctx.dims }
  let exclude: Record<string, DimVal[]> | undefined
  for (const [k, v] of Object.entries(filter)) {
    const rv = resolveFilterVal(v, ctx)
    // '' / null / undefined — wildcard: drop the dim from ctx so val() sums over it.
    if (rv === '' || rv === null || rv === undefined) delete dims[k]
    else                                              dims[k] = rv
    // `$ne` — a CLIENT-SIDE exclusion applied at val match time, kept SEPARATE from
    // the positive coordinate so a wildcard fallback still sums the whole dim MINUS the
    // excluded aggregate row (e.g. sum leaf regions, drop `_T`). When the $ctx pin IS
    // populated (State B), the positive coordinate already excludes `_T`, so this is a
    // harmless no-op. The wire fetch is unchanged (covering superset) — warm↔read safe.
    if (v !== null && typeof v === 'object' && '$ne' in v && (v as DimFilterRef).$ne !== undefined) {
      (exclude ??= {})[k] = [(v as DimFilterRef).$ne as DimVal]
    }
  }
  return exclude ? { ...ctx, dims, exclude } : { ...ctx, dims }
}
