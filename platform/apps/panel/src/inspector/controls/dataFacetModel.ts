// ── dataFacetModel — the pure model behind the DATA facet control ────────────────
//
//  The DATA facet edits an element's whole `data: DataSpec` through ONE onChange
//  (the Inspector writes it to `props.data`). This module holds the pure, framework-
//  free transforms the control drives — no React, no store, trivially testable
//  (mirrors styleFieldModel for the STYLE facet).
//
import type { DataSpec } from '@statdash/engine'

/**
 * Bind a GOVERNED metric onto an element's DataSpec — the metric-bind MODE of the
 * DATA facet (author-safe, pipe-over-governed). Produces / updates a `query` spec
 * with the metric-id at `query.measure`: the SAME canonical location the element's
 * schema metric-ref field (`data.query.measure`, enum-ref source:'metrics') and the
 * host-level Metric-Palette bind write to, so a facet bind is byte-identical to hand-
 * authoring the metric picker. Metric-optional: this is invoked ONLY when the author
 * picks a metric — a raw query/transform/derive/calc pipeline is authored without it,
 * straight through the spec editor.
 *
 * A pre-existing `query` spec keeps its other query facets (dims/filter/pipe); any
 * other spec kind (or none) is seeded fresh — the palette is the governed ENTRY, not
 * an override of an already-authored advanced pipeline (that is edited in the editor).
 */
export function bindMeasureToSpec(spec: DataSpec | undefined, metricId: string): DataSpec {
  if (spec && spec.type === 'query') {
    return { ...spec, query: { ...spec.query, measure: metricId } }
  }
  return { type: 'query', query: { measure: metricId }, pipe: [], encoding: { label: 'label' } }
}
