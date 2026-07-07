// ── KPI Spec Engine — the interpreter (render + warm) ───────────────────
//
//  JSON-based KPI config system — Eurostat / ONS / IMF pattern. The declarative
//  spec vocabulary (KpiSpec / KpiValueSpec / KpiTrendSpec) lives in ./kpi-spec;
//  this file is the interpreter:
//
//  KpiSpec  →  interpretKpi(spec, ctx, store)  →  KpiDef (resolved, feeds KpiCard)
//

import type { DataStore, Requirement } from './store'
import { storeVal }              from './store'
import { resolveMeasureRef }     from './metric'
import { resolveMetricValue, calcMetricRequirements } from './metric-calc'
import type { SectionContext }   from '../core/context'
import { atTime }                from '../core/context'
import type { KpiDef }           from '../config/kpi'
import { getFormatter }          from './transform'
import { resolveTemplate }       from '../config/template'
import { evalVisibility }        from '../config/visibility'
import type {
  ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec,
} from './kpi-spec'
import { resolveTime, withFilter } from './kpi-coord'
import { valueIsPreliminary }      from './kpi-preliminary'

// Re-export the vocabulary so existing `from './kpi'` / `from '../data/kpi'`
// import paths (index.ts, data/index.ts, tests) stay byte-identical after the split.
export type { FormatKey, ObsRef, KpiValueSpec, KpiTrendSpec, KpiSpec, DimFilter, DimFilterRef } from './kpi-spec'

// ── Internal helpers ──────────────────────────────────────────────────
//
//  The read-coordinate primitives (resolveTime / withFilter) live in ./kpi-coord,
//  shared with the displayed-slice preliminary derivation (./kpi-preliminary) so a
//  KPI's value and its OBS_STATUS resolve at the IDENTICAL coordinate (DRY).

const fmtKpiPct = (n: number): string => n.toFixed(1)

function trendDir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
}

