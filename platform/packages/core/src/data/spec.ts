import { staticStore }           from './store'
import { desugar }               from './desugar'
import { resolveFilterForReqs }  from '../registry/resolvers'
import { resolveMeasureRef }     from './metric'
import type { EngineRow }        from './encoding'
import type { DimVal, ObsQuery } from '../sdmx'
import type { DataSpec, MetricSpec, SourceStep } from '../config/data-spec'
import type { SectionContext }   from '../core/context'
import { TIME_DIM }              from '../core/context'
import { effectiveYears, isUnsetTime } from '../core/time-dimension'
import type { DataStore, Requirement } from './store'
import { defaultRegistry }       from '../registry/engine'
import { hasSourceGrain }        from '../registry/pipeline-resolver'
import { browseScanDims }        from './metric-natural'
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
  // R3: desugar convenience specs to primitives FIRST, then resolve. A spec with
  // no desugar rule (every primitive) is returned unchanged ⇒ untouched path.
  const lowered  = desugar(spec)
  const resolver = defaultRegistry.spec(lowered.type)
  if (!resolver) {
    emitDiagnostic(diagWarning(
      'UNKNOWN_SPEC_TYPE',
      `interpretSpec: no resolver registered for type '${spec.type}'`,
      { context: { specType: spec.type } },
    ))
    return []
  }
  const rows = resolver.resolve(lowered, ctx, store)

  // Notify observer (app layer wires this; engine never couples to console/Vite).
  // Tag uses the ORIGINAL spec — observability reflects authored intent, not the
  // lowered primitive.
  if (_observer) {
    _observer(_specTag(spec), ctx, rows)
  }

  return rows
}

