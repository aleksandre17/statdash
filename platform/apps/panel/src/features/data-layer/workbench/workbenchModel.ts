// ── workbenchModel — the canonical PIPELINE view the workbench operates on (W-P5b) ──
//
//  ADR-046 · SPEC §1/§3. The workbench speaks the ONE spine: the pipeline shape is
//  canonical INSIDE the surface, and BOTH accepted inputs flow through one code path —
//    • a native `pipeline` spec       → used as-is;
//    • a legacy `query` spec          → its DESUGARED view (`desugarToPipeline`, the
//                                        engine SSOT: a steward `source(query+clamp)`
//                                        head + the pure tail), so the rail/grid/query-
//                                        pane never branch on the discriminant.
//  Any WRITE emits `pipeline` (`fromWorkbenchModel`) — the ⛔ W-P5 emission flip. An
//  active edit of a legacy `query` therefore converts it to the spine (safe: desugar
//  makes query≡pipeline byte-identical at resolve time; stored configs are never batch-
//  rewritten — this is read-then-write on active authoring).
//
//  Pure + framework-free (no React, no store) — trivially testable, mirroring the
//  other data-layer pure models (binding.ts / generatedQuery.ts).
//
import type {
  DataSpec, DimVal, EncodingSpec, ObsQuery, PipelineSpec, PipeStep, SourceStep, TransformStep,
} from '@statdash/engine'
import { desugarToPipeline } from '@statdash/engine'

/** The governed (AUTHOR-plane) source head — a metric ref + a generic M2 grain. */
type GovernedHead = Extract<SourceStep, { metrics: MetricRefList }>
type MetricRefList = string[]

/** The canonical pipeline view: the store-aware `source` HEAD + the pure TAIL + encoding. */
export interface WorkbenchModel {
  head:     SourceStep
  tail:     TransformStep[]
  encoding: EncodingSpec
}

/** Whether a spec is one the workbench can shape (query legacy, or native pipeline). */
export function isWorkbenchShaped(spec: DataSpec | undefined): spec is Extract<DataSpec, { type: 'query' | 'pipeline' }> {
  return !!spec && (spec.type === 'query' || spec.type === 'pipeline')
}

/**
 * Lower any accepted spec to the canonical pipeline view — the ONE code path. Returns
 * `null` for a spec the workbench does not shape (row-list/timeseries/growth/…): the
 * caller declares that honestly rather than paint a broken surface (Law 11).
 */
export function toWorkbenchModel(spec: DataSpec | undefined): WorkbenchModel | null {
  if (!spec) return null
  const pipeline: DataSpec =
    spec.type === 'pipeline' ? spec
    : spec.type === 'query'  ? desugarToPipeline(spec)  // the SSOT desugared view
    : spec
  if (pipeline.type !== 'pipeline') return null
  const head = pipeline.pipe[0]
  if (!head || head.op !== 'source') return null
  return {
    head:     head as SourceStep,
    tail:     pipeline.pipe.slice(1) as TransformStep[],
    encoding: pipeline.encoding,
  }
}

/** Serialize the canonical view back to a `pipeline` DataSpec (the emission flip). */
export function fromWorkbenchModel(m: WorkbenchModel): PipelineSpec {
  return { type: 'pipeline', pipe: [m.head, ...m.tail] as PipeStep[], encoding: m.encoding }
}

/** A SOURCE-ONLY pipeline (the head alone) — what the preview grid resolves for the
 *  browse rows, before the tail. The tail is prefix-run locally over these (E5). */
export function sourceOnlySpec(head: SourceStep, encoding: EncodingSpec): PipelineSpec {
  return { type: 'pipeline', pipe: [head], encoding }
}

/** The measure ref(s) a source head reads — governed metrics, or a steward query's
 *  measure. Drives the governed value-column label (never a raw code, Law 4). */
export function sourceMeasure(head: SourceStep | undefined): string | string[] | undefined {
  if (!head) return undefined
  if ('metrics' in head) return head.metrics
  if ('query' in head) return head.query.measure
  return undefined
}

/** The filter/grain dim KEYS the head pins (their governed labels are shown; the member
 *  VALUES never are). A governed head pins via `where`; a steward head via `query.filter`. */
export function sourceGrainDims(head: SourceStep | undefined): string[] {
  if (!head) return []
  if ('metrics' in head) return Object.keys((head.where ?? {}) as Record<string, unknown>)
  if ('query' in head) return Object.keys(((head.query as ObsQuery).filter ?? {}) as Record<string, unknown>)
  return []
}

/** Whether the head carries a bound read (a metric, a query measure, or inline rows). */
export function isHeadBound(head: SourceStep | undefined): boolean {
  const m = sourceMeasure(head)
  if (Array.isArray(m)) return m.length > 0
  if (m) return true
  return !!head && 'rows' in head
}

/** Set / append a governed metric on the head — the workbench Get metric picker's write.
 *  A governed head appends (multi-series, deduped); any other head becomes governed. */
