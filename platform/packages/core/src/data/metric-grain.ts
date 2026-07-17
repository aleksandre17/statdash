// ── metric-grain — measure algebra at ANY grain [AR-50 M2] ──────────────────────
//
//  The generalization of metric-calc.ts from SCALAR (grain-∅, a KPI point-read) to a
//  measure that evaluates at whatever grain the query requests — the Malloy/LookML/
//  DAX "a measure works at any grain" property, on our SDMX substrate.
//
//  THE ALGEBRA (align-join + per-row Expr eval):
//    1. ALIGN — enumerate the union of grain tuples every input measure populates
//       (one `obs` scan per input, ctx.dims with the grain axes OPENED, projected
//       onto the grain axes). This is an OUTER align-join on the shared grain keys.
//    2. EVAL  — at each aligned tuple, point-read every input at that CELL (the same
//       storeValAt OLAP-cell seam metric-calc uses; a nested DERIVED input re-derives
//       recursively), bind them into the expr scope as `$derived[<name>]`, and
//       evaluate the ONE `calc.expr` per row — REUSING @statdash/expr, never a second
//       dialect. Grain is a GENERIC set of dim keys (Law 1 — `time` is not special).
//
//  Scalar is grain-∅ (align on nothing → one row): evalCalcAtGrain(ref, ctx, store)
//  delegates to metric-calc's resolveMetricValue, so a point read is BYTE-IDENTICAL
//  to the pre-M2 behaviour (FF-CALC-GRAIN-SCALAR-IDENTICAL — the reversible-expansion
//  parity gate). Nothing about a scalar KPI read changes.
//
//  ADDITIVITY, CONSUMED: a NON-ADDITIVE measure (a ratio: deflator, share, per-capita)
//  is re-derived from its `calc` at the requested grain, NEVER summed. `guardNoSumOfRatio`
//  is the executable FF-NO-SUM-OF-RATIO gate — it throws if a non-additive measure is
//  ever handed to a summing reducer. A base ADDITIVE input rolls up with `sum` (today's
//  OLAP cell); a SEMI-ADDITIVE base measure rolls per-axis (`rollupForAxis`, DAX parity).
//
//  Data-layer leaf: imports the metric registry (./metric), the store helpers (./store),
//  the scalar evaluator (./metric-calc), and @statdash/expr. Arrow-clean (expr ← core);
//  NO react, NO DOM, idempotent. It is the intended registry consumer wiring, exactly
//  like metric-calc.ts (not subject to metric.ts's own purity invariant).
//
import type { DataStore, RollupOp } from './store'
import { storeValAt }               from './store'
import type { EngineRow }           from './encoding'
import { getMetric, resolveMeasureRef, effectiveAdditivity, isRelativeCoord } from './metric'
import type { MetricDef, MetricInput } from './metric'
import { resolveMetricValue }       from './metric-calc'
import type { SectionContext }      from '../core/context'
import { evalExpr }                 from '@statdash/expr'
import type { DimVal }              from '../sdmx'

// ── FF-NO-SUM-OF-RATIO — the executable guard ───────────────────────────────────
//
//  The scientific falsehood this platform must refuse: summing a non-additive measure
//  across a dimension (adding up GDP-per-capita over years, averaging a deflator).
//  A summing reducer applied to a non-additive metric is a HARD error — the metric
//  must instead re-derive from its `calc` at the target grain.

/** The reducers that AGGREGATE BY SUMMATION — the ops FF-NO-SUM-OF-RATIO forbids on a ratio. */
const SUMMING_OPS: ReadonlySet<RollupOp> = new Set<RollupOp>(['sum'])

/** True ⟺ the rollup op aggregates by summation (the operation forbidden on a non-additive measure). */
export function isSummingOp(op: RollupOp): boolean {
  return SUMMING_OPS.has(op)
}

/** Thrown when a non-additive measure would be aggregated by a summing reducer (FF-NO-SUM-OF-RATIO). */
export class NonAdditiveSumError extends Error {
  readonly ref: string
  readonly op:  RollupOp
  constructor(ref: string, op: RollupOp) {
    super(
      `[FF-NO-SUM-OF-RATIO] measure '${ref}' is non-additive and may not be aggregated by a ` +
      `summing reducer ('${op}'); re-derive it from its calc at the requested grain instead`,
    )
    this.name = 'NonAdditiveSumError'
    this.ref  = ref
    this.op   = op
  }
}

