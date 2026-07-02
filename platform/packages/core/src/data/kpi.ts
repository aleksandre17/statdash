// ── KPI Spec Engine — the interpreter (render + warm) ───────────────────
//
//  JSON-based KPI config system — Eurostat / ONS / IMF pattern. The declarative
//  spec vocabulary (KpiSpec / KpiValueSpec / KpiTrendSpec) lives in ./kpi-spec;
//  this file is the interpreter:
//
//  KpiSpec  →  interpretKpi(spec, ctx, store)  →  KpiDef (resolved, feeds KpiCard)
//

import type { DataStore, Requirement } from './store'
import { storeVal }            from './store'
import { resolveMeasureRef }    from './metric'
import { resolveMetricValue, calcMetricRequirements } from './metric-calc'
import type { SectionContext }  from '../core/context'
import { atTime, TIME_DIM }      from '../core/context'
import type { KpiDef }          from '../config/kpi'
import { getFormatter }         from './transform'
import { resolveTemplate }      from '../config/template'
import { evalVisibility }       from '../config/visibility'
import type {
  TimeRef, DimFilter, ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec,
} from './kpi-spec'

// Re-export the vocabulary so existing `from './kpi'` / `from '../data/kpi'`
// import paths (index.ts, data/index.ts, tests) stay byte-identical after the split.
export type { FormatKey, ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec } from './kpi-spec'

// ── Internal helpers ──────────────────────────────────────────────────

/** Extract the primary measure code from a KpiValueSpec for provenance lookup. */
function primaryMeasure(spec: KpiValueSpec): string | undefined {
  if ('measure' in spec) return spec.measure          // point | yoy | cagr
  if ('num'     in spec) return spec.num.measure      // share
  if ('codes'   in spec) return spec.codes[0]         // expr — first operand
  if ('metric'  in spec) return resolveMeasureRef(spec.metric).codes[0]  // calc — first component code
  return undefined
}

function resolveTime(ref: TimeRef | undefined, ctx: SectionContext): number {
  if (ref === undefined)                        return ctx.dims[TIME_DIM] as number
  if (typeof ref === 'object' && '$ctx' in ref) return ctx.dims[ref.$ctx] as number
  return ref as number
}

function withFilter(ctx: SectionContext, filter?: DimFilter): SectionContext {
  if (!filter) return ctx
  const dims = { ...ctx.dims }
  for (const [k, v] of Object.entries(filter)) {
    // '' / null / undefined — wildcard: drop the dim from ctx so val() sums over it.
    if (v === '' || v === null || v === undefined) delete dims[k]
    else                                            dims[k] = v
  }
  return { ...ctx, dims }
}

const fmtKpiPct = (n: number): string => n.toFixed(1)

function trendDir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
}

/** Greppable diagnostic code for a CAGR whose baseline is 0/falsy (PL-4). */
export const KPI_CAGR_ZERO_BASELINE = 'KPI_CAGR_ZERO_BASELINE'

