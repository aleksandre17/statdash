// ── PipelineResolver — the `pipeline` DataSpec resolver [ADR-046 · SPEC §1.3] ──────
//
//  The ONE canonical data-manipulation grammar: an ordered `pipe` whose HEAD is a
//  store-aware `source` read and whose TAIL is the existing pure transform verbs. The
//  resolver is the ONLY place that knows the head is store-aware (mirroring how the
//  MetricResolver/PointSeriesResolver own the store-aware primitives) — it reads the
//  source, then runs `applyPipeline` over the pure tail (the SAME `applyStep` every
//  other pipe uses, unchanged). Additive via `registerSpec` (OCP — the interpreter is
//  untouched; a new discriminant = one registered resolver).
//
//  The source head read LOWERS ONTO THE EXISTING PATHS — no new store port, no new
//  evaluator (SPEC §1.1). Each of the three `source` variants delegates to the
//  registered resolver for its equivalent legacy spec, so the read is BYTE-IDENTICAL
//  to that spec by construction:
//    • governed (metrics + grain) → the `metric` resolver (resolveMeasureRef + the M2
//      grain algebra) — the author-plane governed read.
//    • steward   (raw ObsQuery)   → the `query` resolver (storeObs + resolveQueryMeasures
//      + the effectiveBounds post-fetch clamp) — byte-identical to QueryResolver.
//    • inline    (literal rows)   → the rows as-is (read-free — the `transform` case).
//
//  Arrow-clean (core → data + registry only). Declarative spec in, neutral EngineRow[]
//  out; encoding happens at the renderer boundary.
//

import type { EngineRow }         from '../data/encoding'
import type { DataSpec, PipelineSpec, PipeStep, SourceStep, MetricRef, PointSeriesSpec } from '../config/data-spec'
import type { SectionContext }    from '../core/context'
import { atTime, TIME_DIM, MEASURE_DIM } from '../core/context'
import type { DataStore }         from '../data/store'
import { storeObs }               from '../data/store'
import type { TransformStep }     from '../data/transform'
import { applyPipeline }          from '../data/transform'
import type { DimVal, ObsQuery }  from '../sdmx'
import { getMetric, resolveMeasureRef } from '../data/metric'
import { isCalculatedMetric, resolveMetricValue } from '../data/metric-calc'
import { naturalBrowseCtx, browseScanCtx } from '../data/metric-natural'
import { tagLocaleString }        from '../i18n/types'
import type { LocaleString }      from '../i18n/types'
import type { SpecResolver }      from './engine'
import { defaultRegistry }        from './engine'

/** The GOVERNED variant of a `source` head — governed metric refs + a generic grain. */
type GovernedHead = Extract<SourceStep, { metrics: MetricRef[] }>

/**
 * True ⟺ the governed head declares an EXPLICIT grain (`by` / `time` / `where`). Absent
 * all three the head is grain-∅ and lowers to the metric's OBSERVATION BROWSE (Addendum 2);
 * an explicit grain lowers to the shaped M2 read. Law-1 generic — no privileged-dim literal.
 */
export function hasSourceGrain(head: GovernedHead): boolean {
  return (head.by?.length ?? 0) > 0
      || head.time !== undefined
      || (head.where !== undefined && Object.keys(head.where).length > 0)
}

/** The governed metric label, tagged for the React locale boundary (Law 1 — never picks a locale). */
function metricSeries(ref: string): DimVal {
  const label: LocaleString | undefined = getMetric(ref)?.label
  return (label ? tagLocaleString(label) : ref) as DimVal
}

/**
 * The metric's OBSERVATION BROWSE [ADR-046 Addendum 2] — the grain-∅ governed read.
 * A BASE metric browses as its full obs read (the SAME storeObs path a steward head uses,
 * codes via resolveMeasureRef — delegated to the `query` resolver so it is byte-identical
 * to the steward obs read). A CALC metric has no raw obs, so it is evaluated PER MEMBER of
 * its time axis via resolveMetricValue (year-by-year values) — honest no-data at the
 * first-period edge (ADR-045: null, never a fabricated 0). "A source IS the table" (Power
 * Query); shaping comes after (the pure tail).
 */