/**
 * FF-NO-SUM-OF-RATIO gate: throw if `ref` resolves to a NON-ADDITIVE measure and `op`
 * is a summing reducer. The one guard both the runtime cell-read and the fitness test
 * call — a non-additive measure can never silently reach a `sum`. A raw code /
 * additive / semi-additive measure passes through untouched.
 */
export function guardNoSumOfRatio(ref: string, op: RollupOp): void {
  if (isSummingOp(op) && effectiveAdditivity(getMetric(ref)) === 'non-additive') {
    throw new NonAdditiveSumError(ref, op)
  }
}

/**
 * The rollup op to apply on ONE axis for a base ADDITIVE / SEMI-ADDITIVE measure (the
 * consumed additivity model, DAX parity):
 *   additive      → 'sum' on every axis.
 *   semi-additive → 'sum' on an axis in `semiAdditive.additiveOver`; else `nonAdditiveOp`
 *                   (the stock's `last`-over-time behaviour, Law 1 generic axis).
 * A NON-ADDITIVE measure is never rolled up (it re-derives from `calc`) — calling this
 * for one is the FF-NO-SUM-OF-RATIO violation, surfaced rather than silently summed.
 */
export function rollupForAxis(metric: MetricDef | undefined, dim: string, ref = '(non-additive measure)'): RollupOp {
  const cls = effectiveAdditivity(metric)
  if (cls === 'additive') return 'sum'
  if (cls === 'non-additive') throw new NonAdditiveSumError(ref, 'sum')
  const rule = metric?.semiAdditive
  if (rule && rule.additiveOver.includes(dim)) return 'sum'
  return (rule?.nonAdditiveOp ?? 'last') as RollupOp
}

// ── evalCalcAtGrain — the grain-polymorphic evaluator ───────────────────────────

/** Coerce an expr result to a numeric cell value — byte-identical to metric-calc's fold. */
function coerce(v: DimVal | undefined): number {
  return typeof v === 'number' ? v : v == null ? 0 : Number(v)
}

/** Deterministic key for a grain tuple over the ordered grain axes. */
function grainKey(tuple: Record<string, DimVal>, grain: readonly string[]): string {
  return grain.map((d) => `${d}=${String(tuple[d])}`).join('|')
}

/** An input's primary underlying store code (a metric-id expands to its first code). */
function inputBaseCode(input: MetricInput): string {
  return resolveMeasureRef(input.measure).codes[0] ?? input.measure
}

/**
 * ALIGN step — enumerate the DISTINCT grain tuples an input populates and union them
 * into `into`. An `obs` scan at ctx.dims with the grain axes OPENED (⊕ input.at pins)
 * gives the rows spanning the grain; each is projected onto the grain axes. Generic —
 * grain is any set of dim keys (Law 1). A row missing a grain axis cannot be placed on
 * the grain and is skipped.
 */
function enumerateGrainTuples(
  input: MetricInput,
  grain: readonly string[],
  ctx:   SectionContext,
  store: DataStore,
  into:  Map<string, Record<string, DimVal>>,
): void {
  const grainSet = new Set(grain)
  const filter: Record<string, DimVal> = {}
  // Keep the FIXED coordinate (ctx.dims minus the grain axes); OPEN the grain axes so
  // obs returns rows spanning every grain value at the current slice.
  for (const [dim, val] of Object.entries(ctx.dims)) {
    if (!grainSet.has(dim) && val != null) filter[dim] = val
  }
  // Input pins (input.at) constrain THIS component's read (Law 1 — any dim).
  for (const [dim, val] of Object.entries(absolutePins(input.at))) filter[dim] = val
  const rows = store.querySync({ type: 'obs', measure: inputBaseCode(input), filter }, ctx)
  for (const row of rows) {
    const tuple: Record<string, DimVal> = {}
    let complete = true
    for (const d of grain) {
      const v = (row as Record<string, DimVal>)[d]
      if (v === undefined) { complete = false; break }
      tuple[d] = v
    }
    if (complete) into.set(grainKey(tuple, grain), tuple)
  }
}