export function withGovernedMetric(m: WorkbenchModel, metricId: string): WorkbenchModel {
  const head = m.head
  if ('metrics' in head) {
    const metrics = head.metrics.includes(metricId) ? head.metrics : [...head.metrics, metricId]
    return { ...m, head: { ...head, metrics } }
  }
  return { ...m, head: { op: 'source', metrics: [metricId] } }
}

// ── The governed head's READ-LEVEL grain (`where` pins) — «წაკითხვის არე» (card 0087) ─
//
//  The governed head carries a generic M2 grain (`by`/`time`/`where`, Law-1 generic,
//  identical to MetricSpec). `where` is the fixed-coordinate PIN surface: `{ time: 2020 }`
//  reads only 2020 (the old query editor's power, now OFFERED in the workbench). Scalar
//  DimVal per dim (the engine head type) — the AutoFilter single-member pick. Grain-∅ =
//  browse stays the default (ADR-046 Addendum 2 — an EMPTY grain is a meaningful state,
//  never force one). `by`/`time` are the ledgered grain axes the same surface will host.

/** True when the head is a GOVERNED metric read (an AUTHOR-plane grain surface). */
export function isGovernedHead(head: SourceStep | undefined): head is GovernedHead {
  return !!head && 'metrics' in head
}

/** The governed head's `where` pins (dim → single member). Empty ⇒ browse (no pin). */
export function governedWhere(head: SourceStep | undefined): Partial<Record<string, DimVal>> {
  return isGovernedHead(head) ? (head.where ?? {}) : {}
}

/** Set the governed head's `where` grain — the workbench read-area editor's write. An empty
 *  map drops the `where` key entirely (grain-∅ browse, never a lingering `{}`). */
export function withGovernedWhere(m: WorkbenchModel, where: Partial<Record<string, DimVal>>): WorkbenchModel {
  if (!isGovernedHead(m.head)) return m
  const next = { ...m.head } as GovernedHead
  if (Object.keys(where).length === 0) delete next.where
  else next.where = where
  return { ...m, head: next }
}

// ── The STEWARD raw-cube head (0084 · ADR-046 variant 2) ───────────────────────
//
//  A raw cube pick emits the EXISTING steward `source` head `{op:'source', query}` —
//  no new grammar (the variant lives in the engine). The browse grid then resolves the
//  head through the QueryResolver's storeObs (the same raw-observation read a legacy
//  `query` used), so the steward sees the cube's raw observations. Reachable ONLY behind
//  the steward lens (plane law, ADR-041 §PLANE) — the author never picks a raw cube.

/** True when the head is a STEWARD raw read (an ObsQuery), not a governed metric ref. */
export function isStewardHead(head: SourceStep | undefined): head is Extract<SourceStep, { query: ObsQuery }> {
  return !!head && 'query' in head
}

/** The raw measure code(s) a steward head reads — the promotion loop's `code`. */
export function stewardHeadMeasure(head: SourceStep | undefined): string | string[] | undefined {
  return isStewardHead(head) ? head.query.measure : undefined
}

/** Swap the head to a STEWARD raw-cube browse of `measures` — a FRESH source read (the
 *  tail is cleared: a new raw cube is a new table, its columns differ from the prior read).
 *  The write emits the steward `source(query)` variant (Law 1: `measure` is generic).
 *
 *  `storeKey` (0089 · ADR-046 Addendum 3) declares the cube's store HOME on the head so the
 *  browse reads the PICKED cube's OWN store, not the page's (the cross-cube lying-grid fix).
 *  Same routing vocabulary as the governed head (`MetricDef.dataSource`); the caller resolves
 *  it from the picked datasetCode via the session-source SSOT `storeKeyForDataset`. Optional:
 *  no storeKey ⇒ the head carries none and falls through to the page store (byte-identical to
 *  pre-0089 — no regression). */
export function withStewardCube(m: WorkbenchModel, measures: string[], storeKey?: string): WorkbenchModel {
  const measure: string | string[] = measures.length === 1 ? measures[0]! : measures
  const head: SourceStep = storeKey
    ? { op: 'source', query: { measure }, dataSource: storeKey }
    : { op: 'source', query: { measure } }
  return { ...m, head, tail: [] }
}

/**
 * Promote a steward raw head to a GOVERNED metric ref (E2 — the Looker/dbt promotion
 * loop). The head is REPLACED by `{op:'source', metrics:[metricId]}` (the tail + encoding
 * preserved). The invariant (FF-PROMOTE-ROUNDTRIP): when `metricId` is a BASE metric whose
 * `code` equals the raw head's `query.measure`, the governed head resolves BYTE-IDENTICALLY
 * to the raw head it replaced (a refactor, never a semantic change) — proven at the browse
 * seam (browseBaseMetric ≡ the steward obs read, ADR-046 Addendum 2).
 */
export function promoteHeadToMetric(m: WorkbenchModel, metricId: string): WorkbenchModel {
  return { ...m, head: { op: 'source', metrics: [metricId] } }
}