// A falsy CAGR baseline over a real window (to > from, vFrom === 0) means CAGR —
// a LEVEL operator — was applied to a series whose start is 0 (typically a RATE
// series, e.g. real-gdp-growth-rates). The ratio (vTo/vFrom) is undefined; the two
// cagr sites keep a 0 numeric fallback for prod resilience, but must NOT be silent —
// this emits a loud, greppable signal so the mis-authoring (use `type:'mean'` for a
// rate series) surfaces at dev time rather than rendering a bogus 0.0%.
function cagrZeroBaseline(measure: string, from: number, to: number): void {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[${KPI_CAGR_ZERO_BASELINE}] measure="${measure}" from=${from} to=${to}: ` +
      `zero/falsy baseline — result forced to 0 (use type:'mean' for a rate series)`,
    )
  }
}

// ── Value computation ─────────────────────────────────────────────────

function resolveValue(spec: KpiValueSpec, ctx: SectionContext, store: DataStore): string {
  switch (spec.type) {
    case 'point': {
      const c = withFilter(ctx, spec.filter)
      const t = resolveTime(spec.time, c)
      const n = storeVal(store, spec.measure, atTime(t, c))
      return getFormatter(spec.format)(spec.abs ? Math.abs(n) : n)
    }
    case 'yoy': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const cur  = storeVal(store, spec.measure, atTime(t, c))
      const prev = storeVal(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return getFormatter('sign_pct')(pct)
    }
    case 'cagr': {
      const c     = withFilter(ctx, spec.filter)
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = storeVal(store, spec.measure, atTime(from, c))
      const vTo   = storeVal(store, spec.measure, atTime(to, c))
      if (to > from && !vFrom) cagrZeroBaseline(spec.measure, from, to)   // PL-4 — fail loud, not silent 0
      const n     = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return fmtKpiPct(n)
    }
    case 'mean': {
      // Arithmetic mean Σ v(t)/N over the INCLUSIVE window [from,to] — the proper
      // reducer for a RATE series (each year's rate read at its pinned coordinate,
      // GENERICALLY via atTime). Absent `format` ⇒ fmtKpiPct (byte-identical to the
      // share/metric default); a rate card supplies 'sign_pct' to keep the sign.
      const c   = withFilter(ctx, spec.filter)
      const lo  = Math.min(resolveTime(spec.from, c), resolveTime(spec.to, c))
      const hi  = Math.max(resolveTime(spec.from, c), resolveTime(spec.to, c))
      let sum = 0
      let n   = 0
      for (let t = lo; t <= hi; t++) { sum += storeVal(store, spec.measure, atTime(t, c)); n++ }
      const avg = n ? sum / n : 0
      return (spec.format ? getFormatter(spec.format) : fmtKpiPct)(avg)
    }
    case 'share': {
      const getRef = (ref: ObsRef): number => {
        const rc = withFilter(ctx, ref.filter)
        return storeVal(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
      }
      const n = getRef(spec.num)
      const d = getRef(spec.denom)
      return fmtKpiPct(d ? (n / d) * 100 : 0)
    }
    case 'expr': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const vals = spec.codes.map((code) => storeVal(store, code, atTime(t, c)))
      const n    = spec.op === 'subtract'
        ? vals[0] - vals.slice(1).reduce((a, b) => a + b, 0)
        : vals.reduce((a, b) => a + b, 0)
      return getFormatter(spec.format)(n)
    }
    case 'metric': {
      // Evaluate the named calc metric at the pinned period. `?? 0` mirrors the
      // legacy ratio guard (a non-calc/missing ref or null expr ⇒ 0). Absent
      // `format` ⇒ fmtKpiPct — the SAME formatter `share` uses (byte-identical).
      const t = resolveTime(spec.time, ctx)
      const v = resolveMetricValue(spec.metric, atTime(t, ctx), store) ?? 0
      return (spec.format ? getFormatter(spec.format) : fmtKpiPct)(v)
    }
  }
}

// ── Trend computation ─────────────────────────────────────────────────

function resolveTrend(
  spec:  KpiTrendSpec,
  ctx:   SectionContext,
  store: DataStore,
): { value: string; dir: 'up' | 'down' | 'flat' } {
  // Static caption is an i18n carrier — collapse to the active locale (+ template-expand)
  // at THIS boundary, exactly as interpretKpi resolves label/unit/trendSub, so a raw
  // { ka, en } bag never reaches the KpiCard child.
  if (spec.type === 'static') return { value: resolveTemplate(spec.value, ctx), dir: spec.dir }
  const c = withFilter(ctx, spec.filter)
  switch (spec.type) {
    case 'yoy': {
      const t    = resolveTime(spec.time, c)
      const cur  = storeVal(store, spec.measure, atTime(t, c))
      const prev = storeVal(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
    case 'cagr': {
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = storeVal(store, spec.measure, atTime(from, c))
      const vTo   = storeVal(store, spec.measure, atTime(to, c))
      if (to > from && !vFrom) cagrZeroBaseline(spec.measure, from, to)   // PL-4 — same fail-loud guard as the value site
      const pct   = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
  }
}

// ── kpiVisible — the SHARED per-card visibility predicate (P5.2 (2)) ──────────
//
//  ONE SSOT both the render path (interpretKpis) and the warm path
//  (extractKpiRequirements) call, so the warm requirement set is the EXACT visible
//  set the render reads — no drift (the §0b kpi-strip-crash invariant: a card warmed
//  but not rendered, or rendered but not warmed, breaks an async store).
//
//  A card's `when?` is a VisibilityExpr (canonically `perspective-is(id)`), evaluated
//  against `ctx.perspectiveState` — the SAME SSOT the node visibility gate reads. The
//  declarative replacement for the retired `mode: 'year'|'range'|'both'` union:
//    • `when` present → evalVisibility (perspective-is/in/not/and/or/…),
//    • `when` ABSENT  → visible in every perspective (the old `'both'`).
//  `evalVisibility`'s `fr` (filter-param) arg is the SAME surface `renderNode` passes
//  for a node's `view.visibleWhen` — `ctx.filterParams` (the raw URL filter Record),
//  NOT `ctx.dims`. This keeps the visibility SSOT uniform: an `eq`/`isset`/`in` `when`
//  resolves identically on a kpi card and on a node (a perspective-* op ignores `fr`
//  and reads `perspectiveState`, so today's perspective-only `when` is unaffected).
function kpiVisible(
  spec:         KpiSpec,
  ctx:          SectionContext,
  filterParams: Record<string, unknown>,
): boolean {
  if (!spec.when) return true
  return evalVisibility(spec.when, filterParams, ctx.perspectiveState)
}

// ── Public API ────────────────────────────────────────────────────────

export function interpretKpi(
  spec:  KpiSpec,
  ctx:   SectionContext,
  store: DataStore,
): KpiDef {
  const formattedValue = resolveValue(spec.value, ctx, store)
  const trend          = spec.trend ? resolveTrend(spec.trend, ctx, store) : null

  // Provenance: static flag OR dynamic store.metadata port [N14].
  const code = primaryMeasure(spec.value)
  const prov = code ? store.metadata?.provenance(code, ctx) : undefined

  // Every display field funnels through resolveTemplate — which collapses the
  // LocaleString carrier to the active locale (ctx.locale, generic) THEN template-
  // expands against ctx.dims. label/unit/trendSub are all i18n carriers; resolving
  // them at this ONE boundary keeps a raw { ka, en } bag from reaching the KpiCard.
  return {
    label:           resolveTemplate(spec.label, ctx),
    value:           formattedValue,
    unit:            resolveTemplate(spec.unit, ctx),
    color:           spec.color,
    trend:           trend?.dir ?? 'flat',
    trendValue:      trend?.value ?? '',
    trendSub:        spec.trendSub ? resolveTemplate(spec.trendSub, ctx) : '',
    preliminary:     spec.preliminary || prov?.status === 'p',
    note:            spec.note,
    methodologyUrl:  spec.methodologyUrl,
  }
}

export function interpretKpis(
  specs:        KpiSpec[],
  ctx:          SectionContext,
  store:        DataStore,
  filterParams: Record<string, unknown> = {},
): KpiDef[] {
  return specs
    .filter((s) => kpiVisible(s, ctx, filterParams))
    .map((s) => interpretKpi(s, ctx, store))
}

// ── extractKpiRequirements ────────────────────────────────────────────
//
//  Static analysis of a KpiSpec[] — the SSOT requirement set for the KPI
//  read surface, the sibling of extractRequirements (DataSpec). Returns every
//  {code, dims} pair interpretKpis WILL read via storeVal, WITHOUT executing
//  it — so a warm consumer (ApiStore.prefetch / CachedStore.warm / the react
//  KPI warm path) can batch-load exactly the slices a kpi-strip needs.
//
//  CRITICAL — the comparison period. A 'yoy' value/trend reads BOTH atTime(t)
//  AND atTime(t-1): the previous year is a real store read. extractRequirements
//  for a 'growth' DataSpec enumerates each year; this does the same for KPIs —
//  it MUST yield t-1 so the warm covers it, else querySync cold-throws on the
//  previous-period read (the kpi-strip crash). 'cagr' reads from AND to; 'share'
//  reads num AND denom at their own pinned times; 'expr' reads every code at t.
//
//  Visibility-filtered identically to interpretKpis via the SHARED `kpiVisible`
//  predicate (a year-only KPI contributes no requirements in the range perspective
//  and vice-versa) so the warm set is the EXACT superset of the synchronous render's
//  reads — no more, no less (warm === render, one SSOT, no drift).
//
//  Mirrors the resolveMeasureRef + atTime + withFilter seams interpretKpi uses,
//  so a metric ref expands to its underlying codes exactly as the read will.
//
export function extractKpiRequirements(
  specs:        KpiSpec[],
  ctx:          SectionContext,
  filterParams: Record<string, unknown> = {},
): Requirement[] {
  const out: Requirement[] = []

  // One (code, dims@time) requirement per underlying code of a measure ref.
  const push = (measure: string, c: SectionContext, t: number): void => {
    const dims = atTime(t, c).dims
    for (const code of resolveMeasureRef(measure).codes) out.push({ code, dims })
  }

  const fromValue = (spec: KpiValueSpec, base: SectionContext): void => {
    switch (spec.type) {
      case 'point': {
        const c = withFilter(base, spec.filter)
        push(spec.measure, c, resolveTime(spec.time, c))
        return
      }
      case 'yoy': {
        const c = withFilter(base, spec.filter)
        const t = resolveTime(spec.time, c)
        push(spec.measure, c, t)
        push(spec.measure, c, t - 1)   // the comparison period — the crash year
        return
      }
      case 'cagr': {
        const c = withFilter(base, spec.filter)
        push(spec.measure, c, resolveTime(spec.from, c))
        push(spec.measure, c, resolveTime(spec.to, c))
        return
      }
      case 'mean': {
        // The mean reads EVERY year in [from,to] — enumerate one requirement per
        // year (mirrors the `growth` DataSpec's per-year enumeration) so the warm
        // set is the EXACT superset the render reads (warm === render, no drift).
        const c  = withFilter(base, spec.filter)
        const lo = Math.min(resolveTime(spec.from, c), resolveTime(spec.to, c))
        const hi = Math.max(resolveTime(spec.from, c), resolveTime(spec.to, c))
        for (let t = lo; t <= hi; t++) push(spec.measure, c, t)
        return
      }
      case 'share': {
        const cn = withFilter(base, spec.num.filter)
        const cd = withFilter(base, spec.denom.filter)
        push(spec.num.measure,   cn, resolveTime(spec.num.time, cn))
        push(spec.denom.measure, cd, resolveTime(spec.denom.time, cd))
        return
      }
      case 'expr': {
        const c = withFilter(base, spec.filter)
        const t = resolveTime(spec.time, c)
        for (const code of spec.codes) push(code, c, t)
        return
      }
      case 'metric': {
        // Warm EXACTLY the component reads resolveMetricValue will issue at the
        // pinned period — the calc-metric warm SSOT (same period as the read).
        const t = resolveTime(spec.time, base)
        for (const req of calcMetricRequirements(spec.metric, atTime(t, base))) out.push(req)
        return
      }
    }
  }

  const fromTrend = (spec: KpiTrendSpec, base: SectionContext): void => {
    if (spec.type === 'static') return
    const c = withFilter(base, spec.filter)
    if (spec.type === 'yoy') {
      const t = resolveTime(spec.time, c)
      push(spec.measure, c, t)
      push(spec.measure, c, t - 1)   // the comparison period — the crash year
    } else {
      push(spec.measure, c, resolveTime(spec.from, c))
      push(spec.measure, c, resolveTime(spec.to, c))
    }
  }

  for (const spec of specs) {
    if (!kpiVisible(spec, ctx, filterParams)) continue   // SAME predicate (+fr) as interpretKpis — warm === render
    fromValue(spec.value, ctx)
    if (spec.trend) fromTrend(spec.trend, ctx)
  }

  return out
}