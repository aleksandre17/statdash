// ── MetricResolver — the `metric` DataSpec resolver [AR-50 M-SQ] ────────────────
//
//  Metric-first, made STRUCTURAL. A `metric` spec names GOVERNED metrics + a GRAIN;
//  this resolver LOWERS it onto the existing machinery rather than introducing a new
//  data path (OCP / Law 8 — a new discriminant = one registered resolver, the union's
//  interface unchanged). It does NOT reimplement the grain algebra — it delegates to
//  the M2 SSOT `evalMeasureAtGrain`:
//
//    grain  = by ⊕ time.dim         (generic dim keys — Law 1, `time` is not special)
//    scoped = ctx.dims ⊕ where       (the semantic-layer `where` narrows the coordinate)
//    per ref → evalMeasureAtGrain(ref, scoped, store, grain)
//               • CALC metric → re-derived at grain (align-join + Expr eval, SNA-correct)
//               • BASE metric → the OLAP cell rolled up per grain tuple
//    time.range → clamp the emitted tuples (the SAME effectiveBounds the val-cell specs use)
//    reshape → a canonical `{ ...tuple, id, label, series, metric, value }` EngineRow
//
//  Store-aware + algebra-consuming (like PointSeriesResolver), so it lives in its own
//  file; registered from resolvers.ts (one registration site — the single extension path).
//  Declarative + JSON-serializable spec in, neutral EngineRow[] out; encoding happens at
//  the renderer boundary. Arrow-clean (core → data + core/time-dimension only).
//

import type { EngineRow }        from '../data/encoding'
import type { MetricSpec, TimeDimensionSpec } from '../config/data-spec'
import type { SectionContext }    from '../core/context'
import type { DataStore }         from '../data/store'
import type { DimVal }            from '../sdmx'
import type { SpecResolver }      from './engine'
import { evalMeasureAtGrain }     from '../data/metric-grain'
import { getMetric }              from '../data/metric'
import { effectiveBounds, effectiveYears } from '../core/time-dimension'
import { tagLocaleString }        from '../i18n/types'
import type { LocaleString }      from '../i18n/types'

/**
 * grain = by ⊕ time.dim — the generic ordered grain axes (Law 1). The first-class
 * `time.dim` JOINS the grain (de-duped if already in `by`); a metric "over time" may
 * be authored either way. Absent both ⇒ grain-∅ (a scalar governed value per metric).
 */
function effectiveMetricGrain(spec: MetricSpec): string[] {
  const by = spec.by ?? []
  const timeDim = spec.time?.dim
  return timeDim && !by.includes(timeDim) ? [...by, timeDim] : by
}

/**
 * The series label for a ref — the GOVERNED metric label (tagged so the React
 * resolveRowLocales boundary localizes it; Law 1 — the engine never picks a locale) or
 * the raw ref string for an unregistered code. Carried on every row's `series` field so
 * a multi-metric spec renders as distinct series.
 */
function seriesLabel(ref: string): DimVal {
  const label: LocaleString | undefined = getMetric(ref)?.label
  return (label ? tagLocaleString(label) : ref) as DimVal
}

/**
 * Apply the first-class `time` selection to the emitted grain tuples — BOTH forms of
 * TimeRange, via the SAME core/time-dimension SSOT the val-cell specs use:
 *   • YearsSpec (explicit number[]) → keep only the selected coordinates (a SELECTION).
 *     'all'/absent ⇒ no filter (every enumerated coordinate).
 *   • [from,to] ctx-ref tuple       → the numeric CLAMP (effectiveBounds).
 * The two literal-number tuple form is a YearsSpec (per TimeRange's shape rule), so it
 * is honored here as a selection — not silently ignored.
 */
function applyTimeSelection(rows: EngineRow[], td: TimeDimensionSpec | undefined, ctx: SectionContext): EngineRow[] {
  if (!td) return rows
  const dim = td.dim
  let out = rows

  // Explicit year SELECTION (range is a number[]).
  const sel = effectiveYears({ timeDimension: td })
  if (Array.isArray(sel)) {
    const keep = new Set(sel.map(String))
    out = out.filter((r) => keep.has(String(r[dim])))
  }

  // Numeric [from,to] CLAMP (ctx-ref bounds; a YearsSpec folds to from:0/to:∞ ⇒ no-op).
  const { from, to } = effectiveBounds({ timeDimension: td }, ctx)
  if (from || to !== Infinity) {
    out = out.filter((r) => {
      const t = Number(r[dim])
      return (!from || t >= from) && (!to || t <= to)
    })
  }
  return out
}

export class MetricResolver implements SpecResolver<MetricSpec> {
  readonly type = 'metric' as const

  resolve(spec: MetricSpec, ctx: SectionContext, store: DataStore): EngineRow[] {
    const grain = effectiveMetricGrain(spec)

    // `where` narrows the read coordinate — merged OVER ctx.dims (Law 1, any dim).
    const scoped: SectionContext =
      spec.where && Object.keys(spec.where).length > 0
        ? { ...ctx, dims: { ...ctx.dims, ...spec.where } as Record<string, DimVal> }
        : ctx

    const out: EngineRow[] = []
    for (const ref of spec.metrics) {
      const series = seriesLabel(ref)
      let rows = evalMeasureAtGrain(ref, scoped, store, grain)
      rows = applyTimeSelection(rows, spec.time, ctx)

      for (const r of rows) {
        // r is `{ ...grainTuple, value }`. Reshape into a canonical EngineRow: id/label
        // carry the grain coordinate(s) for the renderer's default encoding; the raw
        // tuple dims are PRESERVED (spread) so an encoding addressing a dim key (x=time)
        // still resolves. series/metric identify the measure across a multi-metric spec.
        const id    = grain.length ? grain.map((d) => String(r[d])).join('::') : ref
        const label = grain.length === 1 ? String(r[grain[0]!]) : id
        out.push({ ...r, id, label, series, metric: ref })
      }
    }
    return out
  }
}
