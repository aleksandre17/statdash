// ── metric-calc — calculated-metric value evaluation [DC-01] ──────────────────
//
//  The runtime consumer of MetricDef.calc (the measure-algebra in the semantic
//  layer). A calculated metric's value is a declarative EXPRESSION over named
//  component measures; this module evaluates it at a point coordinate by:
//
//    1. point-reading each component via storeValAt (ctx.dims ⊕ component.at) —
//       leaning on the new valAt seam exactly where it fits (a scalar OLAP cell),
//    2. binding the reads into the expr scope as `$derived[<name>]`,
//    3. evaluating MetricDef.calc.expr through @statdash/expr — REUSING the one
//       typed evaluator, never a second dialect.
//
//  Scalar by construction: a calc metric is consumed at a point (a KPI `metric`
//  value), not as a row-set query measure. `resolveMetricValue` returns undefined
//  for a non-calc ref so a caller transparently falls back to a raw read.
//
//  This is a data-layer leaf — it imports the metric registry (getMetric /
//  resolveMeasureRef from ./metric) + the store helpers (./store) + @statdash/expr.
//  It is NOT subject to the metric.ts purity invariant (that guards metric.ts only,
//  against registry/ cycles); using getMetric here is the intended consumer wiring.
//
import type { DataStore, Requirement } from './store'
import { storeValAt }                  from './store'
import { getMetric, resolveMeasureRef } from './metric'
import type { MetricInput }            from './metric'
import type { SectionContext }         from '../core/context'
import { evalExpr }                    from '@statdash/expr'
import type { DimVal }                 from '../sdmx'

/** True ⟺ the ref resolves to a registered CALCULATED metric (carries `calc`). */
export function isCalculatedMetric(ref: string): boolean {
  return getMetric(ref)?.calc !== undefined
}

/**
 * Resolve a calc input to its primary store code (a metric-id input expands to its
 * first underlying code) + the point-read coordinate it pins. The coordinate is
 * `input.at` — a DimVal scalar coordinate, NOT the referenced metric's `dims`
 * (those are FilterValue query semantics, a different category — a point-read
 * addresses a single cell, never a $ctx/$ne predicate). The active ctx.dims is
 * applied by the caller (storeValAt merges `at` over ctx.dims).
 */
function inputCoord(input: MetricInput): { code: string; at: Partial<Record<string, DimVal>> } {
  return {
    code: resolveMeasureRef(input.measure).codes[0] ?? input.measure,
    at:   input.at ?? {},
  }
}

/**
 * Evaluate a calculated metric's value at the active coordinate. Each component is
 * point-read via storeValAt (ctx.dims ⊕ component coordinate) and bound into the
 * expr scope as `$derived[<name>]`; the expr yields the scalar. A div-by-zero in
 * the expr folds to 0 (the expr `div` returns null, which a wrapping `mul`/`add`
 * coerces to 0 — byte-identical to the legacy `denom ? num/denom : 0` guard).
 *
 * Returns undefined when `ref` is not a calc metric, so a scalar consumer can fall
 * back to a plain storeVal read with no branching of its own.
 */
export function resolveMetricValue(
  ref:   string,
  ctx:   SectionContext,
  store: DataStore,
): number | undefined {
  const metric = getMetric(ref)
  if (!metric?.calc) return undefined

  const derived: Record<string, DimVal> = {}
  for (const [name, input] of Object.entries(metric.calc.inputs)) {
    const { code, at } = inputCoord(input)
    derived[name] = storeValAt(store, code, at, ctx)
  }

  const v = evalExpr<DimVal>(metric.calc.expr, { dims: ctx.dims, derived })
  return typeof v === 'number' ? v : v == null ? 0 : Number(v)
}

/**
 * The (code, dims) component reads a calc metric will issue at `ctx` — the warm
 * SSOT sibling of extractRequirements / extractKpiRequirements, so an async store
 * prefetches EXACTLY the slices resolveMetricValue reads (no cold component, no
 * over-fetch). Mirrors inputCoord's coordinate layering. Empty for a non-calc ref.
 */
export function calcMetricRequirements(ref: string, ctx: SectionContext): Requirement[] {
  const metric = getMetric(ref)
  if (!metric?.calc) return []

  const out: Requirement[] = []
  for (const input of Object.values(metric.calc.inputs)) {
    // `at` is Partial (values may be undefined); the store's matcher skips unset
    // dims, so the cast is sound — undefined keys never narrow a coordinate.
    const dims = { ...ctx.dims, ...input.at } as Record<string, DimVal>
    for (const code of resolveMeasureRef(input.measure).codes) out.push({ code, dims })
  }
  return out
}