/**
 * Read ONE input's value at a specific grain cell. A nested DERIVED input is
 * RE-DERIVED at the pinned coordinate (the scalar seam at ctx.dims ⊕ input.at ⊕ tuple)
 * — the algebra is recursive at grain, so a non-additive input never gets summed. A
 * BASE input is an OLAP cell sum via storeValAt; guardNoSumOfRatio forbids summing a
 * BASE measure that was explicitly classified non-additive (no `calc` to re-derive).
 */
function readInputAt(
  input: MetricInput,
  tuple: Record<string, DimVal>,
  ctx:   SectionContext,
  store: DataStore,
): number {
  const metric = getMetric(input.measure)
  if (metric?.calc) {
    // `input.at` is Partial (values may be undefined); the store matcher skips unset
    // dims, so the cast is sound — undefined keys never narrow a coordinate.
    const dims = { ...ctx.dims, ...absolutePins(input.at), ...tuple } as Record<string, DimVal>
    return resolveMetricValue(input.measure, { ...ctx, dims }, store) ?? 0
  }
  guardNoSumOfRatio(input.measure, 'sum')
  const at: Partial<Record<string, DimVal>> = { ...absolutePins(input.at), ...tuple }
  return storeValAt(store, inputBaseCode(input), at, ctx)
}

/**
 * The ABSOLUTE pins of a component's `at` — a relative token `{ $prev: n }` [ADR-045] is
 * DROPPED here. Grain-SERIES navigation of a relative coordinate is a follow-up (the
 * tuple-vs-token collision needs its own design); the SCALAR KPI path (evalCalcAtGrain
 * grain-∅ → resolveMetricValue) already resolves tokens honestly. A token-FREE input —
 * every catalog metric today — is byte-identical (null/undefined keys were already
 * skipped by the store matcher). Keeps the grain path type-correct without expanding scope.
 */
function absolutePins(at: MetricInput['at']): Record<string, DimVal> {
  const out: Record<string, DimVal> = {}
  for (const [dim, v] of Object.entries(at ?? {})) {
    if (v != null && !isRelativeCoord(v)) out[dim] = v
  }
  return out
}

/** Grain comparator — numeric where both values are numeric, else lexical; per axis in order. */
function sortByGrain(
  grain:  readonly string[],
  tuples: Map<string, Record<string, DimVal>>,
): (ka: string, kb: string) => number {
  return (ka, kb) => {
    const a = tuples.get(ka)!, b = tuples.get(kb)!
    for (const d of grain) {
      const av = a[d], bv = b[d]
      const an = Number(av), bn = Number(bv)
      const numeric = !Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '' && av != null && bv != null
      const cmp = numeric ? an - bn : String(av).localeCompare(String(bv))
      if (cmp !== 0) return cmp
    }
    return 0
  }
}

/**
 * Evaluate a calculated metric at the requested GRAIN — the align-join + per-row Expr
 * eval described in this module's header. Returns one EngineRow per aligned grain tuple
 * (`{ ...tuple, value }`), the metric's governed value re-derived at that grain.
 *
 * `grain` is a GENERIC ordered set of dim keys (Law 1 — e.g. `['time']` for a time
 * series, `['geo']` for a cross-section, `[]` for a scalar). Grain-∅ delegates to the
 * scalar SSOT (resolveMetricValue), so a KPI point read is byte-identical to pre-M2
 * (FF-CALC-GRAIN-SCALAR-IDENTICAL). A non-calc / unregistered ref yields [] at any
 * non-empty grain (the caller falls back to a raw row query).
 */