// ── readMeasure — the metric-aware point read (U1) ─────────────────────────────
//
//  Route EVERY render-side measure read through the SAME resolveMeasureRef seam the
//  WARM path (extractKpiRequirements.push) already uses, so render and warm resolve a
//  measure ref IDENTICALLY. This closes a latent split: the warm path resolved a
//  metric-id to its underlying code(s), but the render path passed the raw ref
//  straight to storeVal — so a KPI referencing a metric-id warmed one code yet
//  rendered a different key (cache-miss → 0 value + a dead preliminary badge).
//
//  Postel / FF-RAW-CODE-IDENTICAL: a raw code is NOT a registered metric-id, so
//  resolveMeasureRef('X').codes === ['X'] → storeVal(store, 'X', ctx), BYTE-IDENTICAL
//  to the legacy direct read. A metric-id expands to its underlying code(s); when a
//  metric declares MULTIPLE codes they SUM (the OLAP additive-measure reading),
//  mirroring the warm path which enumerates one requirement per code (warm === render).
function readMeasure(store: DataStore, measure: string, ctx: SectionContext): number {
  let sum = 0
  for (const code of resolveMeasureRef(measure).codes) sum += storeVal(store, code, ctx)
  return sum
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
      const n = readMeasure(store, spec.measure, atTime(t, c))
      return getFormatter(spec.format)(spec.abs ? Math.abs(n) : n)
    }
    case 'yoy': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const cur  = readMeasure(store, spec.measure, atTime(t, c))
      const prev = readMeasure(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return getFormatter('sign_pct')(pct)
    }
    case 'cagr': {
      const c     = withFilter(ctx, spec.filter)
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = readMeasure(store, spec.measure, atTime(from, c))
      const vTo   = readMeasure(store, spec.measure, atTime(to, c))
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
      for (let t = lo; t <= hi; t++) { sum += readMeasure(store, spec.measure, atTime(t, c)); n++ }
      const avg = n ? sum / n : 0
      return (spec.format ? getFormatter(spec.format) : fmtKpiPct)(avg)
    }
    case 'share': {
      const getRef = (ref: ObsRef): number => {
        const rc = withFilter(ctx, ref.filter)
        return readMeasure(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
      }
      const n = getRef(spec.num)
      const d = getRef(spec.denom)
      return fmtKpiPct(d ? (n / d) * 100 : 0)
    }
    case 'expr': {
      const c    = withFilter(ctx, spec.filter)
      const t    = resolveTime(spec.time, c)
      const vals = spec.codes.map((code) => readMeasure(store, code, atTime(t, c)))
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
): { value: string; dir: 'up' | 'down' | 'flat' | 'none' } {
  // Static caption is an i18n carrier — collapse to the active locale (+ template-expand)
  // at THIS boundary, exactly as interpretKpi resolves label/unit/trendSub, so a raw
  // { ka, en } bag never reaches the KpiCard child.
  if (spec.type === 'static') return { value: resolveTemplate(spec.value, ctx), dir: spec.dir }
  // 'share' — num / denom × 100 as the trend line. Reads each ObsRef at ITS OWN
  // filter/time (the SAME getRef seam the `share` VALUE uses — DRY), so a trend
  // share and a value share resolve byte-identically. 'none' dir — a share is a
  // PROPORTION, not a rise/fall, so the card must render it WITHOUT a direction glyph
  // or an up/down/flat ("stable") label (that reads as a false trend); magnitude
  // percent ('pct') so it reads "53.1%".
  if (spec.type === 'share') {
    const getRef = (ref: ObsRef): number => {
      const rc = withFilter(ctx, ref.filter)
      return readMeasure(store, ref.measure, atTime(resolveTime(ref.time, rc), rc))
    }
    const n = getRef(spec.num)
    const d = getRef(spec.denom)
    return { value: getFormatter('pct')(d ? (n / d) * 100 : 0), dir: 'none' }
  }
  const c = withFilter(ctx, spec.filter)
  switch (spec.type) {
    case 'yoy': {
      const t    = resolveTime(spec.time, c)
      const cur  = readMeasure(store, spec.measure, atTime(t, c))
      const prev = readMeasure(store, spec.measure, atTime(t - 1, c))
      const pct  = prev ? (cur / prev - 1) * 100 : 0
      return { value: getFormatter('sign_pct')(pct), dir: trendDir(pct) }
    }
    case 'cagr': {
      const from  = resolveTime(spec.from, c)
      const to    = resolveTime(spec.to, c)
      const vFrom = readMeasure(store, spec.measure, atTime(from, c))
      const vTo   = readMeasure(store, spec.measure, atTime(to, c))
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

  // Every display field funnels through resolveTemplate — which collapses the
  // LocaleString carrier to the active locale (ctx.locale, generic) THEN template-
  // expands against ctx.dims. label/unit/trendSub are all i18n carriers; resolving
  // them at this ONE boundary keeps a raw { ka, en } bag from reaching the KpiCard.
  return {
    label:           resolveTemplate(spec.label, ctx),
    value:           formattedValue,
    // Unit is OPTIONAL — absent for a self-describing (percent) value. Resolve only
    // when authored; else undefined (KpiCard guards `{unit && …}`), NEVER pass
    // undefined into resolveTemplate (its carrier collapse would throw).
    unit:            spec.unit ? resolveTemplate(spec.unit, ctx) : undefined,
    color:           spec.color,
    trend:           trend?.dir ?? 'flat',
    trendValue:      trend?.value ?? '',
    trendSub:        spec.trendSub ? resolveTemplate(spec.trendSub, ctx) : '',
    // Displayed-slice preliminary (Law 9, year-aware): an explicit author override
    // always wins; otherwise derive from the SDMX OBS_STATUS of the observation(s)
    // this KPI actually reads at its pinned coordinate(s) — never dataset-wide.
    preliminary:     spec.preliminary === true || valueIsPreliminary(spec.value, ctx, store),
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
    // 'share' trend — warm num AND denom at their own pinned coordinates (mirrors
    // the `share` VALUE warm in fromValue, so warm === render for a trend share).
    if (spec.type === 'share') {
      const cn = withFilter(base, spec.num.filter)
      const cd = withFilter(base, spec.denom.filter)
      push(spec.num.measure,   cn, resolveTime(spec.num.time, cn))
      push(spec.denom.measure, cd, resolveTime(spec.denom.time, cd))
      return
    }
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