function browseMetrics(refs: MetricRef[], ctx: SectionContext, store: DataStore): EngineRow[] {
  const out: EngineRow[] = []
  for (const ref of refs) {
    if (isCalculatedMetric(ref)) out.push(...browseCalcMetric(ref, ctx, store))
    else                         out.push(...browseBaseMetric(ref, ctx, store))
  }
  return out
}

/**
 * BASE browse — the metric's obs read, byte-identical to the steward obs read (via `query`).
 * The metric-natural coordinate rule [ADR-047 DECISION 1] applies: a FOREIGN ctx pin (a dim
 * the metric does not range over — e.g. a national metric on a region-pinned page) is
 * neutralized to '' so the browse reads the metric's OWN natural table, never an empty slice.
 * The naturality is DERIVED from the metric's obs (whole-table scan), never a declared axis.
 */
function browseBaseMetric(ref: MetricRef, ctx: SectionContext, store: DataStore): EngineRow[] {
  const code = resolveMeasureRef(ref).codes[0] ?? ref
  const members = storeObs(store, { measure: code }, browseScanCtx(ctx))
  const { ctx: natCtx } = naturalBrowseCtx(members, code, ctx)
  const querySpec: DataSpec = { type: 'query', query: { measure: ref }, encoding: { label: 'id' } }
  return defaultRegistry.spec('query')?.resolve(querySpec, natCtx, store) ?? []
}

/** CALC browse — resolveMetricValue at each member of the metric's time axis (year-by-year). */
function browseCalcMetric(ref: MetricRef, ctx: SectionContext, store: DataStore): EngineRow[] {
  // Component codes carry the time axis (a calc metric has no raw obs of its own). Scan the
  // component's WHOLE natural table once (browseScanCtx neutralizes every pin to '' so a
  // FOREIGN ctx pin — e.g. geo=<region> on a national component — does not zero the slice on
  // an async store, and the scan is time-unbounded). That one slice yields BOTH the metric's
  // natural dims and its time members.
  const codes = resolveMeasureRef(ref).codes
  if (!codes.length) return []
  const code0 = codes[0]!
  const members = storeObs(store, { measure: code0 }, browseScanCtx(ctx))

  // The metric-natural coordinate [ADR-047 DECISION 1]: neutralize every FOREIGN pin (derived
  // from `members`) to '' so a NATIONAL component under a regional page reads its own value —
  // NOT storeValAt(...) = 0 → the −100 lie (W-P5c FINDING). A NATURAL pin (a dim the metric
  // ranges over) is kept, so a regional metric still shows its pinned region's series.
  const { ctx: natCtx } = naturalBrowseCtx(members, code0, ctx)

  const years = [...new Set(
    members
      .filter((o) => String((o as Record<string, DimVal>)[MEASURE_DIM] ?? code0) === code0)
      .map((o) => Number(o[TIME_DIM])),
  )]
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)

  const series = metricSeries(ref)
  return years.map((y) => {
    // resolveMetricValue at the NATURAL coordinate: a number, OR null at the first-period edge
    // (honest no-data, ADR-045). It is a calc metric by construction here, so never undefined.
    // NEVER a fabricated 0/−100 — the null flows to the grid's honest `no-data` Cell (Law 11).
    const v = resolveMetricValue(ref, atTime(y, natCtx), store)
    const row: EngineRow = {
      id: String(y), label: String(y), [TIME_DIM]: y, series, metric: ref, value: (v ?? null) as DimVal,
    }
    return row
  })
}

/**
 * The obs query a `source` head reads/warms — the SSOT the async warm (useNodeRows'
 * specHeadObs) aligns its key to. A STEWARD head reads its `query`; a GOVERNED BROWSE head
 * (metrics, no grain) reads the metric's obs across its natural dims (`{ measure: metrics }`,
 * resolveMeasureRef-expanded downstream). A GRAINED governed head reads shaped val/obs
 * covered by the generic per-req warm, and an inline head is read-free ⇒ undefined.
 */
