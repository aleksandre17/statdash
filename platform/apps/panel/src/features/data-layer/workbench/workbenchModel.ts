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
  DataSpec, EncodingSpec, ObsQuery, PipelineSpec, PipeStep, SourceStep, TransformStep,
} from '@statdash/engine'
import { desugarToPipeline } from '@statdash/engine'

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
