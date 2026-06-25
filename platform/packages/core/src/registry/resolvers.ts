// ── Built-in SpecResolvers ─────────────────────────────────────────────
//
//  Each DataSpec type is implemented as a SpecResolver class.
//  No switch statement — each type is its own unit, independently testable.
//

import type { EngineRow }                   from '../data/encoding'
import type { DataSpec, RowSpec, YearsSpec } from '../config/data-spec'
import type { SectionContext }               from '../core/context'
import { atTime, TIME_DIM }                  from '../core/context'
import type { DataStore }                    from '../data/store'
import { storeVal, storeObs }               from '../data/store'
import type { CtxRef, DimVal, FilterValue, NeCtxRef, ObsQuery }  from '../sdmx'
import { resolveMeasureRef }                  from '../data/metric'
import { desugar }                             from '../data/desugar'
import { resolveRef }                          from '../ref/ref'
import { resolveLocaleString }                from '../i18n/types'
import type { SpecResolver }                 from './engine'
import { applyPipeline }                      from '../data/transform'
import { defaultRegistry }                   from './engine'
import { emitDiagnostic }                    from './diagnostics'
import { diagWarning }                        from '../core/diagnostic'

// ── Shared utilities ───────────────────────────────────────────────────
//
//  atTime / TIME_DIM are imported from core/context — the single SSOT for
//  the conventional time-axis key. No local 'time' literal lives here.

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
  return [...new Set(obs.map((o) => Number(o[TIME_DIM])))].sort((a, b) => a - b)
}

// ── Measure-ref resolution at the query boundary [N26 / R1] ───────────
//
//  The SINGLE wire point where a config measure reference becomes a store
//  query. resolveMeasureRef (metric.ts) is the SSOT seam; this helper applies
//  its result to an ObsQuery:
//    - measure: raw code(s) substituted for any metric-id(s).
//    - filter:  MetricDef default dims merged in as DEFAULTS. Precedence is
//               explicit config > metric default (the query's own filter keys
//               win on collision). A raw-code query (no metric) gets NO dims
//               merged and the SAME measure back ⇒ a byte-identical ObsQuery
//               (Postel / FF-RAW-CODE-IDENTICAL).
//
//  Cube-default precedence (the third tier) lives below this: the store applies
//  its own defaults to whatever measure+filter it receives, so the full chain
//  is explicit config > metric default > cube default.
//
export function resolveQueryMeasures(query: ObsQuery): ObsQuery {
  const resolved = resolveMeasureRef(query.measure)

  // No metric expansion AND no metric dims ⇒ return the original object
  // untouched (identity) so raw-code queries are provably byte-identical.
  const sameMeasure =
    resolved.codes.length === (Array.isArray(query.measure) ? query.measure.length : 1) &&
    resolved.codes.every((c, i) => c === (Array.isArray(query.measure) ? query.measure[i] : query.measure))
  if (sameMeasure && !resolved.dims) return query

  const measure: string | string[] =
    resolved.codes.length === 1 ? resolved.codes[0]! : resolved.codes

  // Metric dims are DEFAULTS — the query's explicit filter overrides them.
  const filter = resolved.dims
    ? { ...resolved.dims, ...query.filter }
    : query.filter

  return filter !== undefined
    ? { ...query, measure, filter }
    : { ...query, measure }
}

/**
 * Resolve a single measure reference used by the convenience specs
 * (timeseries/growth/ratio-list `code`). A registered metric-id expands to its
 * underlying code; a raw code passes through UNCHANGED (byte-identical).
 * Multi-code metrics resolve to their FIRST code here (the convenience specs
 * are single-measure-per-code by shape); author a `query` spec for multi-measure.
 */
function resolveCode(code: string): string {
  return resolveMeasureRef(code).codes[0] ?? code
}

/**
 * Resolve a FilterValue to a flat list of DimVals (used by extractRequirements).
 * The ctx-scope lookups route through the one Ref dispatcher (../ref) — the same
 * resolution path the runtime filter (store-filter.ts) uses for `$ctx`.
 */
export function resolveFilterForReqs(fv: FilterValue, ctx: SectionContext): DimVal[] {
  if (Array.isArray(fv)) return fv as DimVal[]
  if (typeof fv === 'object' && !Array.isArray(fv)) {
    if ('$ctx' in (fv as object) && !('$ne' in (fv as object))) {
      return [resolveRef(fv as CtxRef, { dims: ctx.dims }) as DimVal]
    }
    if ('$ne'  in (fv as object) && '$ctx' in (fv as object)) {
      const ctxVal = resolveRef({ $ctx: (fv as NeCtxRef).$ctx }, { dims: ctx.dims }) as DimVal | undefined
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
      const code = resolveCode(r.code)
      const raw = storeVal(store, code, ctx)

      let label = r.label
      let color = r.color
      if (!label || !color) {
        const obs = storeObs(store, { measure: code }, ctx)[0]
        if (obs) {
          if (!label) label = String(obs['label'] ?? code)
          if (!color) color = String(obs['color'] ?? '') || undefined
        }
      }

      const row: EngineRow = {
        id:    code,
        // Flatten LocaleString → string at the data boundary; the React/i18n
        // layer performs locale-aware classifier resolution downstream.
        label: label !== undefined ? resolveLocaleString(label, 'en', 'en') : code,
        value: r.negate ? -raw : raw,
      }
      if (r.pctOf !== undefined) row['pct'] = (Math.abs(raw) / storeVal(store, resolveCode(r.pctOf), ctx)) * 100
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
    const code  = resolveCode(spec.code)
    const years = clampYears(resolveYears(spec.years, code, store, ctx), spec, ctx)
    const vals  = years.map((y) => storeVal(store, code, atTime(y, ctx)))
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
    const codes = (Array.isArray(spec.code) ? spec.code : [spec.code]).map(resolveCode)
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
      const numCode = resolveCode(code)
      const denCode = resolveCode(denom)
      const num = storeVal(store, numCode, ctx)
      const den = storeVal(store, denCode, ctx)
      return { id: numCode, measure: numCode, label: label ?? numCode, value: den ? (num / den) * 100 : 0 }
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
    const raw     = storeObs(store, resolveQueryMeasures(spec.query), ctx)
    const clamped = (spec.fromDim || spec.toDim)
      ? raw.filter((o) => {
          const t    = Number(o[TIME_DIM])
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

// ── PivotResolver — desugar delegate [ADR R3] ─────────────────────────
//
//  `pivot` is sugar for transform + melt (F-A). Its bespoke melt-and-shape
//  logic now lives as ONE desugar rule (data/desugar.ts); this resolver is the
//  thin delegate that lowers the spec and resolves the resulting primitive.
//  Kept registered so `pivot` stays a KNOWN spec type (validateDataSpec +
//  Constructor manifest) and so a by-mode branch nesting a pivot still resolves
//  through the registry. interpretSpec also desugars up-front, so this path is
//  reached only via direct registry dispatch (e.g. by-mode) — one rewrite, one
//  resolution. FF-DESUGAR-EQUIV proves the lowered output is row-identical.
//
class PivotResolver implements SpecResolver<Extract<DataSpec, { type: 'pivot' }>> {
  readonly type = 'pivot' as const

  resolve(
    spec:  Extract<DataSpec, { type: 'pivot' }>,
    ctx:   SectionContext,
    store: DataStore,
  ): EngineRow[] {
    const lowered  = desugar(spec)
    const resolver = defaultRegistry.spec(lowered.type)
    return resolver ? resolver.resolve(lowered, ctx, store) : []
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