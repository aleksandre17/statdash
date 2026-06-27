// ── KPI Spec Engine ───────────────────────────────────────────────────
//
//  JSON-based KPI config system — Eurostat / ONS / IMF pattern.
//
//  KpiSpec  →  interpretKpi(spec, ctx, store)  →  KpiDef (resolved, feeds KpiCard)
//
//  KpiValueSpec types:
//    'point'  → single observation  (store.val)
//    'yoy'    → year-on-year %      (cur/prev − 1) × 100
//    'cagr'   → compound annual GR  (to/from)^(1/n) − 1
//    'share'  → ratio × 100         num / denom
//    'expr'   → derived indicator   D2 − D3  (add / subtract)
//

import type { CtxRef, DimVal }  from '../sdmx'
import type { DataStore, Requirement } from './store'
import { storeVal }            from './store'
import { resolveMeasureRef }    from './metric'
import type { SectionContext }  from '../core/context'
import { atTime, TIME_DIM }      from '../core/context'
import type { KpiDef }          from '../config/kpi'
import type { LocaleString }    from '../i18n/types'
import { resolveLocaleString }  from '../i18n/types'
import { getFormatter }         from './transform'
import { resolveTemplate }      from '../config/template'
import type { VisibilityExpr }  from '../config/visibility'
import { evalVisibility }       from '../config/visibility'

// ── Types ─────────────────────────────────────────────────────────────

export type FormatKey = 'mln_gel' | 'sign_pct' | 'pct' | 'decimal1' | 'decimal2'

type TimeRef = number | CtxRef

type DimFilter = Record<string, DimVal>

/** Self-contained observation reference: measure + optional dim overrides + optional time pin. */
export type ObsRef = { measure: string; filter?: DimFilter; time?: TimeRef }

export type KpiValueSpec =
  | { type: 'point';  measure: string; time?: TimeRef; format: FormatKey; abs?: boolean; filter?: DimFilter }
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  | { type: 'share';  num: ObsRef;     denom: ObsRef }
  | { type: 'expr';   op: 'subtract' | 'add'; codes: string[]; time?: TimeRef; format: FormatKey; filter?: DimFilter }

export type KpiTrendSpec =
  | { type: 'yoy';    measure: string; time?: TimeRef; filter?: DimFilter }
  | { type: 'cagr';   measure: string; from: TimeRef;  to: TimeRef;       filter?: DimFilter }
  | { type: 'static'; value: string;   dir: 'up' | 'down' | 'flat' }

export interface KpiSpec {
  id:              string
  /**
   * User-facing card label. LocaleString — plain string (legacy/single-locale)
   * OR { ka, en } bilingual map, consistent with every other label in the
   * platform (ColumnDef.label, RowSpec.label, HeroNode.title, LinkDef.label).
   * Resolved to the active locale by interpretKpi via SectionContext.locale,
   * then template-expanded against ctx.dims.
   */
  label:           LocaleString
  unit:            string
  color:           string
  /**
   * OPTIONAL perspective-scoped visibility — the declarative replacement for the
   * retired privileged `mode: 'year'|'range'|'both'` union (Law 1). A
   * `{op:'perspective-is', perspective:'year'}` shows the card only in the `year`
   * perspective; absent ⇒ the card shows in EVERY perspective (the old `'both'`).
   * Evaluated against `ctx.perspectiveState` by the SHARED `kpiVisible` predicate,
   * at BOTH the render (`interpretKpis`) and warm (`extractKpiRequirements`) sites.
   */
  when?:           VisibilityExpr
  value:           KpiValueSpec
  trend?:          KpiTrendSpec
  trendSub?:       string
  /** Mark data as preliminary / subject to revision — renders a "P" badge. */
  preliminary?:    boolean
  /** Short explanatory note rendered below the trend line. */
  note?:           string
  /** URL to methodology or metadata page — renders as an info-icon link on the card. */
  methodologyUrl?: string
}

// ── Internal helpers ──────────────────────────────────────────────────

/** Extract the primary measure code from a KpiValueSpec for provenance lookup. */
function primaryMeasure(spec: KpiValueSpec): string | undefined {
  if ('measure' in spec) return spec.measure          // point | yoy | cagr
  if ('num'     in spec) return spec.num.measure      // share
  if ('codes'   in spec) return spec.codes[0]         // expr — first operand
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
      const n     = vFrom && to > from ? ((vTo / vFrom) ** (1 / (to - from)) - 1) * 100 : 0
      return fmtKpiPct(n)
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
  }
}

// ── Trend computation ─────────────────────────────────────────────────

function resolveTrend(
  spec:  KpiTrendSpec,
  ctx:   SectionContext,
  store: DataStore,
): { value: string; dir: 'up' | 'down' | 'flat' } {
  if (spec.type === 'static') return { value: spec.value, dir: spec.dir }
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
//  `evalVisibility`'s filterParams arg is `ctx.dims` (a perspective-* op ignores it;
//  this keeps the predicate general for any future fr-reading `when`).
function kpiVisible(spec: KpiSpec, ctx: SectionContext): boolean {
  if (!spec.when) return true
  return evalVisibility(spec.when, ctx.dims, ctx.perspectiveState)
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

  // LocaleString → concrete string for the active locale, THEN template-expand
  // against ctx.dims. ctx.locale is the same seam ColumnDef.label resolution uses.
  const localizedLabel = resolveLocaleString(spec.label, ctx.locale ?? 'ka', 'ka')

  return {
    label:           resolveTemplate(localizedLabel, ctx),
    value:           formattedValue,
    unit:            spec.unit,
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
  specs:  KpiSpec[],
  ctx:    SectionContext,
  store:  DataStore,
): KpiDef[] {
  return specs
    .filter((s) => kpiVisible(s, ctx))
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
  specs: KpiSpec[],
  ctx:   SectionContext,
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
    if (!kpiVisible(spec, ctx)) continue   // SAME predicate as interpretKpis — warm === render
    fromValue(spec.value, ctx)
    if (spec.trend) fromTrend(spec.trend, ctx)
  }

  return out
}