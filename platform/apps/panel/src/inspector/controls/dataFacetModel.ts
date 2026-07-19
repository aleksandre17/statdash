// ── dataFacetModel — the pure model behind the DATA facet control ────────────────
//
//  The DATA facet edits an element's whole `data: DataSpec` through ONE onChange
//  (the Inspector writes it to `props.data`). This module holds the pure, framework-
//  free transforms the control drives — no React, no store, trivially testable
//  (mirrors styleFieldModel for the STYLE facet).
//
import type { DataSpec, PipeStep, SourceStep } from '@statdash/engine'

/**
 * A fresh, valid-by-default PIPELINE spec — the browse-first Get + result (E1): opening
 * the workbench on an UNBOUND element seeds this, and the grid shows the "pick a metric"
 * browse hint until one is chosen. The ⛔ W-P5 emission flip: the workbench's fresh spec
 * is the spine (an empty governed `source` head), never the legacy `query` shape.
 */
export function freshPipelineSpec(): DataSpec {
  return { type: 'pipeline', pipe: [{ op: 'source', metrics: [] }], encoding: { label: 'label' } }
}

/**
 * ADR-049 P2a Lane 1 — the workbench-open ADOPT decision (FF-WORKBENCH-KIND-AGNOSTIC).
 *
 * Opening the DataWorkbench must never DISCARD an existing binding. Before the un-gate,
 * the door was reachable only for `query`/`pipeline`/unbound, and opening on anything
 * else seeded a `freshPipelineSpec()` that WIPED the bound spec. Now the door is kind-
 * agnostic, so the seed decision is: a bound spec of ANY kind (row-list / timeseries /
 * growth / ratio-list / query / pipeline / …) is ADOPTED intact — handed to the workbench
 * verbatim, no write; only a TRULY unbound element is seeded a fresh browse-first pipeline.
 *
 * Returns the spec to WRITE before escalating, or `null` when the current binding is
 * already adoptable (no write — the binding is preserved). The workbench itself declares
 * an honest empty state for a kind it cannot yet shape (Law 11) and offers a governed
 * metric bind to start — so the door is a live path forward, never a lossy overwrite.
 */
export function adoptOnOpen(spec: DataSpec | undefined): DataSpec | null {
  return spec ? null : freshPipelineSpec()
}

/**
 * Bind a GOVERNED metric onto an element's DataSpec — the metric-bind MODE of the
 * DATA facet (author-safe, pipe-over-governed). The ⛔ W-P5 EMISSION FLIP (ADR-046 ·
 * SPEC §4): a governed bind now emits the canonical `pipeline` spine — a `source`
 * head that names governed metrics + a pure tail — NOT the legacy `query` shape. The
 * governed `source.metrics` head lowers onto the SAME resolveMeasureRef + M2 grain
 * algebra the `metric` DataSpec uses (PipelineResolver → the `metric` resolver), so a
 * calc metric (e.g. a YoY growth metric) resolves to its REAL computed value, not a
 * raw obs read (the value-cell path a legacy `query.measure` could never reach).
 *
 * Stored configs are NEVER batch-rewritten (expand-contract, read-time desugar) — this
 * is an ACTIVE author bind, so emitting the spine is the intended flip, not a migration.
 *
 * Reconciliation over the ONE `data` value:
 *   • an existing `pipeline` with a governed `source` head → APPEND the metric (multi-
 *     series), keeping the tail + encoding untouched (idempotent — no duplicate id);
 *   • a `pipeline` with a steward/inline head → set a governed head, keep the tail;
 *   • a legacy `query` spec → carry its tail + encoding onto a governed spine head
 *     (the emission flip converts it on active edit);
 *   • fresh / any other spec kind → a fresh governed spine.
 *
 * Metric-optional: this is invoked ONLY when the author picks a metric — a raw
 * query/transform/derive/calc pipeline is authored without it, straight through the
 * workbench (author plane) or the spec editor (steward plane).
 */
export function bindMeasureToSpec(spec: DataSpec | undefined, metricId: string): DataSpec {
  if (spec && spec.type === 'pipeline') {
    const [head, ...tail] = spec.pipe
    if (head?.op === 'source' && 'metrics' in head) {
      const metrics = head.metrics.includes(metricId) ? head.metrics : [...head.metrics, metricId]
      return { ...spec, pipe: [{ ...head, metrics }, ...tail] }
    }
    const governed: SourceStep = { op: 'source', metrics: [metricId] }
    return { ...spec, pipe: [governed, ...tail] as PipeStep[] }
  }

  if (spec && spec.type === 'query') {
    const governed: SourceStep = { op: 'source', metrics: [metricId] }
    return { type: 'pipeline', pipe: [governed, ...(spec.pipe ?? [])] as PipeStep[], encoding: spec.encoding }
  }

  return { type: 'pipeline', pipe: [{ op: 'source', metrics: [metricId] }], encoding: { label: 'label' } }
}
