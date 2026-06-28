// ── PointSeriesResolver — the store-aware desugar target [grain G1] ─────────────
//
//  The genuinely STORE-AWARE primitive (the pure `transform` pipe has no store): it
//  ENUMERATES the generic `over` dimension's coordinates and fans out a `valAt` point
//  read (storeValAt) per coordinate, emits one `{ id, label, value, pct }` row each,
//  then runs the `pipe` tail. The val-cell convenience specs (timeseries → G2; growth
//  via window/derive) lower onto this. Generic over `over` (Law 1); declarative (Law 2).
//
//  Byte-identity (FF-DESUGAR-EQUIV): given the timeseries-lowered shape it reproduces
//  the bespoke TimeseriesResolver exactly — coords = explicit list ?? store distinct
//  (ascending), clamped via the SAME effectiveBounds; value via storeValAt (default
//  sum ≡ storeVal(atTime)); pct = |v| / max(|v|, 1) × 100.
//
//  Kept in its own file (one concern: the grain/store-aware resolver) so resolvers.ts
//  stays the simple cell-resolver unit; registered from there (one registration site).
//

import type { EngineRow }        from '../data/encoding'
import type { PointSeriesSpec }  from '../config/data-spec'
import type { SectionContext }   from '../core/context'
import { clampToBounds, effectiveBounds } from '../core/time-dimension'
import type { DataStore }        from '../data/store'
import { storeValAt, storeObs }  from '../data/store'
import type { DimVal }           from '../sdmx'
import type { SpecResolver }     from './engine'
import { applyPipeline }         from '../data/transform'
import { resolveCode }           from './spec-helpers'

export class PointSeriesResolver implements SpecResolver<PointSeriesSpec> {
  readonly type = 'point-series' as const

  resolve(
    spec:  PointSeriesSpec,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const code = resolveCode(spec.code)
    const over = spec.over

    // 1. coordinate enumeration: explicit list, or the store's distinct(over) ascending.
    let coords: DimVal[] = (spec.coords === undefined || spec.coords === 'all')
      ? this.enumerate(over, code, store, ctx)
      : [...spec.coords]

    // 2. numeric range clamp (folds fromDim/toDim + timeDimension — same machinery as
    //    the legacy clampYears, so a clamped timeseries lowers byte-identically).
    if (spec.clamp && coords.length && coords.every((c) => typeof c === 'number')) {
      const { from, to } = effectiveBounds(spec.clamp, ctx)
      coords = clampToBounds(coords as number[], from, to)
    }

    // 3. one valAt point read per coordinate (default sum ≡ storeVal(atTime), Law 1).
    const vals = coords.map((c) =>
      storeValAt(store, code, { ...spec.at, [over]: c }, ctx, spec.grain, spec.rollup),
    )
    const max = Math.max(...vals.map(Math.abs), 1)

    const rows: EngineRow[] = coords.map((c, i) => ({
      id:    String(c),
      label: String(c),
      value: vals[i],
      pct:   (Math.abs(vals[i]) / max) * 100,
    }))

    if (!spec.pipe?.length) return rows
    return applyPipeline(rows, spec.pipe,
      { classifiers: store.classifiers, display: store.display, section: ctx })
  }

  // distinct(over) for the measure, ascending — mirrors resolveYears for the time axis
  //  (numeric coords sort numerically; non-numeric sort lexically — generic, Law 1).
  private enumerate(over: string, code: string, store: DataStore, ctx: SectionContext): DimVal[] {
    const raw  = storeObs(store, { measure: code }, ctx).map((o) => o[over]).filter((v) => v !== undefined) as DimVal[]
    const uniq = [...new Set(raw)]
    const allNumeric = uniq.every((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))))
    return allNumeric
      ? [...new Set(uniq.map(Number))].sort((a, b) => a - b) as DimVal[]
      : [...uniq].sort()
  }
}