export function sourceHeadObs(head: SourceStep | undefined): ObsQuery | undefined {
  if (!head || head.op !== 'source') return undefined
  if ('query' in head)   return head.query
  if ('metrics' in head) return hasSourceGrain(head) ? undefined : { measure: head.metrics }
  if ('over' in head)    return { measure: head.code }   // value-cell — warms the enumerate + valAt reads
  return undefined   // inline rows — read-free
}

/** Read the store for a `source` head, delegating to the equivalent legacy resolver. */
function readSource(head: SourceStep | undefined, ctx: SectionContext, store: DataStore): EngineRow[] {
  if (!head || head.op !== 'source') return []   // honest empty — an unbound/malformed head reads nothing

  // Governed (author plane): a MetricSpec by another name. With NO grain it is the metric's
  // OBSERVATION BROWSE (Addendum 2 — a source IS the table); with an explicit grain it is
  // the shaped M2 read — delegate to the `metric` resolver so the governed read uses the
  // SAME measure resolution + grain algebra. Built by rest-spread (drop `op`, keep the
  // generic grain) so no privileged-dim key literal is typed here (Law 1 / FF-NO-PRIVILEGED-
  // LITERAL — the grain keys stay generic).
  if ('metrics' in head) {
    if (!hasSourceGrain(head)) return browseMetrics(head.metrics, ctx, store)
    const { op: _op, ...grain } = head
    const metricSpec: DataSpec = { type: 'metric', ...grain }
    return defaultRegistry.spec('metric')?.resolve(metricSpec, ctx, store) ?? []
  }

  // Steward: a raw ObsQuery (+ optional clamp) — delegate to the `query` resolver so the
  // read + post-fetch time clamp are byte-identical to QueryResolver. QueryResolver
  // ignores `encoding` in resolve(), so a placeholder satisfies the type.
  if ('query' in head) {
    const querySpec: DataSpec = {
      type: 'query', query: head.query, encoding: { label: 'id' },
      fromDim: head.clamp?.fromDim, toDim: head.clamp?.toDim, timeDimension: head.clamp?.timeDimension,
    }
    return defaultRegistry.spec('query')?.resolve(querySpec, ctx, store) ?? []
  }

  // Value-cell (store-aware POINT read): the internal PointSeriesSpec hoisted to a `source`
  // head — reconstitute the point-series (drop `op`, add its discriminant) and delegate to the
  // already-registered, already-proven PointSeriesResolver. NO new read path / store port —
  // the read is the SAME storeValAt fan-out FF-DESUGAR-EQUIV proves row-identical for timeseries,
  // so the fold is byte-identical BY CONSTRUCTION (ADR-046 Addendum 4).
  if ('over' in head) {
    const { op: _op, ...rest } = head
    const pointSeries: PointSeriesSpec = { type: 'point-series', ...rest }
    return defaultRegistry.spec('point-series')?.resolve(pointSeries, ctx, store) ?? []
  }

  // Inline: literal rows (subsumes transform.source) — read-free.
  return head.rows as EngineRow[]
}

export class PipelineResolver implements SpecResolver<PipelineSpec> {
  readonly type = 'pipeline' as const

  resolve(spec: PipelineSpec, ctx: SectionContext, store: DataStore): EngineRow[] {
    const head: PipeStep | undefined = spec.pipe[0]
    const sourceRows = readSource(head as SourceStep | undefined, ctx, store)

    // Tail = the pure transform verbs after the head. `source` is head-only, so the
    // tail is TransformStep[] by construction; the identity handler makes a stray
    // `source` a safe no-op regardless (see transform/index.ts).
    const tail = spec.pipe.slice(1) as TransformStep[]
    if (!tail.length) return sourceRows
    return applyPipeline(sourceRows, tail, {
      classifiers: store.classifiers, display: store.display, section: ctx,
    })
  }
}
