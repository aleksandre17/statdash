// ── metric-store — the metric→store binding helper [M1] ───────────────
//
//  The MIDDLE TIER of the three-tier reference chain that every best-in-class
//  multi-store platform converges on (Cube.dev / Superset / Looker):
//
//      physical store  →  logical metric  →  binding node
//      (DatasourceInstanceConfig)   (MetricDef)        (DataSpec on a node)
//
//  A node references a metric in its DataSpec; the metric NAMES its store via
//  MetricDef.dataSource (the Cube.dev `dataSource`-on-measure pattern). This
//  module is the single place that walks a DataSpec, resolves its measure
//  references through the SSOT resolveMeasureRef seam, and returns the storeKey
//  the spec routes to — a PLAIN STRING.
//
//  Arrow-clean by construction: the react binding layer (resolveStore /
//  renderNode) calls specDataSource(spec) and consumes a string. It never
//  imports the metric registry nor re-implements DataSpec traversal, and core
//  never imports react. The storeKey crosses the layer boundary as data.
//
//  Byte-identical: a spec that references no metric-with-a-dataSource (the
//  common case today — raw codes, or metrics without a dataSource) returns
//  undefined, so the binding layer falls through to the page/default store
//  exactly as it did before M1. Purely additive.

import type { DataSpec } from '../config/data-spec'
import { resolveMeasureRef } from './metric'

/**
 * Enumerate the raw measure references a DataSpec carries, in deterministic
 * order (the same order extractRequirements walks). Returns the AUTHORED refs
 * (raw codes AND metric-ids) without resolving them, so the caller resolves
 * each through the one resolveMeasureRef seam.
 */
// Module-local implementation; specMeasureRefs (exported) + specDataSource both
// delegate to it. The switch is TOTAL (a default arm) so it always returns an
// iterable — a malformed/unknown spec never throws, it simply yields no refs.
function measureRefs(spec: DataSpec): string[] {
  switch (spec.type) {
    case 'query': {
      const m = spec.query.measure
      return Array.isArray(m) ? [...m] : [m]
    }
    case 'row-list':
      return spec.rows.flatMap((r) => (r.pctOf ? [r.code, r.pctOf] : [r.code]))
    case 'timeseries':
      return [spec.code]
    case 'growth':
      return Array.isArray(spec.code) ? [...spec.code] : [spec.code]
    case 'ratio-list':
      return spec.pairs.flatMap((p) => [p.code, p.denom])
    case 'pivot':
    case 'transform':
    case 'custom':
      return []
    // A spec whose discriminant is none of the above (e.g. a malformed/unknown
    // type) carries no measure refs ⇒ no metric-store routing. Mirrors
    // interpretSpec's defensive UNKNOWN_SPEC_TYPE fallthrough — never throw on a
    // bad spec, just decline to route. Always returns an iterable for the
    // for-of in specDataSource.
    default:
      return []
  }
}

export function specMeasureRefs(spec: DataSpec): string[] {
  return measureRefs(spec)
}

/**
 * The storeKey a DataSpec routes to via the metric it references (M1, Cube.dev
 * `dataSource`). Resolves each measure ref through the SSOT resolveMeasureRef
 * seam and returns the FIRST metric-declared `dataSource` (order-stable,
 * deterministic — mirrors resolveMeasureRef's first-metric-wins governance).
 *
 * Returns undefined when the spec references no metric with a `dataSource` (the
 * common case today) ⇒ the binding layer falls through to page/default,
 * byte-identical to the single-store status quo.
 */
export function specDataSource(spec: DataSpec): string | undefined {
  for (const ref of measureRefs(spec)) {
    const ds = resolveMeasureRef(ref).dataSource
    if (ds !== undefined) return ds
  }
  return undefined
}
