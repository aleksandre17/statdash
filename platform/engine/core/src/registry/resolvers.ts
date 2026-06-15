// ── Built-in SpecResolvers ─────────────────────────────────────────────
//
//  Each DataSpec type is implemented as a SpecResolver class.
//  No switch statement — each type is its own unit, independently testable.
//

import type { EngineRow }                   from '../data/encoding'
import type { DataSpec, RowSpec, YearsSpec } from '../config/section'
import type { SectionContext }               from '../core/context'
import type { DataStore }                    from '../data/store'
import { storeVal, storeObs }               from '../data/store'
import type { CtxRef, DimVal, FilterValue, NeCtxRef }  from '../sdmx'
import type { SpecResolver }                 from './engine'
import { applyPipeline, applyStep }          from '../data/transform'
import { defaultRegistry }                   from './engine'
import { emitDiagnostic }                    from './diagnostics'
import { diagWarning }                        from '../core/diagnostic'

// ── Shared utilities ───────────────────────────────────────────────────

function atTime(t: number, ctx: SectionContext): SectionContext {
  if ((ctx.dims['time'] as number) === t) return ctx
  return { ...ctx, dims: { ...ctx.dims, time: t } }
}

/**
 * Resolves YearsSpec → number[].
 *
 * 'all'    — queries distinct time values from the store for the given measure.
 *            observe() without a time filter returns all years (ctx.dims NOT auto-applied).
 *            Sorted ascending. Duplicates removed.
 *
 * number[] — returned as-is. No store access.
 */
function resolveYears(years: YearsSpec, measure: string, store: DataStore, ctx: SectionContext): number[] {
  if (years !== 'all') return [...years]
  const obs = storeObs(store, { measure }, ctx)
  return [...new Set(obs.map((o) => Number(o['time'])))].sort((a, b) => a - b)
}

/** Resolve a FilterValue to a flat list of DimVals (used by extractRequirements). */
export function resolveFilterForReqs(fv: FilterValue, ctx: SectionContext): DimVal[] {
  if (Array.isArray(fv)) return fv as DimVal[]
  if (typeof fv === 'object' && !Array.isArray(fv)) {
    if ('$ctx' in (fv as object) && !('$ne' in (fv as object))) return [ctx.dims[(fv as CtxRef).$ctx]]
    if ('$ne'  in (fv as object) && '$ctx' in (fv as object)) {
      const ctxVal = ctx.dims[(fv as NeCtxRef).$ctx]
      return ctxVal !== '' && ctxVal != null ? [ctxVal] : []
    }
    if ('$ne'  in (fv as object)) return []   // can't enumerate excluded values statically
  }
  return [fv as DimVal]
}

// ── ByModeResolver ────────────────────────────────────────────────────

class ByModeResolver implements SpecResolver<Extract<DataSpec, { type: 'by-mode' }>> {
  readonly type = 'by-mode' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'by-mode' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const modeKeys = Object.keys(spec.modes)
    const branch   = spec.modes[ctx.timeMode]

    let active: DataSpec | undefined
    if (branch) {
      active = branch
    } else {
      // Active mode key absent — emit a diagnostic then fall back to first branch.
      const fallbackKey = modeKeys[0]
      emitDiagnostic(diagWarning(
        'by-mode:missing-branch',
        `timeMode '${ctx.timeMode}' not found in modes [${modeKeys.join(', ')}]; falling back to '${fallbackKey ?? '(none)'}'`,
      ))
      active = fallbackKey ? spec.modes[fallbackKey] : undefined
    }

    if (!active) return []
    const resolver = defaultRegistry.spec(active.type)
    if (resolver) return resolver.resolve(active as DataSpec, ctx, store)
    return []
  }
}

// ── RowListResolver ───────────────────────────────────────────────────

class RowListResolver implements SpecResolver<Extract<DataSpec, { type: 'row-list' }>> {
  readonly type = 'row-list' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'row-list' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    return spec.rows.map((r: RowSpec) => {
      const raw = storeVal(store, r.code, ctx)

      let label = r.label
      let color = r.color
      if (!label || !color) {
        const obs = storeObs(store, { measure: r.code }, ctx)[0]
        if (obs) {
          if (!label) label = String(obs['label'] ?? r.code)
          if (!color) color = String(obs['color'] ?? '') || undefined
        }
      }

      const row: EngineRow = {
        id:    r.code,
        label: label ?? r.code,
        value: r.negate ? -raw : raw,
      }
      if (r.pctOf !== undefined) row['pct'] = (Math.abs(raw) / storeVal(store, r.pctOf, ctx)) * 100
      if (color)    row['color']   = color
      if (r.isTotal) row['isTotal'] = true
      return row
    })
  }
}

// ── clampYears — shared helper for fromDim / toDim ────────────────────

function clampYears(
  years:  number[],
  spec:   { fromDim?: string; toDim?: string },
  ctx:    SectionContext,
): number[] {
  let out = years
  if (spec.fromDim) {
    const from = Number(ctx.dims[spec.fromDim] ?? 0)
    if (from) out = out.filter((y) => y >= from)
  }
  if (spec.toDim) {
    const to = Number(ctx.dims[spec.toDim] ?? Infinity)
    if (to) out = out.filter((y) => y <= to)
  }
  return out
}

// ── TimeseriesResolver ────────────────────────────────────────────────

