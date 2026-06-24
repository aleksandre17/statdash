import { staticStore }           from './store'
import { resolveFilterForReqs }  from '../registry/resolvers'
import { resolveMeasureRef }     from './metric'
import type { EngineRow }        from './encoding'
import type { DataSpec }         from '../config/data-spec'
import type { SectionContext }   from '../core/context'
import { TIME_DIM }              from '../core/context'
import type { DataStore, Requirement } from './store'
import { defaultRegistry }       from '../registry/engine'
import { emitDiagnostic }        from '../registry/diagnostics'
import { diagWarning }           from '../core/diagnostic'

// Side-effect import: populate defaultRegistry with all built-in resolvers
import '../registry/resolvers'

// ── Observability seam ────────────────────────────────────────────────
//
//  The engine never reads import.meta or couples to a console.
//  The app layer registers an optional observer (once, at startup) and
//  receives resolved rows for logging / telemetry.  Engine ships pure.
//
//  Usage (app layer, dev-only):
//    import { setSpecResolveObserver } from '@statdash/engine'
//    if (import.meta.env.DEV) {
//      setSpecResolveObserver((tag, ctx, rows) => { … })
//    }
//
export type SpecResolveObserver = (
  tag:  string,
  ctx:  SectionContext,
  rows: EngineRow[],
) => void

let _observer: SpecResolveObserver | undefined

/** Register a single dev-time observer.  Call once at app startup. */
export function setSpecResolveObserver(fn: SpecResolveObserver): void {
  _observer = fn
}

// ── interpretSpec ─────────────────────────────────────────────────────
//
//  Single entry point: DataSpec + SectionContext → DataRow[]
//  Page components call this once; the result feeds both Table and Chart.
//
//  Dispatches through defaultRegistry (Strategy Pattern).
//  Each DataSpec type is handled by a registered SpecResolver.
//  New spec type: register a SpecResolver — no changes here.
//
export function interpretSpec(
  spec:  DataSpec,
  ctx:   SectionContext,
  store: DataStore = staticStore,
): EngineRow[] {
  const resolver = defaultRegistry.spec(spec.type)
  if (!resolver) {
    emitDiagnostic(diagWarning(
      'UNKNOWN_SPEC_TYPE',
      `interpretSpec: no resolver registered for type '${spec.type}'`,
      { context: { specType: spec.type } },
    ))
    return []
  }
  const rows = resolver.resolve(spec as DataSpec, ctx, store)

  // Notify observer (app layer wires this; engine never couples to console/Vite).
  if (_observer) {
    _observer(_specTag(spec, ctx), ctx, rows)
  }

  return rows
}

// _specTag is a logging concern — used only by the observability seam above.
function _specTag(spec: DataSpec, ctx: SectionContext): string {
  switch (spec.type) {
    case 'query': {
      const m = spec.query.measure
      return `query[${Array.isArray(m) ? (m.length > 3 ? `${m.slice(0, 3).join(',')}…` : m.join(',')) : m}]`
    }
    case 'row-list':
      return `row-list[${spec.rows.map(r => r.code).slice(0, 3).join(',')}${spec.rows.length > 3 ? '…' : ''}]`
    case 'timeseries':
    case 'growth': {
      const c = spec.code
      return `${spec.type}[${Array.isArray(c) ? c[0] : c}]`
    }
    case 'by-mode':
      return `by-mode[${ctx.timeMode}]`
    default:
      return spec.type
  }
}

// ── extractRequirements ───────────────────────────────────────────────
//
//  Static analysis of a DataSpec: returns every {code, dims} pair the
//  spec will need, without executing it. Used by ApiStore.prefetch()
//  and CachedStore.warm() to batch-load exactly what is needed.
//
export function extractRequirements(
  spec: DataSpec,
  ctx:  SectionContext,
): Requirement[] {
  const time = ctx.dims[TIME_DIM] as number

  switch (spec.type) {

    case 'by-mode': {
      const active = spec.modes[ctx.timeMode] ?? spec.modes[Object.keys(spec.modes)[0]!]
      if (!active) return []
      return extractRequirements(active, ctx)
    }

    case 'row-list':
      // Resolve each ref through the SSOT seam so prefetch warms the underlying
      // codes (raw codes pass through unchanged ⇒ byte-identical requirements).
      return spec.rows.flatMap(({ code, pctOf }) => {
        const reqs: Requirement[] = resolveMeasureRef(code).codes.map((c) => ({ code: c, dims: ctx.dims }))
        if (pctOf) for (const c of resolveMeasureRef(pctOf).codes) reqs.push({ code: c, dims: ctx.dims })
        return reqs
      })

    case 'timeseries':
      // 'all' — years resolved at runtime from store; no static requirements extractable
      if (spec.years === 'all') return []
      return resolveMeasureRef(spec.code).codes.flatMap((code) =>
        (spec.years as readonly number[]).map((year) => ({ code, dims: { ...ctx.dims, [TIME_DIM]: year } })),
      )

    case 'growth': {
      // 'all' — years resolved at runtime from store; no static requirements extractable
      if (spec.years === 'all') return []
      const codes = resolveMeasureRef(spec.code).codes
      return codes.flatMap((code) =>
        (spec.years as readonly number[]).map((year) => ({ code, dims: { ...ctx.dims, [TIME_DIM]: year } })),
      )
    }

    case 'ratio-list':
      return spec.pairs.flatMap(({ code, denom }) => [
        ...resolveMeasureRef(code).codes.map((c)  => ({ code: c, dims: ctx.dims })),
        ...resolveMeasureRef(denom).codes.map((c) => ({ code: c, dims: ctx.dims })),
      ])

    case 'query': {
      const measures = resolveMeasureRef(spec.query.measure).codes

      const timeFilter = spec.query.filter?.[TIME_DIM]
      let years: number[]

      if (timeFilter !== undefined) {
        years = resolveFilterForReqs(timeFilter, ctx)
          .map(Number)
          .filter((n) => !isNaN(n))
      } else {
        years = [time]
      }

      return measures.flatMap((code) =>
        years.map((year) => ({ code, dims: { ...ctx.dims, [TIME_DIM]: year } })),
      )
    }

    case 'pivot':
    case 'transform':
    case 'custom':
      return []
  }
}