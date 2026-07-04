// ── KPI preliminary derivation — the DISPLAYED-slice status (Law 9, year-aware) ──
//
//  A KPI's `preliminary` flag must reflect the SDMX OBS_STATUS of the observation(s)
//  the card ACTUALLY reads at its pinned coordinate(s) — NEVER the dataset-wide
//  provenance (`store.metadata?.provenance(code)`), which lit the badge on a FINAL
//  year merely because some OTHER slice of the dataset carried a preliminary obs
//  (the year-blind leak). This is the status-aware twin of `resolveValue` (kpi.ts):
//  it walks the SAME coordinate logic each value discriminant reads via `storeVal`,
//  but inspects `obsStatus` instead of summing `value`.
//
//  `storeObs` is the status-carrying sibling of `storeVal` — it returns the raw
//  Observation[] (each carrying the SDMX `obsStatus` field) for a measure. We read it
//  with the SAME `{ measure }` shape the KPI warm path pre-fetches (useKpiRows warms
//  `val` AND `obs` per requirement), so an async ApiStore resolves it from the warm
//  cache — never a cold-throw. The returned rows are then scoped to the exact
//  coordinate (measure × every concrete dim in `c.dims`, INCLUDING the pinned time)
//  client-side, so a warm slice carrying sibling measures/periods narrows to the cell
//  the KPI displays. Generic over dims (Law 1 — no year/measure literal).

import type { DataStore, Observation } from './store'
import { storeObs }                    from './store'
import { resolveMeasureRef }           from './metric'
import type { SectionContext }         from '../core/context'
import { atTime, MEASURE_DIM }         from '../core/context'
import type { KpiValueSpec }           from './kpi-spec'
import { resolveTime, withFilter }     from './kpi-coord'

/** True when an SDMX OBS_STATUS value denotes preliminary data ('p', any case). */
function isPreliminaryStatus(status: unknown): boolean {
  return typeof status === 'string' && status.toLowerCase() === 'p'
}

/** True when an Observation carries a preliminary OBS_STATUS on any provenance field. */
function obsIsPreliminary(o: Observation): boolean {
  const r = o as Record<string, unknown>
  const prov = r['provenance'] as { status?: unknown } | undefined
  return isPreliminaryStatus(r['obsStatus']) || isPreliminaryStatus(r['status']) || isPreliminaryStatus(prov?.status)
}

/**
 * Status-aware point read: does ANY observation at (measure × c.dims) carry
 * OBS_STATUS 'p'? The read mirrors `storeVal(store, measure, c)` but inspects status.
 * Scopes the returned rows to the coordinate client-side (measure + every concrete
 * dim in c.dims) — a warm slice that carries sibling measures/periods is narrowed to
 * the exact cell the KPI displays. Defensive `try/catch → false`: status detection is
 * best-effort and must NEVER crash the kpi-strip (the warm===render invariant).
 */
function coordIsPreliminary(store: DataStore, measure: string, c: SectionContext): boolean {
  let obs: Observation[]
  try {
    obs = storeObs(store, { measure }, c)
  } catch {
    return false
  }
  for (const o of obs) {
    const r = o as Record<string, unknown>
    if (String(r[MEASURE_DIM] ?? measure) !== measure) continue
    let atCoord = true
    for (const [dim, val] of Object.entries(c.dims)) {
      if (val === '' || val === null || val === undefined) continue
      const ov = r[dim]
      if (ov !== undefined && String(ov) !== String(val)) { atCoord = false; break }
    }
    if (atCoord && obsIsPreliminary(o)) return true
  }
  return false
}

/**
 * Does the KPI's VALUE read any preliminary observation? Walks every value
 * discriminant's coordinate(s) — the SAME reads `resolveValue` issues — and reports
 * whether ANY displayed observation carries OBS_STATUS 'p'. Covers each endpoint a
 * discriminant reads: `point` (its coord), `yoy`/`cagr` (both periods), `mean` (every
 * year in the window), `share` (num AND denom), `expr` (every code), `metric` (each
 * component at the pinned period).
 */
export function valueIsPreliminary(spec: KpiValueSpec, ctx: SectionContext, store: DataStore): boolean {
  switch (spec.type) {
    case 'point': {
      const c = withFilter(ctx, spec.filter)
      return coordIsPreliminary(store, spec.measure, atTime(resolveTime(spec.time, c), c))
    }
    case 'yoy': {
      const c = withFilter(ctx, spec.filter)
      const t = resolveTime(spec.time, c)
      return coordIsPreliminary(store, spec.measure, atTime(t, c))
          || coordIsPreliminary(store, spec.measure, atTime(t - 1, c))
    }
    case 'cagr': {
      const c = withFilter(ctx, spec.filter)
      // `to` (the latest endpoint) first — the most likely preliminary period.
      return coordIsPreliminary(store, spec.measure, atTime(resolveTime(spec.to, c), c))
          || coordIsPreliminary(store, spec.measure, atTime(resolveTime(spec.from, c), c))
    }
    case 'mean': {
      const c  = withFilter(ctx, spec.filter)
      const lo = Math.min(resolveTime(spec.from, c), resolveTime(spec.to, c))
      const hi = Math.max(resolveTime(spec.from, c), resolveTime(spec.to, c))
      for (let t = lo; t <= hi; t++) {
        if (coordIsPreliminary(store, spec.measure, atTime(t, c))) return true
      }
      return false
    }
    case 'share': {
      const cn = withFilter(ctx, spec.num.filter)
      const cd = withFilter(ctx, spec.denom.filter)
      return coordIsPreliminary(store, spec.num.measure,   atTime(resolveTime(spec.num.time, cn), cn))
          || coordIsPreliminary(store, spec.denom.measure, atTime(resolveTime(spec.denom.time, cd), cd))
    }
    case 'expr': {
      const c = withFilter(ctx, spec.filter)
      const t = resolveTime(spec.time, c)
      return spec.codes.some((code) => coordIsPreliminary(store, code, atTime(t, c)))
    }
    case 'metric': {
      const t = resolveTime(spec.time, ctx)
      return resolveMeasureRef(spec.metric).codes.some(
        (code) => coordIsPreliminary(store, code, atTime(t, ctx)),
      )
    }
  }
}