class TimeseriesResolver implements SpecResolver<Extract<DataSpec, { type: 'timeseries' }>> {
  readonly type = 'timeseries' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'timeseries' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const years = clampYears(resolveYears(spec.years, spec.code, store, ctx), spec, ctx)
    const vals  = years.map((y) => storeVal(store, spec.code, atTime(y, ctx)))
    const max   = Math.max(...vals.map(Math.abs), 1)
    return years.map((y, i) => ({
      id:    String(y),
      label: String(y),
      value: vals[i],
      pct:   (Math.abs(vals[i]) / max) * 100,
    }))
  }
}

// ── GrowthResolver ────────────────────────────────────────────────────

class GrowthResolver implements SpecResolver<Extract<DataSpec, { type: 'growth' }>> {
  readonly type = 'growth' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'growth' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const codes = Array.isArray(spec.code) ? spec.code : [spec.code]
    const years = clampYears(resolveYears(spec.years, codes[0], store, ctx), spec, ctx)

    if (codes.length === 1) {
      return years.slice(1).map((y, i) => {
        const prev = storeVal(store, codes[0], atTime(years[i], ctx))
        const cur  = storeVal(store, codes[0], atTime(y,        ctx))
        const gr   = prev ? ((cur / prev - 1) * 100) : 0
        return { id: String(y), label: String(y), value: gr,
                 color: gr >= 0 ? '#00A896' : '#E76F51' }
      })
    }

    const result: EngineRow[] = []
    for (const code of codes) {
      const meta  = storeObs(store, { measure: code, filter: { time: years[0] } }, ctx)[0]
      const label = meta ? String(meta['label'] ?? code) : code
      const color = meta ? String(meta['accountColor'] ?? meta['color'] ?? '') : ''
      for (let i = 1; i < years.length; i++) {
        const prev = storeVal(store, code, atTime(years[i - 1], ctx))
        const cur  = storeVal(store, code, atTime(years[i],     ctx))
        const gr   = prev ? ((cur / prev - 1) * 100) : 0
        result.push({ id: `${label}::${years[i]}`, label, series: String(years[i]), value: gr, color })
      }
    }
    return result
  }
}

// ── RatioListResolver ─────────────────────────────────────────────────

class RatioListResolver implements SpecResolver<Extract<DataSpec, { type: 'ratio-list' }>> {
  readonly type = 'ratio-list' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'ratio-list' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const rows = spec.pairs.map(({ code, denom, label }) => {
      const num = storeVal(store, code,  ctx)
      const den = storeVal(store, denom, ctx)
      return { id: code, measure: code, label: label ?? code, value: den ? (num / den) * 100 : 0 }
    })
    if (!spec.pipe?.length) return rows
    return applyPipeline(
      rows,
      spec.pipe,
      { classifiers: store.classifiers, display: store.display, section: ctx },
    )
  }
}

// ── QueryResolver ─────────────────────────────────────────────────────
//
//  Pure data ops: observe → year-clamp → pipe → return raw rows.
//  No encoding — field→channel mapping happens at the renderer boundary
//  (RenderEngine.encodeRows), not here. Renderer-agnostic by design.
//
//  Pattern: Grafana data pipeline returns DataFrames (raw);
//           panels apply field overrides at their own boundary.
//
class QueryResolver implements SpecResolver<Extract<DataSpec, { type: 'query' }>> {
  readonly type = 'query' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'query' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const raw     = storeObs(store, spec.query, ctx)
    const clamped = (spec.fromDim || spec.toDim)
      ? raw.filter((o) => {
          const t    = Number(o['time'])
          const from = spec.fromDim ? Number(ctx.dims[spec.fromDim] ?? 0)        : 0
          const to   = spec.toDim   ? Number(ctx.dims[spec.toDim]   ?? Infinity) : Infinity
          return (!from || t >= from) && (!to || t <= to)
        })
      : raw

    if (spec.pipe?.length) {
      return applyPipeline(clamped, spec.pipe,
        { classifiers: store.classifiers, display: store.display, section: ctx })
    }
    return clamped
  }
}

// ── PivotResolver ─────────────────────────────────────────────────────

class PivotResolver implements SpecResolver<Extract<DataSpec, { type: 'pivot' }>> {
  readonly type = 'pivot' as const

  resolve(spec: Extract<DataSpec, { type: 'pivot' }>): EngineRow[] {
    const melted = applyStep(spec.rows, {
      op: 'melt', idFields: [spec.keyField], valueFields: spec.valueFields,
      seriesKey: 'series', valueKey: 'value',
    })
    return melted.map((row) => {
      const label  = String(row[spec.keyField] ?? '')
      const series = String(row['series'] ?? '')
      const out: EngineRow = { id: `${label}::${series}`, label, series, value: Number(row['value'] ?? 0) }
      const color = spec.colors?.[series]
      if (color) out['color'] = color
      return out
    })
  }
}

// ── TransformResolver ─────────────────────────────────────────────────
//
//  Pure pipeline: inline source → steps → raw rows.
//  Encoding happens at the renderer boundary, not here.
//
class TransformResolver implements SpecResolver<Extract<DataSpec, { type: 'transform' }>> {
  readonly type = 'transform' as const

  resolve(spec: Extract<DataSpec, { type: 'transform' }>): EngineRow[] {
    return applyPipeline(spec.source, spec.steps)
  }
}

// ── Register all built-in spec resolvers ──────────────────────────────
//
//  To add a custom resolver: `defaultRegistry.registerSpec(myResolver)` in your app bootstrap.
//

defaultRegistry
  .registerSpec(new ByModeResolver())
  .registerSpec(new RowListResolver())
  .registerSpec(new TimeseriesResolver())
  .registerSpec(new GrowthResolver())
  .registerSpec(new RatioListResolver())
  .registerSpec(new QueryResolver())
  .registerSpec(new PivotResolver())
  .registerSpec(new TransformResolver())