// _specTag is a logging concern — used only by the observability seam above.
function _specTag(spec: DataSpec): string {
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
// "No single time year is resolved" — range/dynamics mode (the read is unbounded).
// Decides whether the query branch warms an unbounded slice (range) or per-year
// slices (year mode) — GAP 4. Shares the ONE isUnsetTime predicate with
// ApiStore.toObsParams (core/time-dimension.ts) so warm-key and read-key agree.

// ── Shared requirement kernels — the SSOT the `pipeline` desugar preserves ─────
//
//  The `query` and `metric` store-read contracts are extracted here as pure kernels so
//  the `pipeline` branch (whose `source` head lowers onto the SAME reads) reuses the
//  IDENTICAL logic — FF-PIPELINE-EQUIV holds BY CONSTRUCTION, not by parallel code that
//  can drift. A source(query) head extracts `queryRequirements`; a source(metrics) head
//  extracts `metricRequirements`; a source(rows) head is read-free (like `transform`).

/** The store-read contract of a `query` (its ObsQuery) — the exact `query` branch logic. */
function queryRequirements(query: ObsQuery, ctx: SectionContext): Requirement[] {
  const time     = ctx.dims[TIME_DIM] as number
  const measures = resolveMeasureRef(query.measure).codes

  const filter     = query.filter
  const timeFilter = filter?.[TIME_DIM]

  // GAP 4 — range-awareness. No time filter AND `time` unset ⇒ the read is UNBOUNDED
  // (bounds clamp POST-fetch); warm ONE unbounded req per measure so warm-key ≡ read-key.
  const rangeMode = timeFilter === undefined && isUnsetTime(time)

  let years: number[]
  if (timeFilter !== undefined) {
    years = resolveFilterForReqs(timeFilter, ctx).map(Number).filter((n) => !isNaN(n))
  } else {
    years = [time]
  }

  // Fold NON-time filter dims into the requirement dims so each pinned slice is uniquely
  // identified (two specs differing only by a filter pin must yield distinct reqs).
  const pinned: Record<string, DimVal> = {}
  if (filter) {
    for (const [dim, fv] of Object.entries(filter)) {
      if (dim === TIME_DIM || fv === undefined || fv === null) continue
      const vals = resolveFilterForReqs(fv, ctx)
      if (vals.length === 1) pinned[dim] = vals[0]!
    }
  }

  if (rangeMode) {
    return measures.map((code) => ({ code, dims: { ...ctx.dims, ...pinned } }))
  }
  return measures.flatMap((code) =>
    years.map((year) => ({ code, dims: { ...ctx.dims, ...pinned, [TIME_DIM]: year } })),
  )
}

/** The store-read contract of a `metric` spec (grain-stripped unbounded superset) — the exact `metric` branch. */
function metricRequirements(spec: MetricSpec, ctx: SectionContext): Requirement[] {
  const grainAxes = new Set<string>([
    ...(spec.by ?? []),
    ...(spec.time?.dim ? [spec.time.dim] : []),
  ])
  const base: Record<string, DimVal> = {}
  for (const [d, v] of Object.entries(ctx.dims)) if (!grainAxes.has(d) && v != null) base[d] = v as DimVal
  for (const [d, v] of Object.entries(spec.where ?? {})) if (v != null) base[d] = v as DimVal
  return spec.metrics.flatMap((ref) =>
    resolveMeasureRef(ref).codes.map((code) => ({ code, dims: { ...base } })),
  )
}

/**
 * The store-read contract of a `pipeline`'s `source` head — dispatched to the SAME
 * kernel the equivalent legacy spec uses (the pure tail issues no read). This is the
 * invariant FF-PIPELINE-EQUIV proves: a desugared pipeline extracts the identical set.
 */
function pipelineRequirements(head: SourceStep | undefined, ctx: SectionContext): Requirement[] {
  if (!head || head.op !== 'source') return []
  if ('metrics' in head) {
    // Drop `op`, keep the generic grain (Law 1 — no privileged-dim key typed here).
    const { op: _op, ...grain } = head
    // GRAIN-∅ ⇒ the metric's OBSERVATION BROWSE [ADR-046 Addendum 2]: a NEW read shape
    // (the whole table across natural dims, time-unbounded) — NOT the shaped grain read.
    // The warm must span every period the browse reads, so STRIP the TIME_DIM pin (mirrors
    // the query rangeMode / point-series 'all' branch — warm ⊇ read). Per underlying code
    // (base: its own code; calc: its component codes, via resolveMeasureRef). The exact
    // obs-array slice a BASE browse reads is additionally warmed under `sourceHeadObs` in
    // the react warm; here we warm the val + per-code obs superset the calc reads visit.
    if (!hasSourceGrain(head)) {
      // ADR-047 DECISION 1: the browse reads the metric's NATURAL table — foreign ctx pins
      // neutralized to '' at READ time (metric-natural). The warm has NO store to derive
      // naturality, so it warms the whole-table SUPERSET: EVERY ctx pin set to the empty-
      // wildcard '' via `browseScanDims` (NOT stripped — an omitted dim inherits its ctx pin
      // across the re-merge wall { ...ctx.dims, ...r.dims }; a '' dim wins the spread as
      // "unpinned", and isUnsetTime('') leaves the time axis unbounded). warm ⊇ read by
      // construction — the SAME '' mechanism the READ's obs member scan uses (browseScanCtx).
      const dims = browseScanDims(ctx)
      return head.metrics.flatMap((ref) =>
        resolveMeasureRef(ref).codes.map((code) => ({ code, dims: { ...dims } })),
      )
    }
    return metricRequirements({ type: 'metric', ...grain }, ctx)
  }
  if ('query' in head) return queryRequirements(head.query, ctx)
  return []   // inline rows — read-free (the `transform` case)
}

export function extractRequirements(
  spec: DataSpec,
  ctx:  SectionContext,
): Requirement[] {
  // R3: analyse the lowered primitive — the same path interpretSpec resolves.
  // pivot lowers to transform (both extract []); timeseries lowers to point-series
  // (whose case below warms the SAME per-coordinate reads the old timeseries case did).
  const lowered = desugar(spec)

  switch (lowered.type) {

    // ── point-series — the lowering target for timeseries (grain G2) ──
    //  Warm one val read per ENUMERATED coordinate (the unclamped superset, exactly
    //  as the old `timeseries` case warmed effectiveYears — the read clamps later).
    case 'point-series': {
      const psCodes = resolveMeasureRef(lowered.code).codes
      const at = lowered.at
      const over = lowered.over
      // 'all'/absent coords resolve at runtime from the store (distinct(over)); the
      // coordinate set is NOT knowable statically. Emit ONE UNBOUNDED requirement per
      // code — the enumerated `over` dim STRIPPED from the dims (Law 1: generic, not
      // time-special) so the warmed slice spans every coordinate the resolver reads
      // (its obs enumerate + per-coordinate val reads). Mirrors the `query` rangeMode
      // branch (:220): a read-issuing spec must never warm [] (FF-NO-EMPTY-REQS).
      if (lowered.coords === undefined || lowered.coords === 'all') {
        const { [over]: _stripOver, ...rest } = ctx.dims
        return psCodes.map((code) => ({
          code, dims: { ...rest, ...at } as Record<string, DimVal>,
        }))
      }
      return psCodes.flatMap((code) =>
        (lowered.coords as readonly DimVal[]).map((c) => ({
          // `at` is Partial; the matching loop skips unset dims, so the cast is sound.
          code, dims: { ...ctx.dims, ...at, [over]: c } as Record<string, DimVal>,
        })),
      )
    }

    case 'row-list':
      // Resolve each ref through the SSOT seam so prefetch warms the underlying
      // codes (raw codes pass through unchanged ⇒ byte-identical requirements).
      return lowered.rows.flatMap(({ code, pctOf }) => {
        const reqs: Requirement[] = resolveMeasureRef(code).codes.map((c) => ({ code: c, dims: ctx.dims }))
        if (pctOf) for (const c of resolveMeasureRef(pctOf).codes) reqs.push({ code: c, dims: ctx.dims })
        return reqs
      })

    case 'timeseries': {
      // Defensive fallback (timeseries normally lowers to point-series above).
      const tsYears = effectiveYears(lowered)
      const tsCodes = resolveMeasureRef(lowered.code).codes
      // 'all' — years resolved at runtime from the store. Emit ONE UNBOUNDED req per
      // code with the TIME pin STRIPPED, so the warmed slice spans every year the
      // read enumerates (mirrors query rangeMode :220 — never warm [] for a reading
      // spec, FF-NO-EMPTY-REQS).
      if (tsYears === 'all') {
        const { [TIME_DIM]: _stripTime, ...rest } = ctx.dims
        return tsCodes.map((code) => ({ code, dims: rest as Record<string, DimVal> }))
      }
      return tsCodes.flatMap((code) =>
        (tsYears as readonly number[]).map((year) => ({ code, dims: { ...ctx.dims, [TIME_DIM]: year } })),
      )
    }

    case 'growth': {
      const grYears = effectiveYears(lowered)
      const codes = resolveMeasureRef(lowered.code).codes
      // 'all' — years resolved at runtime from the store. One UNBOUNDED req per code
      // (time pin stripped) covers every year the YoY read visits (see timeseries).
      if (grYears === 'all') {
        const { [TIME_DIM]: _stripTime, ...rest } = ctx.dims
        return codes.map((code) => ({ code, dims: rest as Record<string, DimVal> }))
      }
      return codes.flatMap((code) =>
        (grYears as readonly number[]).map((year) => ({ code, dims: { ...ctx.dims, [TIME_DIM]: year } })),
      )
    }

    case 'ratio-list':
      return lowered.pairs.flatMap(({ code, denom }) => [
        ...resolveMeasureRef(code).codes.map((c)  => ({ code: c, dims: ctx.dims })),
        ...resolveMeasureRef(denom).codes.map((c) => ({ code: c, dims: ctx.dims })),
      ])

    case 'metric':
      // Semantic query [AR-50 M-SQ]. Grain-stripped unbounded superset per underlying
      // code — the kernel is shared with the `pipeline` governed-source branch.
      return metricRequirements(lowered, ctx)

    case 'query':
      // The obs read contract (measures × pinned dims × year/range handling). The kernel
      // is shared with the `pipeline` steward-source branch, so the desugar is provably
      // equivalent (FF-PIPELINE-EQUIV) by construction, not by parallel code.
      return queryRequirements(lowered.query, ctx)

    case 'pipeline':
      // ADR-046 spine: the read is entirely the `source` HEAD's — the pure tail issues
      // no store read. Dispatched to the SAME kernel the equivalent legacy spec uses.
      return pipelineRequirements(lowered.pipe[0] as SourceStep | undefined, ctx)

    case 'pivot':
    case 'transform':
      // PROVABLY read-free (O-2 / item 0010): both carry an INLINE data array —
      // `pivot.rows` / `transform.source` (Record<string,DimVal>[]) — and their
      // `steps` run through applyPipeline over classifiers/display ONLY (the pure
      // transform pipe has no store handle; the cross-store `blend` op is desugared
      // in the react layer BEFORE reaching core, Law 3). No branch issues a store
      // read, so [] is CORRECT here — not a coverage gap. FF-WARM-COVERS-RENDER
      // proves it: rendering either against a throw-on-cold store never reads.
      return []
  }
}