export function evalCalcAtGrain(
  ref:   string,
  ctx:   SectionContext,
  store: DataStore,
  grain: readonly string[] = [],
): EngineRow[] {
  // Grain-∅ = scalar. The scalar path is UNTOUCHED — one governed number, byte-identical.
  if (grain.length === 0) {
    const v = resolveMetricValue(ref, ctx, store)
    // `null` = an off-the-edge relative coordinate (honest no-data, ADR-045); `undefined`
    // = a non-calc ref. Both yield NO row here (no fabricated value). A resolved value —
    // including a genuine 0 — is one row. Byte-identical for every token-free metric.
    return v == null ? [] : [{ value: v }]
  }

  const metric = getMetric(ref)
  if (!metric?.calc) return []

  // 1. ALIGN — the union of grain tuples across every input (outer align-join on grain keys).
  const tuples = new Map<string, Record<string, DimVal>>()
  const inputs = Object.entries(metric.calc.inputs)
  for (const [, input] of inputs) enumerateGrainTuples(input, grain, ctx, store, tuples)

  // 2. EVAL — per aligned tuple, read each input at that cell, bind $derived, eval the ONE expr.
  const out: EngineRow[] = []
  for (const key of [...tuples.keys()].sort(sortByGrain(grain, tuples))) {
    const tuple = tuples.get(key)!
    const derived: Record<string, DimVal> = {}
    for (const [name, input] of inputs) derived[name] = readInputAt(input, tuple, ctx, store)
    const v = evalExpr<DimVal>(metric.calc.expr, { dims: ctx.dims, derived })
    out.push({ ...tuple, value: coerce(v) })
  }
  return out
}

// ── evalMeasureAtGrain — ANY governed measure at grain (calc OR base) [AR-50 M-SQ] ──
//
//  The complete "measure at grain" entry point the `metric` DataSpec lowers onto.
//  evalCalcAtGrain (above) covers a CALC metric — the align-join + per-row Expr eval —
//  and, by design, declines a BASE ref at a non-empty grain ("the caller falls back to
//  a raw row query"). This function IS that caller, folded back into the grain SSOT so
//  grain semantics live in ONE module:
//
//    • CALC metric → evalCalcAtGrain (native at any grain, single or multi-axis).
//    • BASE metric / raw code → read the underlying measure at each grain CELL. It
//      REUSES the very same align machinery (enumerateGrainTuples + readInputAt +
//      sortByGrain) as a ONE-input read — NOT a reimplementation of the algebra, just
//      the algebra with no Expr and a single component. readInputAt routes a base input
//      through storeValAt (the OLAP cell sum) behind guardNoSumOfRatio, so a DECLARED
//      non-additive base measure with no `calc` to re-derive throws rather than silently
//      summing (FF-NO-SUM-OF-RATIO). Grain-∅ ⇒ one scalar cell (byte-identical to a
//      storeVal read at ctx.dims).
//
//  Emits one `{ ...grainTuple, value }` EngineRow per aligned tuple — the SAME uniform
//  shape evalCalcAtGrain returns, so a caller reshapes both branches identically. Grain
//  is a GENERIC ordered set of dim keys (Law 1 — `time` is not special).
export function evalMeasureAtGrain(
  ref:   string,
  ctx:   SectionContext,
  store: DataStore,
  grain: readonly string[] = [],
): EngineRow[] {
  // CALC metric → the align-join + Expr algebra (native multi-axis, scalar-identical at ∅).
  if (getMetric(ref)?.calc) return evalCalcAtGrain(ref, ctx, store, grain)

  // BASE metric / raw code — read the one underlying measure at each grain cell.
  const input: MetricInput = { measure: ref }
  if (grain.length === 0) {
    // Grain-∅ ≡ a single OLAP cell at ctx.dims (byte-identical to storeVal). readInputAt
    // guards a declared non-additive base before the sum.
    return [{ value: readInputAt(input, {}, ctx, store) }]
  }

  // ALIGN — the distinct grain tuples the measure populates (the SAME outer align as calc,
  // one input). EVAL — a single storeValAt cell read per tuple (no Expr for a base measure).
  const tuples = new Map<string, Record<string, DimVal>>()
  enumerateGrainTuples(input, grain, ctx, store, tuples)

  const out: EngineRow[] = []
  for (const key of [...tuples.keys()].sort(sortByGrain(grain, tuples))) {
    const tuple = tuples.get(key)!
    out.push({ ...tuple, value: readInputAt(input, tuple, ctx, store) })
  }
  return out
}
