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
import { getMetric, resolveMeasureRef, isRelativeCoord } from './metric'
import { resolveRelativeAt }           from './relative-coord'
import type { SectionContext }         from '../core/context'
import { evalExpr }                    from '@statdash/expr'
import type { DimVal }                 from '../sdmx'

/** True ⟺ the ref resolves to a registered CALCULATED metric (carries `calc`). */
export function isCalculatedMetric(ref: string): boolean {
  return getMetric(ref)?.calc !== undefined
}

/**
 * Evaluate a calculated metric's value at the active coordinate. Each component is
 * point-read via storeValAt (ctx.dims ⊕ component coordinate) and bound into the
 * expr scope as `$derived[<name>]`; the expr yields the scalar. A div-by-zero in
 * the expr folds to 0 (the expr `div` returns null, which a wrapping `mul`/`add`
 * coerces to 0 — byte-identical to the legacy `denom ? num/denom : 0` guard).
 *
 * RELATIVE coordinates [ADR-045]: a component whose `at` carries a `{ $prev: n }`
 * token is navigated over the dimension's ordered members BEFORE the read
 * (resolveRelativeAt). When ANY token is OFF-THE-EDGE (no such prior member — the
 * first-period growth edge), this returns `null` — the honest no-data signal (Law 11),
 * distinct from a fabricated 0: the scalar KPI consumer renders no-data, never a lie.
 *
 * Returns:
 *   `number`    — the resolved value (INCLUDING a genuine div-by-zero 0),
 *   `null`      — a calc metric whose relative coordinate is off-the-edge (no-data),
 *   `undefined` — `ref` is not a calc metric (a scalar consumer falls back to a raw read).
 */
export function resolveMetricValue(
  ref:   string,
  ctx:   SectionContext,
  store: DataStore,
): number | null | undefined {
  const metric = getMetric(ref)
  if (!metric?.calc) return undefined

  const derived: Record<string, DimVal> = {}
  for (const [name, input] of Object.entries(metric.calc.inputs)) {
    const code = resolveMeasureRef(input.measure).codes[0] ?? input.measure
    // Resolve any relative token to an absolute member; off-the-edge ⇒ honest no-data.
    const at = resolveRelativeAt(input.at, code, ctx, store)
    if (at === undefined) return null
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
    // Layer the component's `at` over ctx.dims. A RELATIVE token dim [ADR-045] is
    // navigated at READ time over the ordered member set, so we warm the WHOLE axis:
    // DROP that dim from the warm dims (async store leaves it unbounded — e.g. all
    // time periods) so BOTH the member enumeration (orderedMembers' obs scan) AND the
    // navigated prior-member point-read resolve from ONE cached superset slice
    // (warm ⊇ read). A concrete `at` value narrows as before. A token-free input is
    // byte-identical to `{ ...ctx.dims, ...input.at }` (FF-BIND-PARITY holds).
    const dims: Record<string, DimVal> = { ...ctx.dims }
    for (const [dim, v] of Object.entries(input.at ?? {})) {
      if (isRelativeCoord(v)) delete dims[dim]
      else if (v !== undefined) dims[dim] = v as DimVal
    }
    for (const code of resolveMeasureRef(input.measure).codes) out.push({ code, dims })
  }
  return out
}
